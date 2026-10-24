// Logic test for the game in app/: installs every language pack, builds every lesson three times, answers each
// exercise correctly and checks that the game accepts it. Then checks tests, hearts, listening pause, reset, decay,
// combo, blitz round, daily quests, shop, dialogues, mastery, spaced repetition, the tab bar and the app bridge.
// Run: node test/game-test.js   (exit code 1 on errors)
const fs = require("fs");
const path = require("path");
const { loadGame, el, packFiles } = require("./harness");

let errors = 0, count = 0;
const types = {};
const fail = (...a) => { errors++; console.log("FEHLER", ...a); };

const g = loadGame();
const codes = Object.keys(g.COURSES);
if (codes.length !== packFiles().length) fail("Nicht alle Sprachpakete installiert", codes);

for (const code of codes) {
  g.st.course = code; g.setCourse(code); g.st.settings.hearts = false;
  for (let u = 0; u < g.UNITS().length; u++) for (let li = 0; li < 4; li++) for (let rep = 0; rep < 3; rep++) {
    g.startLesson(u, li);
    const L = g.L;
    for (let guard = 0; g.view === "lesson" && guard < 60; guard++) {
      const ex = L.cur, name = ex.type + (ex.audio ? "Word" : "");
      count++; types[name] = (types[name] || 0) + 1;
      if (ex.type !== "match" && !/^[ws]:[a-z0-9-]+\.[ws]\d+$/.test(ex.key)) fail("Aufgabe ohne feste ID", code, ex.key);
      g.exerciseHTML(ex);
      if (ex.type === "match") { L.checked = true; L.res = { ok: true }; L.done++; }
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

// Level tabs: the path shows one level (10 units each), the tab switches it, started units stay open.
{
  g.setCourse("en"); g.st.course = "en"; g.view = "home"; g.ui.tab = "path"; g.ui.level = null;
  const levels = ["A1", "A2", "B1", "B2"];
  for (const l of levels) if (g.UNITS().filter(u => u.level === l).length !== 10) fail("Stufe hat nicht 10 Einheiten", l);
  if (g.UNITS().map(u => u.level).join() !== [...g.UNITS().map(u => u.level)].sort().join()) fail("Einheiten nicht nach Stufe sortiert");
  g.cs().progress = {};
  let h = g.homeHTML();
  if (!h.includes('data-act="level" data-l="B2"') || (h.match(/class="unit-head/g) || []).length !== 10 || !h.includes("Einheit 1 von 10")) fail("Stufen-Reiter oder A1-Pfad fehlen");
  g.click("level", { l: "B1" }); h = g.homeHTML();
  const b1 = g.UNITS().find(u => u.level === "B1");
  if (!h.includes(b1.title) || h.includes(g.UNITS()[0].title + "</h2>") || !h.includes("noch gesperrt")) fail("Reiter B1 zeigt nicht B1");
  g.cs().progress[b1.id] = 1;
  if (!g.homeHTML().includes(`data-act="words" data-u="${g.UNITS().indexOf(b1)}"`)) fail("Begonnene Einheit nach Umsortierung gesperrt");
  g.cs().progress = {}; g.ui.level = null;
}

// Shared answer helper for flows below: answers every task correctly through the real check().
function answerAll(L) {
  for (let guard = 0; guard < 80 && g.view === "lesson"; guard++) {
    const ex = L.cur;
    if (ex.type === "match") { L.checked = true; L.res = { ok: true }; L.done++; L.right++; }
    else {
      if (["choice", "pic", "gap"].includes(ex.type)) L.sel = ex.ans;
      else if (ex.type === "bank" || ex.type === "listen") {
        const used = new Set(); L.picked = [];
        for (const t of ex.target.replace(/[.,!?¿¡]/g, "").split(" ").filter(Boolean)) { const tile = ex.tiles.find(x => x.t === t && !used.has(x.id)); used.add(tile.id); L.picked.push(tile.id); }
      } else if (ex.type === "type") global.document.getElementById = () => ({ value: ex.target });
      g.ui.modal = null;
      g.check(false);
      global.document.getElementById = () => el();
      if (!L.res || !L.res.ok) fail("Antwort abgelehnt", ex.type, ex.target || ex.full);
    }
    g.cont();
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
if (g.st.hearts < 1 || g.result.heartsGained !== g.st.hearts) fail("Auffüllrunde lädt nicht auf", g.st.hearts, g.result.heartsGained);
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
for (const u of g.UNITS()) g.cs().progress[u.id] = 4;
const w1 = "w:" + g.UNITS()[1].words[0].id, w7 = "w:" + g.UNITS()[7].words[0].id;
g.srsUpdate(w1, true); g.srsUpdate(w7, true);
const frBefore = JSON.stringify(g.st.courses.fr);
g.resetCourseFrom(5);
if (g.done(g.UNITS()[4].id) !== 4 || g.done(g.UNITS()[5].id) !== 0 || g.done(g.UNITS()[19].id) !== 0) fail("Zurücksetzen ab Einheit 6 falsch");
if (!g.srs()[w1] || g.srs()[w7]) fail("Lernstufen falsch zurückgesetzt");
if (JSON.stringify(g.st.courses.fr) !== frBefore) fail("Andere Sprache verändert");
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
  else if (g.result.bestCombo < 10 || g.result.comboBonus < 4) fail("Combo-Bonus fehlt", g.result.bestCombo, g.result.comboBonus);
  if (g.st.xp - before < 10 + 5 + g.result.comboBonus) fail("Combo-Bonus nicht gutgeschrieben");
}

// Finishing the last A1 unit opens the A2 tab.
{
  g.setCourse("en"); g.st.course = "en"; g.st.settings.hearts = false; g.ui.level = "A1";
  for (let i = 0; i < 9; i++) g.cs().progress[g.UNITS()[i].id] = 4;
  g.cs().progress[g.UNITS()[9].id] = 3;
  g.startLesson(9, 3); answerAll(g.L);
  if (g.view !== "result" || g.ui.level !== "A2") fail("Nach der letzten A1-Einheit nicht zu A2 gewechselt", g.view, g.ui.level);
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
  g.st.gems = 0; if (g.buy("freeze")) fail("Kauf ohne genug Edelsteine");
  const d = new Date(); d.setDate(d.getDate() - 2);
  g.st.lastDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  g.st.streak = 7; g.st.freezes = 1;
  if (g.shownStreak() !== 7) fail("Serie trotz Schutz nicht angezeigt");
  g.startLesson(0, 0); answerAll(g.L);
  if (g.st.streak !== 8 || g.st.freezes !== 0 || g.result.freezeUsed !== 1) fail("Serienschutz greift nicht", g.st.streak, g.st.freezes);
  g.st.boostUntil = Date.now() + 60000; g.startLesson(0, 0); answerAll(g.L);
  if (!g.result.boosted || g.result.xp < 30) fail("Doppel-XP wirkt nicht", g.result.xp);
  g.st.boostUntil = 0; g.ui.modal = "shop"; g.modalHTML(); g.ui.modal = null; g.resultHTML();
}

// Dialogues: every scene of every language can be played to the end; a wrong pick counts as a mistake.
for (const code of codes) {
  g.setCourse(code); g.st.course = code;
  if (g.dialogsFor(code).length !== 4) fail("Gesprächsanzahl", code);
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
  g.setCourse("es"); g.st.course = "es"; g.cs().progress[g.UNITS()[0].id] = 4; g.cs().mastery = {};
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

// Every dialog renders (settings, account, privacy, languages, friends).
for (const m of ["settings", "account", "privacy", "packs", "courses", "addfriend", "signout", "deleteaccount", "reset"]) { g.ui.modal = m; g.modalHTML(); }
g.ui.modal = null;
for (const v of ["welcome", "signin", "langs"]) { g.view = v; g.render(); }
g.view = "home";

// App mode: with an AndroidBridge the game speaks through the phone, listens for speaking tasks and handles back.
{
  const spoken = [], calls = [];
  const a = loadGame({ AndroidBridge: { speak: (t, lang) => { spoken.push(lang + ":" + t); return true; }, stop() {},
    canRecognize: () => true, startListening: lang => calls.push("listen:" + lang), stopListening() {}, appVersion: () => "0.0.1",
    setReminder: (on, h, m) => calls.push(`reminder:${on}:${h}:${m}`), reportDay: () => calls.push("day"), copy: t => calls.push("copy:" + t), share() {}, openUrl() {} } });
  a.st.settings.audio = true;
  a.setCourse("pt"); a.speak("Bom dia!");
  if (spoken[0] !== "pt-BR:Bom dia!") fail("App: Sprachausgabe des Handys nicht genutzt", spoken[0]);
  if (!calls.some(c => c.startsWith("reminder:false"))) fail("App: Erinnerung beim Start nicht übergeben");
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
  console.log(`Übungen: ${count}, Fehler: ${errors}`, JSON.stringify(types));
process.exit(errors ? 1 : 0);
})();
