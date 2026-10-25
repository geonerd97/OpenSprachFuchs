"use strict";
/* ---------- Lesson flow ----------
   Every round (lesson, practice, test, blitz, dialogue, mastery) runs through beginLesson() and ends in finish(). */
/* ---------- Lesson flow ---------- */
let view = "home", L = null, ui = { pop: null, modal: null, shake: null, tab: "path" }, result = null;

function startLesson(ui_, li) {
  syncHearts();
  if (st.settings.hearts && st.hearts <= 0) { ui.modal = "hearts"; render(); return; }
  const u = UNITS[ui_];
  const p = { words: u.words, sentences: u.sentences, used: new Set(), prefer: new Set(cs().mistakes) };
  const queue = PLANS[li].map(k => generate(k, p)).filter(Boolean);
  beginLesson({ kind: "lesson", unit: ui_, lesson: li, queue });
}
function startTraining(vocab, refill) {
  const open = UNITS.filter((u, i) => unitUnlocked(i) && (done(u.id) > 0 || i === 0));
  const due = dueWords().map(w => "w:" + w.id);
  const p = { words: open.flatMap(u => u.words), sentences: open.flatMap(u => u.sentences), used: new Set(), prefer: new Set([...cs().mistakes, ...due]) };
  const kinds = refill ? REFILL_PLAN : vocab ? VOCAB_PLAN : shuffle(MIX_PLAN);
  beginLesson({ kind: "training", vocab: !!vocab || !!refill, refill: !!refill, queue: kinds.map(k => generate(k, p)).filter(Boolean) });
}
const PLACEMENT_PLAN = ["bank", "typeSent", "listenWord", "bankRev", "gap", "type", "listen", "choiceRev", "typeSent", "bankRev", "type", "bank"];
const PLACEMENT_MAX = 3;
function placementRange(target) {
  let first = UNITS.findIndex(u => done(u.id) < LESSONS_PER_UNIT);
  if (first < 0 || first > target) first = target;
  return [first, target];
}
function startPlacement(target) {
  const [first] = placementRange(target), units = UNITS.slice(first, target + 1);
  // Lean towards the target unit: it is in the pool twice as often as the ones before it.
  const words = units.flatMap(u => u.words).concat(UNITS[target].words), sentences = units.flatMap(u => u.sentences).concat(UNITS[target].sentences);
  const p = { words, sentences, used: new Set(), prefer: new Set() };
  beginLesson({ kind: "placement", unit: target, queue: PLACEMENT_PLAN.map(k => generate(k, p)).filter(Boolean) });
}
/* Blitz round: 60 seconds of quick word tasks, one tap answers, the next task follows at once. */
const BLITZ_MS = 60 * 1000, BLITZ_KINDS = ["choice", "choiceRev", "choice", "choiceRev", "pic"];
let blitzTimer = 0;
function startBlitz() {
  const open = openUnits();
  const p = { words: open.flatMap(u => u.words), sentences: [], used: new Set(), prefer: new Set(dueWords().map(w => "w:" + w.id)) };
  beginLesson({ kind: "blitz", pool: p, queue: [blitzTask(p)], score: 0, endsAt: Date.now() + BLITZ_MS });
  clearInterval(blitzTimer);
  blitzTimer = setInterval(blitzTick, 250);
}
function blitzTask(p) { if (p.used.size > p.words.length * .8) p.used.clear(); return generate(pick(BLITZ_KINDS), p); }
function blitzTick() {
  if (!L || L.kind !== "blitz" || view !== "lesson") { clearInterval(blitzTimer); return; }
  const left = Math.max(0, L.endsAt - Date.now());
  const bar = document.getElementById("blitzBar"), time = document.getElementById("blitzTime");
  if (bar) bar.style.width = `${100 * left / BLITZ_MS}%`;
  if (time) time.textContent = `${Math.ceil(left / 1000)} s`;
  if (!left && !ui.modal) { clearInterval(blitzTimer); finish(); }
}
function blitzAnswer(i) {
  if (!L || L.checked) return;
  const ex = L.cur; L.sel = i;
  const ok = i === ex.ans;
  L.checked = true; L.res = { ok, given: givenText(ex) };
  trackAnswer(ex, ok);
  if (ok) { L.score++; L.done++; L.right++; sfx("good"); srsUpdate(ex.key, true); comboHit(ex); }
  else { L.mistakes++; L.combo = 0; sfx("bad"); srsUpdate(ex.key, false); }
  render();
  setTimeout(() => {
    if (!L || L.kind !== "blitz" || L.cur !== ex || view !== "lesson") return;
    L.queue.push(blitzTask(L.pool)); nextExercise(); render();
  }, ok ? 350 : 1100);
}
/* Mini dialogues: a partner speaks, you pick the fitting reply out of three. Wrong picks show what they mean. */
const dialogsFor = code => (COURSES[code] && COURSES[code].dialogs) || [];
function startDialog(id) {
  const scene = dialogsFor(CODE).find(d => d.id === id);
  if (!scene) return;
  beginLesson({ kind: "dialog", scene, queue: [{ type: "dialog", key: "d:" + id }] });
  L.total = scene.turns.length; render();
}
function startDialogTurns() {
  const sc = L.scene;
  L.dlg = { turn: 0, log: [{ who: "p", line: sc.turns[0].p }], order: shuffle([0, 1, 2]), wrong: [] };
  if (!listenPaused()) setTimeout(() => { if (L && L.dlg) speak(L.dlg.log[0].line.t); }, 400);
}
function dialogPick(i) {
  if (!L || !L.dlg || L.checked) return;
  const d = L.dlg, sc = L.scene, turn = sc.turns[d.turn], idx = d.order[i];
  if (d.wrong.includes(i)) return;
  if (idx !== 0) { d.wrong.push(i); L.mistakes++; L.combo = 0; sfx("bad"); render(); return; }
  sfx("good"); L.right++; L.done++; comboHit(L.cur);
  const mine = turn.a[0];
  d.log.push({ who: "me", line: mine });
  if (!listenPaused()) speak(mine.t);
  d.turn++; d.wrong = [];
  if (d.turn < sc.turns.length) {
    d.log.push({ who: "p", line: sc.turns[d.turn].p });
    d.order = shuffle([0, 1, 2]);
    const next = d.log[d.log.length - 1].line.t;
    if (!listenPaused()) speak(next, false, true); // after your own line, not on top of it
  } else { L.checked = true; L.res = { ok: true, given: "" }; }
  save(); render();
}

/* Mastery: finished units can be replayed for bronze, silver and gold. Harder tasks, no word hints, fewer mistakes allowed. */
const MEDALS = ["", "🥉", "🥈", "🥇"], MEDAL_NAMES = ["", "Bronze", "Silber", "Gold"], MASTER_ALLOWED = [2, 1, 0];
const masteryOf = id => ((cs().mastery || {})[id]) || 0;
function startMaster(u) {
  const unit = UNITS[u], level = masteryOf(unit.id);
  if (level >= 3) return;
  const p = { words: unit.words, sentences: unit.sentences, used: new Set(), prefer: new Set() };
  beginLesson({ kind: "master", unit: u, level, queue: MASTER_PLAN.map(k => generate(k, p)).filter(Boolean) });
}
function beginLesson(o) {
  ui.pop = null; ui.modal = null;
  L = Object.assign(o, { total: o.queue.length, done: 0, right: 0, mistakes: 0, startedAt: Date.now(), cur: null, checked: false, res: null });
  nextExercise(); view = "lesson"; render(); window.scrollTo(0, 0);
}
function nextExercise() {
  L.cur = L.queue.shift(); L.checked = false; L.res = null; L.sel = null; L.picked = []; L.typed = ""; L.hint = null; L.mic = ""; L.heard = null;
  if (L.cur && L.cur.type === "speak" && !canSpeak()) L.cur = degradeSpeak(L.cur);
  if (L.cur && L.cur.type === "dialog") startDialogTurns();
  if (L.cur && L.cur.type === "match") {
    const n = L.cur.pairs.length;
    L.m = { left: shuffle([...Array(n).keys()]), right: shuffle([...Array(n).keys()]), done: new Set(), l: null, r: null, flash: null, okFlash: null };
  }
  if (listenPaused() || noVoice()) L.cur = degradeAudio(L.cur);
  else if (L.cur && L.cur.type === "listen") setTimeout(() => speak(L.cur.text), 350);
  else if (L.cur && L.cur.audio) setTimeout(() => speak(L.cur.item.t), 350);
}
function answerReady() {
  const ex = L.cur;
  if (!ex) return false;
  if (ex.type === "choice" || ex.type === "pic" || ex.type === "gap") return L.sel !== null;
  if (ex.type === "bank" || ex.type === "listen") return L.picked.length > 0;
  if (ex.type === "type") { const t = document.getElementById("typeInput"); return !!(t && t.value.trim()); }
  if (ex.type === "speak") return !!(L.heard && L.heard.length);
  return false;
}
function evaluate(ex) {
  if (ex.type === "speak") return speechMatch(L.heard || [], ex.answers);
  if (ex.type === "choice" || ex.type === "pic" || ex.type === "gap") return { ok: L.sel === ex.ans };
  if (ex.type === "bank" || ex.type === "listen") {
    const said = norm(L.picked.map(id => ex.tiles[id].t).join(" "));
    return { ok: ex.answers.some(a => norm(a) === said) };
  }
  if (ex.type === "type") {
    const prep = s => { s = norm(s); return ex.word ? bare(s) : s; };
    const v = prep(document.getElementById("typeInput").value);
    if (!v) return { ok: false };
    if (ex.answers.some(a => prep(a) === v)) return { ok: true };
    if (ex.answers.some(a => plain(prep(a)) === plain(v))) return { ok: true, accents: true };
    for (const a of ex.answers) { const t = plain(prep(a)), d = lev(plain(v), t); if ((t.length >= 5 && d <= 1) || (t.length >= 12 && d <= 2)) return { ok: true, typo: true }; }
    return { ok: false };
  }
  return { ok: false };
}
function correctText(ex) {
  if (ex.type === "choice") return ex.rev ? `${ex.item.t} = ${ex.item.de}` : `${ex.item.de} = ${ex.item.t}`;
  if (ex.type === "pic") return `${ex.item.de} = ${ex.item.t}`;
  if (ex.type === "gap") return ex.full;
  return ex.target;
}
/* Sentences with tappable words: known words (longest phrase first, up to three words) show a translation. */
function hintSpans(text, lang) {
  if (L && L.kind === "master") return esc(text);
  const dict = lang === "de" ? HINT_DE : HINT_T, toks = String(text).split(" ").filter(Boolean), out = [];
  for (let i = 0; i < toks.length;) {
    let hit = null;
    for (let n = Math.min(3, toks.length - i); n >= 1 && !hit; n--) {
      const words = toks.slice(i, i + n).join(" "), h = dict[cleanKey(words)];
      if (h) hit = { words, n, h: h.join(" / ") };
    }
    if (hit) {
      const on = L && L.hint && L.hint.w === hit.words ? " on" : "";
      out.push(`<button class="hw${on}" data-act="hint" data-w="${esc(hit.words)}" data-h="${esc(hit.h)}" data-l="${lang}">${esc(hit.words)}</button>`);
      i += hit.n;
    } else { out.push(esc(toks[i])); i++; }
  }
  return out.join(" ");
}
const hintBox = () => L && L.hint ? `<div class="hintbox" role="status"><b>${esc(L.hint.w)}</b> = ${esc(L.hint.h)}</div>` : "";
function targetOf(ex) {
  if (ex.type === "choice" || ex.type === "pic") return ex.item.t;
  if (ex.type === "gap") return ex.full;
  if (ex.type === "bank") return ex.srcLang === "de" ? ex.target : ex.src;
  if (ex.type === "listen" || ex.type === "type" || ex.type === "speak") return ex.target;
  return null;
}
function givenText(ex) {
  if (ex.type === "choice") return ex.opts[L.sel] ? (ex.rev ? ex.opts[L.sel].de : ex.opts[L.sel].t) : "";
  if (ex.type === "pic") return ex.opts[L.sel] ? ex.opts[L.sel].t : "";
  if (ex.type === "gap") return ex.opts[L.sel] || "";
  if (ex.type === "bank" || ex.type === "listen") return L.picked.map(id => ex.tiles[id].t).join(" ");
  if (ex.type === "type") { const t = document.getElementById("typeInput"); return t ? t.value : ""; }
  if (ex.type === "speak") return (L.heard || [])[0] || "";
  return "";
}
function promptText(ex) {
  if (ex.type === "choice") return ex.audio ? `(gehört) ${ex.item.t}` : ex.rev ? ex.item.t : ex.item.de;
  if (ex.type === "pic") return ex.item.de;
  if (ex.type === "gap") return `${ex.before} ___ ${ex.after} (${ex.de})`;
  if (ex.type === "listen") return `(gehört) ${ex.text}`;
  if (ex.type === "match") return ex.pairs.map(w => `${w.de} = ${w.t}`).join("; ");
  return ex.src;
}
/* Combo: right answers in a row. Every fifth one in a row gives +2 bonus XP (not in the blitz round, which scores itself). */
const COMBO_STEP = 5, COMBO_XP = 2;
function comboHit(ex) {
  L.combo = (L.combo || 0) + 1; L.bestCombo = Math.max(L.bestCombo || 0, L.combo); L.comboNow = 0;
  const rec = dayRec(); best(rec, "combo", L.combo);
  if (ex && (ex.type === "listen" || ex.audio)) bump(rec, "listenRight");
  if (L.kind !== "blitz" && L.combo % COMBO_STEP === 0) { L.bonus = (L.bonus || 0) + COMBO_XP; L.comboNow = COMBO_XP; }
}
const comboChip = () => L && L.combo >= 3 ? `<span class="combo ${L.comboNow ? "pop" : ""}" title="Richtige Antworten in Folge">🔥 ${L.combo}</span>` : "";
function check(skip) {
  if (!L || L.checked || !L.cur || L.cur.type === "match" || L.cur.type === "dialog") return;
  if (!skip && !answerReady()) return;
  const ex = L.cur, res = skip ? { ok: false } : evaluate(ex), c = cs();
  res.given = skip ? "(übersprungen)" : givenText(ex);
  L.checked = true; L.res = res; L.reported = false;
  trackAnswer(ex, res.ok);
  if (res.ok) {
    L.done++; L.right++; sfx("good"); srsUpdate(ex.key, true); comboHit(ex);
    c.mistakes = c.mistakes.filter(k => k !== ex.key);
    const t = targetOf(ex); if (t && ex.type !== "listen" && !listenPaused()) speak(t);
  } else {
    L.mistakes++; sfx("bad"); if (L.kind === "lesson") loseHeart(); srsUpdate(ex.key, false); L.combo = 0;
    if (ex.key !== "m" && !c.mistakes.includes(ex.key)) c.mistakes = [ex.key, ...c.mistakes].slice(0, 40);
    ex._tries = (ex._tries || 0) + 1;
    if (L.kind === "placement" || L.kind === "master") L.done++; // a test counts every answer once
    else if (ex._tries < 3) {
      const again = Object.assign({}, ex);
      if (again.tiles) again.tiles = shuffle(again.tiles.map(t => t.t)).map((t, id) => ({ id, t }));
      L.queue.push(again);
    } else L.done++;
  }
  save(); render();
}
function cont() {
  if (!L || !L.checked) return;
  if (st.settings.hearts && L.kind === "lesson" && st.hearts <= 0) { ui.fail = "hearts"; view = "fail"; render(); return; }
  if (L.kind === "placement" && L.mistakes >= PLACEMENT_MAX) { ui.fail = "placement"; view = "fail"; render(); return; }
  if (L.kind === "master" && L.mistakes > MASTER_ALLOWED[L.level]) { ui.fail = "master"; ui.mu = L.unit; ui.ml = L.level; view = "fail"; render(); return; }
  if (!L.queue.length) { finish(); return; }
  nextExercise(); render();
}
function finish() {
  syncDay();
  const perfect = L.mistakes === 0, goalBefore = st.dayLessons >= 1;
  clearInterval(blitzTimer);
  const bonusFirst = L.kind === "bonus" && !bonusDone(UNITS[L.unit].id);
  let xp = L.kind === "bonus" ? (bonusFirst ? BONUS_XP : BONUS_REPLAY_XP) : L.kind === "blitz" ? Math.min(30, L.score) : L.kind === "placement" || L.kind === "master" ? 20 : L.kind === "training" ? 10 : 10 + (perfect ? 5 : 0);
  const comboBonus = L.kind === "blitz" ? 0 : L.bonus || 0;
  xp += comboBonus;
  const boosted = Date.now() < (st.boostUntil || 0);
  if (boosted) xp *= 2;
  let gems = L.kind === "bonus" ? (bonusFirst ? BONUS_GEMS : 0) : L.kind === "lesson" ? 5 + (perfect ? 3 : 0) : L.kind === "placement" ? 10 : L.kind === "master" ? 5 + 3 * L.level : L.kind === "dialog" ? 4 : L.kind === "blitz" ? Math.floor(L.score / 5) : 2;
  st.xp += xp; st.dayLessons++; st.lessons++;
  const rec = dayRec(); rec.xp += xp; rec.lessons++;
  cs().last = Date.now();
  if (perfect && L.kind === "lesson") { st.perfect = (st.perfect || 0) + 1; bump(rec, "perfect"); }
  let blitz = null;
  if (L.kind === "blitz") {
    const c = cs(), before = c.blitzBest || 0;
    c.blitzBest = Math.max(before, L.score); best(rec, "blitzBest", L.score);
    blitz = { score: L.score, best: c.blitzBest, record: L.score > before && L.score > 0 };
  }
  let master = null, dialog = "";
  if (L.kind === "master") {
    const c = cs(), id = UNITS[L.unit].id; c.mastery = c.mastery || {};
    if ((c.mastery[id] || 0) === L.level) c.mastery[id] = L.level + 1;
    master = { title: UNITS[L.unit].title, level: c.mastery[id] };
  }
  if (L.kind === "dialog") { const c = cs(); c.dialogs = c.dialogs || {}; c.dialogs[L.scene.id] = true; dialog = L.scene.title; }
  let bonus = "";
  if (L.kind === "bonus") { const c = cs(); c.bonus = c.bonus || {}; c.bonus[UNITS[L.unit].id] = true; bonus = bonusTitle(L.game); }
  if (L.kind === "placement") { const c = cs(); c.bonus = c.bonus || {}; for (let i = 0; i <= L.unit; i++) { c.progress[UNITS[i].id] = LESSONS_PER_UNIT; c.bonus[UNITS[i].id] = true; } st.placementPassed = true; }
  const before = shownStreak();
  let freezeUsed = 0;
  if (st.lastDay !== dayStr()) {
    const missed = missedDays();
    if (st.lastDay && missed === 0) st.streak++;
    else if (st.lastDay && missed <= (st.freezes || 0)) { st.freezes -= missed; freezeUsed = missed; st.streak++; }
    else st.streak = 1;
    st.lastDay = dayStr();
  }
  st.bestStreak = Math.max(st.bestStreak || 0, st.streak);
  pruneHistory();
  const fresh = checkBadges();
  gems += fresh.length * 10;
  st.gems = (st.gems || 0) + gems;
  if (L.kind === "lesson") { const id = UNITS[L.unit].id; if (L.lesson === done(id)) cs().progress[id] = done(id) + 1; }
  // Finishing the last unit of a level opens the next level's tab on the path.
  const nextUnit = UNITS[L.unit + 1];
  if ((L.kind === "lesson" || L.kind === "placement" || L.kind === "bonus") && nextUnit && unitComplete(L.unit) && nextUnit.level !== UNITS[L.unit].level) ui.level = nextUnit.level;
  let heartsGained = 0;
  if (L.kind === "training" && st.settings.hearts) {
    syncHearts();
    const before = st.hearts;
    st.hearts = Math.min(MAX_HEARTS, st.hearts + Math.floor(L.right / RIGHT_PER_HEART));
    if (st.hearts === MAX_HEARTS) st.heartsTs = 0;
    heartsGained = st.hearts - before;
  }
  const quests = claimQuests();
  save();
  const answered = L.done + L.mistakes;
  result = { xp, perfect, acc: Math.round(100 * L.done / Math.max(1, answered)), secs: Math.round((Date.now() - L.startedAt) / 1000),
    streakUp: st.streak > before ? st.streak : 0, goal: !goalBefore, training: L.kind === "training", vocab: !!L.vocab, badges: fresh,
    placement: L.kind === "placement" ? UNITS[L.unit].title : "", refill: !!L.refill, heartsGained,
    comboBonus, bestCombo: L.bestCombo || 0, blitz, quests, gems, boosted, freezeUsed, master, dialog, bonus,
    unitDone: L.kind === "lesson" && done(UNITS[L.unit].id) >= LESSONS_PER_UNIT && L.lesson === LESSONS_PER_UNIT - 1 };
  sfx("win"); view = "result"; L = null; render(); confetti(); reportDay(); reportLearningDay();
}

/* A short burst of confetti; skipped when the viewer prefers reduced motion. */
function confetti() {
  try {
    if (typeof requestAnimationFrame !== "function" || !window.matchMedia || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = document.createElement("canvas"), dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60";
    document.body.appendChild(cv);
    const g = cv.getContext("2d"); g.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement), cols = ["--accent", "--gold", "--good", "--heart", "--flame"].map(v => css.getPropertyValue(v).trim() || "#2456E8");
    const parts = Array.from({ length: 110 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 9, vy: -Math.random() * 11 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: cols[Math.floor(Math.random() * cols.length)] }));
    const t0 = performance.now();
    (function frame(t) {
      const k = (t - t0) / 1800; g.clearRect(0, 0, W, H);
      for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += .32; p.vx *= .99; p.r += p.vr;
        g.save(); g.globalAlpha = Math.max(0, 1 - k); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); }
      if (k < 1) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  } catch (e) {}
}
