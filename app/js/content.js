"use strict";
/* ---------- Language packs ----------
   Every language is a JSON pack (format: packs/README.md). The app ships without any; the player downloads
   the languages they want from the backend, and they stay on the device. COURSES holds the installed packs. */
const PACK_KEY = code => `openlingo-pack-${code}`, PACKS_KEY = "openlingo-packs";
let COURSES = {};          // code -> installed course
let PACK_SHA = {};         // code -> sha256 of the installed pack (from the index it was downloaded with)
let PACK_INDEX = null;     // the backend's packs/index.json once fetched: { packs: [{ code, name, sha256, ... }] }
const packs = { busy: "", error: "", loading: false };

const list = v => Array.isArray(v) ? v : [v];
function courseFromPack(p) {
  return { code: p.short, name: p.name, voice: p.voice, c: p.color, note: p.note, art: new RegExp(p.articles || "(?!)", "i"),
    skip: p.gapSkip || [], gloss: p.glossary || {}, units: p.units, dialogs: p.dialogs || [] };
}
function validPack(p) {
  return p && p.format === 1 && /^[a-z]{2,3}$/.test(p.code) && Array.isArray(p.units) && p.units.length > 0
    && p.units.every(u => u.id && Array.isArray(u.words) && Array.isArray(u.sentences));
}
function storePacks() {
  try { localStorage.setItem(PACKS_KEY, JSON.stringify(PACK_SHA)); } catch (e) {}
}
function loadInstalledPacks() {
  COURSES = {}; PACK_SHA = {};
  let shas = {};
  try { shas = JSON.parse(localStorage.getItem(PACKS_KEY)) || {}; } catch (e) {}
  for (const [code, sha] of Object.entries(shas)) {
    try {
      const p = JSON.parse(localStorage.getItem(PACK_KEY(code)));
      if (validPack(p)) { COURSES[code] = courseFromPack(p); PACK_SHA[code] = sha; }
    } catch (e) {}
  }
}
/** Adds a downloaded pack (text as served) to the device. Returns false if it is not a usable pack. */
function installPack(text, sha256) {
  let p;
  try { p = JSON.parse(text); } catch (e) { return false; }
  if (!validPack(p)) return false;
  try { localStorage.setItem(PACK_KEY(p.code), text); } catch (e) { return false; }
  COURSES[p.code] = courseFromPack(p); PACK_SHA[p.code] = sha256 || "";
  storePacks();
  return true;
}
function removePack(code) {
  try { localStorage.removeItem(PACK_KEY(code)); } catch (e) {}
  delete COURSES[code]; delete PACK_SHA[code];
  storePacks();
}
/* The packs come from the backend. The Android app also carries a copy of every pack (assets/packs/, made at build
   time), so languages can be installed without internet; only updates need the backend. */
const LOCAL_PACKS = "packs/";
async function loadIndex(base) {
  const r = await fetchTimeout(base + "index.json", { cache: "no-store" }, 6000);
  if (!r.ok) throw new Error("index " + r.status);
  const idx = await r.json();
  if (!idx || !Array.isArray(idx.packs)) throw new Error("index");
  return Object.assign(idx, { base });
}
async function fetchPackIndex() {
  try { PACK_INDEX = await loadIndex(BACKEND + "packs/"); PACK_INDEX.remote = true; }
  catch (e) {
    if (PACK_INDEX && PACK_INDEX.remote) return PACK_INDEX;
    PACK_INDEX = await loadIndex(LOCAL_PACKS); // throws when neither is reachable
  }
  return PACK_INDEX;
}
/** Downloads (or updates) one language. Renders progress through `packs.busy` / `packs.error`. */
async function downloadPack(code) {
  packs.busy = code; packs.error = ""; render();
  try {
    if (!PACK_INDEX) await fetchPackIndex();
    const entry = PACK_INDEX.packs.find(p => p.code === code);
    const r = await fetchTimeout(PACK_INDEX.base + `${code}.json`, { cache: "no-store" });
    if (!entry || !r.ok || !installPack(await r.text(), entry.sha256)) throw new Error("pack");
    if (!COURSES[st.course]) st.course = code;
    if (CODE === code || !UNITS.length) setCourse(st.course);
    save();
  } catch (e) { packs.error = "Das Laden hat nicht geklappt. Bitte versuch es noch einmal."; }
  packs.busy = ""; render();
}
/** Installed languages with a newer pack on the backend. */
const packUpdates = () => PACK_INDEX && PACK_INDEX.remote ? PACK_INDEX.packs.filter(p => COURSES[p.code] && PACK_SHA[p.code] !== p.sha256).map(p => p.code) : [];
async function checkPackUpdates() {
  try { await fetchPackIndex(); } catch (e) { return; }
  // A language the saved progress uses but this device lacks (e.g. after signing in with a key) is fetched right away.
  for (const code of Object.keys(st.courses)) if (!COURSES[code] && PACK_INDEX.packs.some(p => p.code === code) && courseDone(code) > 0) await downloadPack(code);
  if (view === "home" && !ui.modal) render();
}

/* ---------- The active course ----------
   setCourse() flattens one pack into UNITS: words { id, t, alt, de, pic } and sentences { id, t, tAlt, de, deAlt }.
   Progress is keyed by the stable ids ("w:basics.w01"), so corrections in a pack keep what was learned. */
const cleanKey = x => String(x).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[.,!?;:"«»„“”()¿¡]/g, "").replace(/\s+/g, " ").trim();
let HINT_T = {}, HINT_DE = {};
function addHint(map, key, value) {
  key = cleanKey(key); if (!key || !value) return;
  const l = map[key] || (map[key] = []);
  if (!l.includes(value) && l.length < 3) l.push(value);
}
const unitsFor = code => (COURSES[code] && COURSES[code].units) || [];
const EMPTY_COURSE = { code: "", name: "", voice: "de-DE", c: "#2456E8", note: "", art: /(?!)/, skip: [], gloss: {}, units: [], dialogs: [] };

let C = EMPTY_COURSE, CODE = "", UNITS = [], ALL_WORDS = [], ALL_SENTS = [], KEY_UNIT = {};
function setCourse(code) {
  if (!COURSES[code]) code = Object.keys(COURSES)[0] || "";
  CODE = code; C = COURSES[code] || EMPTY_COURSE;
  UNITS = C.units.map(u => ({ id: u.id, title: u.title, level: u.level, desc: u.desc, c: u.colors,
    words: u.words.map(w => ({ id: w.id, t: list(w.t)[0], alt: list(w.t).slice(1), de: w.de, pic: w.pic || "" })),
    sentences: u.sentences.map(s => ({ id: s.id, t: list(s.t)[0], tAlt: list(s.t).slice(1), de: list(s.de)[0], deAlt: list(s.de).slice(1) })) }));
  ALL_WORDS = UNITS.flatMap(u => u.words); ALL_SENTS = UNITS.flatMap(u => u.sentences);
  // Tap hints: target-language words to German and back, from the vocabulary plus the pack's glossary.
  HINT_T = {}; HINT_DE = {};
  for (const w of ALL_WORDS) {
    for (const f of [w.t, ...w.alt]) { addHint(HINT_T, f, w.de); addHint(HINT_T, f.replace(C.art, ""), w.de); }
    for (const part of w.de.split("/")) {
      const p = part.replace(/\(.*?\)/g, "").trim();
      addHint(HINT_DE, p, w.t); addHint(HINT_DE, p.replace(/^(der|die|das|ein|eine) /i, ""), w.t);
    }
  }
  for (const [k, v] of Object.entries(C.gloss)) if (!HINT_T[cleanKey(k)]) addHint(HINT_T, k, v);
  KEY_UNIT = {};
  for (const u of UNITS) for (const x of [...u.words.map(w => "w:" + w.id), ...u.sentences.map(z => "s:" + z.id)]) KEY_UNIT[x] = u.id;
}
