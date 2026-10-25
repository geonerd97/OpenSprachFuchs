"use strict";
/* ---------- Bonus stations ----------
   Every unit has a fifth, optional node after its four lessons. It is a short story when the pack has one for the unit
   (every fifth unit), otherwise a mini game with the unit's words: word search, letter salad, memory or word guessing,
   taking turns along the path. A station runs as its own round (kind "bonus", no hearts) and gives
   BONUS_XP and BONUS_GEMS the first time, BONUS_REPLAY_XP after that. */
const BONUS_XP = 15, BONUS_GEMS = 5, BONUS_REPLAY_XP = 5;
const GAME_KINDS = ["wordsearch", "scramble", "memory", "guess"];
const GAME_INFO = {
  story: { em: "📖", name: "Kurzgeschichte", desc: "Lies und hör eine kurze Geschichte, dann beantworte drei Fragen." },
  wordsearch: { em: "🔎", name: "Wortsuche", desc: "Finde die Wörter im Buchstabenraster: erst den ersten, dann den letzten Buchstaben antippen." },
  scramble: { em: "🔤", name: "Buchstabensalat", desc: "Bring die Buchstaben in die richtige Reihenfolge." },
  memory: { em: "🃏", name: "Memory", desc: "Deck die Karten auf und finde Wort und Übersetzung." },
  guess: { em: "❓", name: "Wortraten", desc: "Errate das Wort Buchstabe für Buchstabe." },
};
const storyFor = unitId => (C.stories || []).find(s => s.unit === unitId) || null;
const bonusKind = ui_ => storyFor(UNITS[ui_].id) ? "story" : GAME_KINDS[ui_ % GAME_KINDS.length];
const bonusDone = id => !!((cs().bonus || {})[id]);

/* Words for the games: the unit's words without article, letters only (no spaces or apostrophes), uppercase.
   Units with too few such words borrow from the units before. */
function gameWords(ui_, min, maxLen = 9) {
  const out = [], seen = new Set();
  for (let i = ui_; i >= 0 && out.length < 12; i--) {
    for (const w of shuffle(UNITS[i].words)) {
      const word = w.t.replace(C.art, "").trim().toLocaleUpperCase(C.voice);
      if (!/^\p{L}+$/u.test(word) || word.length < 3 || word.length > maxLen || seen.has(word)) continue;
      seen.add(word); out.push({ word, t: w.t, de: w.de.split("/")[0].trim() });
    }
    if (out.length >= min && i < ui_) break;
    if (out.length >= Math.max(min, 8)) break;
  }
  return out;
}

function startBonus(ui_) {
  const kind = bonusKind(ui_), u = UNITS[ui_];
  const g = { kind, unit: ui_ };
  if (kind === "story") {
    const s = storyFor(u.id);
    Object.assign(g, { story: s, phase: "read", q: 0, order: shuffle([0, 1, 2]), wrong: [] });
  } else if (kind === "wordsearch") Object.assign(g, makeWordSearch(gameWords(ui_, 5, 8).slice(0, 6)));
  else if (kind === "scramble") Object.assign(g, { words: gameWords(ui_, 5, 10).slice(0, 5), i: 0, shake: false });
  else if (kind === "memory") {
    const words = gameWords(ui_, 6, 14).slice(0, 6);
    Object.assign(g, { words, cards: shuffle(words.flatMap((w, i) => [{ p: i, side: "t" }, { p: i, side: "de" }])), open: [], found: new Set() });
  } else if (kind === "guess") Object.assign(g, { words: gameWords(ui_, 4, 10).slice(0, 4), i: 0, guessed: new Set(), lives: 5 });
  if (kind === "scramble") Object.assign(g, scrambleTiles(g.words[0]));
  if (kind === "guess") g.keys = guessKeys(g.words[0].word);
  beginLesson({ kind: "bonus", unit: ui_, game: g, queue: [{ type: "game", key: "g:" + u.id }] });
  L.total = kind === "story" ? g.story.questions.length : g.words.length; render(); // the progress bar grows with every solved item
}
const bonusTitle = g => g.kind === "story" ? g.story.title : GAME_INFO[g.kind].name;
function gameWon() { L.checked = true; L.res = { ok: true, given: "" }; L.done = L.total; sfx("good"); }

/* Word search: up to six words, left to right, top to bottom or diagonally, in an 8×8 grid. */
function makeWordSearch(words) {
  const N = 8, DIRS = [[0, 1], [1, 0], [1, 1]];
  for (let attempt = 0; attempt < 40; attempt++) {
    const grid = [...Array(N)].map(() => new Array(N).fill("")), placed = [];
    for (const w of words) {
      const chars = [...w.word];
      let ok = false;
      for (let k = 0; k < 80 && !ok; k++) {
        const [dr, dc] = pick(DIRS), r0 = Math.floor(Math.random() * N), c0 = Math.floor(Math.random() * N);
        const cells = chars.map((_, j) => [r0 + dr * j, c0 + dc * j]);
        if (cells.some(([r, c], j) => r >= N || c >= N || (grid[r][c] && grid[r][c] !== chars[j]))) continue;
        cells.forEach(([r, c], j) => { grid[r][c] = chars[j]; });
        placed.push(Object.assign({}, w, { cells })); ok = true;
      }
    }
    if (placed.length < Math.min(4, words.length)) continue;
    const pool = [...placed.map(p => p.word).join("")];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) grid[r][c] = pick(pool);
    return { N, grid, words: placed, found: new Set(), first: null, flash: null };
  }
  return { N, grid: [...Array(N)].map(() => new Array(N).fill("·")), words: [], found: new Set(), first: null, flash: null };
}
function wordSearchTap(r, c) {
  const g = L.game;
  if (L.checked) return;
  if (!g.first) { g.first = [r, c]; render(); return; }
  const [r0, c0] = g.first; g.first = null;
  const key = cells => cells.map(x => x.join(",")).join(";");
  const hit = g.words.findIndex((w, i) => !g.found.has(i) && (() => {
    const a = w.cells[0], b = w.cells[w.cells.length - 1];
    return (a[0] === r0 && a[1] === c0 && b[0] === r && b[1] === c) || (b[0] === r0 && b[1] === c0 && a[0] === r && a[1] === c);
  })());
  if (hit >= 0) {
    g.found.add(hit); sfx("good"); L.right++; L.done = Math.min(L.total, L.done + 1);
    if (!listenPaused()) speak(g.words[hit].t);
    if (g.found.size === g.words.length) gameWon();
  } else if (r0 !== r || c0 !== c) { L.mistakes++; sfx("bad"); g.flash = key([[r0, c0], [r, c]]); setTimeout(() => { if (L && L.game === g) { g.flash = null; render(); } }, 500); }
  render();
}

/* Letter salad: the letters of a word in random order; tap them in the right order. */
function scrambleTiles(w) {
  const letters = [...w.word];
  let order = shuffle(letters.map((_, i) => i));
  for (let k = 0; k < 10 && order.every((x, i) => letters[x] === letters[i]); k++) order = shuffle(order);
  return { tiles: order.map(i => letters[i]), picked: [] };
}
function scrambleTap(i) {
  const g = L.game;
  if (L.checked || g.picked.includes(i)) return;
  g.picked.push(i); sfx("tap");
  const w = g.words[g.i];
  if (g.picked.length === g.tiles.length) {
    if (g.picked.map(j => g.tiles[j]).join("") === w.word) {
      L.right++; L.done = Math.min(L.total, L.done + 1); sfx("good");
      if (!listenPaused()) speak(w.t);
      g.i++;
      if (g.i >= g.words.length) { g.picked = []; gameWon(); }
      else Object.assign(g, scrambleTiles(g.words[g.i]));
    } else {
      L.mistakes++; sfx("bad"); g.shake = true;
      setTimeout(() => { if (L && L.game === g) { g.picked = []; g.shake = false; render(); } }, 600);
    }
  }
  render();
}
function scrambleBack() { const g = L.game; if (!L.checked && !g.shake) { g.picked.pop(); render(); } }

/* Memory: twelve cards, each word once in the language and once in German. */
function memoryTap(i) {
  const g = L.game;
  if (L.checked || g.open.length >= 2 || g.open.includes(i) || g.found.has(g.cards[i].p)) return;
  g.open.push(i); sfx("tap");
  const card = g.cards[i];
  if (card.side === "t" && !listenPaused()) speak(g.words[card.p].t);
  if (g.open.length === 2) {
    const [a, b] = g.open.map(j => g.cards[j]);
    if (a.p === b.p) {
      g.found.add(a.p); g.open = []; L.right++; L.done = Math.min(L.total, L.done + 1); sfx("good");
      if (g.found.size === g.words.length) gameWon();
    } else {
      L.mistakes++;
      setTimeout(() => { if (L && L.game === g) { g.open = []; render(); } }, 900);
    }
  }
  render();
}

/* Word guessing: the German word as a hint, letters to tap; five wrong letters per word reveal it. */
function guessKeys(word) {
  const own = [...new Set(word)], extra = shuffle([..."AEIOURSTNLMDCPBG"].filter(c => !own.includes(c))).slice(0, Math.max(4, 12 - own.length));
  return shuffle([...own, ...extra]);
}
function guessTap(ch) {
  const g = L.game, w = g.words[g.i];
  if (L.checked || g.guessed.has(ch) || g.reveal) return;
  g.guessed.add(ch);
  if (w.word.includes(ch)) sfx("tap"); else { g.lives--; L.mistakes++; sfx("bad"); }
  const solved = [...w.word].every(c => g.guessed.has(c));
  if (solved || g.lives <= 0) {
    if (solved) { L.right++; L.done = Math.min(L.total, L.done + 1); sfx("good"); }
    g.reveal = true;
    if (!listenPaused()) speak(w.t);
    setTimeout(() => guessNext(g), solved ? 900 : 1600);
  }
  render();
}
function guessNext(g) {
  if (!L || L.game !== g || !g.reveal) return;
  g.reveal = false; g.i++;
  if (g.i >= g.words.length) gameWon();
  else { g.guessed = new Set(); g.lives = 5; g.keys = guessKeys(g.words[g.i].word); }
  render();
}

/* Story: read (and listen), then three questions in German. */
function storyToQuestions() { const g = L.game; if (g.phase === "read") { g.phase = "quiz"; g.q = 0; g.order = shuffle([0, 1, 2]); g.wrong = []; speechStop(); render(); window.scrollTo(0, 0); } }
function storyAnswer(i) {
  const g = L.game, q = g.story.questions[g.q];
  if (L.checked || g.wrong.includes(i)) return;
  if (g.order[i] !== 0) { g.wrong.push(i); L.mistakes++; sfx("bad"); render(); return; }
  L.right++; L.done = Math.min(L.total, L.done + 1); sfx("good"); g.q++;
  if (g.q >= g.story.questions.length) gameWon();
  else { g.order = shuffle([0, 1, 2].slice(0, g.story.questions[g.q].a.length)); g.wrong = []; }
  render();
}
function storyReadAll() { const g = L.game; speechStop(); g.story.lines.forEach((l, i) => speak(l.t, false, i > 0)); }
function speechStop() { try { if (APP && window.AndroidBridge.stop) window.AndroidBridge.stop(); else if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} }

/* ---------- Views ---------- */
function gameHTML() {
  const g = L.game, info = GAME_INFO[g.kind];
  if (g.kind === "story") {
    const s = g.story;
    if (g.phase === "read") return `<div class="tag">${info.em} ${info.name}</div><h2>${s.em || "📖"} ${esc(s.title)}</h2>
      <div class="row"><button class="btn ghost" data-act="storyall">${I.speaker(18)} Alles vorlesen</button></div>
      <div class="story">${s.lines.map(l => `<div class="story-line"><button class="speak sm" data-act="say" data-t="${esc(l.t)}" aria-label="Vorlesen">${I.speaker(16)}</button>
        <div>${hintSpans(l.t, "t")}<details><summary>Übersetzung</summary>${esc(l.de)}</details></div></div>`).join("")}</div>${hintBox()}`;
    if (g.q >= s.questions.length) return `<div class="tag">${info.em} ${info.name}</div><h2>Alle Fragen richtig beantwortet!</h2>
      <div class="story">${s.lines.map(l => `<div class="story-line"><div>${hintSpans(l.t, "t")}</div></div>`).join("")}</div>${hintBox()}`;
    const q = s.questions[g.q];
    return `<div class="tag">${info.em} Frage ${g.q + 1} von ${s.questions.length}</div><h2>${esc(q.q)}</h2>
      <div class="choices">${g.order.map((idx, i) => { const wrong = g.wrong.includes(i);
        return `<button class="choice ${wrong ? "wrong" : ""}" data-act="storyq" data-i="${i}" ${wrong ? "disabled" : ""}><span class="num">${i + 1}</span><span>${esc(q.a[idx])}</span></button>`; }).join("")}</div>
      <details class="muted"><summary>Geschichte noch einmal lesen</summary>${s.lines.map(l => `<p>${hintSpans(l.t, "t")}</p>`).join("")}</details>${hintBox()}`;
  }
  if (g.kind === "wordsearch") {
    const onWord = (r, c) => g.words.some((w, i) => g.found.has(i) && w.cells.some(x => x[0] === r && x[1] === c));
    const cells = g.grid.map((row, r) => row.map((ch, c) => {
      const cls = onWord(r, c) ? "found" : g.first && g.first[0] === r && g.first[1] === c ? "sel" : g.flash && g.flash.split(";").includes(`${r},${c}`) ? "flash" : "";
      return `<button class="ws-cell ${cls}" data-act="ws" data-r="${r}" data-c="${c}">${esc(ch)}</button>`; }).join("")).join("");
    return `<div class="tag">${info.em} ${info.name}</div><h2>Finde die Wörter</h2>
      <div class="ws-grid" style="--n:${g.N}">${cells}</div>
      <ul class="ws-list">${g.words.map((w, i) => `<li class="${g.found.has(i) ? "found" : ""}">${esc(w.de)}${g.found.has(i) ? ` = <b>${esc(w.t)}</b>` : ""}</li>`).join("")}</ul>`;
  }
  if (g.kind === "scramble") {
    const w = g.words[Math.min(g.i, g.words.length - 1)];
    return `<div class="tag">${info.em} ${info.name} · ${Math.min(g.i + 1, g.words.length)} von ${g.words.length}</div><h2>Wie heißt „${esc(w.de)}“?</h2>
      <div class="scr-answer ${g.shake ? "shake" : ""}">${[...Array(g.tiles.length).keys()].map(k => `<span class="scr-slot">${g.picked[k] !== undefined ? esc(g.tiles[g.picked[k]]) : ""}</span>`).join("")}</div>
      <div class="bank">${g.tiles.map((ch, i) => `<button class="tile ${g.picked.includes(i) ? "used" : ""}" data-act="scr" data-i="${i}" ${g.picked.includes(i) ? "disabled" : ""}>${esc(ch)}</button>`).join("")}</div>
      <div class="row" style="justify-content:center"><button class="btn ghost" data-act="scrback">⌫ Zurück</button></div>`;
  }
  if (g.kind === "memory") return `<div class="tag">${info.em} ${info.name}</div><h2>Finde die Paare</h2>
      <div class="mem-grid">${g.cards.map((cd, i) => { const up = g.open.includes(i) || g.found.has(cd.p), w = g.words[cd.p];
        return `<button class="mem-card ${up ? "up" : ""} ${g.found.has(cd.p) ? "found" : ""} ${cd.side === "de" ? "de" : ""}" data-act="mem" data-i="${i}" aria-label="${up ? esc(cd.side === "t" ? w.t : w.de) : "Verdeckte Karte"}">${up ? esc(cd.side === "t" ? w.t : w.de) : "🦊"}</button>`; }).join("")}</div>`;
  if (g.kind === "guess") {
    const w = g.words[Math.min(g.i, g.words.length - 1)];
    return `<div class="tag">${info.em} ${info.name} · ${Math.min(g.i + 1, g.words.length)} von ${g.words.length}</div><h2>Gesucht: „${esc(w.de)}“</h2>
      <div class="guess-word">${[...w.word].map(ch => `<span class="scr-slot">${g.guessed.has(ch) || g.reveal ? esc(ch) : ""}</span>`).join("")}</div>
      <p class="muted" style="text-align:center;margin:0">${"❤️".repeat(Math.max(0, g.lives))}${"🤍".repeat(5 - Math.max(0, g.lives))}</p>
      <div class="bank">${g.keys.map(ch => `<button class="tile ${g.guessed.has(ch) ? (w.word.includes(ch) ? "used good" : "used") : ""}" data-act="guess" data-ch="${esc(ch)}" ${g.guessed.has(ch) ? "disabled" : ""}>${esc(ch)}</button>`).join("")}</div>`;
  }
  return "";
}
function gameFooterHTML() {
  const g = L.game;
  if (L.checked) {
    const first = !bonusDone(UNITS[g.unit].id);
    return `<footer class="l-foot ok"><div class="l-foot-in"><div class="fb" role="status"><span class="ico">${I.check(32)}</span><div><h3>Geschafft!</h3>
      <p>${first ? `+${BONUS_XP} XP und ${BONUS_GEMS} 💎` : `+${BONUS_REPLAY_XP} XP`}</p></div></div><button class="btn good" id="contBtn" data-act="cont">Weiter</button></div></footer>`;
  }
  if (g.kind === "story" && g.phase === "read") return `<footer class="l-foot"><div class="l-foot-in"><p class="muted" style="margin:0">Unterstrichene Wörter kannst du antippen.</p>
    <button class="btn good" data-act="storyquiz">Zu den Fragen</button></div></footer>`;
  const note = g.kind === "wordsearch" ? `${g.found.size} von ${g.words.length} gefunden. ${g.first ? "Jetzt den letzten Buchstaben antippen." : "Tippe den ersten Buchstaben eines Wortes."}`
    : g.kind === "memory" ? `${g.found.size} von ${g.words.length} Paaren` : g.kind === "story" ? "Wähle die passende Antwort." : GAME_INFO[g.kind].desc;
  return `<footer class="l-foot"><div class="l-foot-in"><p class="muted" style="margin:0">${note}</p></div></footer>`;
}
/** The fifth node of a unit on the path. */
function bonusNodeHTML(u, ui_, open, off) {
  const ready = open && done(u.id) >= LESSONS_PER_UNIT, kind = bonusKind(ui_), info = GAME_INFO[kind], fin = bonusDone(u.id), id = `${ui_}-b`;
  const state = !ready ? "locked" : fin ? "done" : "bonus";
  const pop = ui.pop === id && ready ? `<div class="pop" role="dialog" style="--c:var(--gold)"><h3>${info.em} ${kind === "story" ? esc(storyFor(u.id).title) : info.name}</h3><p>${info.desc} Freiwillig.</p>
    <button class="btn gold wide" data-act="bonus" data-u="${ui_}">${fin ? `Nochmal spielen +${BONUS_REPLAY_XP} XP` : `Spielen +${BONUS_XP} XP · ${BONUS_GEMS} 💎`}</button></div>` : "";
  return `<div class="node-wrap" style="transform:translateX(${off}px)"><button class="node bonus-node ${state}" data-act="node" data-id="${id}" data-state="${state === "locked" ? "locked" : "open"}"
    aria-label="${u.title}, ${kind === "story" ? "Kurzgeschichte" : info.name}${state === "locked" ? ", noch gesperrt" : fin ? ", geschafft" : ""}"><span aria-hidden="true">${state === "locked" ? "🔒" : info.em}</span></button></div>${pop}`;
}
