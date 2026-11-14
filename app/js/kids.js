"use strict";
/* Kids mode (Kindermodus). A parent PIN guards everything that is not learning: settings, language management, the
   account, app updates and resetting. Optional limits: play time per day, a bedtime and no friends.
   The settings live in st.kids (in the encrypted save, so they follow the account to a new device). The play time
   counted today stays on this device only (KIDS_USED), it would otherwise trigger a backup every few seconds.
   The PIN keeps children out, it is no protection against attackers: four digits, stored as a salted hash. */
const KIDS_USED = "opensprachfuchs-kids-used";
const KIDS_TICK = 15000, PARENT_MS = 5 * 60000, KIDS_EXTRA_MS = 30 * 60000;
const KIDS_LIMITS = [0, 10, 15, 20, 30, 45, 60, 90];
const KIDS_DEF = { on: false, pin: "", salt: "", limit: 0, bed: false, bedFrom: "20:00", bedTo: "07:00", friends: false };
// Actions that need the PIN while kids mode is on.
const KIDS_PROTECTED = new Set(["settings", "kidsettings", "managepacks", "reloadpacks", "getpack", "removepack", "doremovepack",
  "account", "togglekey", "toggleqr", "copykey", "signout", "dosignout", "deleteaccount", "dodeleteaccount", "newcode",
  "openupdate", "updateinfo", "releasepage", "checkupdate", "toggle", "reset", "doreset", "resetcourse", "resetfrom", "doresetfrom",
  "kidsunlock", "kidstoggle", "kidsoff", "kidspin"]);
// Actions that need friends to be allowed.
const KIDS_FRIENDS = new Set(["addfriend", "doaddfriend", "friend", "acceptfriend", "renamefriend", "removefriend", "gift", "claimgifts", "sharecode", "myqr"]);

const kids = () => Object.assign({}, KIDS_DEF, st.kids || {});
const kidsOn = () => !!(st.kids && st.kids.on && st.kids.pin);
const kidsFriendsOff = () => kidsOn() && !kids().friends;
const parentOk = () => !kidsOn() || Date.now() < (ui.parentUntil || 0);

function pinHash(pin, salt) {
  // FNV-1a over salt and PIN, twice with different seeds: enough to not keep the PIN in plain text.
  const fnv = (s, h) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, "0"); };
  const s = `osf-kids:${salt}:${pin}`;
  return fnv(s, 2166136261) + fnv(s, 3266489917);
}
const pinValid = pin => /^\d{4}$/.test(pin);
function pinMatches(pin) { const k = kids(); return !!k.pin && pinHash(String(pin || "").trim(), k.salt) === k.pin; }
function setPin(pin) {
  const salt = Math.random().toString(36).slice(2, 10);
  st.kids = Object.assign(kids(), { salt, pin: pinHash(pin, salt) });
}

/* Play time today, counted while the app is visible. */
function kidsUsed() {
  let u = null;
  try { u = JSON.parse(localStorage.getItem(KIDS_USED) || "null"); } catch (e) {}
  return u && u.day === dayStr() ? u : { day: dayStr(), ms: 0, extraUntil: 0 };
}
function kidsStore(u) { try { localStorage.setItem(KIDS_USED, JSON.stringify(u)); } catch (e) {} }
const minutesOf = t => { const [h, m] = String(t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
function inBedtime(now = new Date()) {
  const k = kids(); if (!k.bed) return false;
  const n = now.getHours() * 60 + now.getMinutes(), a = minutesOf(k.bedFrom), b = minutesOf(k.bedTo);
  return a === b ? false : a < b ? n >= a && n < b : n >= a || n < b; // a window over midnight, e.g. 20:00 to 07:00
}
/** Why the app is locked right now: "bed", "time" or "" (not locked). Parents can open it for another 30 minutes. */
function kidsLock() {
  if (!kidsOn()) return "";
  const u = kidsUsed();
  if (Date.now() < (u.extraUntil || 0)) return "";
  if (inBedtime()) return "bed";
  const k = kids();
  return k.limit > 0 && u.ms >= k.limit * 60000 ? "time" : "";
}
function kidsMinutesLeft() {
  const k = kids(); if (!kidsOn() || !k.limit) return null;
  return Math.max(0, Math.ceil((k.limit * 60000 - kidsUsed().ms) / 60000));
}
let kidsLastLock = "";
setInterval(() => {
  if (!kidsOn() || (typeof document.visibilityState !== "undefined" && document.visibilityState === "hidden")) return;
  const u = kidsUsed();
  if (!kidsLock()) { u.ms += KIDS_TICK; kidsStore(u); }
  const lock = kidsLock();
  if (lock !== kidsLastLock) { kidsLastLock = lock; if (view === "home" || view === "stats") render(); }
}, KIDS_TICK);

/* Click guard, called before every action. Returns true when the action was stopped. */
function kidsGuard(a, ds) {
  if (!kidsOn()) return false;
  if (KIDS_FRIENDS.has(a) && !kids().friends) return true;
  if (!KIDS_PROTECTED.has(a) || parentOk()) return false;
  ui.pinFor = { a, ds: Object.assign({}, ds), modal: ui.modal };
  ui.pinMsg = ""; ui.pinForgot = false; ui.modal = "pin"; render();
  const f = document.getElementById && document.getElementById("pinInput"); if (f && f.focus) f.focus();
  return true;
}
/** The PIN was entered in the dialog: on success the stopped action runs. */
function kidsCheckPin(pin) {
  if (!pinMatches(pin)) { ui.pinMsg = "Die PIN stimmt nicht."; sfx("bad"); render(); return; }
  ui.parentUntil = Date.now() + PARENT_MS;
  const p = ui.pinFor; ui.pinFor = null; ui.modal = p ? p.modal : null;
  if (p) act(p.a, p.ds); else render();
}
/** PIN forgotten: the account key (only the parents should have it) turns kids mode off. */
function kidsForgot(key) {
  const norm = s => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!acct.key || norm(key) !== norm(acct.key)) { ui.pinMsg = "Der Schlüssel stimmt nicht."; render(); return; }
  st.kids = Object.assign(kids(), { on: false }); save();
  ui.pinFor = null; ui.modal = null; ui.parentUntil = 0; render();
}
function kidsEnable(pin, pin2) {
  if (!pinValid(pin)) { ui.kidsMsg = "Die PIN braucht genau 4 Ziffern."; render(); return; }
  if (pin !== pin2) { ui.kidsMsg = "Die beiden PINs sind verschieden."; render(); return; }
  setPin(pin); st.kids.on = true; save();
  ui.kidsMsg = "Kindermodus ist an."; ui.parentUntil = Date.now() + PARENT_MS;
  if (ui.tab === "friends" && kidsFriendsOff()) ui.tab = "path";
  render();
}
function kidsChangePin(pin, pin2) {
  if (!pinValid(pin)) { ui.kidsMsg = "Die PIN braucht genau 4 Ziffern."; render(); return; }
  if (pin !== pin2) { ui.kidsMsg = "Die beiden PINs sind verschieden."; render(); return; }
  setPin(pin); st.kids.on = true; save(); ui.kidsMsg = "Neue PIN gespeichert."; render();
}
function kidsSet(k, v) { st.kids = Object.assign(kids(), { [k]: v }); save(); kidsLastLock = kidsLock(); }
function kidsUnlock() { const u = kidsUsed(); u.extraUntil = Date.now() + KIDS_EXTRA_MS; kidsStore(u); kidsLastLock = ""; ui.modal = null; render(); }

/* ---------- Views ---------- */
function pinModalHTML() {
  const forgot = ui.pinForgot;
  return `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>🔒 Eltern-PIN</h2>
    ${forgot ? `<p class="muted">${acct.key ? "Gib den Konto-Schlüssel ein. Dann geht der Kindermodus aus, und du kannst eine neue PIN festlegen."
        : "Ohne Konto lässt sich die PIN nicht zurücksetzen. Dann hilft nur, die Daten der App in den Einstellungen des Handys zu löschen (der Fortschritt geht dabei verloren)."}</p>
      ${acct.key ? `<input id="pinKey" class="search" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" aria-label="Konto-Schlüssel">
      <button class="btn wide" data-act="pinkeyok">Kindermodus ausschalten</button>` : ""}`
    : `<p class="muted">Dieser Bereich ist für Eltern. Bitte die PIN eingeben.</p>
      <input id="pinInput" class="search pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="PIN">
      <button class="btn wide" data-act="pinok">Weiter</button>
      <button class="linkbtn" data-act="pinforgot">PIN vergessen?</button>`}
    ${ui.pinMsg ? `<p class="muted" role="alert">${esc(ui.pinMsg)}</p>` : ""}
    <button class="btn ghost wide" data-act="closemodal">Abbrechen</button></div></div>`;
}
function kidsModalHTML() {
  const k = kids(), on = kidsOn(), msg = ui.kidsMsg ? `<p class="muted" role="status">${esc(ui.kidsMsg)}</p>` : "";
  const pins = (label) => `<input id="kidsPin" class="search pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="PIN (4 Ziffern)" aria-label="${label}">
    <input id="kidsPin2" class="search pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="PIN wiederholen" aria-label="PIN wiederholen">`;
  if (!on) return modal("👧 Kindermodus", `<p class="muted">Im Kindermodus sind Einstellungen, Sprachen verwalten, Konto und App-Updates nur mit einer PIN erreichbar.
      Dazu kannst du eine Spielzeit pro Tag und eine Schlafenszeit festlegen.</p>
    ${pins("Neue PIN")}<button class="btn good wide" data-act="kidson">Kindermodus einschalten</button>${msg}
    <button class="btn ghost wide" data-act="settings">Zurück</button>`);
  const tg = (key, label, sub) => `<div class="toggle"><span>${label}<small>${sub}</small></span><button class="sw" role="switch" aria-checked="${!!k[key]}" data-act="kidstoggle" data-k="${key}" aria-label="${label}"></button></div>`;
  const left = kidsMinutesLeft();
  return modal("👧 Kindermodus", `<p class="muted">Der Kindermodus ist an. Einstellungen, Sprachen verwalten, Konto und Updates brauchen die PIN.</p>
    <div class="toggle"><span>Spielzeit pro Tag<small>${k.limit ? `Heute noch ${left} Min.` : "Ohne Grenze"}</small></span>
      <select id="kidsLimit" class="time-input" aria-label="Spielzeit pro Tag">${KIDS_LIMITS.map(m => `<option value="${m}" ${m === k.limit ? "selected" : ""}>${m ? m + " Min." : "unbegrenzt"}</option>`).join("")}</select></div>
    ${tg("bed", "Schlafenszeit", "In dieser Zeit ist die App gesperrt")}
    ${k.bed ? `<div class="toggle"><span>Von<small>Beginn der Sperre</small></span><input id="kidsBedFrom" class="time-input" type="time" value="${esc(k.bedFrom)}" aria-label="Schlafenszeit von"></div>
      <div class="toggle"><span>Bis<small>Ende der Sperre</small></span><input id="kidsBedTo" class="time-input" type="time" value="${esc(k.bedTo)}" aria-label="Schlafenszeit bis"></div>` : ""}
    ${tg("friends", "Freunde erlauben", "Freunde hinzufügen, Geschenke und gemeinsame Serien")}
    <details><summary>PIN ändern</summary>${pins("Neue PIN")}<button class="btn ghost wide" data-act="kidspin">Neue PIN speichern</button></details>
    ${msg}
    <button class="btn bad wide" data-act="kidsoff">Kindermodus ausschalten</button>
    <button class="btn wide" data-act="settings">Zurück zu den Einstellungen</button>`);
}
function kidsLockHTML(lock) {
  const k = kids();
  return `<div class="center"><div class="card">${foxSadHTML()}
    <h1>${lock === "bed" ? "🌙 Schlafenszeit" : "Für heute ist Schluss!"}</h1>
    <p class="muted">${lock === "bed" ? `Bis ${esc(k.bedTo)} Uhr schläft der Fuchs. Danach geht es weiter.` : `Deine ${k.limit} Minuten für heute sind um. Morgen geht es weiter, deine Serie wartet auf dich.`}</p>
    <button class="btn ghost wide" data-act="kidsunlock">Eltern: 30 Minuten freigeben</button></div></div>`;
}
