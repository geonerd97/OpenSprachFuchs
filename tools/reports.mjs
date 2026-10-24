#!/usr/bin/env node
// Content reports from the app ("Fehler melden") from the D1 database.
//
//   node tools/reports.mjs                    lists the open reports, grouped by language and unit
//   node tools/reports.mjs --issues           files one GitHub issue per language and unit and marks the reports as filed
//   node tools/reports.mjs --issues --dry-run shows the issues without creating anything
//
// Needs Wrangler signed in (cd worker && npx wrangler login), and for --issues the GitHub CLI (gh auth login).
// Database name from worker/wrangler.toml, repository from GITHUB_REPO in app/js/config.js.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = join(ROOT, "worker");
const args = new Set(process.argv.slice(2));
const toml = existsSync(join(WORKER, "wrangler.toml")) ? readFileSync(join(WORKER, "wrangler.toml"), "utf8") : "";
const DB = (toml.match(/^database_name\s*=\s*"([^"]+)"/m) || [])[1] || "opensprachfuchs";
const REPO = (readFileSync(join(ROOT, "app/js/config.js"), "utf8").match(/GITHUB_REPO:\s*"([^"]*)"/) || [])[1] || "";
const LABEL = "Fehlermeldung";

function d1(sql) {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql], { cwd: WORKER, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const res = JSON.parse(out);
  return (Array.isArray(res) ? res[0] : res).results || [];
}

// Language and unit names from the packs, so the issues say "Französisch · Café & Restaurant" instead of "fr / food".
const packs = {};
for (const f of readdirSync(join(ROOT, "packs")).filter(f => f.endsWith(".json"))) {
  const p = JSON.parse(readFileSync(join(ROOT, "packs", f), "utf8"));
  packs[p.code] = { name: p.name, units: Object.fromEntries(p.units.map(u => [u.id, `${u.title} (${u.level})`])) };
}
const langName = c => (packs[c] && packs[c].name) || c || "?";
const unitName = (c, u) => (packs[c] && packs[c].units[u]) || u || "ohne Einheit";

const reports = d1("SELECT * FROM reports WHERE issue IS NULL ORDER BY course, unit, id");
if (!reports.length) { console.log("Keine offenen Fehlermeldungen."); process.exit(0); }
const groups = new Map();
for (const r of reports) {
  const key = `${r.course}|${r.unit}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const clip = (s, n = 300) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const md = s => clip(s).replace(/[`|<>]/g, c => ({ "`": "'", "|": "/", "<": "‹", ">": "›" }[c]));
function issueBody(list) {
  const rows = list.map(r => `- **${md(r.task)}**\n  - erwartet: ${md(r.expected)}\n  - Antwort: ${md(r.given) || "–"}${r.note ? `\n  - Notiz: ${md(r.note)}` : ""}\n  - ${r.type || "?"} · \`${md(r.item) || "?"}\` · ${r.day}${r.pack ? ` · Paket ${md(r.pack)}` : ""}`);
  return `Fehlermeldungen aus der App („Fehler melden“), ohne Bezug zu einem Konto.\n\n${rows.join("\n")}\n\n` +
    "Bitte prüfen und in `packs/` korrigieren (die `id` nie ändern), danach dieses Issue schließen.";
}

console.log(`${reports.length} offene Fehlermeldungen in ${groups.size} Gruppen:\n`);
for (const list of groups.values()) {
  const r0 = list[0];
  console.log(`## ${langName(r0.course)} · ${unitName(r0.course, r0.unit)} (${list.length})`);
  for (const r of list) console.log(`  - ${clip(r.task, 80)} → erwartet „${clip(r.expected, 60)}“${r.note ? ` · Notiz: ${clip(r.note, 80)}` : ""}`);
  console.log("");
}
if (!args.has("--issues")) { console.log("Mit --issues wird pro Gruppe ein GitHub-Issue angelegt."); process.exit(0); }
if (!REPO) { console.log("GITHUB_REPO in app/js/config.js ist leer."); process.exit(1); }

const dry = args.has("--dry-run");
if (!dry) execFileSync("gh", ["label", "create", LABEL, "--repo", REPO, "--color", "F26B1D", "--description", "Meldung aus der App: Inhalt prüfen", "--force"], { stdio: "ignore" });
for (const list of groups.values()) {
  const r0 = list[0], title = `Fehlermeldung: ${langName(r0.course)} · ${unitName(r0.course, r0.unit)} (${list.length})`;
  if (dry) { console.log(`[dry-run] ${title}\n${issueBody(list)}\n`); continue; }
  const url = execFileSync("gh", ["issue", "create", "--repo", REPO, "--title", title, "--label", LABEL, "--body", issueBody(list)], { encoding: "utf8" }).trim();
  const num = Number((url.match(/\/issues\/(\d+)/) || [])[1]);
  if (!num) { console.log("Issue-Nummer nicht erkannt:", url); process.exit(1); }
  d1(`UPDATE reports SET issue = ${num} WHERE id IN (${list.map(r => Number(r.id)).join(",")})`);
  console.log(`${url}  (${list.length} Meldungen)`);
}
