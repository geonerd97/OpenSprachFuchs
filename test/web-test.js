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
  if (fs.readFileSync(path.join(ROOT, "app", "index.html"), "utf8").includes("manifest")) fail("app/index.html (APK) enthält Web-App-Zeilen");
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

console.log("Web-App-Test:", errors, "Fehler");
process.exit(errors ? 1 : 0);
