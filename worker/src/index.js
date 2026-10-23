/* Openlingo backend on Cloudflare Workers + D1.
 *
 * Accounts are anonymous: the app derives an access token from a secret key that never leaves the phone and
 * sends it as "Authorization: Bearer <64 hex>". The database keeps only the SHA-256 of that token. Saves arrive
 * encrypted and are stored as they are. Friends find each other by a public friend code.
 *
 *   POST   /api/account               create the account for this token        -> 201 { friendCode }
 *   GET    /api/account               check the token                          -> { friendCode, savedAt }
 *   DELETE /api/account               delete account, save and friendships
 *   POST   /api/account/friend-code   replace the friend code                  -> { friendCode }
 *   GET    /api/save                  the encrypted save                       -> { savedAt, data } | 404
 *   PUT    /api/save                  { savedAt, data }                         -> 200 | 409 { savedAt } if the stored one is newer
 *   POST   /api/day                   { day: "YYYY-MM-DD" } last learning day; counts shared streaks
 *   GET    /api/friends                                                         -> { friends: [...], gifts }
 *   POST   /api/friends               { code } send a request (accepts one coming the other way) -> { id, status }
 *   POST   /api/friends/:id/accept
 *   DELETE /api/friends/:id           decline, withdraw or end a friendship
 *   POST   /api/friends/:id/gift      the daily free gift for a friend
 *   POST   /api/gifts/claim           open received gifts                      -> { gifts }
 *   POST   /api/report                content report from "Fehler melden", without any account reference
 *
 * Everything else (the language packs under /packs/) is served from the static assets in ./public.
 */

export const MAX_FRIENDS = 5;
const MAX_SAVE_CHARS = 700_000;          // about 512 KB of encrypted data in base64
const INACTIVE_DAYS = 365, REPORT_DAYS = 365;
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32, as in the app

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (status, error) => json({ error }, status);

const utcDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const addDays = (day, n) => utcDay(Date.parse(day + "T00:00:00Z") + n * 864e5);
const isDay = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && utcDay(Date.parse(s + "T00:00:00Z")) === s;

async function sha256(text) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(d, x => x.toString(16).padStart(2, "0")).join("");
}
function newFriendCode() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  const s = Array.from(b, x => CODE_ALPHABET[x & 31]).join("");
  return s.slice(0, 4) + "-" + s.slice(4);
}
const cleanCode = s => {
  const c = String(s || "").toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/[^0-9A-Z]/g, "");
  return c.length === 8 ? c.slice(0, 4) + "-" + c.slice(4) : "";
};

async function limited(env, binding, key) {
  const limiter = env[binding];
  if (!limiter || typeof limiter.limit !== "function") return false;
  const { success } = await limiter.limit({ key });
  return !success;
}
async function readJson(request, max = 1_000_000) {
  const text = await request.text();
  if (text.length > max) throw Object.assign(new Error("too large"), { status: 413 });
  try { return JSON.parse(text || "{}"); } catch (e) { throw Object.assign(new Error("bad json"), { status: 400 }); }
}

/** The account for the request's token, or null. Marks it as seen today (one write per day at most). */
async function authed(request, env) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get("Authorization") || "");
  if (!m) return null;
  const auth = await sha256(m[1]);
  const acc = await env.DB.prepare("SELECT * FROM accounts WHERE auth = ?").bind(auth).first();
  if (acc && acc.seen !== utcDay()) await env.DB.prepare("UPDATE accounts SET seen = ? WHERE id = ?").bind(utcDay(), acc.id).run();
  return acc ? Object.assign(acc, { auth }) : null;
}

/* ---------- Accounts and saves ---------- */
async function createAccount(request, env) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get("Authorization") || "");
  if (!m) return fail(401, "no_token");
  const auth = await sha256(m[1]);
  const existing = await env.DB.prepare("SELECT friend_code FROM accounts WHERE auth = ?").bind(auth).first();
  if (existing) return json({ friendCode: existing.friend_code, error: "exists" }, 409);
  for (let i = 0; i < 5; i++) {
    const code = newFriendCode();
    try {
      await env.DB.prepare("INSERT INTO accounts (auth, friend_code, created, seen) VALUES (?, ?, ?, ?)").bind(auth, code, utcDay(), utcDay()).run();
      return json({ friendCode: code }, 201);
    } catch (e) {
      if (!/UNIQUE/i.test(String(e && e.message))) throw e;
      if (await env.DB.prepare("SELECT 1 FROM accounts WHERE auth = ?").bind(auth).first()) return fail(409, "exists");
    }
  }
  return fail(500, "no_code");
}
async function deleteAccount(acc, env) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM friendships WHERE a = ? OR b = ?").bind(acc.id, acc.id),
    env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(acc.id),
  ]);
  return json({ ok: true });
}
async function replaceFriendCode(acc, env) {
  for (let i = 0; i < 5; i++) {
    const code = newFriendCode();
    try {
      await env.DB.prepare("UPDATE accounts SET friend_code = ? WHERE id = ?").bind(code, acc.id).run();
      return json({ friendCode: code });
    } catch (e) { if (!/UNIQUE/i.test(String(e && e.message))) throw e; }
  }
  return fail(500, "no_code");
}
async function putSave(acc, request, env) {
  const body = await readJson(request);
  if (typeof body.data !== "string" || !body.data || typeof body.savedAt !== "number" || !Number.isFinite(body.savedAt)) return fail(400, "bad_save");
  if (body.data.length > MAX_SAVE_CHARS) return fail(413, "too_large");
  if (!/^[A-Za-z0-9+/=]+$/.test(body.data)) return fail(400, "bad_save");
  if (acc.saved_at && acc.saved_at > body.savedAt) return json({ error: "newer", savedAt: acc.saved_at }, 409);
  await env.DB.prepare("UPDATE accounts SET save = ?, saved_at = ? WHERE id = ?").bind(body.data, Math.round(body.savedAt), acc.id).run();
  return json({ ok: true });
}

/* ---------- Learning days and shared streaks ---------- */
async function reportDay(acc, request, env) {
  const { day } = await readJson(request, 1000);
  // The phone's local date may run a day ahead of or behind UTC.
  if (!isDay(day) || day < addDays(utcDay(), -2) || day > addDays(utcDay(), 1)) return fail(400, "bad_day");
  if (acc.last_day && day <= acc.last_day) {
    if (day === acc.last_day || day === acc.prev_day) return json({ ok: true });
  }
  const [last, prev] = !acc.last_day || day > acc.last_day ? [day, acc.last_day] : [acc.last_day, day > (acc.prev_day || "") ? day : acc.prev_day];
  const stmts = [env.DB.prepare("UPDATE accounts SET last_day = ?, prev_day = ? WHERE id = ?").bind(last, prev, acc.id)];
  // A shared day: the friend also learned on `day`. The streak grows if the last shared day was the day before.
  const { results } = await env.DB.prepare(`SELECT f.id, f.streak, f.streak_day FROM friendships f JOIN accounts o ON o.id = CASE WHEN f.a = ? THEN f.b ELSE f.a END
    WHERE (f.a = ? OR f.b = ?) AND f.accepted = 1 AND (o.last_day = ? OR o.prev_day = ?)`).bind(acc.id, acc.id, acc.id, day, day).all();
  for (const f of results) {
    if (f.streak_day && f.streak_day >= day) continue;
    const streak = f.streak_day === addDays(day, -1) ? f.streak + 1 : 1;
    stmts.push(env.DB.prepare("UPDATE friendships SET streak = ?, streak_day = ? WHERE id = ?").bind(streak, day, f.id));
  }
  await env.DB.batch(stmts);
  return json({ ok: true });
}

/* ---------- Friends ---------- */
async function friendCount(env, id) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM friendships WHERE a = ? OR b = ?").bind(id, id).first();
  return r ? r.n : 0;
}
async function listFriends(acc, env) {
  const { results } = await env.DB.prepare(`SELECT f.*, o.friend_code AS code, o.last_day AS o_last FROM friendships f
    JOIN accounts o ON o.id = CASE WHEN f.a = ? THEN f.b ELSE f.a END WHERE f.a = ? OR f.b = ? ORDER BY f.id`).bind(acc.id, acc.id, acc.id).all();
  const today = utcDay();
  let gifts = 0;
  const friends = results.map(f => {
    const mine = f.a === acc.id;
    gifts += mine ? f.gifts_for_a : f.gifts_for_b;
    const status = f.accepted ? "accepted" : mine ? "outgoing" : "incoming";
    return { id: f.id, status, code: f.code,
      streak: f.accepted ? f.streak : 0, streakDay: f.accepted ? f.streak_day : null, lastDay: f.accepted ? f.o_last : null,
      canGift: !!f.accepted && (mine ? f.gift_a : f.gift_b) !== today };
  });
  return json({ friends, gifts });
}
async function requestFriend(acc, request, env) {
  const code = cleanCode((await readJson(request, 1000)).code);
  if (!code) return fail(400, "bad_code");
  const other = await env.DB.prepare("SELECT id, last_day FROM accounts WHERE friend_code = ?").bind(code).first();
  if (!other) return fail(404, "not_found");
  if (other.id === acc.id) return fail(400, "self");
  const existing = await env.DB.prepare("SELECT * FROM friendships WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)").bind(acc.id, other.id, other.id, acc.id).first();
  if (existing) {
    // A request the other way round is accepted: both want it.
    if (!existing.accepted && existing.b === acc.id) return accept(acc, existing, env);
    return fail(409, "exists");
  }
  if (await friendCount(env, acc.id) >= MAX_FRIENDS || await friendCount(env, other.id) >= MAX_FRIENDS) return fail(409, "limit");
  const r = await env.DB.prepare("INSERT INTO friendships (a, b) VALUES (?, ?) RETURNING id").bind(acc.id, other.id).first();
  return json({ id: r.id, status: "outgoing" });
}
async function friendship(acc, env, id) {
  const f = await env.DB.prepare("SELECT * FROM friendships WHERE id = ? AND (a = ? OR b = ?)").bind(id, acc.id, acc.id).first();
  return f || null;
}
async function accept(acc, f, env) {
  if (f.b !== acc.id) return fail(403, "not_yours");
  if (!f.accepted) {
    // If both already learned today, the shared streak starts right away.
    const a = await env.DB.prepare("SELECT last_day FROM accounts WHERE id = ?").bind(f.a).first();
    const shared = a && a.last_day && a.last_day === acc.last_day ? acc.last_day : null;
    await env.DB.prepare("UPDATE friendships SET accepted = 1, streak = ?, streak_day = ? WHERE id = ?").bind(shared ? 1 : 0, shared, f.id).run();
  }
  return json({ id: f.id, status: "accepted" });
}
async function gift(acc, f, env) {
  if (!f.accepted) return fail(409, "not_friends");
  const today = utcDay(), mine = f.a === acc.id;
  if ((mine ? f.gift_a : f.gift_b) === today) return fail(409, "already_sent");
  await env.DB.prepare(mine ? "UPDATE friendships SET gift_a = ?, gifts_for_b = MIN(gifts_for_b + 1, 30) WHERE id = ?"
    : "UPDATE friendships SET gift_b = ?, gifts_for_a = MIN(gifts_for_a + 1, 30) WHERE id = ?").bind(today, f.id).run();
  return json({ ok: true });
}
async function claimGifts(acc, env) {
  const r = await env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN a = ? THEN gifts_for_a ELSE gifts_for_b END), 0) AS n FROM friendships WHERE a = ? OR b = ?")
    .bind(acc.id, acc.id, acc.id).first();
  await env.DB.batch([
    env.DB.prepare("UPDATE friendships SET gifts_for_a = 0 WHERE a = ?").bind(acc.id),
    env.DB.prepare("UPDATE friendships SET gifts_for_b = 0 WHERE b = ?").bind(acc.id),
  ]);
  return json({ gifts: r ? r.n : 0 });
}

/* ---------- Content reports ---------- */
async function report(request, env) {
  const b = await readJson(request, 8000);
  const t = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  if (!t(b.task, 1) || !t(b.course, 1)) return fail(400, "bad_report");
  await env.DB.prepare("INSERT INTO reports (day, course, pack, unit, item, type, task, expected, given, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(utcDay(), t(b.course, 8), t(b.pack, 16), t(b.unit, 40), t(b.item, 60), t(b.type, 20), t(b.task, 600), t(b.expected, 600), t(b.given, 600), t(b.note, 500)).run();
  return json({ ok: true });
}

/* ---------- Router ---------- */
async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname.replace(/\/+$/, ""), method = request.method;
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (!path.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(request) : fail(404, "not_found");
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  if (await limited(env, "LIMIT_API", ip)) return fail(429, "rate_limited");
  const strict = (method === "POST" && (path === "/api/account" || path === "/api/friends" || path === "/api/report"));
  if (strict && await limited(env, "LIMIT_STRICT", path + ":" + ip)) return fail(429, "rate_limited");

  if (path === "/api/ping") return json({ app: "openlingo", ok: true });
  if (path === "/api/report" && method === "POST") return report(request, env);
  if (path === "/api/account" && method === "POST") return createAccount(request, env);

  const acc = await authed(request, env);
  if (!acc) return fail(401, "unknown_account");
  if (path === "/api/account") {
    if (method === "GET") return json({ friendCode: acc.friend_code, savedAt: acc.saved_at || 0 });
    if (method === "DELETE") return deleteAccount(acc, env);
  }
  if (path === "/api/account/friend-code" && method === "POST") return replaceFriendCode(acc, env);
  if (path === "/api/save") {
    if (method === "GET") return acc.save ? json({ savedAt: acc.saved_at || 0, data: acc.save }) : fail(404, "no_save");
    if (method === "PUT") return putSave(acc, request, env);
  }
  if (path === "/api/day" && method === "POST") return reportDay(acc, request, env);
  if (path === "/api/friends") {
    if (method === "GET") return listFriends(acc, env);
    if (method === "POST") return requestFriend(acc, request, env);
  }
  if (path === "/api/gifts/claim" && method === "POST") return claimGifts(acc, env);
  const m = /^\/api\/friends\/(\d+)(\/accept|\/gift)?$/.exec(path);
  if (m) {
    const f = await friendship(acc, env, Number(m[1]));
    if (!f) return fail(404, "not_found");
    if (!m[2] && method === "DELETE") { await env.DB.prepare("DELETE FROM friendships WHERE id = ?").bind(f.id).run(); return json({ ok: true }); }
    if (m[2] === "/accept" && method === "POST") return accept(acc, f, env);
    if (m[2] === "/gift" && method === "POST") return gift(acc, f, env);
  }
  return fail(404, "not_found");
}

/** Daily clean-up: accounts not used for a year (with their friendships) and old reports. */
export async function cleanUp(env, now = Date.now()) {
  const cutoff = utcDay(now - INACTIVE_DAYS * 864e5), reportCutoff = utcDay(now - REPORT_DAYS * 864e5);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM friendships WHERE a IN (SELECT id FROM accounts WHERE seen < ?) OR b IN (SELECT id FROM accounts WHERE seen < ?)").bind(cutoff, cutoff),
    env.DB.prepare("DELETE FROM accounts WHERE seen < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM reports WHERE day < ?").bind(reportCutoff),
  ]);
}

export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (e) {
      if (e && e.status) return fail(e.status, e.status === 413 ? "too_large" : "bad_request");
      console.error(e);
      return fail(500, "server_error");
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(cleanUp(env)); },
};
