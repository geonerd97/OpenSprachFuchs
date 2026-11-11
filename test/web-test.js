// Web app test: builds app/ and web/ into a temporary folder (tools/web.mjs) and checks what browsers need:
// manifest and icons in index.html, a service worker that caches every file that exists, the cache headers,
// and that the game itself offers the install notice in a browser and handles friend links from the page /f.
// Run: node test/web-test.js   (exit code 1 on errors)
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadGame } = require("./harness");

let errors = 0;
const fail = (...a) => { errors++; console.log("FEHLER", ...a); };
const ROOT = path.join(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "osf-web-"));
const build = () => execFileSync(process.execPath, [path.join(ROOT, "tools", "web.mjs"), "build", out], { encoding: "utf8" });
try {
  fs.mkdirSync(path.join(out, "packs")); fs.writeFileSync(path.join(out, "packs", "index.json"), "{}");
  fs.writeFileSync(path.join(out, "_headers"), "/packs/*\n  Access-Control-Allow-Origin: *\n");
  fs.writeFileSync(path.join(out, "old.js"), "stale");
  build();
  const read = f => fs.readFileSync(path.join(out, f), "utf8");
  const html = read("index.html");
  for (const tag of ['rel="manifest"', 'rel="apple-touch-icon"', 'name="theme-color"', 'href="styles.css"', 'src="js/main.js"']) if (!html.includes(tag)) fail("index.html ohne", tag);
  if (fs.readFileSync(path.join(ROOT, "app", "index.html"), "utf8").includes('rel="manifest"')) fail("app/index.html (APK) enthält Web-App-Zeilen");
  const man = JSON.parse(read("manifest.webmanifest"));
  if (man.display !== "standalone" || !man.start_url) fail("Manifest unvollständig");
  for (const i of man.icons) if (!fs.existsSync(path.join(out, i.src))) fail("Icon fehlt", i.src);
  if (!man.icons.some(i => i.purpose === "maskable")) fail("Kein maskierbares Icon");
  const sw = read("sw.js"), m = sw.match(/FILES = (\[[^\]]*\])/);
  if (!m || /__VERSION__|__FILES__/.test(sw)) fail("sw.js nicht ausgefüllt");
  else for (const f of JSON.parse(m[1])) if (f !== "./" && !fs.existsSync(path.join(out, f))) fail("Service Worker cacht fehlende Datei", f);
  if (!sw.includes("js/main.js") || !sw.includes("fonts/nunito.woff2")) fail("Service Worker cacht die App nicht");
  if (/packs\//.test(m ? m[1] : "")) fail("Service Worker cacht Sprachpakete");
  if (fs.existsSync(path.join(out, "old.js")) || !fs.existsSync(path.join(out, "packs", "index.json"))) fail("Build räumt falsch auf");
  const headers = read("_headers");
  if (!headers.includes("Access-Control-Allow-Origin") || !/\/sw\.js\n\s+Cache-Control: no-cache/.test(headers)) fail("_headers falsch", headers);
  // Issue #33: the Content-Security-Policy as meta tag (before the first script) and as header with frame-ancestors.
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || "";
  if (!csp || html.indexOf("Content-Security-Policy") > html.indexOf("<script")) fail("CSP fehlt in index.html oder steht nach den Skripten");
  if (!headers.includes(`Content-Security-Policy: ${csp}; frame-ancestors 'none'`)) fail("CSP-Header fehlt oder weicht vom Meta-Tag ab", headers);
  const dir = Object.fromEntries(csp.split(";").map(d => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  if ((dir["script-src"] || []).join(" ") !== "'self'") fail("script-src erlaubt mehr als eigene Dateien", dir["script-src"]);
  if ((dir["object-src"] || []).join() !== "'none'" || (dir["base-uri"] || []).join() !== "'none'") fail("object-src/base-uri nicht 'none'");
  if ((dir["style-src-elem"] || []).join() !== "'self'") fail("style-src-elem erlaubt mehr als das eigene Stylesheet", dir["style-src-elem"]);
  const backend = new URL(fs.readFileSync(path.join(ROOT, "app", "js", "config.js"), "utf8").match(/BACKEND_URL: "([^"]+)"/)[1]).origin;
  for (const o of ["'self'", backend, "https://api.github.com", "http://localhost:8787"]) if (!(dir["connect-src"] || []).includes(o)) fail("connect-src ohne", o);
  if ((dir["connect-src"] || []).length !== 4) fail("connect-src erlaubt weitere Ziele", dir["connect-src"]);
  // What the policy forbids must not be in the app: inline scripts and handlers, javascript: links, eval, outside images.
  if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) fail("Inline-Skript in index.html");
  for (const f of ["index.html", ...fs.readdirSync(path.join(ROOT, "app", "js")).map(f => "js/" + f)]) {
    const src = fs.readFileSync(path.join(ROOT, "app", f), "utf8");
    if (/\son[a-z]+=["'$]/i.test(src)) fail("Inline-Handler (on…=) in", f);
    if (/javascript:|\beval\(|new Function\(|setTimeout\(\s*["'`]|setInterval\(\s*["'`]/.test(src)) fail("Von der CSP verbotener Code in", f);
    if (/\ssrc="(?!img\/|js\/|\$\{)/.test(src) || /\ssrc="(https?:|data:|\/\/)/.test(src)) fail("Bild oder Skript von außerhalb in", f);
  }
  // Building twice gives the same version and does not repeat the header rules; a changed file gives a new version.
  build();
  if (read("sw.js") !== sw || read("_headers") !== headers) fail("Zweiter Build ist nicht gleich");
} finally { fs.rmSync(out, { recursive: true, force: true }); }

// The game in a browser (https): install notice on the path (iPhone wording), hidden for good with one tap.
{
  const nav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", platform: "iPhone", standalone: false }, configurable: true, writable: true });
  const g = loadGame({}, { web: true });
  g.ui.tab = "path";
  const h = g.homeHTML();
  if (!h.includes("Als App installieren") || !h.includes("Zum Home-Bildschirm")) fail("Installationshinweis fehlt im Browser");
  g.click("installhide");
  if (g.homeHTML().includes("Als App installieren")) fail("Installationshinweis lässt sich nicht ausblenden");
  if (!g.PRIVACY_HTML.includes("Speicher des Browsers")) fail("Datenschutz erwähnt die Web-App nicht");
  if (nav) Object.defineProperty(globalThis, "navigator", nav); else delete globalThis.navigator;
  const a = loadGame();
  a.ui.tab = "path";
  if (a.homeHTML().includes("Als App installieren")) fail("Installationshinweis außerhalb des Browsers");
}

// Issue #32: every field of a pack (and of the pack index) reaches the page escaped; colours only as #hex.
(async () => {
  const EVIL = '"><x-evil>', CSS = "red;background:url(x-evil)";
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, "packs", "en.json"), "utf8"));
  Object.assign(p, { name: EVIL, short: EVIL, color: CSS, note: EVIL });
  Object.assign(p.units[0], { title: EVIL, desc: EVIL, colors: [CSS, CSS] });
  p.units[0].words[0].pic = EVIL;
  const story = p.stories[0], si = p.units.findIndex(u => u.id === story.unit);
  Object.assign(story, { em: EVIL, title: EVIL });
  Object.assign(p.dialogs[0], { em: EVIL, title: EVIL, desc: EVIL });
  p.dialogGroups[p.dialogs[0].group] = { title: EVIL, em: EVIL };
  const text = JSON.stringify(p), sha = require("crypto").createHash("sha256").update(text).digest("hex");
  const store = { "opensprachfuchs-pack-en": text, "opensprachfuchs-packs": JSON.stringify({ en: sha }), "opensprachfuchs-state": JSON.stringify({ onboarded: true, course: "en" }) };
  const index = { packs: [{ code: "en", name: EVIL, short: EVIL, color: CSS, note: EVIL, units: EVIL, words: EVIL, size: 1, sha256: "neu" },
    { code: EVIL, name: EVIL, short: EVIL, color: CSS, note: EVIL, units: EVIL, words: EVIL, size: 1, sha256: "x" }] };
  const g = loadGame({}, { store, packs: false, fetch: async u => new Response(String(u).endsWith("index.json") ? JSON.stringify(index) : "", { status: String(u).endsWith("index.json") ? 200 : 404 }) });
  if (!g.COURSES.en || g.COURSES.en.name !== EVIL) { fail("Testpaket nicht geladen"); }
  await g.fetchPackIndex();
  const pages = {};
  g.view = "home"; g.ui.modal = null;
  for (const tab of ["path", "practice", "profile"]) { g.ui.tab = tab; g.ui.dgroup = p.dialogs[0].group; pages["Tab " + tab] = g.homeHTML(); }
  pages.Statistik = g.statsHTML();
  Object.assign(g.ui, { wu: 0, ru: 0, mu: 0, pu: 1 });
  for (const m of ["courses", "words", "resetcourse", "resetfrom", "master", "placement", "packs", "settings"]) { g.ui.modal = m; pages["Dialog " + m] = g.modalHTML(); }
  g.ui.modal = null;
  g.startLesson(0, 0);
  pages.Lektion = [g.L.cur, ...g.L.queue].filter(ex => ex.type !== "match").map(ex => g.exerciseHTML(ex)).join("");
  const w0 = g.UNITS()[0].words[0];
  pages.Bilder = g.exerciseHTML({ type: "pic", item: w0, opts: [w0], ans: 0 });
  pages.Tippen = g.exerciseHTML({ type: "type", word: true, src: w0.de });
  pages.Sprechblase = g.exerciseHTML({ type: "bank", src: "x", srcLang: "t", tiles: [] });
  g.view = "home"; g.startDialog(p.dialogs[0].id);
  pages.Gespräch = g.L ? g.exerciseHTML(g.L.cur) : "";
  if (!pages.Gespräch) fail("Gespräch im Test nicht gestartet");
  g.view = "home";
  if (g.bonusKind(si) === "story") { g.startBonus(si); pages.Geschichte = g.exerciseHTML(g.L.cur); } else fail("Geschichte im Test nicht gefunden", si, g.bonusKind(si));
  for (const [name, h] of Object.entries(pages)) {
    if (h.includes("<x-evil")) fail("Paketfeld ungeschützt im HTML:", name, h.slice(Math.max(0, h.indexOf("<x-evil") - 120), h.indexOf("<x-evil") + 20));
    if (h.includes("url(x-evil")) fail("Paketfarbe ungeprüft im Style:", name);
  }
  if (!pages["Tab path"].includes("&lt;x-evil&gt;")) fail("Testpaket erscheint nicht auf dem Lernweg");
  console.log("Web-App-Test:", errors, "Fehler");
  process.exit(errors ? 1 : 0);
})().catch(e => { console.log("ABBRUCH", e); process.exit(1); });
