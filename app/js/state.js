"use strict";
/* ---------- State ----------
   Progress always lives on the device (localStorage). With an account it is also backed up, encrypted (account.js).
   XP, streak, hearts and gems are shared by all languages; st.courses[code] keeps what belongs to one language. */
const STORE = "opensprachfuchs-state";
// Hearts (issue #4, all halved): at most 5, one grows back every 40 minutes, the bonus chest gives 2.
const LESSONS_PER_UNIT = 4, MAX_HEARTS = 5, REGEN_MS = 40 * 60 * 1000, BONUS_HEARTS = 2;
const DEF = { gems: 20, freezes: 0, boostUntil: 0, history: {}, bestStreak: 0, badges: {}, perfect: 0, placementPassed: false, xp: 0, streak: 0,
  lastDay: null, day: null, dayLessons: 0, hearts: MAX_HEARTS, heartsTs: 0, course: "", courses: {}, lessons: 0, listenOffUntil: 0, speakOffUntil: 0,
  onboarded: false, friends: {}, dayReported: "", reportQueue: [],
  settings: { sound: true, audio: true, hearts: true, listen: true, decay: true, speak: true, reminder: false, reminderTime: "19:00", updates: true } };
function fromSaved(saved) {
  const s = Object.assign(JSON.parse(JSON.stringify(DEF)), saved || {});
  s.settings = Object.assign({}, DEF.settings, (saved && saved.settings) || {});
  s.savedAt = s.savedAt || 0;
  s.hearts = Math.min(MAX_HEARTS, s.hearts); // saves from before the hearts were halved
  return s;
}
let st;
try { st = fromSaved(JSON.parse(localStorage.getItem(STORE))); } catch (e) { st = fromSaved(null); }
loadInstalledPacks();
setCourse(st.course);
function save() {
  st.savedAt = Date.now();
  try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) {}
  scheduleBackup();
}

const cs = (code = CODE) => st.courses[code] || (st.courses[code] = { progress: {}, mistakes: [] });

const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d); };
function syncDay() { if (st.day !== dayStr()) { st.day = dayStr(); st.dayLessons = 0; } }
/* Days without a finished round between the last learning day and today (0 = learned yesterday or today). */
function missedDays() {
  if (!st.lastDay) return 0;
  const a = new Date(st.lastDay + "T00:00:00"), b = new Date(dayStr() + "T00:00:00");
  return Math.max(0, Math.round((b - a) / 864e5) - 1);
}
// A streak survives missed days as long as there are enough streak freezes to cover them.
function shownStreak() {
  if (st.lastDay === dayStr() || st.lastDay === yesterday()) return st.streak;
  const m = missedDays();
  return m > 0 && m <= (st.freezes || 0) ? st.streak : 0;
}
function syncHearts() {
  if (st.hearts >= MAX_HEARTS) { st.hearts = MAX_HEARTS; return; }
  const n = Math.floor((Date.now() - st.heartsTs) / REGEN_MS);
  if (n > 0) { st.hearts = Math.min(MAX_HEARTS, st.hearts + n); st.heartsTs += n * REGEN_MS; }
}
function loseHeart() {
  if (!st.settings.hearts) return;
  syncHearts();
  if (st.hearts === MAX_HEARTS) st.heartsTs = Date.now();
  st.hearts = Math.max(0, st.hearts - 1); save();
}
const done = (id, code) => cs(code).progress[id] || 0;
// A unit opens when the one before is finished; one that was already started stays open (e.g. after the path was re-sorted).
// A unit is complete with its four lessons and its bonus station (games.js); only then the next one opens.
const unitComplete = i => done(UNITS[i].id) >= LESSONS_PER_UNIT && bonusDone(UNITS[i].id);
const unitUnlocked = i => i === 0 || unitComplete(i - 1) || done(UNITS[i].id) > 0;
/* Levels (GER/CEFR): the path is shown one level at a time, picked in the tabs above it. */
const LEVEL_NAMES = { A1: "Einstieg", A2: "Grundlagen", B1: "Mittelstufe", B2: "Erweitert", C1: "Fachkundig", C2: "Profi" };
const levelsOf = () => [...new Set(UNITS.map(u => u.level))];
// The level to show: the one picked in the tabs, otherwise the level of the first unfinished, open unit.
function shownLevel() {
  const levels = levelsOf();
  if (ui.level && levels.includes(ui.level)) return ui.level;
  const i = UNITS.findIndex((u, k) => unitUnlocked(k) && !unitComplete(k));
  return i >= 0 ? UNITS[i].level : levels[levels.length - 1] || "A1";
}
/* Spaced repetition for words (Leitner boxes): each correct answer moves a word to a longer interval,
   a wrong one sends it back to box 0. "Vokabeln üben" picks due words first. */
const SRS_DAYS = [0, 1, 2, 4, 8, 16, 32];
const srs = () => { const c = cs(); return c.srs || (c.srs = {}); };
function srsUpdate(key, ok) {
  if (!key || !key.startsWith("w:")) return;
  const all = srs(), e = all[key] || { box: 0, due: 0 }, now = Date.now();
  if (ok && e.due > now) return; // already scheduled ahead; a repeat in the same session doesn't count twice
  if (ok && all[key] && e.box > 0) bump(dayRec(), "reviews");
  e.box = ok ? Math.min(e.box + 1, SRS_DAYS.length - 1) : 0;
  e.due = now + (ok ? SRS_DAYS[e.box] * 864e5 : 0);
  all[key] = e;
}
const openUnits = () => UNITS.filter((u, i) => unitUnlocked(i) && (done(u.id) > 0 || i === 0));
function dueWords() { const all = srs(), now = Date.now(); return openUnits().flatMap(u => u.words).filter(w => { const e = all["w:" + w.id]; return e && e.due <= now; }); }
/* Statistics: one record per day (all courses) and right/wrong counts per unit (per course). */
function dayRec(d = dayStr()) { const h = st.history || (st.history = {}); return h[d] || (h[d] = { xp: 0, lessons: 0, right: 0, wrong: 0 }); }
const bump = (rec, k, n = 1) => { rec[k] = (rec[k] || 0) + n; };
const best = (rec, k, v) => { rec[k] = Math.max(rec[k] || 0, v); };
function trackAnswer(ex, ok) {
  const r = dayRec(); if (ok) r.right++; else r.wrong++;
  const uid = ex.type === "match" ? KEY_UNIT["w:" + ex.pairs[0].id] : KEY_UNIT[ex.key];
  if (!uid) return;
  const c = cs(), us = c.unitStats || (c.unitStats = {}), e = us[uid] || (us[uid] = { r: 0, w: 0 });
  if (ok) e.r++; else e.w++;
}
function pruneHistory() {
  const keys = Object.keys(st.history || {}).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete st.history[k];
}
const unitsDone = code => unitsFor(code).filter(u => done(u.id, code) >= LESSONS_PER_UNIT).length;
const sureWords = code => Object.values((st.courses[code] || {}).srs || {}).filter(e => e.box >= 3).length;
const BADGES = [
  { id: "first", em: "🎉", name: "Erste Lektion", desc: "Die erste Lektion geschafft.", test: () => st.lessons >= 1 },
  { id: "streak3", em: "🔥", name: "3 Tage am Stück", desc: "Drei Tage in Folge gelernt.", test: () => st.bestStreak >= 3 },
  { id: "streak7", em: "🔥", name: "Eine Woche dabei", desc: "Sieben Tage in Folge gelernt.", test: () => st.bestStreak >= 7 },
  { id: "streak30", em: "🏅", name: "30-Tage-Serie", desc: "Einen Monat lang jeden Tag gelernt.", test: () => st.bestStreak >= 30 },
  { id: "unit1", em: "🏁", name: "Erste Einheit", desc: "Eine Einheit komplett abgeschlossen.", test: () => Object.keys(COURSES).some(c => unitsDone(c) >= 1) },
  { id: "a1", em: "🎓", name: "A1 geschafft", desc: "Alle A1-Einheiten einer Sprache abgeschlossen.",
    test: () => Object.keys(COURSES).some(c => unitsFor(c).filter(u => u.level === "A1").every(u => done(u.id, c) >= LESSONS_PER_UNIT)) },
  { id: "perfect10", em: "💎", name: "Zehnmal fehlerfrei", desc: "Zehn Lektionen ohne einen Fehler.", test: () => (st.perfect || 0) >= 10 },
  { id: "xp500", em: "⚡", name: "500 XP", desc: "500 Erfahrungspunkte gesammelt.", test: () => st.xp >= 500 },
  { id: "xp2000", em: "⚡", name: "2.000 XP", desc: "2.000 Erfahrungspunkte gesammelt.", test: () => st.xp >= 2000 },
  { id: "words50", em: "📚", name: "50 Wörter sicher", desc: "50 Vokabeln auf Lernstufe 3 oder höher.", test: () => Object.keys(COURSES).reduce((a, c) => a + sureWords(c), 0) >= 50 },
  { id: "polyglot", em: "🌍", name: "Sprachentdecker", desc: "In drei Sprachen eine Lektion geschafft.", test: () => Object.keys(st.courses).filter(c => courseDone(c) >= 1).length >= 3 },
  { id: "placement", em: "🚀", name: "Überflieger", desc: "Einen Einstufungstest bestanden.", test: () => !!st.placementPassed },
  { id: "gold", em: "🥇", name: "Goldmeister", desc: "Eine Einheit auf Gold gemeistert.", test: () => Object.values(st.courses).some(c => Object.values(c.mastery || {}).some(v => v >= 3)) },
  { id: "talk", em: "💬", name: "Gesprächig", desc: "Ein Gespräch zu Ende geführt.", test: () => Object.values(st.courses).some(c => Object.keys(c.dialogs || {}).length > 0) },
];
function checkBadges() {
  st.badges = st.badges || {};
  const fresh = BADGES.filter(b => !st.badges[b.id] && b.test());
  for (const b of fresh) st.badges[b.id] = dayStr();
  return fresh;
}
/* Resets the current course from unit `from` on: lesson progress, word stages, open mistakes and unit statistics. */
function resetCourseFrom(from) {
  const c = cs(), ids = new Set(UNITS.slice(from).map(u => u.id));
  for (const id of ids) delete c.progress[id];
  const inReset = key => ids.has(KEY_UNIT[key]);
  for (const key of Object.keys(c.srs || {})) if (inReset(key)) delete c.srs[key];
  c.mistakes = (c.mistakes || []).filter(key => !inReset(key));
  for (const id of ids) if (c.unitStats) delete c.unitStats[id];
  for (const u of UNITS.slice(from)) for (const w of u.words) if (c.seen) delete c.seen[w.id];
  save();
}
/* Practising a language keeps it fresh. Every full 14 days without a finished round in a started language
   move it back one lesson (one circle on the path), taken from the furthest lesson reached. */
const DECAY_DAYS = 14, DAY_MS = 864e5;
function applyDecay(now = Date.now()) {
  const notes = [];
  if (st.settings.decay === false) return notes;
  for (const code of Object.keys(COURSES)) {
    const c = st.courses[code];
    if (!c || !Object.values(c.progress || {}).some(v => v > 0)) continue;
    if (!c.last) { c.last = now; continue; } // saves from before this feature start counting today
    const steps = Math.floor((now - c.last) / (DECAY_DAYS * DAY_MS));
    if (steps < 1) continue;
    const days = Math.floor((now - c.last) / DAY_MS), units = unitsFor(code);
    let lost = 0;
    for (let k = 0; k < steps; k++) {
      let i = units.length - 1;
      while (i >= 0 && !(c.progress[units[i].id] > 0)) i--;
      if (i < 0) break;
      c.progress[units[i].id]--; lost++;
    }
    c.last += steps * DECAY_DAYS * DAY_MS;
    if (lost) notes.push({ code, lost, days });
  }
  if (notes.length) save();
  return notes;
}
/* Daily quests: three goals a day, picked once per day and the same on every device. Each pays out when met;
   all three open a bonus chest. Progress is read from today's record in st.history. */
const QUESTS = [
  { id: "right20", text: "20 richtige Antworten", goal: 20, key: "right" },
  { id: "right40", text: "40 richtige Antworten", goal: 40, key: "right" },
  { id: "lessons2", text: "2 Runden abschließen", goal: 2, key: "lessons" },
  { id: "perfect1", text: "1 Lektion fehlerfrei", goal: 1, key: "perfect" },
  { id: "reviews5", text: "5 fällige Vokabeln wiederholen", goal: 5, key: "reviews", when: () => dueWords().length >= 5 },
  { id: "listen5", text: "5 Hörübungen richtig", goal: 5, key: "listenRight", when: () => canListen() },
  { id: "blitz10", text: "Blitzrunde mit 10 Punkten", goal: 10, key: "blitzBest" },
  { id: "combo8", text: "8 richtige Antworten in Folge", goal: 8, key: "combo" },
  { id: "xp50", text: "50 XP sammeln", goal: 50, key: "xp" },
];
function seeded(seed) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296); }
function todaysQuests() {
  const day = dayStr();
  if (!st.quests || st.quests.day !== day) {
    const rnd = seeded(day), pool = QUESTS.filter(q => !q.when || q.when()), ids = [];
    while (ids.length < 3 && pool.length) { const q = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; if (!ids.some(id => id.slice(0, 5) === q.id.slice(0, 5))) ids.push(q.id); }
    st.quests = { day, ids, claimed: [], bonus: false };
  }
  return st.quests.ids.map(id => QUESTS.find(q => q.id === id)).filter(Boolean);
}
const questValue = q => dayRec()[q.key] || 0;
function giveHearts(n) { if (!st.settings.hearts) return 0; syncHearts(); const b = st.hearts; st.hearts = Math.min(MAX_HEARTS, st.hearts + n); if (st.hearts === MAX_HEARTS) st.heartsTs = 0; return st.hearts - b; }
function claimQuests() {
  const msgs = [], qs = todaysQuests();
  for (const q of qs) {
    if (st.quests.claimed.includes(q.id) || questValue(q) < q.goal) continue;
    st.quests.claimed.push(q.id);
    st.xp += 10; bump(dayRec(), "xp", 10); st.gems = (st.gems || 0) + 5;
    msgs.push(`✅ Tagesaufgabe „${q.text}“: +10 XP, +5 💎`);
  }
  if (!st.quests.bonus && qs.length && st.quests.claimed.length >= qs.length) {
    st.quests.bonus = true;
    const h = giveHearts(BONUS_HEARTS);
    st.xp += 20; bump(dayRec(), "xp", 20); st.gems = (st.gems || 0) + 15;
    msgs.push(`🎁 Alle Tagesaufgaben geschafft: +20 XP, +15 💎${h ? ` und +${h} ${h === 1 ? "Herz" : "Herzen"}` : ""}`);
  }
  return msgs;
}
/* Shop: gems buy small helps. Each item says whether it can be bought right now. */
const MAX_FREEZES = 2, BOOST_MS = 15 * 60 * 1000;
function shopItems() {
  const now = Date.now(), c = cs(), started = Object.values(c.progress || {}).some(v => v > 0);
  const boostLeft = Math.ceil(((st.boostUntil || 0) - now) / 60000);
  return [
    { id: "freeze", em: "🧊", name: "Serienschutz", price: 50, desc: "Rettet deine Serie, wenn du einen Tag nicht lernst.",
      note: `Vorrat: ${st.freezes || 0} von ${MAX_FREEZES}`, can: (st.freezes || 0) < MAX_FREEZES, buy: () => { st.freezes = (st.freezes || 0) + 1; } },
    { id: "hearts", em: "❤️", name: "Herzen auffüllen", price: 30, desc: `Sofort alle ${MAX_HEARTS} Herzen.`,
      note: st.settings.hearts ? `Gerade: ${st.hearts} von ${MAX_HEARTS}` : "Herzen sind ausgeschaltet", can: st.settings.hearts && st.hearts < MAX_HEARTS,
      buy: () => { st.hearts = MAX_HEARTS; st.heartsTs = 0; } },
    { id: "boost", em: "⚡", name: "Doppel-XP", price: 40, desc: "Alle Runden der nächsten 15 Minuten zählen doppelt.",
      note: boostLeft > 0 ? `Aktiv, noch ${boostLeft} Min.` : "", can: boostLeft <= 0, buy: () => { st.boostUntil = Date.now() + BOOST_MS; } },
    { id: "pause", em: "🏖️", name: `Pausenschutz für ${C.name}`, price: 40, desc: `${DECAY_DAYS} Tage mehr, bevor es in ${C.name} wegen einer Pause zurückgeht.`,
      note: !started ? "Erst nach der ersten Lektion möglich" : st.settings.decay === false ? "Rückstufung ist ausgeschaltet" : (c.last || now) > now ? "Schutz ist aktiv" : "",
      can: started && st.settings.decay !== false && (c.last || now) <= now, buy: () => { const k = cs(); k.last = (k.last || Date.now()) + DECAY_DAYS * DAY_MS; } },
  ];
}
function buy(id) {
  const it = shopItems().find(x => x.id === id);
  if (!it || !it.can || (st.gems || 0) < it.price) return false;
  st.gems -= it.price; it.buy(); save();
  ui.shopMsg = `${it.name} gekauft.`;
  return true;
}
const courseDone = code => unitsFor(code).reduce((a, u) => a + Math.min(done(u.id, code), LESSONS_PER_UNIT), 0);
