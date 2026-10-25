#!/usr/bin/env node
// Language packs: checks, formats and builds the files in packs/.
//
//   node tools/packs.mjs check    checks every pack and prints problems (exit code 1 on errors)
//   node tools/packs.mjs format   rewrites every pack in the house format (one word or sentence per line)
//   node tools/packs.mjs build    checks, then writes worker/public/packs/<code>.json and index.json
//
// The format of a pack is described in packs/README.md.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKS = join(ROOT, "packs");
const OUT = join(ROOT, "worker", "public", "packs");
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const HEX = /^#[0-9A-Fa-f]{6}$/;

export function packFiles() {
  return readdirSync(PACKS).filter(f => f.endsWith(".json")).sort();
}
export function readPack(file) {
  return JSON.parse(readFileSync(join(PACKS, file), "utf8"));
}

const texts = v => (Array.isArray(v) ? v : [v]);
const isText = v => typeof v === "string" && v.trim() !== "";
const isTexts = v => isText(v) || (Array.isArray(v) && v.length > 0 && v.every(isText));

/** Returns { errors, warnings } for one pack. */
export function checkPack(pack, file) {
  const errors = [], warnings = [];
  const err = (where, msg) => errors.push(`${file}: ${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${file}: ${where}: ${msg}`);
  if (pack.format !== 1) err("format", "muss 1 sein");
  if (!/^[a-z]{2,3}$/.test(pack.code || "")) err("code", "zwei oder drei Kleinbuchstaben, z. B. \"it\"");
  else if (file !== pack.code + ".json") err("code", `Dateiname muss ${pack.code}.json sein`);
  for (const k of ["name", "short", "voice", "note"]) if (!isText(pack[k])) err(k, "fehlt");
  if (!HEX.test(pack.color || "")) err("color", "Farbe als #RRGGBB");
  try { new RegExp(pack.articles || "(?!)", "i"); } catch (e) { err("articles", "kein gültiger regulärer Ausdruck"); }
  if (!Array.isArray(pack.gapSkip)) err("gapSkip", "muss eine Liste sein");
  if (pack.glossary && typeof pack.glossary !== "object") err("glossary", "muss ein Objekt sein");
  if (pack.glossaryDe && typeof pack.glossaryDe !== "object") err("glossaryDe", "muss ein Objekt sein");
  if (!Array.isArray(pack.units) || !pack.units.length) { err("units", "keine Einheiten"); return { errors, warnings }; }
  const ids = new Set();
  const uniq = (id, where) => { if (ids.has(id)) err(where, `ID ${id} doppelt`); ids.add(id); };
  for (const [ui, u] of pack.units.entries()) {
    const at = `Einheit ${ui + 1} (${u.id})`;
    if (!/^[a-z0-9-]+$/.test(u.id || "")) err(at, "id nur aus a-z, 0-9 und -");
    uniq("u:" + u.id, at);
    for (const k of ["title", "desc"]) if (!isText(u[k])) err(at, `${k} fehlt`);
    if (!LEVELS.includes(u.level)) err(at, `level muss eines von ${LEVELS.join(", ")} sein`);
    if (!Array.isArray(u.colors) || u.colors.length !== 2 || !u.colors.every(c => HEX.test(c))) err(at, "colors: zwei Farben #RRGGBB");
    if (!Array.isArray(u.words) || u.words.length < 4) err(at, "mindestens 4 Wörter");
    if (!Array.isArray(u.sentences)) err(at, "sentences fehlt");
    for (const w of u.words || []) {
      const wat = `${at}, Wort ${w.id}`;
      if (!new RegExp(`^${u.id}\\.w\\d+$`).test(w.id || "")) err(wat, `id muss ${u.id}.wNN sein`);
      uniq(w.id, wat);
      if (!isTexts(w.de) || Array.isArray(w.de)) err(wat, "de muss ein Text sein");
      if (!isTexts(w.t)) err(wat, "t fehlt");
    }
    for (const s of u.sentences || []) {
      const sat = `${at}, Satz ${s.id}`;
      if (!new RegExp(`^${u.id}\\.s\\d+$`).test(s.id || "")) err(sat, `id muss ${u.id}.sNN sein`);
      uniq(s.id, sat);
      if (!isTexts(s.de)) err(sat, "de fehlt");
      if (!isTexts(s.t)) err(sat, "t fehlt");
      for (const x of [...texts(s.t), ...texts(s.de)]) if (/\s[.,!?;:]/.test(x)) warn(sat, `frei stehendes Satzzeichen in „${x}“ (Lückentext überspringt den Satz)`);
    }
  }
  for (const [di, d] of (pack.dialogs || []).entries()) {
    const at = `Gespräch ${di + 1} (${d.id})`;
    if (!/^[a-z0-9-]+$/.test(d.id || "")) err(at, "id nur aus a-z, 0-9 und -");
    uniq("d:" + d.id, at);
    if (d.group !== undefined && !(pack.dialogGroups || {})[d.group]) err(at, `Kategorie „${d.group}“ fehlt in dialogGroups`);
    for (const k of ["title", "em", "desc"]) if (!isText(d[k])) err(at, `${k} fehlt`);
    if (!Array.isArray(d.turns) || !d.turns.length) { err(at, "keine Züge"); continue; }
    for (const [ti, t] of d.turns.entries()) {
      if (!t.p || !isText(t.p.de) || !isText(t.p.t)) err(`${at}, Zug ${ti + 1}`, "p braucht de und t");
      if (!Array.isArray(t.a) || t.a.length !== 3 || !t.a.every(a => a && isText(a.de) && isText(a.t))) err(`${at}, Zug ${ti + 1}`, "a braucht genau drei Antworten mit de und t (die erste ist richtig)");
    }
  }
  return { errors, warnings };
}

/** The house format: readable diffs, one word, sentence or dialogue line per line. */
export function formatPack(p) {
  const j = v => JSON.stringify(v);
  const head = ["format", "code", "name", "short", "voice", "color", "note", "articles", "gapSkip"].map(k => `  ${j(k)}: ${j(p[k])}`);
  const obj = (name, o) => `  ${j(name)}: {\n${Object.entries(o || {}).map(([k, v]) => `    ${j(k)}: ${j(v)}`).join(",\n")}\n  }`;
  const gloss = obj("glossary", p.glossary) + (p.glossaryDe ? ",\n" + obj("glossaryDe", p.glossaryDe) : "");
  const unit = u => `    {\n      "id": ${j(u.id)}, "title": ${j(u.title)}, "level": ${j(u.level)}, "colors": ${j(u.colors)},\n      "desc": ${j(u.desc)},\n`
    + `      "words": [\n${u.words.map(w => `        ${j(w)}`).join(",\n")}\n      ],\n`
    + `      "sentences": [\n${u.sentences.map(s => `        ${j(s)}`).join(",\n")}\n      ]\n    }`;
  const dialog = d => `    {\n      "id": ${j(d.id)},${d.group ? ` "group": ${j(d.group)},` : ""} "title": ${j(d.title)}, "em": ${j(d.em)}, "desc": ${j(d.desc)},\n      "turns": [\n`
    + d.turns.map(t => `        { "p": ${j(t.p)},\n          "a": [\n${t.a.map(a => `            ${j(a)}`).join(",\n")}\n          ] }`).join(",\n") + "\n      ]\n    }";
  const groups = p.dialogGroups ? `  "dialogGroups": {\n${Object.entries(p.dialogGroups).map(([k, v]) => `    ${j(k)}: ${j(v)}`).join(",\n")}\n  },\n` : "";
  return `{\n${head.join(",\n")},\n${gloss},\n  "units": [\n${p.units.map(unit).join(",\n")}\n  ],\n${groups}  "dialogs": [\n${(p.dialogs || []).map(dialog).join(",\n")}\n  ]\n}\n`;
}

function checkAll() {
  let errors = [], warnings = [];
  const packs = [];
  for (const f of packFiles()) {
    let p;
    try { p = readPack(f); } catch (e) { errors.push(`${f}: kein gültiges JSON (${e.message})`); continue; }
    const r = checkPack(p, f);
    errors = errors.concat(r.errors); warnings = warnings.concat(r.warnings);
    packs.push(p);
  }
  for (const w of warnings) console.log("Hinweis:", w);
  for (const e of errors) console.log("FEHLER:", e);
  return { packs, ok: !errors.length };
}

function build() {
  const { packs, ok } = checkAll();
  if (!ok) process.exit(1);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const index = { format: 1, packs: [] };
  for (const p of packs) {
    const body = JSON.stringify(p);
    writeFileSync(join(OUT, p.code + ".json"), body);
    index.packs.push({ code: p.code, name: p.name, short: p.short, color: p.color, note: p.note,
      units: p.units.length, words: p.units.reduce((a, u) => a + u.words.length, 0),
      size: Buffer.byteLength(body), sha256: createHash("sha256").update(body).digest("hex") });
  }
  writeFileSync(join(OUT, "index.json"), JSON.stringify(index));
  // The app loads the packs from another origin (https://appassets.androidplatform.net), so they need CORS.
  // Cloudflare serves static assets with the headers from public/_headers; short caching so updates arrive quickly.
  writeFileSync(join(OUT, "..", "_headers"), "/packs/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=300\n");
  console.log(`${packs.length} Sprachpakete nach worker/public/packs/ geschrieben:`, index.packs.map(p => `${p.code} (${Math.round(p.size / 1024)} KB)`).join(", "));
}

const cmd = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  if (cmd === "check") process.exit(checkAll().ok ? 0 : 1);
  else if (cmd === "format") { for (const f of packFiles()) writeFileSync(join(PACKS, f), formatPack(readPack(f))); console.log("Formatiert:", packFiles().join(", ")); }
  else if (cmd === "build") build();
  else { console.log("Aufruf: node tools/packs.mjs check | format | build"); process.exit(2); }
}
