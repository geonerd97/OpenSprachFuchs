// Backend test: runs the Cloudflare Worker (worker/src/index.js) against an in-memory SQLite database that
// stands in for D1, and drives it through the real app code (accounts, encrypted saves, friends, streaks, gifts).
// Run: node test/backend-test.js   (Node 22.5+, for node:sqlite; exit code 1 on errors)
process.removeAllListeners("warning"); // node:sqlite is still marked experimental
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { loadGame, ROOT } = require("./harness");

let errors = 0;
const fail = (...a) => { errors++; console.log("FEHLER", ...a); };
const ok = (cond, ...msg) => { if (!cond) fail(...msg); };

/* A small D1 look-alike: prepare().bind().first()/all()/run() and batch(), backed by node:sqlite. */
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(path.join(ROOT, "worker", "schema.sql"), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
    _run: () => db.prepare(sql).run(...args),
  });
  return { db, prepare: sql => stmt(sql), batch: async list => { db.exec("BEGIN"); try { for (const s of list) s._run(); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; } } };
}

(async () => {
  const worker = (await import(path.join(ROOT, "worker", "src", "index.js"))).default;
  const { cleanUp } = await import(path.join(ROOT, "worker", "src", "index.js"));
  const DB = fakeD1();
  const env = { DB };
  const call = (url, opts = {}) => worker.fetch(new Request(url, opts), env);
  // The app's fetch goes straight into the worker.
  const appFetch = (url, opts = {}) => call(url, Object.assign({}, opts, { signal: undefined }));
  const B = "https://opensprachfuchs.YOUR-SUBDOMAIN.workers.dev/";

  /* ---------- Raw API ---------- */
  ok((await call(B + "api/account")).status === 401, "ohne Token kein Zugriff");
  const tok = "a".repeat(64), auth = { Authorization: "Bearer " + tok };
  let r = await call(B + "api/account", { method: "POST", headers: auth });
  ok(r.status === 201 && /^[0-9A-Z]{4}-[0-9A-Z]{4}$/.test((await r.json()).friendCode), "Konto anlegen");
  ok((await call(B + "api/account", { method: "POST", headers: auth })).status === 409, "Konto doppelt angelegt");
  const row = DB.db.prepare("SELECT * FROM accounts").get();
  ok(row.auth !== tok && row.auth.length === 64, "Token im Klartext gespeichert");
  r = await call(B + "api/save", { method: "PUT", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ savedAt: 5, data: "QUJD" }) });
  ok(r.status === 200, "Speichern", r.status);
  r = await call(B + "api/save", { method: "PUT", headers: auth, body: JSON.stringify({ savedAt: 4, data: "QUJD" }) });
  ok(r.status === 409, "älterer Spielstand überschreibt neueren");
  r = await call(B + "api/save", { method: "PUT", headers: auth, body: JSON.stringify({ savedAt: 9, data: "x".repeat(800000) }) });
  ok(r.status === 413, "zu großer Spielstand angenommen", r.status);
  r = await call(B + "api/report", { method: "POST", body: JSON.stringify({ course: "en", task: "hallo", expected: "hello", note: "test" }) });
  ok(r.status === 200 && DB.db.prepare("SELECT COUNT(*) n FROM reports").get().n === 1, "Fehlermeldung");
  ok(!Object.keys(DB.db.prepare("SELECT * FROM reports").get()).some(k => /account|auth|ip/i.test(k)), "Meldung mit Kontobezug");
  ok((await call(B + "api/day", { method: "POST", headers: auth, body: JSON.stringify({ day: "2001-01-01" }) })).status === 400, "uralter Lerntag angenommen");
  ok((await call(B + "api/account", { method: "OPTIONS" })).headers.get("Access-Control-Allow-Origin") === "*", "CORS fehlt");
  ok((await call(B + "api/account", { method: "DELETE", headers: auth })).status === 200 && !DB.db.prepare("SELECT * FROM accounts").get(), "Konto löschen");

  /* ---------- Through the app: two players on their phones ---------- */
  const anna = loadGame({}, { fetch: appFetch });
  await anna.createAccount();
  ok(anna.acct.status === "ok" && /^([0-9A-Z]{4}-){3}[0-9A-Z]{4}$/.test(anna.acct.key), "App: Konto anlegen", anna.acct.status, anna.acct.key);
  anna.st.xp = 123; anna.st.friends = {};
  anna.st.savedAt = Date.now(); await anna.pushSave();
  const stored = DB.db.prepare("SELECT save FROM accounts").get().save;
  ok(stored && !stored.includes("123") && !Buffer.from(stored, "base64").toString("latin1").includes('"xp"'), "Spielstand unverschlüsselt auf dem Server");

  // Key safety: no reminder right away, one after 3 days, the last four characters prove the key; QR code in the account dialog.
  ok(!anna.keyReminderDue(), "Schlüssel-Erinnerung zu früh");
  anna.st.keyCreated = "2020-01-01";
  ok(anna.keyReminderDue(), "Schlüssel-Erinnerung nach 3 Tagen fehlt");
  anna.ui.tab = "path"; anna.view = "home"; ok(anna.homeHTML().includes("Ist dein Schlüssel sicher?"), "Erinnerung nicht im Lernweg");
  ok(!anna.checkKeyEnd("XXXX") && !anna.st.keyChecked, "Falsche Zeichen angenommen");
  ok(anna.checkKeyEnd(anna.acct.key.slice(-4).toLowerCase()) && anna.st.keyChecked && !anna.keyReminderDue(), "Richtige Zeichen abgelehnt");
  ok(anna.qrMatrix(anna.acct.key).length === 21 && anna.qrSVG(anna.acct.key).startsWith("<svg"), "QR-Code fehlt");
  anna.ui.modal = "account"; anna.ui.showQR = true; ok(anna.modalHTML().includes('class="qr"'), "QR-Code nicht im Konto-Dialog"); anna.ui.modal = null;

  // Same key on a new phone: the encrypted save comes back. Typing variants of the key are accepted.
  const anna2 = loadGame({}, { fetch: appFetch, store: {} , packs: true });
  anna2.st.xp = 0;
  ok(await anna2.signIn(anna.acct.key.toLowerCase().replace(/-/g, " ").replace(/0/g, "o")), "App: Anmelden mit Schlüssel", anna2.acct.note);
  ok(anna2.st.xp === 123, "App: Spielstand nicht übernommen", anna2.st.xp);
  ok(anna2.st.keyChecked, "Anmelden mit Schlüssel zählt nicht als geprüft");
  // Issues #16, #17: both phones change the progress before they meet the backup (e.g. a phone that was off for a while
  // saves on start). Nothing may get lost: the saves are merged instead of one replacing the other.
  {
    const t = Date.now();
    const c1 = anna.cs("en"); c1.progress = { basics: 5 }; c1.seen = { "basics.w01": 1 };
    anna.st.myName = "Anna"; anna.st.friends = { f1: "Ben" }; anna.st.savedAt = t + 1000; await anna.pushSave();
    const c2 = anna2.cs("en"); c2.progress = { basics: 2, food: 1 }; c2.seen = { "food.w01": 1 };
    anna2.st.friends = { f2: "Cleo" }; anna2.st.xp = 500; anna2.st.savedAt = t + 2000; // the stale phone saves on start
    await anna2.pullSave(); await anna2.pushSave();
    const m = anna2.st, mc = m.courses.en;
    ok(mc.progress.basics === 5 && mc.progress.food === 1 && mc.seen["basics.w01"] && mc.seen["food.w01"], "Zusammenführen: Fortschritt verloren", JSON.stringify(mc.progress));
    ok(m.myName === "Anna" && m.friends.f1 === "Ben" && m.friends.f2 === "Cleo" && m.xp === 500, "Zusammenführen: Namen verloren", JSON.stringify(m.friends), m.myName);
    await anna.pullSave();
    ok(anna.st.courses.en.progress.food === 1 && anna.st.courses.en.progress.basics === 5 && anna.st.friends.f2 === "Cleo" && anna.st.myName === "Anna", "Zusammengeführter Stand kommt nicht aufs erste Handy");
    // Only one side changed: it is taken over as it is (a reset of a course on one phone stays a reset).
    delete anna.st.courses.en.progress.food; anna.st.savedAt = Date.now() + 5000; await anna.pushSave();
    await anna2.pullSave();
    ok(!anna2.st.courses.en.progress.food && anna2.st.courses.en.progress.basics === 5, "Änderung von nur einem Gerät nicht übernommen");
    // A backup restored to an older state (database time travel) is merged in, not overwritten by the phone.
    const before = DB.db.prepare("SELECT save, saved_at FROM accounts").all().find(r => r.saved_at);
    const old = { s: before.save, at: before.saved_at };
    anna2.cs("en").progress.drinks = 3; anna2.st.savedAt = Date.now() + 9000; await anna2.pushSave();
    ok(DB.db.prepare("UPDATE accounts SET save = ?, saved_at = ? WHERE saved_at = ?").run(old.s, old.at - 100, anna2.st.savedAt).changes === 1, "Test: Sicherung nicht zurückgesetzt");
    const c3 = anna.cs("en"); c3.progress = {}; anna.st.savedAt = Date.now() + 9500; // the phone that lost everything
    await anna.pullSave();
    ok(anna.st.courses.en.progress.basics === 5, "Wiederhergestellte Sicherung überschrieben", JSON.stringify(anna.st.courses.en.progress));
  }
  const wrong = loadGame({}, { fetch: appFetch });
  ok(!(await wrong.signIn("ZZZZ-ZZZZ-ZZZZ-ZZZZ")) && /kein Konto/.test(wrong.acct.note), "App: falscher Schlüssel angenommen");
  ok(!wrong.normalizeKey("ABC") && wrong.normalizeKey("k7qm 4xd2 pl9a h3tv") === "K7QM-4XD2-P19A-H3TV", "Schlüssel normalisieren");

  // Friends: Ben sends Anna a request with a local name, Anna accepts. Max. 5 friends.
  const ben = loadGame({}, { fetch: appFetch });
  await ben.createAccount();
  ok(await ben.addFriend(anna.acct.friendCode.toLowerCase(), "Anna"), "App: Freundschaftsanfrage", ben.friends.note);
  ok(!(await ben.addFriend(ben.acct.friendCode, "")), "App: sich selbst hinzufügen");
  await anna.loadFriends();
  const req = anna.friends.list[0];
  ok(req && req.status === "incoming" && req.code === ben.acct.friendCode, "Anfrage kommt nicht an");
  await anna.acceptFriend(req.id, "Ben");
  await ben.loadFriends();
  ok(ben.friends.list[0].status === "accepted" && ben.st.friends[ben.friends.list[0].id] === "Anna", "Freundschaft nicht angenommen oder Name fehlt");
  ok(!JSON.stringify(DB.db.prepare("SELECT * FROM friendships").all()).includes("Anna"), "Freundesname auf dem Server");

  // Shared streak: both learn today -> 1; yesterday was shared -> grows.
  const today = anna.st.day || new Date().toISOString().slice(0, 10);
  const local = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const t = new Date(), y = new Date(); y.setDate(y.getDate() - 1);
  for (const p of [anna, ben]) { p.st.lastDay = local(y); await p.reportLearningDay(); }
  for (const p of [anna, ben]) { p.st.lastDay = local(t); await p.reportLearningDay(); }
  await anna.loadFriends();
  ok(anna.pairStreak(anna.friends.list[0]) === 2, "Gemeinsame Serie falsch", JSON.stringify(anna.friends.list[0]));
  ok(anna.friends.list[0].lastDay === local(t), "Lerntag des Freundes fehlt");

  // Gifts: once a day per friend, 5 gems each.
  await ben.loadFriends();
  ok(ben.friends.list[0].canGift, "Geschenk nicht möglich");
  await ben.sendGift(ben.friends.list[0].id);
  await ben.sendGift(ben.friends.list[0].id);
  ok(/schon ein Geschenk/.test(ben.friends.note), "Zweites Geschenk am selben Tag");
  await anna.loadFriends();
  const gems = anna.st.gems;
  ok(anna.friends.gifts === 1, "Geschenk kommt nicht an", anna.friends.gifts);
  await anna.claimGifts();
  ok(anna.st.gems === gems + 5 && anna.friends.gifts === 0, "Geschenk nicht eingelöst", anna.st.gems - gems);

  // QR code for friends: Anna's own name only travels in her link; Dora scans it, the app opens "Freund hinzufügen" filled in.
  anna.setMyName("  Anna <Lü>  ");
  const link = anna.friendLink();
  ok(anna.st.myName === "Anna Lü" && link.endsWith("/f#" + anna.acct.friendCode + "/Anna%20L%C3%BC"), "Freundes-Link falsch", link);
  ok(anna.qrSVG(link, 240).includes("<svg"), "QR-Code für den Freundes-Link fehlt");
  const viaPage = anna.parseFriendLink("https://x.example/f?c=" + anna.acct.friendCode.toLowerCase() + "&n=Anna%20L%C3%BC");
  ok(viaPage && viaPage.code === anna.acct.friendCode && viaPage.name === "Anna Lü", "Link von der Webseite nicht erkannt", JSON.stringify(viaPage));
  ok(!anna.parseFriendLink("https://x.example/other#ABCD-EFGH") && !anna.parseFriendLink("kein link"), "Fremder Link als Freundes-Link erkannt");
  const dora = loadGame({}, { fetch: appFetch });
  await dora.createAccount();
  dora.view = "welcome"; dora.handleFriendLink(link);
  ok(dora.ui.modal !== "addfriend", "Dialog mitten im Willkommen-Bildschirm");
  dora.view = "home"; dora.render();
  ok(dora.ui.modal === "addfriend" && dora.ui.tab === "friends" && dora.modalHTML().includes('value="Anna Lü"') && dora.modalHTML().includes(anna.acct.friendCode), "Freund hinzufügen nicht vorausgefüllt");
  ok(await dora.addFriend(dora.ui.addPrefill.code, dora.ui.addPrefill.name), "Anfrage über QR-Code", dora.friends.note);
  ok(Object.values(dora.st.friends).includes("Anna Lü"), "Name aus dem QR-Code nicht übernommen");
  ok(!JSON.stringify(DB.db.prepare("SELECT * FROM accounts").all()).includes("Anna"), "Eigener Name auf dem Server");
  anna.handleFriendLink(link); anna.view = "home"; anna.render();
  ok(anna.ui.modal !== "addfriend" && /eigener QR-Code/.test(anna.friends.note), "Eigener QR-Code nicht erkannt");
  // Without the app the link shows a page from the Worker; assetlinks.json lets Android open the app directly.
  const page = await call(B + "f");
  ok(page.status === 200 && (await page.text()).includes("intent://"), "Seite für Freundes-Links fehlt");
  const al = await (await call(B + ".well-known/assetlinks.json")).json();
  ok(al[0].target.package_name === "de.opensprachfuchs.app" && /^89:96:52:44/.test(al[0].target.sha256_cert_fingerprints[0]), "assetlinks.json falsch");

  // Friend limit (100): Anna's list is filled up directly in the database, then two more players ask.
  const MAX_FRIENDS = (await import(path.join(ROOT, "worker", "src", "index.js"))).friendLimit();
  ok(MAX_FRIENDS === 100, "Freundeslimit ist nicht 100", MAX_FRIENDS);
  const annaId = DB.db.prepare("SELECT id FROM accounts WHERE friend_code = ?").get(anna.acct.friendCode).id;
  const have = DB.db.prepare("SELECT COUNT(*) n FROM friendships WHERE a = ? OR b = ?").get(annaId, annaId).n;
  for (let i = have; i < MAX_FRIENDS - 1; i++) {
    const id = DB.db.prepare("INSERT INTO accounts (auth, friend_code, created, seen) VALUES (?, ?, '2026-01-01', '2026-01-01') RETURNING id").get("x".repeat(60) + String(i).padStart(4, "0"), "T" + String(i).padStart(3, "0") + "-TEST").id;
    DB.db.prepare("INSERT INTO friendships (a, b, accepted) VALUES (?, ?, 1)").run(id, annaId);
  }
  const others = [];
  for (let i = 0; i < 2; i++) { const o = loadGame({}, { fetch: appFetch }); await o.createAccount(); others.push(o); }
  ok(await others[0].addFriend(anna.acct.friendCode, ""), "100. Freund abgelehnt", others[0].friends.note);
  ok(!(await others[1].addFriend(anna.acct.friendCode, "")) && /Mehr als 100/.test(others[1].friends.note), "Freundeslimit greift nicht", others[1].friends.note);

  // Ending a friendship removes it on both sides and drops the local name.
  await ben.removeFriend(ben.friends.list[0].id);
  await anna.loadFriends(); await ben.loadFriends();
  ok(!ben.friends.list.length && !Object.keys(ben.st.friends).length && !anna.friends.list.some(f => f.code === ben.acct.friendCode), "Freundschaft nicht beendet");

  // Deleting the account removes everything on the server, the app keeps playing without account.
  const before = DB.db.prepare("SELECT COUNT(*) n FROM friendships").get().n;
  const annas = DB.db.prepare("SELECT COUNT(*) n FROM friendships WHERE a = ? OR b = ?").get(annaId, annaId).n;
  await anna.deleteAccount();
  ok(anna.acct.status === "none" && !anna.store["opensprachfuchs-account"], "App: Konto nicht vom Gerät entfernt");
  ok(DB.db.prepare("SELECT COUNT(*) n FROM friendships").get().n === before - annas && annas > 0, "Freundschaften nach Löschen übrig");
  ok(!(await wrong.signIn(anna.acct.key || "K7QM-4XD2-PL9A-H3TV")), "Gelöschtes Konto noch nutzbar");

  // Offline: an account made without connection is registered on the next start.
  let online = false;
  const carl = loadGame({}, { fetch: (u, o) => (online ? appFetch(u, o) : Promise.reject(new Error("offline"))) });
  await carl.createAccount();
  ok(carl.acct.pending && carl.acct.status === "offline", "Offline-Konto");
  online = true;
  await carl.initAccount();
  ok(carl.acct.status === "ok" && !carl.acct.pending && carl.acct.friendCode, "Offline-Konto später nicht angelegt");

  // Content reports from the queue.
  carl.st.reportQueue = [{ course: "en", task: "x", expected: "y", given: "z", note: "" }];
  await carl.sendReports();
  ok(!carl.st.reportQueue.length, "Meldungen nicht verschickt");

  // Packs: the index from the backend, updates detected by checksum, and the bundled copy when offline.
  const idx = { packs: [{ code: "en", name: "Englisch", short: "EN", color: "#2456E8", note: "", units: 20, words: 1, size: 1, sha256: "neu" }] };
  const packApp = loadGame({}, { fetch: async u => (String(u).endsWith("index.json") ? new Response(JSON.stringify(idx)) : new Response("nope", { status: 404 })) });
  await packApp.fetchPackIndex();
  ok(packApp.PACK_INDEX.remote && packApp.packUpdates().includes("en"), "Paket-Update nicht erkannt");
  const offline = loadGame({}, { fetch: async u => { if (String(u).startsWith("http")) throw new Error("offline"); return new Response(JSON.stringify(idx)); } });
  await offline.fetchPackIndex();
  ok(offline.PACK_INDEX.base === "packs/" && !offline.packUpdates().length, "Offline: mitgelieferte Pakete nicht genutzt");

  // Clean-up: accounts unused for a year disappear.
  DB.db.prepare("UPDATE accounts SET seen = '2000-01-01' WHERE friend_code = ?").run(carl.acct.friendCode);
  await cleanUp(env);
  ok(!DB.db.prepare("SELECT 1 FROM accounts WHERE friend_code = ?").get(carl.acct.friendCode), "Inaktives Konto nicht gelöscht");

  console.log(`Backend-Test: ${errors} Fehler`);
  process.exit(errors ? 1 : 0);
})().catch(e => { console.log("ABBRUCH", e); process.exit(1); });
