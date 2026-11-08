// Pack format 2 (dialects, packs/README.md): checks for valid and invalid packs with the new fields, the index and the
// packs bundled into the APK (tools/packs.mjs), and in the app: languages and dialects as their own groups in the
// language list, no typing tasks with noTyping, no speech with noListen, and the notice when there is no voice.
// The dialect pack here is test data made from the first units of the English pack, not content.
// Run: node test/packs-test.js   (exit code 1 on errors)
const fs = require("fs");
const path = require("path");
const { loadGame, ROOT } = require("./harness");

let errors = 0;
const fail = (...a) => { errors++; console.log("FEHLER", ...a); };
const ok = (cond, ...a) => { if (!cond) fail(...a); };
const clone = x => JSON.parse(JSON.stringify(x));

(async () => {
  const P = await import(path.join(ROOT, "tools", "packs.mjs"));
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, "packs", "en.json"), "utf8"));

  // A dialect pack for the tests: three units of the English pack, the stories and dialogues dropped.
  const dialect = (extra = {}) => {
    const p = Object.assign(clone(en), { format: 2, code: "ksh", name: "Kölsch", short: "KSH", voice: "ksh", group: "dialects",
      noTyping: true, noListen: true, spellings: true, color: "#C8102E", note: "Testpaket" }, extra);
    p.units = p.units.slice(0, 3); p.stories = []; p.dialogs = p.dialogs.slice(0, 1);
    p.units[0].words[0].tr = "Lesehilfe-Test"; p.units[0].sentences[0].tr = "Satz-Lesehilfe";
    p.dialogs[0].turns[0].p.tr = "Zeilen-Lesehilfe";
    return p;
  };
  const errs = (p, file = p.code + ".json") => P.checkPack(p, file).errors;

  // Valid: every pack in packs/ unchanged, a format-1 pack without new fields, a dialect with all of them.
  for (const f of P.packFiles()) ok(!errs(P.readPack(f), f).length, "Bestehendes Paket ungültig", f, errs(P.readPack(f), f));
  ok(!errs(dialect()).length, "Dialekt-Paket abgelehnt", errs(dialect()));
  ok(!errs(dialect({ group: "main", noTyping: false, noListen: false, speech: "de-CH" })).length, "Format 2 mit group main und speech abgelehnt");
  { const p = dialect(); delete p.group; delete p.noTyping; delete p.noListen; delete p.spellings; ok(!errs(p).length, "Format 2 ohne neue Felder abgelehnt"); }
  ok(!errs(dialect({ code: "gsw", voice: "gsw-CH" })).length, "gsw-CH abgelehnt");

  // Invalid: new fields in format 1, wrong values, unknown format.
  const bad = [
    ["noTyping in Format 1", Object.assign(clone(en), { noTyping: true }), "noTyping"],
    ["group in Format 1", Object.assign(clone(en), { group: "main" }), "group"],
    ["tr in Format 1", (() => { const p = clone(en); p.units[0].words[0].tr = "x"; return p; })(), "tr gibt es erst"],
    ["unbekannte Gruppe", dialect({ group: "fun" }), "group"],
    ["noTyping kein Wahrheitswert", dialect({ noTyping: "ja" }), "noTyping"],
    ["noListen kein Wahrheitswert", dialect({ noListen: 1 }), "noListen"],
    ["spellings kein Wahrheitswert", dialect({ spellings: "true" }), "spellings"],
    ["speech kein Tag", dialect({ speech: "de_CH" }), "speech"],
    ["voice kein Tag", dialect({ voice: "Kölsch" }), "voice"],
    ["tr kein Text", (() => { const p = dialect(); p.units[1].sentences[0].tr = 5; return p; })(), "tr muss"],
    ["tr leer im Gespräch", (() => { const p = dialect(); p.dialogs[0].turns[0].a[1].tr = " "; return p; })(), "tr muss"],
    ["Format 3", dialect({ format: 3 }), "format"],
  ];
  for (const [name, p, word] of bad) { const e = errs(p); ok(e.some(x => x.includes(word)), "Ungültiges Paket nicht erkannt:", name, e); }

  // The house format keeps the new fields, and a format-1 pack comes out byte for byte as before.
  ok(JSON.stringify(JSON.parse(P.formatPack(dialect()))) === JSON.stringify(dialect()) || deepEq(JSON.parse(P.formatPack(dialect())), dialect()), "formatPack verliert Felder von Format 2");
  ok(P.formatPack(en) === fs.readFileSync(path.join(ROOT, "packs", "en.json"), "utf8"), "formatPack ändert ein Paket mit Format 1");

  // Index and APK: format-2 packs in packs2, dialects only bundled on request.
  const entries = [en, dialect()].map(p => P.indexEntry(p, JSON.stringify(p)));
  const idx = P.makeIndex(entries);
  ok(idx.packs.map(e => e.code).join() === "en" && idx.packs2.map(e => e.code).join() === "ksh", "index.json: Format-2-Paket falsch einsortiert", idx);
  ok(entries[0].group === "main" && entries[1].group === "dialects", "index.json: group fehlt", entries.map(e => e.group));
  ok(P.bundled([en, dialect()], false).map(p => p.code).join() === "en", "APK enthält Dialekt ohne --dialects");
  ok(P.bundled([en, dialect()], true).length === 2, "APK ohne Dialekt trotz --dialects");
  ok(P.bundled([en, dialect({ group: "main" })], false).length === 2, "Format-2-Hauptsprache fehlt in der APK");

  // The app: an index with a main language, a dialect and a pack of a later format.
  const ksh = dialect(), kshText = JSON.stringify(ksh);
  const kshEntry = P.indexEntry(ksh, kshText);
  const index = P.makeIndex([P.indexEntry(en, JSON.stringify(en)), kshEntry]);
  index.packs2.push(Object.assign({}, kshEntry, { code: "zzz", name: "Zukunft", format: 3 }));
  const serve = pack => async u => {
    const url = String(u);
    if (url.endsWith("packs/index.json")) return new Response(JSON.stringify(index));
    if (url.endsWith("ksh.json")) return new Response(pack);
    return new Response("", { status: 404 });
  };
  const g = loadGame({}, { fetch: serve(kshText) });
  await g.fetchPackIndex();
  ok(g.PACK_INDEX.packs.some(p => p.code === "ksh") && !g.PACK_INDEX.packs.some(p => p.code === "zzz"), "App liest packs2 nicht oder nimmt Format 3", g.PACK_INDEX.packs.map(p => p.code));
  // Grouping in the language list: "Sprachen" first with English, then "Dialekte" with Kölsch.
  {
    const h = g.packListHTML(), iMain = h.indexOf("<h3>Sprachen</h3>"), iDia = h.indexOf("<h3>Dialekte</h3>");
    ok(iMain >= 0 && iDia > iMain, "Gruppen Sprachen/Dialekte fehlen oder falsch sortiert");
    const main = h.slice(iMain, iDia), dia = h.slice(iDia);
    ok(main.includes("Englisch") && !main.includes("Kölsch"), "Englisch nicht unter Sprachen");
    ok(dia.includes("Kölsch") && !dia.includes("Englisch"), "Kölsch nicht unter Dialekte");
    ok(!/Spaß|Fun/i.test(h), "Sprachauswahl nennt Spaß/Fun");
    g.view = "langs"; g.render();
    // Without dialects in the index only the group "Sprachen" shows.
    const only = g.packGroups([{ code: "en" }, { code: "fr", group: "main" }, { code: "xx", group: "unbekannt" }]);
    ok(only.length === 1 && only[0].title === "Sprachen" && only[0].packs.length === 3, "Gruppierung ohne Dialekte", only);
  }
  // Installing the dialect: its settings arrive in the course.
  await g.downloadPack("ksh");
  ok(g.COURSES.ksh && g.COURSES.ksh.noTyping && g.COURSES.ksh.noListen && g.COURSES.ksh.group === "dialects", "Dialekt nicht installiert", g.COURSES.ksh);
  g.st.course = "ksh"; g.setCourse("ksh"); g.st.settings.hearts = false; g.st.settings.audio = true;
  ok(!g.canListen() && !g.canSpeak(), "noListen: Hören/Sprechen noch an");
  // No typing and no listening tasks in any lesson, mastery round or bonus station.
  {
    const kinds = new Set();
    for (let u = 0; u < g.UNITS().length; u++) for (let li = 0; li < g.lessonsOf(g.UNITS()[u]); li++) {
      g.startLesson(u, li);
      for (const ex of [g.L.cur, ...g.L.queue]) { kinds.add(ex.type + (ex.audio ? ":audio" : "")); if (ex.type !== "match") g.exerciseHTML(ex); }
      g.view = "home";
    }
    g.startMaster(0); for (const ex of [g.L.cur, ...g.L.queue]) kinds.add(ex.type + (ex.audio ? ":audio" : "")); g.view = "home";
    ok(!kinds.has("type") && !kinds.has("listen") && ![...kinds].some(k => k.endsWith(":audio")) && !kinds.has("speak"), "Dialekt: Tipp- oder Höraufgabe", [...kinds]);
    ok(kinds.has("bank") && kinds.has("choice"), "Dialekt: keine Ersatzaufgaben", [...kinds]);
    for (let u = 0; u < g.UNITS().length; u++) if (g.bonusKind(u) !== "memory") fail("noTyping: Buchstabenspiel als Sonderstation", u, g.bonusKind(u));
  }
  // Transcription and spellings on the word card and in the word list; no speaker buttons, no voice notice.
  {
    g.st.courses.ksh = { progress: {}, mistakes: [] };
    g.startLesson(0, 0);
    const intro = [g.L.cur, ...g.L.queue].find(x => x.type === "intro" && x.item.tr);
    ok(intro && g.exerciseHTML(intro).includes("Lesehilfe-Test"), "Umschrift fehlt auf der Wortkarte");
    g.view = "home"; g.ui.modal = "words"; g.ui.wu = 0;
    const list = g.modalHTML();
    ok(list.includes("Lesehilfe-Test"), "Umschrift fehlt in der Wortliste");
    const w = g.UNITS()[0].words.find(x => x.alt.length);
    if (w) ok(list.includes("auch geschrieben: "), "spellings: „auch geschrieben“ fehlt");
    g.ui.modal = null; g.ui.tab = "path";
    ok(!g.homeHTML().includes("Keine Stimme"), "noListen: Stimmen-Hinweis trotzdem");
    g.st.course = "en"; g.setCourse("en"); g.ui.modal = "words"; g.ui.wu = 0;
    ok(!g.modalHTML().includes("auch geschrieben"), "Ohne spellings steht „auch geschrieben“"); g.ui.modal = null;
  }

  // A dialect with speech output: in the app the phone has no voice for "ksh" -> notice; with speech "de-CH" it speaks.
  const bridge = (spoken, state) => ({ AndroidBridge: { speak: (t, l) => { spoken.push(l); return state(l) === "ok"; }, speakQueued: () => true, stop() {}, canRecognize: () => false,
    startListening() {}, stopListening() {}, appVersion: () => "0.1.7", setReminder() {}, reportDay() {}, copy() {}, share() {}, openUrl() {}, takeLink: () => "",
    voiceState: state, installVoice() {} } });
  for (const [name, extra, want] of [["ohne speech", { noListen: false }, true], ["speech de-CH", { noListen: false, speech: "de-CH" }, false]]) {
    const spoken = [], text = JSON.stringify(dialect(extra));
    const a = loadGame(bridge(spoken, l => (/^de/.test(l) ? "ok" : "none")), { fetch: serve(text) });
    await a.fetchPackIndex(); await a.downloadPack("ksh");
    a.st.settings.audio = true; a.st.course = "ksh"; a.view = "home"; a.ui.tab = "path"; a.ui.modal = null;
    a.click("pickcourse", { c: "ksh" });
    ok(a.homeHTML().includes("Keine Stimme für Kölsch") === want, "App: Stimmen-Hinweis", name);
    a.speak("Test");
    ok(spoken[0] === (extra.speech || "ksh"), "App: falscher Tag an die Sprachausgabe", name, spoken);
  }
  // In a browser: the voices of the browser decide.
  {
    const b = loadGame({}, { fetch: serve(JSON.stringify(dialect({ noListen: false }))), web: true });
    await b.fetchPackIndex(); await b.downloadPack("ksh");
    global.speechSynthesis.getVoices = () => [{ lang: "de-DE" }, { lang: "en_GB" }];
    b.st.settings.audio = true; b.st.course = "ksh"; b.view = "home"; b.ui.tab = "path"; b.ui.modal = null;
    b.click("pickcourse", { c: "ksh" });
    const h = b.homeHTML();
    ok(h.includes("Keine Stimme für Kölsch") && h.includes("Dein Browser") && !h.includes('data-act="installvoice"'), "Browser: Hinweis ohne Stimme falsch");
    b.click("pickcourse", { c: "en" });
    ok(!b.homeHTML().includes("Keine Stimme"), "Browser: Hinweis trotz englischer Stimme");
    global.speechSynthesis.getVoices = () => [];
    b.click("pickcourse", { c: "ksh" });
    ok(!b.homeHTML().includes("Keine Stimme"), "Browser: Hinweis, obwohl die Stimmen noch nicht geladen sind");
  }

  console.log(`Paket-Test (Format 2, Dialekte): ${errors} Fehler`);
  process.exit(errors ? 1 : 0);
})().catch(e => { console.log("ABBRUCH", e); process.exit(1); });

function deepEq(a, b) { return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b)); }
function sortKeys(x) { return Array.isArray(x) ? x.map(sortKeys) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sortKeys(x[k])])) : x; }
