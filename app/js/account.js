"use strict";
/* ---------- Account and encrypted backup ----------
   An account is nothing but a random key such as K7QM-4XD2-PL9A-H3TV: 16 characters of Crockford Base32, 80 bits.
   The key never leaves the device. PBKDF2 turns it into
     - an access token, sent as "Authorization: Bearer …" (the server stores only its SHA-256), and
     - an AES-GCM key that encrypts the whole save before upload.
   So the server holds no names and cannot read anyone's progress; nicknames for friends travel inside the encrypted save. */
const ACCOUNT_KEY = "opensprachfuchs-account";
const KEY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const KDF_SALT = "opensprachfuchs/v1", KDF_ROUNDS = 150000;
const acct = { key: "", pending: false, token: "", aes: null, friendCode: "", status: "none", busy: false, again: false, timer: 0, note: "" };
// status: "none" (no account, progress only on this device), "ok", "offline" (backend unreachable), "gone" (deleted elsewhere)

const enc = s => new TextEncoder().encode(s);
const hex = b => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
const b64 = b => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16)); // 256 is a multiple of 32, so every character is equally likely
  return Array.from(bytes, x => KEY_ALPHABET[x & 31]).join("").match(/.{4}/g).join("-");
}
/** Accepts what people type: any case, spaces or dashes, O for 0 and I/L for 1. Returns "" if it is no key. */
function normalizeKey(input) {
  const s = String(input || "").toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/[^0-9A-Z]/g, "");
  if (s.length !== 16 || [...s].some(c => !KEY_ALPHABET.includes(c))) return "";
  return s.match(/.{4}/g).join("-");
}
async function deriveKeys(key) {
  const base = await crypto.subtle.importKey("raw", enc(key.replace(/-/g, "")), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc(KDF_SALT), iterations: KDF_ROUNDS }, base, 512));
  const aes = await crypto.subtle.importKey("raw", bits.slice(32), "AES-GCM", false, ["encrypt", "decrypt"]);
  return { token: hex(bits.slice(0, 32)), aes };
}
/* Save format: base64 of [version][12-byte IV][AES-GCM ciphertext]; version 1 is gzip-compressed JSON, 2 plain JSON. */
async function pipeBytes(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
async function encryptState(obj, aes) {
  let data = enc(JSON.stringify(obj)), version = 2;
  if (typeof CompressionStream === "function") { data = await pipeBytes(data, new CompressionStream("gzip")); version = 1; }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, data));
  const out = new Uint8Array(13 + ct.length);
  out[0] = version; out.set(iv, 1); out.set(ct, 13);
  return b64(out);
}
async function decryptState(text, aes) {
  const raw = unb64(text);
  let data = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(1, 13) }, aes, raw.slice(13)));
  if (raw[0] === 1) data = await pipeBytes(data, new DecompressionStream("gzip"));
  return JSON.parse(new TextDecoder().decode(data));
}

/** Calls the backend API. Resolves to { status, data }; status 0 means unreachable. */
async function api(method, path, body, auth = true) {
  const headers = {};
  if (auth && acct.token) headers.Authorization = "Bearer " + acct.token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const r = await fetchTimeout(BACKEND + "api/" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
    let data = null;
    try { data = await r.json(); } catch (e) {}
    return { status: r.status, data: data || {} };
  } catch (e) { return { status: 0, data: {} }; }
}

function storeAccount() {
  try {
    if (acct.key) localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ key: acct.key, pending: acct.pending }));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch (e) {}
}
function forgetAccount() {
  Object.assign(acct, { key: "", pending: false, token: "", aes: null, friendCode: "", status: "none" });
  Object.assign(friends, { list: [], gifts: 0, loaded: false });
  storeAccount();
}
async function useKey(key, pending) {
  Object.assign(acct, { key, pending, friendCode: "" });
  const k = await deriveKeys(key);
  acct.token = k.token; acct.aes = k.aes;
  storeAccount();
}
/** Registers the account on the backend if that has not happened yet (e.g. the key was made offline). */
async function ensureRegistered() {
  if (!acct.pending) return true;
  const r = await api("POST", "account");
  if (r.status === 201 || r.status === 409) { acct.pending = false; acct.friendCode = r.data.friendCode || ""; storeAccount(); return true; }
  acct.status = "offline";
  return false;
}
/** A new account: a fresh key, registered right away when online, otherwise on the next start. */
async function createAccount() {
  await useKey(newKey(), true);
  st.keyCreated = dayStr(); st.keyChecked = false; save();
  acct.status = "offline";
  if (await ensureRegistered()) { acct.status = "ok"; await pushSave(); }
}
/** Signs in on this device with an existing key; the backed-up progress replaces what is on the device. */
async function signIn(input) {
  const key = normalizeKey(input);
  if (!key) { acct.note = "Ein Schlüssel hat 16 Zeichen, zum Beispiel K7QM-4XD2-PL9A-H3TV."; return false; }
  acct.note = "Prüfe den Schlüssel …"; render();
  const before = { key: acct.key, pending: acct.pending, token: acct.token, aes: acct.aes };
  await useKey(key, false);
  const r = await api("GET", "account");
  if (r.status !== 200) {
    Object.assign(acct, before); storeAccount();
    acct.note = r.status === 401 || r.status === 404 ? "Zu diesem Schlüssel gibt es kein Konto. Stimmt jedes Zeichen?" : "Keine Verbindung. Bitte versuch es gleich noch einmal.";
    return false;
  }
  acct.friendCode = r.data.friendCode || ""; acct.status = "ok"; acct.note = "";
  const s = await api("GET", "save");
  if (s.status === 200 && s.data.data) {
    try { adopt(await decryptState(s.data.data, acct.aes), s.data.savedAt); } catch (e) { acct.note = "Der gesicherte Spielstand ließ sich nicht entschlüsseln."; }
  } else await pushSave();
  st.onboarded = true; st.keyChecked = true; save();
  loadFriends(); checkPackUpdates();
  return true;
}
function adopt(state, savedAt) {
  st = fromSaved(state); st.savedAt = savedAt || st.savedAt; st.syncedAt = st.savedAt; migrateLessons();
  try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) {}
  setCourse(st.course);
  const notes = applyDecay(); if (notes.length) ui.decay = notes;
}

/* Backup: every save() schedules an upload a moment later. st.syncedAt is the backup's savedAt when this device last
   matched it; on start (and when the backend reports a newer save) the side that changed since then wins, and if
   both changed, the two are merged (mergeSaves in state.js). */
function markSynced(at) {
  st.syncedAt = at;
  try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) {}
}
function scheduleBackup() {
  if (!acct.key || acct.status === "none" || acct.status === "gone") return;
  clearTimeout(acct.timer); acct.timer = setTimeout(pushSave, 1500);
}
async function pushSave() {
  if (!acct.aes || acct.pending) return;
  if (acct.busy) { acct.again = true; return; }
  acct.busy = true;
  try {
    const at = st.savedAt || Date.now();
    const r = await api("PUT", "save", { savedAt: at, data: await encryptState(st, acct.aes) });
    if (r.status === 200) { acct.status = "ok"; markSynced(at); }
    else if (r.status === 409) await pullSave(); // another device saved something newer meanwhile
    else if (r.status === 401) acct.status = "gone";
    else acct.status = "offline";
  } catch (e) { acct.status = "offline"; }
  acct.busy = false;
  if (acct.again) { acct.again = false; pushSave(); }
  if (view === "home" && !ui.modal) render();
}
async function pullSave() {
  const r = await api("GET", "save");
  if (r.status === 401) { acct.status = "gone"; return; }
  if (r.status === 404) { await pushSave(); return; }
  if (r.status !== 200) { acct.status = "offline"; return; }
  acct.status = "ok";
  const remote = r.data.savedAt || 0, local = st.savedAt || 0, base = st.syncedAt || 0;
  if (remote === local) { if (base !== remote) markSynced(remote); return; }
  if (remote !== base) { // another device saved since this one last synced (or the backup was restored to an older one)
    if (view === "lesson") return; // never swap progress under a running lesson; its save comes back here afterwards
    let other;
    try { other = await decryptState(r.data.data, acct.aes); } catch (e) { return; }
    if (local > base) { // both changed: merge, and the merged save goes up as the newest
      adopt(mergeSaves(st, Object.assign({}, other, { savedAt: remote })), remote);
      save(); st.savedAt = Math.max(st.savedAt, remote + 1, local + 1); markSynced(remote); // newer than both, even with a clock behind
    } else adopt(other, remote);
    render();
  } else if (local > remote) await pushSave();
}
async function initAccount() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ACCOUNT_KEY)); } catch (e) {}
  if (!stored || !normalizeKey(stored.key)) return;
  await useKey(normalizeKey(stored.key), !!stored.pending);
  acct.status = "offline";
  if (!(await ensureRegistered())) return;
  const r = await api("GET", "account");
  if (r.status === 401 || r.status === 404) { acct.status = "gone"; render(); return; }
  if (r.status !== 200) return;
  acct.friendCode = r.data.friendCode || ""; acct.status = "ok";
  await pullSave();
  if (!st.keyCreated) { st.keyCreated = dayStr(); save(); } // accounts from before the reminder: count from today
  await reportLearningDay();
  await loadFriends();
  if (view === "home" && !ui.modal) render();
}
async function deleteAccount() {
  const r = await api("DELETE", "account");
  if (r.status !== 200 && r.status !== 404 && r.status !== 401) { acct.note = "Keine Verbindung. Das Konto wurde nicht gelöscht."; return false; }
  forgetAccount();
  st.friends = {}; st.dayReported = ""; save();
  return true;
}
/** Signs out: the key and all progress leave this device (the backup stays and comes back with the key). */
async function signOut() {
  clearTimeout(acct.timer);
  if (acct.status === "ok") await pushSave();
  forgetAccount();
  st = fromSaved(null);
  try { localStorage.removeItem(STORE); } catch (e) {}
  setCourse(st.course);
}
async function newFriendCode() {
  const r = await api("POST", "account/friend-code");
  if (r.status === 200) { acct.friendCode = r.data.friendCode; acct.note = "Neuer Freundescode erstellt. Der alte gilt nicht mehr."; }
  else acct.note = "Keine Verbindung. Bitte versuch es gleich noch einmal.";
}
/** Tells the backend the last day with a finished round; shared streaks with friends are counted from it. */
async function reportLearningDay() {
  if (acct.status !== "ok" || !st.lastDay || st.dayReported === st.lastDay) return;
  const day = st.lastDay;
  const r = await api("POST", "day", { day });
  if (r.status === 200) { st.dayReported = day; save(); loadFriends(); }
}
/* Key safety: 3 days after the account was made the app asks whether the key is written down, and lets the player
   prove it with the last four characters. "Später" asks again a week later. Signing in with the key counts as proof. */
const KEY_REMIND_DAYS = 3;
function keyReminderDue(now = Date.now()) {
  if (!acct.key || acct.status === "none" || acct.status === "gone" || st.keyChecked || !st.keyCreated) return false;
  if (now < (st.keyRemindAt || 0)) return false;
  return now - Date.parse(st.keyCreated + "T00:00:00") >= KEY_REMIND_DAYS * 864e5;
}
function checkKeyEnd(input) {
  const want = acct.key.replace(/-/g, "").slice(-4), got = String(input || "").toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/[^0-9A-Z]/g, "");
  if (got === want) { st.keyChecked = true; ui.keyMsg = "Passt! Dein Schlüssel ist gesichert."; save(); return true; }
  ui.keyMsg = "Das stimmt nicht. Schau dir den Schlüssel oben noch einmal genau an."; return false;
}
const accountLine = () => acct.status === "ok" ? "Dein Fortschritt ist verschlüsselt gesichert."
  : acct.status === "offline" ? "Gerade keine Verbindung. Auf diesem Gerät ist alles gespeichert."
  : acct.status === "gone" ? "Dieses Konto gibt es nicht mehr. Dein Fortschritt ist nur noch auf diesem Gerät."
  : "Kein Konto: Dein Fortschritt ist nur auf diesem Gerät gespeichert.";

/* ---------- Reports and app updates ---------- */
/** "Fehler melden": sent without any account reference; kept in a small queue while offline. */
async function sendReports() {
  while (st.reportQueue && st.reportQueue.length) {
    const r = await api("POST", "report", st.reportQueue[0], false);
    if (r.status !== 200 && r.status !== 400) return;
    st.reportQueue.shift(); save();
  }
}
const newerVersion = (a, b) => { const p = v => String(v).replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0); const x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
/* App updates from GitHub: at every start (at most every 6 hours) the app asks for the newest release. A newer one
   is remembered until it is installed: a dialog appears once per version, the notice on the path stays, and the
   download button fetches the APK directly. */
const UPDATE_KEY = "opensprachfuchs-update", UPDATE_SEEN_KEY = "opensprachfuchs-update-seen", UPDATE_CHECK_KEY = "opensprachfuchs-update-check";
const UPDATE_EVERY = 6 * 3600e3;
const getItem = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const setItem = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
/** The bullet points of the release notes, without Markdown, for "Was ist neu". */
function releaseNotes(body) {
  return String(body || "").split("\n").map(l => l.trim()).filter(l => /^[-*] /.test(l)).slice(0, 6)
    .map(l => l.replace(/^[-*] /, "").replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s*\(#\d+\)/g, "").trim()).filter(Boolean);
}
function showUpdate(info) {
  ui.appUpdate = info;
  // The dialog comes once per version; afterwards the notice on the path and in the settings is enough.
  if (getItem(UPDATE_SEEN_KEY) !== info.version && !ui.modal && (view === "home" || view === "langs")) { ui.modal = "appupdate"; setItem(UPDATE_SEEN_KEY, info.version); }
  render();
}
async function checkAppUpdate(force = false) {
  if (!APP || !CONFIG.GITHUB_REPO || !window.AndroidBridge.appVersion) return;
  const current = window.AndroidBridge.appVersion();
  let known = null;
  try { known = JSON.parse(getItem(UPDATE_KEY)); } catch (e) {}
  if (known && newerVersion(known.version, current)) showUpdate(known);
  else if (known) { setItem(UPDATE_KEY, null); ui.appUpdate = null; } // installed meanwhile
  if (!force && (!st.settings.updates || Date.now() - (+getItem(UPDATE_CHECK_KEY) || 0) < UPDATE_EVERY)) return;
  if (force) { ui.updateNote = "Suche nach Updates …"; render(); }
  try {
    // Not /releases/latest: GitHub leaves pre-releases out there, and every 0.x version is one.
    const r = await fetchTimeout(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}/releases?per_page=10`, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) throw new Error("github " + r.status);
    const list = await r.json();
    const rel = (Array.isArray(list) ? list : []).filter(x => !x.draft && x.tag_name).sort((x, y) => (newerVersion(x.tag_name, y.tag_name) ? -1 : 1))[0];
    setItem(UPDATE_CHECK_KEY, String(Date.now()));
    if (rel && newerVersion(rel.tag_name, current)) {
      const apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name || ""));
      const info = { version: String(rel.tag_name).replace(/^v/, ""), url: rel.html_url, apk: apk ? apk.browser_download_url : "",
        size: apk ? apk.size : 0, notes: releaseNotes(rel.body), pre: !!rel.prerelease };
      setItem(UPDATE_KEY, JSON.stringify(info));
      ui.updateNote = "";
      showUpdate(info);
    } else if (force) { ui.updateNote = `Du hast die neueste Version (${current}).`; render(); }
  } catch (e) { if (force) { ui.updateNote = "GitHub ist gerade nicht erreichbar. Versuch es später noch einmal."; render(); } }
}
/** Download button: the APK itself (the phone's browser downloads it), otherwise the release page. */
function downloadUpdate() {
  if (!ui.appUpdate) return;
  openUrl(ui.appUpdate.apk || ui.appUpdate.url);
  ui.modal = null; render();
}
