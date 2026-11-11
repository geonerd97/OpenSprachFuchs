// Logic test for the game in app/: installs every language pack, builds every lesson three times, answers each
// exercise correctly and checks that the game accepts it. Then checks tests, hearts, listening pause, reset, decay,
// combo, blitz round, daily quests, shop, dialogues, mastery, spaced repetition, the tab bar and the app bridge.
// Run: node test/game-test.js   (exit code 1 on errors)
const fs = require("fs");
const path = require("path");
const { loadGame, el, packFiles } = require("./harness");

let errors = 0, count = 0;
const types = {}, noSentence = new Set();
const fail = (...a) => { errors++; console.log("FEHLER", ...a); };

const g = loadGame();
const codes = Object.keys(g.COURSES);
if (codes.length !== packFiles().length) fail("Nicht alle Sprachpakete installiert", codes);
// The main languages share one structure (20 dialogues in 4 categories, 16 stories); dialects are smaller.
const isMain = code => g.COURSES[code].group === "main";

for (const code of codes) {
  g.st.course = code; g.setCourse(code); g.st.settings.hearts = false;
  for (let u = 0; u < g.UNITS().length; u++) for (let li = 0; li < g.lessonsOf(g.UNITS()[u]); li++) for (let rep = 0; rep < 3; rep++) {
    g.startLesson(u, li);
    const L = g.L;
    for (let guard = 0; g.view === "lesson" && guard < 60; guard++) {
      const ex = L.cur, name = ex.type + (ex.audio ? "Word" : "");
      count++; types[name] = (types[name] || 0) + 1;
      if (ex.type !== "match" && !/^[ws]:[a-z0-9-]+\.[ws]\d+$/.test(ex.key)) fail("Aufgabe ohne feste ID", code, ex.key);
      g.exerciseHTML(ex);
      // Issue #9: a word is asked only after it was introduced.
      for (const w of g.exWords(ex)) if (ex.type !== "intro" && !g.wordKnown(w)) fail("Wort ohne Einführung abgefragt", code, ex.type, w.id);
      if (ex.type === "intro") { if (!L.checked) fail("Einführung lässt sich nicht weiterklicken", code); if (!ex.sent) noSentence.add(code + ":" + ex.item.id); }
      else if (ex.type === "match") { L.checked = true; L.res = { ok: true }; L.done++; }
      else {
        if (["choice", "pic", "gap"].includes(ex.type)) { L.sel = ex.ans; if (ex.ans < 0) fail("keine richtige Option", code, ex.key); }
        else if (ex.type === "bank" || ex.type === "listen") {
          const used = new Set(); L.picked = [];
          for (const t of ex.target.replace(/[.,!?¿¡]/g, "").split(" ").filter(Boolean)) {
            const tile = ex.tiles.find(x => x.t === t && !used.has(x.id));
            if (!tile) { fail("Wortkarte fehlt", code, t, ex.target); break; }
            used.add(tile.id); L.picked.push(tile.id);
          }
        } else if (ex.type === "type") global.document.getElementById = () => ({ value: ex.target });
        const r = g.evaluate(ex);
        if (!r.ok) fail("richtige Antwort abgelehnt", code, ex.type, ex.target || ex.full);
        global.document.getElementById = () => el();
        L.checked = true; L.res = r; L.done++;
      }
      g.footerHTML();
      if (!L.queue.length) break;
      g.nextExercise();
    }
  }
  // Every tab of the home screen and the word list of every unit must render without throwing.
  for (const tab of ["path", "practice", "friends", "shop", "profile"]) { g.ui.tab = tab; const h = g.homeHTML(); if (!h.includes('class="tabbar"')) fail("Tab-Leiste fehlt", tab); }
  g.ui.tab = "path";
  for (let u = 0; u < g.UNITS().length; u++) { g.ui.modal = "words"; g.ui.wu = u; g.modalHTML(); }
  g.ui.modal = null;
}

// Words that occur in no sentence of the pack are introduced with their meaning only (count for the pack authors).
console.log("Neue Wörter ohne Beispielsatz:", noSentence.size);
// Issue #9: a fresh course starts with an intro card, a lesson brings in a limited number of new words,
// the progress bar does not count the cards, and practice rounds stick to words already known.
{
  g.setCourse("it"); g.st.course = "it"; g.st.courses.it = { progress: {}, mistakes: [] };
  g.startLesson(0, 0);
  const all = [g.L.cur, ...g.L.queue], intros = all.filter(x => x.type === "intro");
  if (g.L.cur.type !== "intro" || !g.exerciseHTML(g.L.cur).includes("Das ist neu für dich")) fail("Lektion beginnt nicht mit einem neuen Wort");
  if (!intros.length || intros.length > g.NEW_PER_LESSON) fail("Anzahl neuer Wörter pro Lektion", intros.length);
  if (g.L.total !== all.length - intros.length) fail("Einführungen zählen im Fortschritt mit");
  if (!/class="hw/.test(g.exerciseHTML(g.L.cur))) fail("Beispielsatz ohne antippbare Wörter");
  answerAll(g.L);
  const known = g.UNITS()[0].words.filter(g.wordKnown).map(w => w.id);
  if (!intros.every(x => known.includes(x.item.id))) fail("Eingeführte Wörter nicht gemerkt");
  g.view = "home"; g.startTraining(true);
  for (const ex of [g.L.cur, ...g.L.queue]) for (const w of g.exWords(ex)) if (!known.includes(w.id)) fail("Training fragt unbekanntes Wort", ex.type, w.id);
  g.view = "home";
  g.resetCourseFrom(0);
  if (Object.keys(g.cs().seen || {}).length) fail("Zurücksetzen vergisst die eingeführten Wörter nicht");
  g.st.courses.it = { progress: {}, mistakes: [] };
}

// Every unit has 10 lessons plus the bonus station. Saves from before keep finished units finished.
{
  g.setCourse("fr"); g.st.course = "fr";
  const a1 = g.UNITS().filter(u => u.level === "A1"), a2 = g.UNITS().find(u => u.level === "A2");
  if (g.LESSONS_PER_UNIT !== 10 || g.UNITS().some(u => g.lessonsOf(u) !== 10)) fail("Lektionen pro Einheit falsch");
  if (g.lessonsTotal("fr") !== g.UNITS().length * 10) fail("Lektionen gesamt falsch", g.lessonsTotal("fr"));
  g.st.courses.fr = { progress: {}, mistakes: [] }; g.ui.level = "A1"; g.ui.tab = "path"; g.view = "home";
  const h = g.homeHTML();
  if ((h.match(/data-id="0-\d"/g) || []).length !== 10) fail("Einheit zeigt nicht 10 Lektionen");
  g.ui.pop = "0-0"; if (!g.homeHTML().includes("Lektion 1 von 10")) fail("Lektionsinfo zeigt nicht 10"); g.ui.pop = null;
  // The first four lessons bring in the unit's words in portions and practise each new word three times.
  const seenNew = new Set();
  for (let li = 0; li < 4; li++) {
    g.startLesson(0, li);
    const all = [g.L.cur, ...g.L.queue], fresh = all.filter(x => x.type === "intro").map(x => x.item.id);
    if (!fresh.length || fresh.length > Math.ceil(a1[0].words.length / 4)) fail("A1: neue Wörter pro Lektion", li + 1, fresh.length);
    for (const id of fresh) {
      seenNew.add(id);
      const n = all.filter(x => x.type !== "intro").reduce((k, x) => k + g.exWords(x).filter(w => w.id === id).length, 0);
      if (n < 3) fail("A1: neues Wort zu selten geübt", li + 1, id, n);
    }
    for (const id of fresh) g.cs().seen[id] = 1;
    g.L = null; g.view = "home";
  }
  if (seenNew.size !== a1[0].words.length) fail("A1: nach vier Lektionen nicht alle Wörter eingeführt", seenNew.size, a1[0].words.length);
  // Migration, saves from before 2026-10-26 (no lessonsV): 4 lessons were a full unit; in A1 only together with the station.
  g.st.courses.fr = { progress: { [a1[0].id]: 4, [a1[1].id]: 4, [a2.id]: 4, [g.UNITS()[30].id]: 3 }, mistakes: [], bonus: { [a1[0].id]: true, [a2.id]: true } };
  g.migrateLessons();
  let p = g.st.courses.fr.progress;
  if (p[a1[0].id] !== 10 || p[a1[1].id] !== 4 || p[a2.id] !== 10 || p[g.UNITS()[30].id] !== 3 || g.st.courses.fr.lessonsV !== 3) fail("Alte Spielstände (v1) falsch übernommen", JSON.stringify(p));
  p[a1[1].id] = 4; p[a2.id] = 5; g.migrateLessons();
  if (p[a1[1].id] !== 4 || p[a2.id] !== 5) fail("Übernahme läuft mehrfach");
  // lessonsV 2 (7 lessons in A1, 4 elsewhere): finished units stay finished, also without their station (it stays open).
  g.st.courses.fr = { lessonsV: 2, progress: { [a1[0].id]: 7, [a1[1].id]: 6, [a1[2].id]: 3, [a2.id]: 4, [g.UNITS()[30].id]: 2 }, mistakes: [], bonus: { [a1[0].id]: true } };
  g.migrateLessons(); p = g.st.courses.fr.progress;
  if (p[a1[0].id] !== 10 || p[a1[1].id] !== 6 || p[a1[2].id] !== 3 || p[a2.id] !== 10 || p[g.UNITS()[30].id] !== 2) fail("Alte Spielstände (v2) falsch übernommen", JSON.stringify(p));
  // Nothing finished gets locked again: the next unit stays open and the bonus mark is untouched.
  g.st.courses.fr.progress[a1[1].id] = 0; g.setCourse("fr"); g.st.course = "fr";
  if (!g.unitUnlocked(1) || !g.bonusDone(a1[0].id) || !g.unitComplete(0)) fail("Fertige Einheit nach Migration gesperrt");
  // A new course starts at the current version and is not migrated.
  g.st.courses.fr = {}; delete g.st.courses.fr; g.cs("fr").progress[a1[0].id] = 4; g.migrateLessons();
  if (g.cs("fr").progress[a1[0].id] !== 4 || g.cs("fr").lessonsV !== 3) fail("Neuer Kurs fälschlich migriert");
  g.st.courses.fr = { progress: {}, mistakes: [] }; g.ui.level = null;
}

// Tap hints: every word in a sentence or dialogue line can be tapped for a translation (numbers aside).
for (const code of codes) {
  g.setCourse(code);
  const C = g.COURSES[code], texts = [];
  for (const u of C.units) for (const s of u.sentences) texts.push([].concat(s.t)[0]);
  for (const d of C.dialogs) for (const t of d.turns) texts.push(t.p.t, ...t.a.map(a => a.t));
  for (const x of C.stories || []) for (const l of x.lines) texts.push(l.t);
  const missing = new Set();
  for (const t of texts) for (const w of g.hintSpans(t, "t").replace(/<button[^>]*>.*?<\/button>/g, " ").split(" "))
    if (w.trim() && !/^[\d.,:%€$?!¿¡-]+$/.test(w.trim())) missing.add(w.trim());
  if (missing.size) fail(`Tipp-Hilfe fehlt (${code})`, [...missing].slice(0, 20).join(", "));
  // Issue #8: the German sentences shown for translating into the language need a hint for every word, too.
  const missingDe = new Set();
  for (const u of C.units) for (const z of u.sentences) for (const w of g.hintSpans([].concat(z.de)[0], "de").replace(/<button[^>]*>.*?<\/button>/g, " ").split(" "))
    if (w.trim() && !/^[\d.,:%€$?!-]+$/.test(w.trim())) missingDe.add(w.trim());
  if (missingDe.size) fail(`Tipp-Hilfe für Deutsch fehlt (${code})`, [...missingDe].slice(0, 20).join(", "));
}

// Tabs: the path only on "Lernweg", practice only on "Üben"; Android's back button returns to the path first.
{
  g.setCourse("en"); g.st.course = "en"; g.view = "home";
  g.ui.tab = "path"; const p = g.homeHTML();
  if (!p.includes('class="path"') || p.includes('data-act="vocab"')) fail("Lernweg-Tab zeigt Falsches");
  g.ui.tab = "practice"; const q = g.homeHTML();
  if (q.includes('class="path"') || !q.includes('data-act="vocab"') || !q.includes("Tagesaufgaben")) fail("Üben-Tab zeigt Falsches");
  g.ui.tab = "shop"; if (!g.homeHTML().includes('data-act="buy"')) fail("Shop-Tab ohne Angebote");
  g.ui.tab = "friends"; if (!g.homeHTML().includes("Konto anlegen")) fail("Freunde-Tab ohne Konto zeigt keinen Hinweis");
  g.ui.tab = "practice";
  if (!global.window.opensprachfuchsBack() || g.ui.tab !== "path") fail("Zurück wechselt nicht zum Lernweg");
  if (global.window.opensprachfuchsBack()) fail("Zurück auf dem Lernweg sollte die App verlassen");
}

// Level tabs: the path shows one level (25 units each), the tab switches it, started units stay open.
{
  g.setCourse("en"); g.st.course = "en"; g.view = "home"; g.ui.tab = "path"; g.ui.level = null;
  const levels = ["A1", "A2", "B1", "B2"];
  for (const l of levels) if (g.UNITS().filter(u => u.level === l).length !== 25) fail("Stufe hat nicht 25 Einheiten", l);
  if (g.UNITS().map(u => u.level).join() !== [...g.UNITS().map(u => u.level)].sort().join()) fail("Einheiten nicht nach Stufe sortiert");
  g.cs().progress = {};
  let h = g.homeHTML();
  if (!h.includes('data-act="level" data-l="B2"') || (h.match(/class="unit-head/g) || []).length !== 25 || !h.includes("– Einheit 1 von 25")) fail("Stufen-Reiter oder A1-Pfad fehlen");
  g.click("level", { l: "B1" }); h = g.homeHTML();
  const b1 = g.UNITS().find(u => u.level === "B1");
  if (!h.includes(b1.title) || h.includes(g.UNITS()[0].title + "</h2>") || !h.includes("noch gesperrt")) fail("Reiter B1 zeigt nicht B1");
  g.cs().progress[b1.id] = 1;
  if (!g.homeHTML().includes(`data-act="words" data-u="${g.UNITS().indexOf(b1)}"`)) fail("Begonnene Einheit nach Umsortierung gesperrt");
  g.cs().progress = {}; g.ui.level = null;
}

// The fox: next to the current lesson on the path, a new line when tapped, cheering on the result screen.
{
  g.setCourse("es"); g.st.course = "es"; g.view = "home"; g.ui.tab = "path"; g.ui.level = null; g.ui.pop = null;
  const before = g.homeHTML();
  if ((before.match(/class="path-fox/g) || []).length !== 1 || !before.includes("img/fox.webp")) fail("Fuchs auf dem Lernweg fehlt");
  const say = h => (h.match(/class="fox-say"[^>]*>([^<]*)</) || [])[1];
  g.click("fox");
  const after = g.homeHTML();
  if (!after.includes("path-fox") || say(after) === say(before) || !after.includes(" hop")) fail("Fuchs reagiert nicht aufs Antippen", say(before), say(after));
}

// Shared answer helper for flows below: answers every task correctly through the real check().
function answerAll(L, gm = g) {
  for (let guard = 0; guard < 80 && gm.view === "lesson"; guard++) {
    const ex = L.cur;
    if (ex.type === "intro") { gm.cont(); continue; }
    if (ex.type === "match") { L.checked = true; L.res = { ok: true }; L.done++; L.right++; }
    else {
      if (["choice", "pic", "gap"].includes(ex.type)) L.sel = ex.ans;
      else if (ex.type === "bank" || ex.type === "listen") {
        const used = new Set(); L.picked = [];
        for (const t of ex.target.replace(/[.,!?¿¡]/g, "").split(" ").filter(Boolean)) { const tile = ex.tiles.find(x => x.t === t && !used.has(x.id)); used.add(tile.id); L.picked.push(tile.id); }
      } else if (ex.type === "type") global.document.getElementById = () => ({ value: ex.target });
      gm.ui.modal = null;
      gm.check(false);
      global.document.getElementById = () => el();
      if (!L.res || !L.res.ok) fail("Antwort abgelehnt", ex.type, ex.target || ex.full);
    }
    gm.cont();
  }
}

// Placement test: passing unlocks every unit up to the target.
g.setCourse("es"); g.st.course = "es";
g.startPlacement(5);
if (g.L.kind !== "placement" || g.L.queue.length < 10) fail("Einstufungstest startet nicht richtig");
answerAll(g.L);
if (g.view !== "result" || !g.result.placement) fail("Einstufungstest endet nicht im Ergebnis", g.view);
for (let i = 0; i <= 5; i++) if (g.done(g.UNITS()[i].id) < 4) fail("Einheit nicht freigeschaltet", i);
g.resultHTML();
if (!g.st.badges.placement) fail("Abzeichen Überflieger fehlt");
// Failing a placement test: three skipped answers end it, without unlocking anything. A report is queued.
g.st.courses.fr = { progress: {}, mistakes: [] }; g.setCourse("fr"); g.st.course = "fr";
g.startPlacement(8);
for (let i = 0; i < 3; i++) {
  if (g.L.cur.type === "match") g.cont();
  g.check(true);
  if (i === 0) { g.ui.modal = "report"; g.modalHTML(); g.click("sendreport"); }
  g.cont();
}
if (g.view !== "fail" || g.ui.fail !== "placement") fail("Nicht bestandener Test endet nicht auf der Fehlerseite", g.view);
if (g.done(g.UNITS()[0].id) !== 0) fail("Nicht bestandener Test schaltet trotzdem frei");
if (!g.st.reportQueue.length || !g.st.reportQueue[0].item || g.st.reportQueue[0].note === undefined) fail("Fehlermeldung nicht vorgemerkt");
g.statsHTML(); g.ui.bar = 3; g.statsHTML();
if (!g.st.history || !Object.keys(g.st.history).length) fail("Tagesstatistik leer");

// Hearts (issue #4, halved): at most 5, +1 per 6 right answers, one every 40 minutes, older saves are capped.
if (g.MAX_HEARTS !== 5) fail("Höchstzahl Herzen ist nicht 5", g.MAX_HEARTS);
if (g.fromSaved({ hearts: 9, courses: {} }).hearts !== 5) fail("Alter Spielstand mit mehr als 5 Herzen nicht gekappt");
g.setCourse("en"); g.st.course = "en"; g.st.settings.hearts = true; g.st.hearts = 0; g.st.heartsTs = Date.now();
g.startTraining(true, true);
if (g.L.queue.length + 1 < 7) fail("Auffüllrunde zu kurz", g.L.queue.length + 1);
answerAll(g.L);
if (g.view !== "result" || !g.result.refill) fail("Auffüllrunde endet nicht im Ergebnis", g.view);
// heartsGained counts only the hearts of the round (1 per 6 right answers); the daily-quest chest (+2) may come on top
// of that, depending on what earlier tests already did today, and is reported in result.quests.
const chestHearts = g.result.quests.some(q => /\+2 Herzen/.test(q)) ? 2 : 0;
if (g.result.heartsGained < 1 || g.st.hearts !== Math.min(g.MAX_HEARTS, g.result.heartsGained + chestHearts)) fail("Auffüllrunde lädt nicht auf", g.st.hearts, g.result.heartsGained, chestHearts);
g.resultHTML(); g.ui.modal = "hearts"; g.modalHTML(); g.ui.modal = null;

// Pausing listening mid-lesson turns every remaining audio task into a reading task.
g.st.listenOffUntil = 0; g.st.settings.listen = true; g.st.settings.audio = true;
g.startLesson(0, 2);
if (!g.L.queue.concat(g.L.cur).some(x => x.type === "listen" || x.audio)) fail("Lektion 3 ohne Hörübung, Test nicht aussagekräftig");
g.pauseListening();
for (let i = 0; i < 40 && g.view === "lesson"; i++) {
  if (g.L.cur.type === "listen" || g.L.cur.audio) { fail("Hörübung trotz Pause", g.L.cur.type); break; }
  g.exerciseHTML(g.L.cur);
  if (!g.L.queue.length) break;
  g.nextExercise();
}
g.resumeListening();
if (g.st.listenOffUntil !== 0) fail("Hören lässt sich nicht wieder einschalten");

// Resetting a course from a unit keeps earlier units and other courses.
g.setCourse("es"); g.st.course = "es";
for (const u of g.UNITS()) g.cs().progress[u.id] = g.lessonsOf(u);
const w1 = "w:" + g.UNITS()[1].words[0].id, w7 = "w:" + g.UNITS()[7].words[0].id;
g.srsUpdate(w1, true); g.srsUpdate(w7, true);
const frBefore = JSON.stringify(g.st.courses.fr);
g.resetCourseFrom(5);
if (g.done(g.UNITS()[4].id) !== 10 || g.done(g.UNITS()[5].id) !== 0 || g.done(g.UNITS()[19].id) !== 0) fail("Zurücksetzen ab Einheit 6 falsch");
if (!g.srs()[w1] || g.srs()[w7]) fail("Lernstufen falsch zurückgesetzt");
if (JSON.stringify(g.st.courses.fr) !== frBefore) fail("Andere Sprache verändert");
// Sonderstation und Medaille gehören zur Einheit: ab der gewählten Einheit gehen sie mit, davor bleiben sie.
{
  const c = g.cs();
  c.bonus = { [g.UNITS()[4].id]: true, [g.UNITS()[6].id]: true };
  c.mastery = { [g.UNITS()[4].id]: 2, [g.UNITS()[6].id]: 3 };
  g.resetCourseFrom(5);
  if (!g.bonusDone(g.UNITS()[4].id) || g.bonusDone(g.UNITS()[6].id)) fail("Sonderstation falsch zurückgesetzt");
  if (g.masteryOf(g.UNITS()[4].id) !== 2 || g.masteryOf(g.UNITS()[6].id) !== 0) fail("Medaille falsch zurückgesetzt");
}
g.ui.modal = "resetcourse"; g.modalHTML(); g.ui.modal = "resetfrom"; g.ui.ru = 5; g.modalHTML(); g.ui.modal = null;

// Two weeks without practice: one lesson back per 14 days, starting from the furthest one.
{
  g.setCourse("en"); g.st.course = "en"; g.st.settings.decay = true;
  const units = g.UNITS();
  g.cs().progress = { [units[0].id]: 4, [units[1].id]: 1 };
  const now = Date.now();
  g.cs().last = now - 29 * 864e5;
  const pt = JSON.stringify(g.st.courses.pt || null);
  const notes = g.applyDecay(now);
  if (g.done(units[1].id) !== 0 || g.done(units[0].id) !== 3) fail("Rückstufung falsch", g.done(units[0].id), g.done(units[1].id));
  if (!notes.some(n => n.code === "en" && n.lost === 2 && n.days === 29)) fail("Rückstufungs-Hinweis falsch", JSON.stringify(notes));
  if (g.applyDecay(now).some(n => n.code === "en")) fail("Rückstufung doppelt");
  if (JSON.stringify(g.st.courses.pt || null) !== pt) fail("Rückstufung trifft andere Sprache");
  g.st.settings.decay = false; g.cs().last = now - 40 * 864e5;
  if (g.applyDecay(now).length) fail("Rückstufung trotz ausgeschalteter Einstellung");
  g.st.settings.decay = true; g.ui.decay = notes; g.ui.tab = "path"; g.homeHTML(); g.ui.decay = null;
}

// Combo: ten right answers in a row in a lesson give 2 × 2 bonus XP.
{
  g.setCourse("en"); g.st.course = "en"; g.st.settings.hearts = false;
  g.startLesson(0, 0);
  const before = g.st.xp;
  answerAll(g.L);
  if (g.view !== "result") fail("Combo-Lektion endet nicht");
  else if (!g.resultHTML().includes("fox-cheer flip")) fail("Jubelnder Fuchs nach fehlerfreier Lektion fehlt");
  else if (g.result.bestCombo < 10 || g.result.comboBonus < 4) fail("Combo-Bonus fehlt", g.result.bestCombo, g.result.comboBonus);
  if (g.st.xp - before < 10 + 5 + g.result.comboBonus) fail("Combo-Bonus nicht gutgeschrieben");
}

// Finishing the last A1 unit opens the A2 tab.
{
  g.setCourse("en"); g.st.course = "en"; g.st.settings.hearts = false; g.ui.level = "A1";
  const lastA1 = g.UNITS().map(u => u.level).lastIndexOf("A1");
  g.cs().bonus = {};
  for (let i = 0; i < lastA1; i++) { g.cs().progress[g.UNITS()[i].id] = 10; g.cs().bonus[g.UNITS()[i].id] = true; }
  g.cs().progress[g.UNITS()[lastA1].id] = 9;
  g.startLesson(lastA1, 9); answerAll(g.L);
  // The bonus station is required: after the last lesson it is the next step, the next unit is still locked.
  if (g.view !== "result" || g.ui.level !== "A1" || g.unitUnlocked(lastA1 + 1)) fail("Sonderstation nicht Pflicht", g.ui.level);
  g.click("home");
  if (!/bonus-node current/.test(g.homeHTML())) fail("Sonderstation ist nicht der nächste Schritt");
  g.startBonus(lastA1); g.L.checked = true; g.L.res = { ok: true }; g.cont();
  if (g.view !== "result" || g.ui.level !== "A2" || !g.unitUnlocked(lastA1 + 1)) fail("Nach der letzten A1-Einheit nicht zu A2 gewechselt", g.view, g.ui.level);
  // Issue #7: "Weiter" goes back to the path at the current lesson, not to the top.
  const seen = [], qs = document.querySelector, top = window.scrollTo;
  document.querySelector = sel => ({ scrollIntoView: o => seen.push([sel, o.block]) }); window.scrollTo = () => seen.push(["top"]);
  g.ui.tab = "path"; g.click("home");
  if (g.view !== "home" || JSON.stringify(seen) !== '[[".node.current","center"]]') fail("Nach der Lektion nicht zur aktuellen Lektion gescrollt", JSON.stringify(seen));
  document.querySelector = qs; window.scrollTo = top;
  g.ui.level = null; g.cs().progress = {};
}

// Blitz round: one tap answers, the score counts right answers, the end of time finishes the round with a record.
{
  g.setCourse("fr"); g.st.course = "fr";
  g.startBlitz();
  if (g.L.kind !== "blitz" || !g.L.cur) fail("Blitzrunde startet nicht");
  for (let i = 0; i < 6; i++) {
    const ex = g.L.cur;
    if (!["choice", "pic"].includes(ex.type)) { fail("Blitzrunde mit falschem Aufgabentyp", ex.type); break; }
    g.blitzAnswer(i === 2 ? (ex.ans + 1) % ex.opts.length : ex.ans);
    g.footerHTML(); g.L.queue.push(g.blitzTask(g.L.pool)); g.nextExercise();
  }
  if (g.L.score !== 5) fail("Blitzrunde zählt falsch", g.L.score);
  g.L.endsAt = Date.now() - 1; g.blitzTick();
  if (g.view !== "result" || !g.result.blitz || g.result.blitz.score !== 5 || !g.result.blitz.record) fail("Blitzrunde endet nicht mit Rekord", g.view);
  g.resultHTML();
}

// Daily quests: three per day, paid out once when met, bonus chest after all three.
{
  g.st.quests = null;
  const qs = g.todaysQuests();
  if (qs.length !== 3 || new Set(qs.map(q => q.id)).size !== 3) fail("Tagesaufgaben nicht drei verschiedene", qs.map(q => q.id));
  const rec = g.dayRec();
  for (const q of qs) rec[q.key] = Math.max(rec[q.key] || 0, q.goal);
  const xp = g.st.xp, msgs = g.claimQuests();
  if (msgs.length !== 4 || g.st.xp - xp < 50) fail("Tagesaufgaben zahlen nicht aus", msgs.length, g.st.xp - xp);
  if (g.claimQuests().length) fail("Tagesaufgaben doppelt ausgezahlt");
}

// Gems and shop.
{
  g.setCourse("en"); g.st.course = "en"; g.st.settings.hearts = true; g.st.hearts = 5; g.st.boostUntil = 0;
  g.st.gems = 0; g.startLesson(0, 0); answerAll(g.L);
  if (g.result.gems < 5 || g.st.gems !== g.result.gems) fail("Edelsteine für Lektion fehlen", g.result.gems, g.st.gems);
  g.st.gems = 200; g.st.freezes = 0;
  if (!g.buy("freeze") || g.st.freezes !== 1 || g.st.gems !== 150) fail("Serienschutz kaufen klappt nicht");
  g.st.hearts = 2; if (!g.buy("hearts") || g.st.hearts !== 5) fail("Herzen kaufen klappt nicht");
  if (g.buy("hearts")) fail("Volle Herzen trotzdem verkauft");
  if (!g.buy("boost") || g.buy("boost")) fail("Doppel-XP falsch");
  g.cs().last = Date.now() - 1000;
  if (!g.buy("pause") || g.cs().last < Date.now() + 13 * 864e5) fail("Pausenschutz verschiebt nicht");
  if (g.buy("pause")) fail("Pausenschutz doppelt gekauft");
  { // Issue #26: a finished round must not move the protection back to today ("schon mehrfach gekauft, verschwindet wieder").
    const until = g.cs().last;
    g.startLesson(0, 0); answerAll(g.L);
    if (g.cs().last !== until) fail("Pausenschutz nach einer Lektion weg", g.cs().last - Date.now());
    g.st.gems = 200;
    if (g.buy("pause")) fail("Pausenschutz trotz aktivem Schutz nochmal verkauft");
    if (!g.shopItems().find(x => x.id === "pause").note.includes("noch")) fail("Pausenschutz zeigt die Restdauer nicht");
  }
  g.st.gems = 0; if (g.buy("freeze")) fail("Kauf ohne genug Edelsteine");
  const d = new Date(); d.setDate(d.getDate() - 2);
  g.st.lastDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  g.st.streak = 7; g.st.freezes = 1;
  if (g.shownStreak() !== 7) fail("Serie trotz Schutz nicht angezeigt");
  // Issue #44: the Android widget and reminder learn from the page until when the streak holds (freezes included).
  {
    const ds = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    const t = new Date(), tom = new Date(); tom.setDate(tom.getDate() + 1);
    if (g.streakUntil() !== ds(t)) fail("Serie gilt bis: Serienschutz nicht eingerechnet", g.streakUntil());
    g.st.freezes = 2; if (g.streakUntil() !== ds(tom)) fail("Serie gilt bis: zwei Serienschutze", g.streakUntil());
    g.st.freezes = 0; const y = new Date(); y.setDate(y.getDate() - 1);
    if (g.streakUntil() !== ds(y)) fail("Serie gilt bis: ohne Schutz nicht der Tag nach dem letzten Lerntag", g.streakUntil());
    g.st.freezes = 1;
  }
  g.startLesson(0, 0); answerAll(g.L);
  if (g.st.streak !== 8 || g.st.freezes !== 0 || g.result.freezeUsed !== 1) fail("Serienschutz greift nicht", g.st.streak, g.st.freezes);
  g.st.boostUntil = Date.now() + 60000; g.startLesson(0, 0); answerAll(g.L);
  if (!g.result.boosted || g.result.xp < 30) fail("Doppel-XP wirkt nicht", g.result.xp);
  g.st.boostUntil = 0; g.ui.modal = "shop"; g.modalHTML(); g.ui.modal = null; g.resultHTML();
}

// The fox as avatar (avatar.js): the catalogue, try-on and buying in the shop, merging two saves, milestone gifts and
// the parts as layers of every fox (on the path, cheering, sad).
{
  const a = loadGame();
  const cats = new Set(a.AVATAR_CATS.map(c => c.id)), ids = new Set();
  for (const it of a.AVATAR_ITEMS) {
    if (!/^[a-z][a-z0-9_]*$/.test(it.id) || ids.has(it.id)) fail("Avatar-Teil ohne gültige, eindeutige ID", it.id);
    ids.add(it.id);
    if (!cats.has(it.cat)) fail("Avatar-Teil in unbekannter Kategorie", it.id, it.cat);
    if (it.free ? !a.AVATAR_MILESTONES[it.free] || it.price !== undefined : !(Number.isInteger(it.price) && it.price > 0)) fail("Avatar-Teil ohne Preis oder Meilenstein", it.id);
    if (!it.name || it.at.length !== 4 || it.at.some(v => typeof v !== "number")) fail("Avatar-Teil ohne Name oder Position", it.id);
    const file = path.join(__dirname, "..", "app", "img", "acc", it.id + ".svg");
    if (!fs.existsSync(file)) { fail("Grafik fehlt", file); continue; }
    const vb = (fs.readFileSync(file, "utf8").match(/viewBox="([^"]+)"/) || [])[1];
    if (!vb || vb.split(/\s+/).map(Number).join() !== it.at.join()) fail("Position im Katalog passt nicht zur viewBox der Grafik", it.id, vb, it.at);
  }
  for (const c of cats) { const n = a.AVATAR_ITEMS.filter(it => it.cat === c).length; if (n < 2 || n > 3) fail("Kategorie mit falscher Teilezahl", c, n); }
  for (const m of Object.keys(a.AVATAR_MILESTONES)) if (!a.AVATAR_ITEMS.some(it => it.free === m)) fail("Meilenstein ohne Teil", m);
  a.view = "home"; a.ui.tab = "shop";
  let h = a.homeHTML();
  for (const c of cats) if (!h.includes(`data-act="avcat" data-cat="${c}"`)) fail("Kategorie fehlt im Shop", c);
  // Try on, then buy with a confirmation: exactly the price, once.
  a.st.gems = 200;
  a.click("avcat", { cat: "eyes" }); a.click("avpick", { id: "sunglasses" });
  h = a.homeHTML();
  if (a.ui.avTry !== "sunglasses" || !h.includes("Anprobe: Sonnenbrille") || !/class="av-stage"><span class="fox-av[^>]*><img[^>]*data-part="sunglasses"/.test(h)) fail("Anprobieren zeigt die Brille nicht am Fuchs");
  if (a.ownsPart("sunglasses") || a.avatarLook().eyes || a.st.gems !== 200) fail("Anprobieren kauft oder zieht schon an");
  a.click("avbuy", { id: "sunglasses" });
  if (a.ui.modal !== "buypart" || !a.modalHTML().includes('data-act="doavbuy"')) fail("Kaufbestätigung fehlt");
  a.click("doavbuy");
  if (a.st.gems !== 120 || !a.ownsPart("sunglasses") || a.avatarLook().eyes !== "sunglasses" || a.ui.avTry) fail("Kauf zieht nicht genau den Preis ab oder zieht nicht an", a.st.gems);
  a.click("avbuy", { id: "sunglasses" }); a.click("doavbuy");
  if (a.buyPart("sunglasses") || a.st.gems !== 120 || a.st.avatar.owned.filter(id => id === "sunglasses").length !== 1) fail("Teil zweimal gekauft", a.st.gems);
  if (a.buyPart("beanie") || a.ownsPart("beanie")) fail("Meilenstein-Teil lässt sich kaufen");
  if (a.buyPart("crown") || a.st.gems !== 120) fail("Kauf ohne genug Edelsteine");
  if (a.buyPart("nope")) fail("Unbekanntes Teil gekauft");
  a.click("avpick", { id: "sunglasses" });
  if (a.avatarLook().eyes) fail("Antippen zieht die Brille nicht aus");
  a.click("avpick", { id: "sunglasses" });
  if (a.avatarLook().eyes !== "sunglasses") fail("Antippen zieht die Brille nicht wieder an");
  if (a.wearPart("head", "crown")) fail("Nicht gekauftes Teil angezogen");
  if (!JSON.parse(a.store["opensprachfuchs-state"]).avatar.owned.includes("sunglasses")) fail("Kauf nicht gespeichert");
  // Two devices: a part bought on each one; both stay. The look comes from the device that changed it last.
  const t = Date.now();
  const x = a.fromSaved({ savedAt: t + 5000, gems: 10, avatar: { owned: ["cap"], worn: { head: "cap" }, bg: "", at: t } });
  const y = a.fromSaved({ savedAt: t, gems: 30, avatar: { owned: ["crown", "bg_night"], worn: { head: "crown" }, bg: "bg_night", at: t + 1000 } });
  for (const m of [a.mergeSaves(x, y), a.mergeSaves(y, x), a.mergeSaves(JSON.parse(JSON.stringify(x)), JSON.parse(JSON.stringify(y)))]) {
    if (!["cap", "crown", "bg_night"].every(id => m.avatar.owned.includes(id)) || m.avatar.owned.length !== 3) fail("Zusammenführen verliert einen Kauf", m.avatar.owned);
    if (m.avatar.worn.head !== "crown" || m.avatar.bg !== "bg_night") fail("Zusammenführen nimmt nicht das zuletzt geänderte Aussehen", JSON.stringify(m.avatar));
  }
  const plain = a.fromSaved({ savedAt: t + 9000, xp: 50 }), m2 = a.mergeSaves(x, plain);
  if (!m2.avatar || m2.avatar.worn.head !== "cap" || !m2.avatar.owned.includes("cap")) fail("Gerät ohne Fuchs-Daten zieht den Fuchs aus", JSON.stringify(m2.avatar));
  const taken = a.fromSaved({ savedAt: t + 9000, avatar: { owned: ["cap"], worn: {}, bg: "", at: t + 9000 } });
  if (a.mergeSaves(x, taken).avatar.worn.head) fail("Ausgezogenes Teil kommt beim Zusammenführen zurück");
  // Milestones: each free part comes once, when its condition holds.
  const b = loadGame();
  b.st.badges = {}; b.st.bestStreak = 0; b.st.avatar = undefined;
  if (b.checkAvatarMilestones().length) fail("Meilenstein-Teil ohne Meilenstein");
  b.st.bestStreak = 7;
  let got = b.checkAvatarMilestones().map(it => it.id);
  if (got.join() !== "beanie" || b.checkAvatarMilestones().length) fail("Pudelmütze nicht genau einmal für 7 Tage Serie", got);
  b.startLesson(0, 0); answerAll(b.L, b);
  if (!b.result.parts || !b.result.parts.some(it => it.id === "round_glasses") || !b.resultHTML().includes("Runde Brille")) fail("Runde Brille fürs erste Abzeichen fehlt im Ergebnis");
  const u0 = b.UNITS()[0];
  b.cs().progress[u0.id] = b.lessonsOf(u0);
  got = b.checkAvatarMilestones().map(it => it.id);
  if (got.join() !== "bandana") fail("Halstuch für die erste Einheit nicht vergeben", got);
  b.startLesson(0, 1); answerAll(b.L, b);
  if (b.result.parts.length || b.checkAvatarMilestones().length) fail("Meilenstein-Teil doppelt vergeben");
  for (const id of ["beanie", "round_glasses", "bandana"]) if (b.st.avatar.owned.filter(x => x === id).length !== 1) fail("Meilenstein-Teil nicht genau einmal im Besitz", id);
  // The parts are layers inside the box that moves, in every fox.
  b.st.avatar.owned.push("crown", "scarf", "hoodie", "bg_night", "sunglasses");
  for (const [cat, id] of [["head", "crown"], ["eyes", "sunglasses"], ["neck", "scarf"], ["body", "hoodie"], ["bg", "bg_night"]]) if (!b.wearPart(cat, id)) fail("Anziehen klappt nicht", id);
  const inBox = html => { const m = html.match(/<span class="fox-av[^"]*"[^>]*>(.*?)<img class="fox-img" src="img\/fox\.webp"/s); return m ? ["crown", "sunglasses", "scarf", "hoodie", "bg_night"].every(id => m[1].includes(`data-part="${id}"`)) : false; };
  if (!inBox(b.foxHTML("left"))) fail("Fuchs auf dem Lernweg ohne Avatar");
  if (!inBox(b.foxCheerHTML(true)) || !inBox(b.foxCheerHTML(false))) fail("Jubelnder Fuchs ohne Avatar");
  if (!inBox(b.foxSadHTML())) fail("Trauriger Fuchs ohne Avatar");
  b.view = "home"; b.ui.tab = "path";
  if (!inBox(b.homeHTML())) fail("Lernweg zeigt den Fuchs ohne Avatar");
  if (!/left:-?[\d.]+%;top:-?[\d.]+%;width:[\d.]+%;height:[\d.]+%/.test(b.foxHTML("left"))) fail("Avatar-Teile nicht in Prozent verankert");
  // A part from a newer app version (unknown id) is ignored, not drawn and not lost.
  b.st.avatar.owned.push("future_hat"); b.st.avatar.worn.head = "future_hat";
  if (b.foxHTML("left").includes("future_hat") || b.avatarLook().head) fail("Unbekanntes Teil wird gezeichnet");
  if (!b.st.avatar.owned.includes("future_hat")) fail("Unbekanntes Teil geht verloren");
}

// Dialogues: every scene of every language can be played to the end; a wrong pick counts as a mistake.
for (const code of codes) {
  g.setCourse(code); g.st.course = code;
  g.ui.tab = "practice"; g.ui.dgroup = null; g.view = "home";
  let h = g.homeHTML();
  if (isMain(code)) {
    if (g.dialogsFor(code).length !== 20) fail("Gesprächsanzahl", code, g.dialogsFor(code).length);
    for (const grp of ["restaurant", "taxi", "hotel", "pharmacy"]) if (g.dialogsFor(code).filter(d => d.group === grp).length !== 5) fail("Nicht 5 Gespräche in", grp, code);
    // Practice tab: categories with progress, a tap opens the five dialogues of one category.
    if ((h.match(/data-act="dgroup"/g) || []).length !== 4 || h.includes('data-act="dialog"')) fail("Gesprächs-Kategorien falsch", code);
    g.click("dgroup", { g: "taxi" }); h = g.homeHTML();
    if ((h.match(/data-act="dialog"/g) || []).length !== 5 || !h.includes("Im Taxi")) fail("Kategorie Taxi zeigt nicht 5 Gespräche", code);
  } else if (!g.dialogsFor(code).length || (h.match(/data-act="dgroup"/g) || []).length !== g.dialogsFor(code).length) fail("Gespräche ohne Kategorie fehlen im Üben-Tab", code); // each one on its own
  g.ui.dgroup = null; g.ui.tab = "path";
  for (const sc of g.dialogsFor(code)) {
    g.startDialog(sc.id);
    let first = true;
    for (let guard = 0; guard < 20 && !g.L.checked; guard++) {
      const d = g.L.dlg, right = d.order.indexOf(0);
      if (first) { g.dialogPick((right + 1) % 3); first = false; }
      g.exerciseHTML(g.L.cur); g.footerHTML();
      g.dialogPick(right);
    }
    if (!g.L.checked || g.L.mistakes !== 1) fail("Gespräch nicht beendet", code, sc.id);
    g.cont();
    if (g.view !== "result" || g.result.dialog !== sc.title || !g.cs().dialogs[sc.id]) fail("Gespräch endet nicht im Ergebnis", code, sc.id);
  }
}

// Mastery: a clean round raises the medal, too many mistakes end it without one.
{
  g.setCourse("es"); g.st.course = "es"; g.cs().progress[g.UNITS()[0].id] = 7; g.cs().mastery = {};
  g.startMaster(0);
  if (g.L.kind !== "master" || g.L.queue.length < 10) fail("Meisterschaft startet nicht");
  if (g.exerciseHTML(g.L.cur).includes('class="hw')) fail("Worthilfen in der Meisterschaft");
  answerAll(g.L);
  if (g.masteryOf(g.UNITS()[0].id) !== 1 || !g.result.master) fail("Bronze nicht vergeben", g.masteryOf(g.UNITS()[0].id));
  g.startMaster(0);
  for (let i = 0; i < 2; i++) { if (g.L.cur.type === "match") { g.nextExercise(); } g.check(true); g.cont(); }
  if (g.view !== "fail" || g.ui.fail !== "master" || g.masteryOf(g.UNITS()[0].id) !== 1) fail("Silber trotz zwei Fehlern", g.view);
  g.ui.modal = "master"; g.ui.mu = 0; g.modalHTML(); g.ui.modal = null;
}

// Spaced repetition: correct moves a word up and schedules it later, wrong resets it.
g.setCourse("en");
g.srsUpdate("w:test", true);
if (g.srs()["w:test"].box !== 1 || g.srs()["w:test"].due <= Date.now()) fail("SRS: richtige Antwort plant nicht korrekt");
g.srsUpdate("w:test", true);
if (g.srs()["w:test"].box !== 1) fail("SRS: Wiederholung in derselben Sitzung zählt doppelt");
g.srsUpdate("w:test", false);
if (g.srs()["w:test"].box !== 0) fail("SRS: falsche Antwort setzt nicht zurück");

// Bonus stations: every unit of every language can build its game; each kind can be won; the reward comes once.
for (const code of codes) {
  g.setCourse(code);
  g.UNITS().forEach((u, i) => {
    g.startBonus(i);
    const G = g.L.game, n = G.kind === "wordsearch" || G.kind === "scramble" || G.kind === "memory" ? G.words.length : G.kind === "guess" ? G.words.length : G.story.lines.length;
    if (n < 4) fail(`Sonderstation zu klein (${code}, ${u.id}, ${G.kind})`, n);
    g.render();
  });
}
g.view = "home";
{
  g.setCourse("en"); g.st.course = "en"; g.cs().bonus = {};
  const solve = () => {
    const G = g.L.game;
    if (G.kind === "wordsearch") for (const w of G.words) { const a = w.cells[0], b = w.cells[w.cells.length - 1]; g.wordSearchTap(a[0], a[1]); g.wordSearchTap(b[0], b[1]); }
    if (G.kind === "scramble") while (!g.L.checked) { const w = G.words[G.i], used = new Set(); for (const ch of w.word) { const j = G.tiles.findIndex((t, k) => t === ch && !used.has(k)); used.add(j); g.scrambleTap(j); } }
    if (G.kind === "memory") for (let p = 0; p < G.words.length; p++) G.cards.forEach((c, i) => { if (c.p === p) g.memoryTap(i); });
    if (G.kind === "guess") while (!g.L.checked) { for (const ch of new Set(G.words[G.i].word)) g.guessTap(ch); g.guessNext(G); }
    if (G.kind === "story") { g.storyToQuestions(); while (!g.L.checked) g.storyAnswer(G.order.indexOf(0)); }
  };
  const kinds = new Set();
  for (let i = 0; i < 4; i++) {
    g.startBonus(i); kinds.add(g.L.game.kind); solve();
    if (!g.L.checked || g.L.mistakes) fail("Sonderstation nicht lösbar", g.L.game.kind, g.L.mistakes);
    const xp = g.st.xp, gems = g.st.gems; g.cont();
    if (g.view !== "result" || !g.result.bonus || g.st.xp - xp < 15 || g.st.gems - gems < 5 || !g.bonusDone(g.UNITS()[i].id)) fail("Belohnung der Sonderstation fehlt", g.st.xp - xp, g.st.gems - gems);
  }
  if (kinds.size !== 4) fail("Minispiele wechseln sich nicht ab", [...kinds].join(","));
  // Every fifth unit has a short story in every language.
  for (const code of codes.filter(isMain)) { g.setCourse(code); const n = g.UNITS().filter((u, i) => g.bonusKind(i) === "story").length; if (n !== 16) fail(`Kurzgeschichten fehlen (${code})`, n); }
  g.setCourse("en");
  g.startBonus(4);
  if (g.L.game.kind !== "story" || !g.exerciseHTML(g.L.cur).includes("Alles vorlesen")) fail("Kurzgeschichte an Stufe 5 fehlt", g.L.game.kind);
  solve(); g.cont();
  if (g.view !== "result" || !g.bonusDone(g.UNITS()[4].id)) fail("Kurzgeschichte nicht abschließbar");
  g.startBonus(0); solve(); const xp = g.st.xp, gems = g.st.gems; g.cont();
  if (g.st.xp - xp !== 5 || g.st.gems !== gems) fail("Wiederholung der Sonderstation falsch belohnt", g.st.xp - xp, g.st.gems - gems);
  // A unit whose pack has no playable words for the game (new packs): the station must neither crash nor block the path.
  {
    const saved = [g.UNITS()[0].words, g.UNITS()[1].words];
    g.UNITS()[0].words = []; g.UNITS()[1].words = [];
    g.startBonus(1);
    if (!g.L.checked || g.exerciseHTML(g.L.cur).includes("undefined")) fail("Sonderstation ohne Wörter nicht abschließbar", g.L.game.kind);
    g.cont();
    if (g.view !== "result" || !g.bonusDone(g.UNITS()[1].id)) fail("Sonderstation ohne Wörter nicht abgeschlossen");
    g.UNITS()[0].words = saved[0]; g.UNITS()[1].words = saved[1];
  }
  // The fifth unit of a level has a story, the 25th has none and falls back to a mini game; both have a bonus station.
  { const us = g.UNITS(); const i5 = us.findIndex(u => u.level === "A2"), i25 = i5 + 24;
    if (g.bonusKind(i5 + 4) !== "story" || g.bonusKind(i25) === "story" || us[i25].level !== "A2" || us[i25 + 1].level !== "B1") fail("Sonderstation von Einheit 5/25 falsch", g.bonusKind(i25));
    g.cs().progress[us[i25].id] = 10; g.ui.level = "A2";
    if (!/bonus-node (current|done)/.test(g.homeHTML())) fail("Sonderstation von Einheit 25 fehlt"); }
  // The bonus node: locked until all lessons of the unit are done, then open.
  g.cs().progress = {}; g.ui.level = "A1"; g.view = "home"; g.ui.tab = "path";
  if (!g.homeHTML().includes('bonus-node locked')) fail("Sonderstation nicht gesperrt");
  g.cs().progress[g.UNITS()[0].id] = 4;
  if (!g.homeHTML().includes('bonus-node locked')) fail("Sonderstation schon nach vier Lektionen offen");
  g.cs().progress[g.UNITS()[0].id] = 10;
  if (!/bonus-node (current|done)/.test(g.homeHTML())) fail("Sonderstation nach zehn Lektionen nicht offen");
  g.cs().progress = {}; g.cs().bonus = {}; g.ui.level = null;
}

// Intro cards: the example sentence shows the word itself; a sentence with another form says which one ("tchau" -> "até logo").
{
  g.setCourse("pt");
  const u = g.UNITS().find(x => x.words.some(w => w.t === "tchau")), w = u.words.find(x => x.t === "tchau"), z = g.exampleFor(w, u.sentences);
  if (!z || z.form !== "até logo") fail("Beispielsatz mit anderer Form nicht gekennzeichnet", JSON.stringify(z));
  const own = u.words.find(x => { const y = g.exampleFor(x, u.sentences); return y && !y.form; });
  if (own && g.exampleFor(own, u.sentences).form) fail("Beispielsatz mit dem Wort selbst gekennzeichnet");
  g.setCourse("en");
}

// Every dialog renders (settings, account, privacy, languages, friends).
for (const m of ["settings", "account", "privacy", "packs", "courses", "addfriend", "myqr", "signout", "deleteaccount", "reset"]) { g.ui.modal = m; g.modalHTML(); }
g.ui.modal = null;
for (const v of ["welcome", "signin", "langs"]) { g.view = v; g.render(); }
g.view = "home";

// No voice on the phone for the language: a notice with an install button, and listening tasks turn into reading tasks.
{
  let installed = false;
  const v = loadGame({ AndroidBridge: { speak: () => true, speakQueued: () => true, stop() {}, canRecognize: () => false, startListening() {}, stopListening() {}, appVersion: () => "0.0.10",
    setReminder() {}, reportDay() {}, copy() {}, share() {}, openUrl() {}, takeLink: () => "", voiceState: lang => (lang === "it-IT" ? "missing" : "ok"), installVoice: () => { installed = true; } } });
  v.st.settings.audio = true; v.setCourse("it"); v.st.course = "it"; v.view = "home"; v.ui.tab = "path"; v.ui.modal = null;
  v.click("pickcourse", { c: "it" });
  if (!v.homeHTML().includes("Keine Stimme für Italienisch")) fail("Hinweis bei fehlender Stimme fehlt");
  v.click("installvoice");
  if (!installed) fail("Stimme installieren öffnet nichts");
  v.startLesson(0, 1);
  const kinds = []; for (let i = 0; i < 40 && v.view === "lesson"; i++) { kinds.push(v.L.cur.type + (v.L.cur.audio ? ":audio" : "")); v.L.queue.length ? v.nextExercise() : v.cont(); }
  if (kinds.some(k => k === "listen" || k.endsWith(":audio"))) fail("Hörübung trotz fehlender Stimme", kinds.join(","));
  v.click("voicehide");
  if (v.homeHTML().includes("Keine Stimme")) fail("Stimmen-Hinweis lässt sich nicht ausblenden");
  v.click("pickcourse", { c: "en" });
  if (v.homeHTML().includes("Keine Stimme")) fail("Stimmen-Hinweis für eine Sprache mit Stimme");
}

// App mode: with an AndroidBridge the game speaks through the phone, listens for speaking tasks and handles back.
{
  const spoken = [], calls = [];
  const a = loadGame({ AndroidBridge: { speak: (t, lang) => { spoken.push(lang + ":" + t); return true; }, speakQueued: (t, lang) => { spoken.push("queued:" + lang + ":" + t); return true; }, stop() {},
    canRecognize: () => true, startListening: lang => calls.push("listen:" + lang), stopListening() {}, appVersion: () => "0.0.1",
    setReminder: (on, h, m) => calls.push(`reminder:${on}:${h}:${m}`), reportDay: (day, streak, until) => calls.push(`day:${day}:${streak}:${until}`), copy: t => calls.push("copy:" + t), share() {}, openUrl() {} } });
  a.st.settings.audio = true;
  a.setCourse("pt"); a.speak("Bom dia!");
  if (spoken[0] !== "pt-BR:Bom dia!") fail("App: Sprachausgabe des Handys nicht genutzt", spoken[0]);
  if (!calls.some(c => c.startsWith("reminder:false"))) fail("App: Erinnerung beim Start nicht übergeben");
  if (!calls.includes("day::0:")) fail("App: Lerntag beim Start nicht mit Gültigkeit der Serie gemeldet", calls.filter(c => c.startsWith("day")));
  a.setCourse("en"); a.st.course = "en";
  const u = a.UNITS()[0], pool = { words: u.words, sentences: u.sentences, used: new Set(), prefer: new Set() };
  const sp = a.generate("speak", pool);
  if (!sp || sp.type !== "speak") fail("App: keine Sprechübung erzeugt");
  else {
    a.startLesson(0, 3); a.L.queue.unshift(sp); a.L.cur = a.L.queue.shift(); a.L.checked = false; a.L.mic = ""; a.L.heard = null;
    a.exerciseHTML(a.L.cur); a.startRecognition();
    if (!calls.includes("listen:en-US")) fail("App: Spracherkennung nicht gestartet");
    global.window.opensprachfuchsSpeech({ type: "result", texts: [sp.target.toLowerCase().replace(/[.!?]/g, "")] });
    if (!a.L.checked || !a.L.res.ok) fail("App: richtig gesprochener Satz abgelehnt", sp.target);
    a.L.cur = Object.assign({}, sp); a.L.checked = false; a.L.mic = ""; a.L.heard = null; a.startRecognition();
    global.window.opensprachfuchsSpeech({ type: "result", texts: ["completely different words here"] });
    if (!a.L.checked || a.L.res.ok) fail("App: falsch gesprochener Satz angenommen");
    a.L.cur = Object.assign({}, sp); a.L.checked = false; a.pauseSpeaking();
    if (a.L.cur.type !== "bank") fail("App: Sprechen pausieren wandelt die Aufgabe nicht um");
  }
  // Issue #5: in a dialogue the partner's next line waits for your own line (queued), it does not talk over it.
  {
    a.setCourse("fr"); a.st.course = "fr"; a.st.listenOffUntil = 0; a.st.settings.audio = true;
    const sc = a.dialogsFor("fr")[0];
    a.startDialog(sc.id); spoken.length = 0;
    a.dialogPick(a.L.dlg.order.indexOf(0));
    const mine = sc.turns[0].a[0].t, next = sc.turns[1].p.t;
    if (spoken[0] !== "fr-FR:" + mine || spoken[1] !== "queued:fr-FR:" + next || spoken.length !== 2) fail("Gespräch: Sätze nicht nacheinander gesprochen", JSON.stringify(spoken));
    a.ui.modal = null; a.setCourse("en"); a.st.course = "en";
  }
  a.ui.modal = "settings"; if (!a.modalHTML().includes('data-k="reminder"')) fail("App: Erinnerung fehlt in den Einstellungen");
  a.ui.modal = null;
  a.startLesson(0, 0);
  if (!global.window.opensprachfuchsBack() || a.ui.modal !== "quit") fail("App: Zurück in der Lektion fragt nicht nach");
  a.ui.modal = null;
}

// App updates: pre-releases count, the APK is linked directly, the dialog comes once per version, the notice stays until installed.
(async () => {
  const releases = [{ tag_name: "v0.0.1", prerelease: true, draft: false, html_url: "u1", assets: [] }, { tag_name: "v0.0.3", draft: true, html_url: "u3" },
    { tag_name: "v0.0.2", prerelease: true, draft: false, html_url: "u2", body: "## Neu\n- **Italienisch** als Sprache (#5)\n- [Logo](x) neu\n\nText",
      assets: [{ name: "opensprachfuchs-0.0.2.apk", size: 1258291, browser_download_url: "https://github.com/x/releases/download/v0.0.2/opensprachfuchs-0.0.2.apk" }] }];
  let online = true;
  const fetchImpl = async url => {
    if (/api\.github\.com/.test(url) && !/\/releases\?/.test(url)) fail("Update-Prüfung fragt die falsche Adresse ab", url);
    if (!/api\.github\.com/.test(url) || !online) throw new Error("offline"); // backend calls at start-up
    return new Response(JSON.stringify(releases));
  };
  const opened = [], bridge = v => ({ appVersion: () => v, setReminder() {}, reportDay() {}, speak() {}, stop() {}, openUrl: u => opened.push(u) });
  const store = { "opensprachfuchs-state": JSON.stringify({ onboarded: true, course: "en" }) };
  const u = loadGame({ AndroidBridge: bridge("0.0.1") }, { fetch: fetchImpl, store });
  u.view = "home"; u.ui.modal = null;
  await u.checkAppUpdate(true);
  const up = u.ui.appUpdate;
  if (!up || up.version !== "0.0.2" || up.url !== "u2" || !/\.apk$/.test(up.apk)) fail("App-Update (Vorabversion) nicht erkannt", JSON.stringify(up));
  else {
    if (JSON.stringify(up.notes) !== JSON.stringify(["Italienisch als Sprache", "Logo neu"])) fail("Was ist neu falsch", JSON.stringify(up.notes));
    if (u.ui.modal !== "appupdate" || !u.modalHTML().includes("Herunterladen · 1,2 MB")) fail("Update-Dialog fehlt", u.ui.modal);
    u.click("openupdate");
    if (opened[0] !== up.apk || u.ui.modal) fail("Download öffnet nicht die APK", opened[0]);
    u.ui.tab = "path"; if (!u.homeHTML().includes("Neue App-Version 0.0.2")) fail("Update-Hinweis im Lernweg fehlt");
  }
  // Next start, offline: the remembered update is still shown, but the dialog does not come again.
  online = false;
  const again = loadGame({ AndroidBridge: bridge("0.0.1") }, { fetch: fetchImpl, store });
  again.view = "home"; again.ui.modal = null; await again.checkAppUpdate();
  if (!again.ui.appUpdate || again.ui.modal === "appupdate") fail("Gemerktes Update falsch angezeigt", again.ui.modal);
  // After installing 0.0.2 the notice disappears; a manual check reports that the app is current.
  online = true;
  const same = loadGame({ AndroidBridge: bridge("0.0.2") }, { fetch: fetchImpl, store });
  await same.checkAppUpdate(true);
  if (same.ui.appUpdate || store["opensprachfuchs-update"]) fail("App-Update angeboten, obwohl die Version aktuell ist");
  if (!/neueste Version \(0\.0\.2\)/.test(same.ui.updateNote || "")) fail("Manuelle Prüfung meldet nichts", same.ui.updateNote);
  same.ui.modal = "settings"; if (!same.modalHTML().includes("neueste Version")) fail("Ergebnis der Prüfung fehlt in den Einstellungen");
  // The streak screen: the first finished round of a day raises the streak and gets its own screen, with the
  // shared streaks that are running underneath. A second round on the same day must not show it again.
  {
    const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    g.setCourse("en"); g.st.course = "en"; g.st.settings.hearts = false;
    g.st.lastDay = day(1); g.st.streak = 4; g.st.day = day(0); g.st.dayLessons = 0;
    g.view = "home"; g.startLesson(0, 0); answerAll(g.L);
    if (g.view !== "result" || g.result.streakUp !== 5) fail("Serie nach der ersten Runde des Tages nicht gewachsen", g.view, g.result && g.result.streakUp);
    if (!g.resultHTML().includes('data-act="resultdone"')) fail("Weiter auf dem Ergebnis führt nicht weiter");
    g.st.friends = { 1: "Anna" };
    g.friends.list = [
      { id: 1, status: "accepted", code: "AAAA-1111", streak: 12, streakDay: day(0), lastDay: day(0) },
      { id: 2, status: "accepted", code: "BBBB-2222", streak: 7, streakDay: day(5), lastDay: day(5) }, // abgelaufen
      { id: 3, status: "incoming", code: "CCCC-3333", streak: 0, streakDay: null, lastDay: null },
    ];
    g.click("resultdone");
    if (g.view !== "streak") fail("Serien-Bildschirm wird nicht gezeigt", g.view);
    const h = g.streakHTML();
    if (!h.includes("5 Tage in Folge!") || !h.includes(">4<") || !h.includes(">5<")) fail("Flamme zählt nicht von 4 auf 5");
    if (!h.includes("Anna") || !h.includes("🔥 12")) fail("Laufende gemeinsame Serie fehlt");
    if (h.includes("BBBB") || h.includes("CCCC")) fail("Abgelaufene Serie oder offene Anfrage auf dem Serien-Bildschirm");
    g.click("home");
    if (g.view !== "home") fail("Weiter vom Serien-Bildschirm führt nicht zum Lernweg", g.view);
    // Second round on the same day: no streak screen.
    g.startLesson(0, 1); answerAll(g.L);
    if (g.result.streakUp) fail("Serie wächst zweimal am selben Tag", g.result.streakUp);
    g.click("resultdone");
    if (g.view !== "home") fail("Serien-Bildschirm kommt ohne gewachsene Serie", g.view);
    // Day one: the screen says "1 Tag" and shows no old number.
    g.st.lastDay = null; g.st.streak = 0; g.st.dayLessons = 0;
    g.startLesson(0, 2); answerAll(g.L);
    if (g.result.streakUp !== 1) fail("Erster Tag zählt nicht", g.result.streakUp);
    g.click("resultdone");
    if (!g.streakHTML().includes("1 Tag in Folge!") || g.streakHTML().includes('class="old"')) fail("Erster Tag zeigt eine alte Zahl");
    g.click("home");
  }

  // Merging two saves keeps the streak with its own last learning day (issue #35).
  {
    const a = loadGame(), t = Date.now();
    const sv = (savedAt, lastDay, streak) => a.fromSaved({ savedAt, lastDay, streak });
    for (const [x, y, want, what] of [
      [sv(t + 1, "2026-11-01", 10), sv(t, "2026-11-10", 1), 1, "verlorene Serie lebt wieder auf"],
      [sv(t, "2026-11-01", 10), sv(t + 1, "2026-11-10", 1), 1, "verlorene Serie lebt wieder auf (neuerer Stand)"],
      [sv(t + 1, "2026-11-09", 10), sv(t, "2026-11-10", 1), 11, "Serie über beide Geräte reißt ab"],
      [sv(t, "2026-11-06", 4), sv(t + 1, "2026-11-10", 5), 8, "Serie über beide Geräte reißt ab (mehrere Tage)"],
      [sv(t + 1, "2026-11-10", 5), sv(t, "2026-11-10", 3), 5, "Serie am selben Tag nicht die größere"],
      [sv(t + 1, null, 0), sv(t, "2026-11-10", 2), 2, "Serie ohne Lerntag auf dem anderen Gerät"]]) {
      for (const m of [a.mergeSaves(x, y), a.mergeSaves(y, x)]) {
        const day = [x.lastDay, y.lastDay].filter(Boolean).sort().pop();
        if (m.streak !== want || m.lastDay !== day) fail("Zusammenführen: " + what, m.streak, m.lastDay);
      }
    }
  }

  // Merging keeps a decay or a reset unless the other save learned there after it (issue #36).
  {
    const a = loadGame(), U = a.UNITS(), c = a.cs(), copy = o => JSON.parse(JSON.stringify(o));
    // A finished round notes when and where the course grew.
    a.startLesson(0, 0); answerAll(a.L, a);
    if (!(a.cs().gainAt[U[0].id] > 0) || !(a.cs().playedAt > 0)) fail("Lektion vermerkt den Lernzeitpunkt nicht", JSON.stringify(a.cs().gainAt));
    for (let i = 0; i < 4; i++) { c.progress[U[i].id] = 10; (c.bonus = c.bonus || {})[U[i].id] = true; (c.mastery = c.mastery || {})[U[i].id] = 1; }
    const w3 = U[3].words[0];
    a.srs()["w:" + w3.id] = { box: 4, due: Date.now() + 864e5 }; (c.seen = c.seen || {})[w3.id] = true; c.mistakes = ["w:" + w3.id];
    a.st.savedAt = Date.now() - 5000;
    const other = copy(a.st); // the second device, still before the reset
    a.resetCourseFrom(2);
    const reset = copy(a.st);
    for (const m of [a.mergeSaves(reset, other), a.mergeSaves(other, reset)]) {
      const mc = m.courses.en;
      if (mc.progress[U[2].id] || mc.progress[U[3].id] || mc.bonus[U[3].id] || mc.mastery[U[3].id]) fail("Zusammenführen macht „Zurücksetzen ab Einheit“ rückgängig", JSON.stringify(mc.progress));
      if (mc.progress[U[1].id] !== 10 || !mc.bonus[U[1].id]) fail("Zusammenführen verliert Fortschritt vor dem Zurücksetzen");
      if (mc.srs["w:" + w3.id] || (mc.seen || {})[w3.id] || mc.mistakes.includes("w:" + w3.id)) fail("Zusammenführen holt Wörter der zurückgesetzten Einheit zurück");
    }
    // The other device learned in unit 3 after the reset: that stays, unit 2 stays reset.
    const later = copy(other), lc = later.courses.en;
    lc.progress[U[3].id] = 10; lc.gainAt = Object.assign({}, lc.gainAt, { [U[3].id]: Date.now() + 1000 }); lc.playedAt = Date.now() + 1000; later.savedAt = Date.now() + 1000;
    for (const m of [a.mergeSaves(reset, later), a.mergeSaves(later, reset)]) {
      const mc = m.courses.en;
      if (mc.progress[U[3].id] !== 10) fail("Zusammenführen verliert Fortschritt nach dem Zurücksetzen", mc.progress[U[3].id]);
      if (mc.progress[U[2].id]) fail("Zusammenführen macht Zurücksetzen in einer anderen Einheit rückgängig");
      if (!mc.srs["w:" + w3.id]) fail("Zusammenführen verliert Wörter, die nach dem Zurücksetzen geübt wurden");
    }
    // Decay: one lesson less in the furthest unit; merging with the older save keeps it.
    const d = loadGame(), DU = d.UNITS(), dc = d.cs();
    dc.progress[DU[0].id] = 10; dc.progress[DU[1].id] = 6; dc.last = Date.now() - 15 * 864e5; d.st.savedAt = Date.now() - 5000;
    const before = copy(d.st);
    const notes = d.applyDecay();
    if (!notes.length || d.cs().progress[DU[1].id] !== 5) fail("Rückstufung greift nicht", JSON.stringify(notes));
    const decayed = copy(d.st);
    for (const m of [d.mergeSaves(decayed, before), d.mergeSaves(before, decayed)]) if (m.courses.en.progress[DU[1].id] !== 5) fail("Zusammenführen macht Rückstufung rückgängig", m.courses.en.progress[DU[1].id]);
    // ... but not the lessons it never had (the other device was further) nor those learned after it.
    const further = copy(before); further.courses.en.progress[DU[1].id] = 8;
    if (d.mergeSaves(decayed, further).courses.en.progress[DU[1].id] !== 8) fail("Rückstufung nimmt Fortschritt des anderen Geräts weg");
    const after = copy(before); after.courses.en.progress[DU[1].id] = 6; after.courses.en.gainAt = { [DU[1].id]: Date.now() + 1000 };
    if (d.mergeSaves(decayed, after).courses.en.progress[DU[1].id] !== 6) fail("Rückstufung nimmt danach Gelerntes weg");
    // Two decays in a row still count from the lessons before the first.
    dc.last = Date.now() - 15 * 864e5; d.applyDecay();
    if (d.cs().progress[DU[1].id] !== 4 || d.cs().cuts[DU[1].id].was !== 6) fail("Zweite Rückstufung vergisst den Stand davor", JSON.stringify(d.cs().cuts));
    if (d.mergeSaves(copy(d.st), before).courses.en.progress[DU[1].id] !== 4) fail("Zusammenführen macht zweite Rückstufung rückgängig");
    // Saves without take-backs merge as before.
    const p = copy(before), q = copy(before); q.courses.en.progress[DU[1].id] = 9; q.savedAt -= 1000;
    if (d.mergeSaves(p, q).courses.en.progress[DU[1].id] !== 9) fail("Zusammenführen ohne Zurücknehmen verliert Fortschritt");
  }

  // Signing out keeps the progress until the backup really has it (issue #34); adopting a save updates widget and
  // reminder (issue #46).
  {
    let reply = () => { throw new Error("offline"); };
    const calls = [];
    const s = loadGame({ AndroidBridge: { appVersion: () => "0.1.7", speak() {}, stop() {}, openUrl() {}, setReminder: (on, h, m) => calls.push(`reminder:${on}:${h}:${m}`),
      reportDay: (day, streak) => calls.push(`day:${day}:${streak}`) } }, { fetch: async (url, opts) => reply(url, opts || {}) });
    // Waits until `done()` holds, at most `ms` of real time. Not a fixed number of event-loop turns: the upload behind the
    // button compresses and encrypts the save in libuv's thread pool (CompressionStream, Web Crypto), which on a busy
    // machine takes far longer than a few turns (PR #56: the CI runner checked while the upload was still running).
    const until = async (done, ms = 10000) => { const end = performance.now() + ms; while (!done() && performance.now() < end) await new Promise(r => setImmediate(r)); };
    s.acct.key = s.newKey(); Object.assign(s.acct, await s.deriveKeys(s.acct.key), { status: "ok", pending: false });
    s.st.xp = 123; s.st.savedAt = Date.now(); s.store["opensprachfuchs-state"] = JSON.stringify(s.st);
    const kept = what => { if (!s.acct.key || !s.store["opensprachfuchs-state"] || JSON.parse(s.store["opensprachfuchs-state"]).xp !== 123 || !s.acct.note) fail("Abmelden löscht den Stand " + what); };
    if (await s.signOut()) fail("Abmelden klappt offline");
    kept("offline");
    s.acct.status = "offline"; // the status a failed upload leaves behind
    reply = () => new Response("{}", { status: 500 });
    if (await s.signOut()) fail("Abmelden klappt bei Serverfehler");
    kept("bei Serverfehler");
    reply = () => new Response("{}", { status: 401 });
    if (await s.signOut()) fail("Abmelden klappt bei gelöschtem Konto");
    kept("bei gelöschtem Konto");
    // The button: the dialog goes back to the account with the warning instead of the welcome screen.
    s.acct.status = "ok"; reply = () => { throw new Error("offline"); };
    s.view = "home"; s.ui.modal = "signout"; s.click("dosignout"); await until(() => s.ui.modal !== "signout");
    if (s.ui.modal !== "account" || s.view !== "home" || !s.modalHTML().includes("nicht sichern")) fail("Abmelden ohne Sicherung zeigt keine Warnung", s.ui.modal, s.view);
    // #46: a save adopted from the backup reaches widget and reminder.
    const theirs = s.fromSaved({ savedAt: Date.now() + 5000, xp: 500, lastDay: s.st.lastDay || "2026-11-09", streak: 7, settings: { reminder: true, reminderTime: "07:30" } });
    const blob = await s.encryptState(theirs, s.acct.aes);
    s.st.syncedAt = s.st.savedAt; s.acct.status = "ok"; calls.length = 0;
    reply = (url, o) => new Response(JSON.stringify((o.method || "GET") === "GET" ? { savedAt: theirs.savedAt, data: blob } : {}), { status: 200 });
    await s.pullSave();
    if (s.st.xp !== 500) fail("Gesicherter Stand nicht übernommen", s.st.xp);
    if (!calls.includes("reminder:true:7:30") || !calls.some(x => x.startsWith(`day:${theirs.lastDay}:`))) fail("Übernommener Stand erreicht Widget und Erinnerung nicht", calls);
    // Online: the upload works, then the progress leaves the device.
    s.st.xp = 600; s.st.savedAt = Date.now() + 9000; s.st.syncedAt = theirs.savedAt;
    const puts = [];
    reply = (url, o) => { if (o.method === "PUT") puts.push(JSON.parse(o.body).savedAt); return new Response("{}", { status: 200 }); };
    if (!(await s.signOut())) fail("Abmelden klappt online nicht", s.acct.note);
    if (!puts.length || s.acct.key || s.store["opensprachfuchs-state"]) fail("Abmelden online lädt nicht hoch oder lässt Daten zurück", puts);
  }
  console.log(`Übungen: ${count}, Fehler: ${errors}`, JSON.stringify(types));
process.exit(errors ? 1 : 0);
})();
