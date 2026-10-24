"use strict";
/* ---------- Lesson plans ----------
   Each lesson, practice round and test is a list of exercise kinds; generate() falls back when a kind does not fit. */
const LESSON_NAMES = ["Wörter", "Wörter & Sätze", "Hören & Schreiben", "Abschluss"];
const LESSON_DESC = ["Die neuen Vokabeln mit Bildern, Paaren und Hören.", "Vokabeln festigen und erste Sätze bauen.", "Hör genau hin und tipp selbst.", "Alles aus der Einheit, mit mehr Schreiben."];
const PLANS = [
  ["pic", "choice", "choiceRev", "match", "listenWord", "type", "pic", "choiceRev", "choice", "listenWord", "type", "match"],
  ["choice", "bank", "choiceRev", "gap", "listenWord", "bank", "type", "bankRev", "match", "gap", "type"],
  ["listen", "listenWord", "type", "bank", "gap", "typeSent", "choiceRev", "listen", "speak", "type", "match"],
  ["typeSent", "match", "listen", "type", "bankRev", "gap", "typeSent", "speak", "bank", "type", "typeSent"],
];
const REFILL_PLAN = ["choice", "choiceRev", "listenWord", "pic", "type", "match", "choiceRev", "type"];
const RIGHT_PER_HEART = 6; // practice rounds: +1 heart per 6 right answers
const VOCAB_PLAN = ["choice", "choiceRev", "type", "match", "listenWord", "pic", "type", "choiceRev", "choice", "type", "listenWord", "match"];
const MIX_PLAN = ["bank", "bankRev", "choice", "choiceRev", "gap", "listen", "typeSent", "type", "match", "bank", "listenWord", "speak"];
// Mastery rounds: harder tasks, more typing and speaking.
const MASTER_PLAN = ["typeSent", "type", "bankRev", "speak", "gap", "typeSent", "listen", "type", "bankRev", "typeSent", "gap", "type"];
const FALLBACK = { speak: ["bank"], pic: ["choice"], listen: ["bank"], listenWord: ["choiceRev"], gap: ["bank", "choice"], match: ["choice"], typeSent: ["bank"], type: ["choice"], bankRev: ["bank"], bank: ["choice"], choiceRev: ["choice"], choice: [] };

/* ---------- Helpers ---------- */
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const sample = (a, n) => shuffle(a).slice(0, n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CONTR = { "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are", "he's": "he is", "she's": "she is", "it's": "it is",
  "that's": "that is", "what's": "what is", "where's": "where is", "how's": "how is", "there's": "there is", "isn't": "is not", "aren't": "are not",
  "don't": "do not", "doesn't": "does not", "didn't": "did not", "wasn't": "was not", "can't": "cannot", "won't": "will not", "i'd": "i would",
  "you'd": "you would", "we'd": "we would", "i'll": "i will", "let's": "let us", "hasn't": "has not", "haven't": "have not",
  "couldn't": "could not", "wouldn't": "would not", "shouldn't": "should not", "weren't": "were not", "you'll": "you will", "we'll": "we will",
  "they'll": "they will", "he'll": "he will", "she'll": "she will", "it'll": "it will", "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have", "geht's": "geht es", "gibt's": "gibt es" };
function norm(s) {
  s = String(s).toLowerCase().replace(/[’‘`´]/g, "'").replace(/ß/g, "ss").replace(/œ/g, "oe").replace(/æ/g, "ae")
    .replace(/[.,!?;:"«»„“”()¿¡]/g, " ").replace(/-/g, " ");
  return s.split(/\s+/).filter(Boolean).map(t => CONTR[t] || t).join(" ").replace(/\bcan not\b/g, "cannot").trim();
}
const plain = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
function lev(a, b) {
  const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
const tokens = s => s.replace(/[.,!?¿¡]/g, "").split(" ").filter(Boolean);
const bare = w => w.replace(C.art, "");

/* ---------- Exercise generators ---------- */
function takeFrom(p, items, kind) {
  const keyOf = x => kind + ":" + x.id;
  let cand = items.filter(x => !p.used.has(keyOf(x)));
  if (!cand.length) cand = items;
  const pref = cand.filter(x => p.prefer.has(keyOf(x)));
  const x = pick(pref.length ? pref : cand);
  p.used.add(keyOf(x));
  return x;
}
function distractWords(p, w, n, field) {
  const ok = x => norm(x.t) !== norm(w.t) && norm(x.de) !== norm(w.de);
  const seen = new Set([norm(w[field])]), out = [];
  for (const x of shuffle(p.words.filter(ok)).concat(shuffle(ALL_WORDS.filter(ok)))) {
    if (out.length >= n) break;
    if (!seen.has(norm(x[field]))) { seen.add(norm(x[field])); out.push(x); }
  }
  return out;
}
function makeTiles(text, field, p) {
  const toks = tokens(text), lower = new Set(toks.map(t => t.toLowerCase()));
  const src = p.sentences.concat(sample(ALL_SENTS, 12)).map(s => s[field]);
  const extra = [], seen = new Set();
  for (const t of shuffle(src.flatMap(tokens))) {
    const l = t.toLowerCase();
    if (lower.has(l) || seen.has(l)) continue;
    seen.add(l); extra.push(t);
    if (extra.length >= (toks.length <= 4 ? 3 : 4)) break;
  }
  return shuffle(toks.concat(extra)).map((t, id) => ({ id, t }));
}
const GEN = {
  choice: p => { const w = takeFrom(p, p.words, "w"); const opts = shuffle([w, ...distractWords(p, w, 3, "t")]); return { type: "choice", rev: false, item: w, opts, ans: opts.indexOf(w), key: "w:" + w.id }; },
  choiceRev: p => { const w = takeFrom(p, p.words, "w"); const opts = shuffle([w, ...distractWords(p, w, 3, "de")]); return { type: "choice", rev: true, item: w, opts, ans: opts.indexOf(w), key: "w:" + w.id }; },
  pic: p => {
    const cand = p.words.filter(w => w.pic); if (cand.length < 4) return null;
    const w = takeFrom(p, cand, "w"); const opts = shuffle([w, ...sample(cand.filter(x => x !== w), 3)]);
    return { type: "pic", item: w, opts, ans: opts.indexOf(w), key: "w:" + w.id };
  },
  type: p => { const w = takeFrom(p, p.words, "w"); return { type: "type", word: true, src: w.de, answers: [w.t, ...w.alt], target: w.t, key: "w:" + w.id }; },
  typeSent: p => { const s = takeFrom(p, p.sentences, "s"); return { type: "type", word: false, src: s.de, answers: [s.t, ...s.tAlt], target: s.t, key: "s:" + s.id }; },
  bank: p => { const s = takeFrom(p, p.sentences, "s"); return { type: "bank", src: s.de, srcLang: "de", answers: [s.t, ...s.tAlt], target: s.t, tiles: makeTiles(s.t, "t", p), key: "s:" + s.id }; },
  bankRev: p => { const s = takeFrom(p, p.sentences, "s"); return { type: "bank", src: s.t, srcLang: CODE, answers: [s.de, ...s.deAlt], target: s.de, tiles: makeTiles(s.de, "de", p), key: "s:" + s.id }; },
  listenWord: p => {
    if (!canListen()) return null;
    const w = takeFrom(p, p.words, "w"); const opts = shuffle([w, ...distractWords(p, w, 3, "de")]);
    return { type: "choice", rev: true, audio: true, item: w, opts, ans: opts.indexOf(w), key: "w:" + w.id };
  },
  speak: p => {
    if (!canSpeak()) return null;
    const short = p.sentences.filter(z => tokens(z.t).length <= 8);
    if (!short.length) return null;
    const z = takeFrom(p, short, "s");
    return { type: "speak", text: z.t, de: z.de, answers: [z.t, ...z.tAlt], target: z.t, key: "s:" + z.id };
  },
  listen: p => {
    if (!canListen()) return null;
    const short = p.sentences.filter(s => tokens(s.t).length <= 8);
    const s = takeFrom(p, short.length ? short : p.sentences, "s");
    return { type: "listen", text: s.t, de: s.de, answers: [s.t, ...s.tAlt], target: s.t, tiles: makeTiles(s.t, "t", p), key: "s:" + s.id };
  },
  gap: p => {
    const single = [...new Set(ALL_WORDS.map(w => bare(w.t)).filter(x => !x.includes(" ")))];
    const known = new Set(single.map(x => x.toLowerCase()));
    const skip = new Set(C.skip);
    for (let tries = 0; tries < 6; tries++) {
      const s = takeFrom(p, p.sentences, "s"), orig = s.t.split(" "), clean = tokens(s.t);
      if (orig.length !== clean.length) continue;
      let idx = clean.map((t, i) => i).filter(i => known.has(clean[i].toLowerCase()) && !skip.has(clean[i].toLowerCase()));
      if (!idx.length) idx = clean.map((t, i) => i).filter(i => clean[i].length >= 4);
      if (!idx.length) continue;
      const i = pick(idx), correct = clean[i], cap = i === 0 && /^\p{Lu}/u.test(correct);
      const poolW = p.words.map(w => bare(w.t)).filter(x => !x.includes(" "));
      const seen = new Set([correct.toLowerCase()]), dis = [];
      for (const x of shuffle(poolW).concat(shuffle(single))) {
        if (dis.length >= 3) break;
        if (!seen.has(x.toLowerCase())) { seen.add(x.toLowerCase()); dis.push(cap ? x[0].toUpperCase() + x.slice(1) : x); }
      }
      const lead = orig[i].match(/^[¿¡]*/)[0], trail = orig[i].slice(lead.length + correct.length);
      const opts = shuffle([correct, ...dis]);
      return { type: "gap", before: orig.slice(0, i).join(" ") + (i ? " " : "") + lead, after: trail + (i < orig.length - 1 ? " " + orig.slice(i + 1).join(" ") : ""),
        opts, ans: opts.indexOf(correct), full: s.t, de: s.de, key: "s:" + s.id };
    }
    return null;
  },
  match: p => {
    if (p.words.length < 4) return null;
    const ws = sample(p.words, Math.min(5, p.words.length));
    return { type: "match", pairs: ws, key: "m" };
  },
};
const SENT_KINDS = new Set(["bank", "bankRev", "listen", "gap", "typeSent"]);
function generate(kind, p) {
  const order = [kind, ...(FALLBACK[kind] || []), "choice"];
  for (const k of order) {
    if (SENT_KINDS.has(k) && !p.sentences.length) continue;
    const ex = GEN[k](p); if (ex) return ex;
  }
  return null;
}
