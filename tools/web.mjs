// Web app: builds app/ plus the files in web/ (manifest, icons, service worker) into worker/public/, next to the packs.
// The Worker serves it at its root URL, so the app runs in any browser and can be added to the home screen (also on iPhones).
//   node tools/web.mjs build [dir]   writes the web app to dir (default worker/public); run after tools/packs.mjs build
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "app"), WEB = join(ROOT, "web");
// Only for the browser: the APK gets app/ unchanged.
const HEAD = `<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="theme-color" content="#EDF0F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1420" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="SprachFuchs">
<meta name="description" content="Freie Sprachlern-App für Deutschsprachige: Englisch, Französisch, Spanisch, Italienisch und Portugiesisch. Ohne Werbung, ohne Tracking.">
`;
const HEADERS = `/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
`;

const files = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });

function build(out) {
  // Start clean, but keep what tools/packs.mjs wrote.
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(out)) if (f !== "packs" && f !== "_headers") rmSync(join(out, f), { recursive: true, force: true });
  const written = [];
  const put = (rel, data) => { const p = join(out, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, data); written.push(rel); };
  for (const p of files(APP)) {
    const rel = relative(APP, p).split(sep).join("/");
    if (rel === "index.html") {
      const html = readFileSync(p, "utf8");
      if (!html.includes('<link rel="stylesheet" href="styles.css">')) throw new Error("app/index.html: Stylesheet-Zeile nicht gefunden");
      put(rel, html.replace('<link rel="stylesheet" href="styles.css">', HEAD + '<link rel="stylesheet" href="styles.css">'));
    } else put(rel, readFileSync(p));
  }
  for (const f of readdirSync(WEB)) if (f !== "sw.js") put(f, readFileSync(join(WEB, f)));
  // The service worker caches every file; its version changes with their content, so browsers pick up each update.
  const list = ["./", ...written.filter(f => f !== "index.html" && !f.endsWith(".txt")).sort()];
  const hash = createHash("sha256");
  for (const f of written.sort()) hash.update(f).update(readFileSync(join(out, f)));
  const sw = readFileSync(join(WEB, "sw.js"), "utf8").replace("__VERSION__", hash.digest("hex").slice(0, 12)).replace("__FILES__", JSON.stringify(list));
  put("sw.js", sw);
  const hp = join(out, "_headers"), old = existsSync(hp) ? readFileSync(hp, "utf8") : "";
  if (!old.includes("/sw.js")) writeFileSync(hp, old + (old && !old.endsWith("\n") ? "\n" : "") + HEADERS);
  return { files: written.length, size: written.reduce((a, f) => a + statSync(join(out, f)).size, 0) };
}

const [cmd, dir] = process.argv.slice(2);
if (cmd === "build") {
  const r = build(dir || join(ROOT, "worker", "public"));
  console.log(`Web-App: ${r.files} Dateien (${Math.round(r.size / 1024)} KB) nach ${relative(process.cwd(), dir || join(ROOT, "worker", "public")) || "."} geschrieben`);
} else { console.log("Aufruf: node tools/web.mjs build [Ordner]"); process.exit(2); }
