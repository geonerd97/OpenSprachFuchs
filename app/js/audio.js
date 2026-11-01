"use strict";
/* ---------- Audio ----------
   Sound effects are synthesised. Speech output and recognition come from the phone (AndroidBridge);
   when the page runs in a desktop browser during development, the browser's speech synthesis stands in. */
let actx = null;
function sfx(kind) {
  if (!st.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { good: [[660, 0], [990, .09]], bad: [[220, 0], [180, .12]], win: [[523, 0], [659, .12], [784, .24], [1047, .36]], tap: [[440, 0]] }[kind];
    notes.forEach(([f, t]) => {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + t, len = kind === "tap" ? .05 : .16;
      o.type = kind === "bad" ? "triangle" : "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(kind === "tap" ? .05 : .18, t0 + .015); g.gain.exponentialRampToValueAtTime(.0001, t0 + len);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + len + .02);
    });
  } catch (e) {}
}
const browserTTS = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
const hasTTS = () => APP || browserTTS();
/* speak() replaces whatever is being said; with `queued` the text waits until the current speech has finished
   (dialogues: the partner answers after your line, instead of both talking at once, issue #5). */
function speak(text, slow, queued) {
  if (!st.settings.audio) return;
  if (APP) {
    try {
      const b = window.AndroidBridge;
      const spoken = queued && b.speakQueued ? b.speakQueued(text, C.voice, !!slow) : b.speak(text, C.voice, !!slow);
      // The bridge says no when the phone has no voice for the language: show the notice on the path instead.
      if (spoken === false && voice.state === "ok") checkVoice();
    } catch (e) {}
    return;
  }
  if (!browserTTS()) return;
  try {
    const synth = speechSynthesis, u = new SpeechSynthesisUtterance(text);
    u.lang = C.voice; u.rate = slow ? .6 : .95;
    if (!queued) synth.cancel();
    synth.speak(u);
  } catch (e) {}
}
function stopSpeaking() {
  try { if (APP) window.AndroidBridge.stop(); else if (browserTTS()) speechSynthesis.cancel(); } catch (e) {}
}

/* Listening can be paused for an hour; audio-only tasks then turn into reading tasks with the same answer. */
const LISTEN_PAUSE_MS = 60 * 60 * 1000;
const listenPaused = () => Date.now() < (st.listenOffUntil || 0);
/* The phone's voice for the current language (app only): "ok", "missing", "none" or "loading"; checked when the
   language changes and again once the speech engine has started. Without a voice, listening tasks become reading tasks. */
const voice = { code: "", state: "ok" };
function checkVoice(retry = 4) {
  if (!APP || !window.AndroidBridge.voiceState) return;
  voice.code = CODE; voice.state = window.AndroidBridge.voiceState(C.voice);
  if (voice.state === "loading" && retry > 0) setTimeout(() => checkVoice(retry - 1), 1500);
  else if (view === "home" && !ui.modal) render();
}
const noVoice = () => APP && voice.code === CODE && (voice.state === "missing" || voice.state === "none");
const canListen = () => hasTTS() && st.settings.audio && st.settings.listen && !listenPaused();
function degradeAudio(ex) {
  if (!ex) return ex;
  if (ex.type === "listen") return Object.assign({}, ex, { type: "bank", src: ex.de, srcLang: "de" });
  if (ex.audio) return Object.assign({}, ex, { audio: false });
  return ex;
}
function pauseListening() {
  st.listenOffUntil = Date.now() + LISTEN_PAUSE_MS; save();
  stopSpeaking();
  if (L) { L.queue = L.queue.map(degradeAudio); if (!L.checked) { L.cur = degradeAudio(L.cur); L.picked = []; } }
  render();
}
function resumeListening() { st.listenOffUntil = 0; save(); render(); }
const clockText = ms => { const d = new Date(ms); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
const pauseUntilText = () => clockText(st.listenOffUntil);

/* Speaking: the phone's speech recognition listens once; the result arrives in window.opensprachfuchsSpeech. */
let speechBroken = false;
const speechSupported = () => !speechBroken && APP && !!(window.AndroidBridge.canRecognize && window.AndroidBridge.canRecognize());
const speakPaused = () => Date.now() < (st.speakOffUntil || 0);
const canSpeak = () => speechSupported() && st.settings.speak !== false && !speakPaused();
function degradeSpeak(ex) {
  if (!ex || ex.type !== "speak") return ex;
  return Object.assign({}, ex, { type: "bank", src: ex.de, srcLang: "de", tiles: makeTiles(ex.target, "t", { sentences: ALL_SENTS }) });
}
function pauseSpeaking() {
  st.speakOffUntil = Date.now() + LISTEN_PAUSE_MS; save();
  try { if (APP && window.AndroidBridge.stopListening) window.AndroidBridge.stopListening(); } catch (e) {}
  if (L) { L.queue = L.queue.map(degradeSpeak); if (!L.checked) { L.cur = degradeSpeak(L.cur); L.picked = []; } }
  render();
}
function resumeSpeaking() { st.speakOffUntil = 0; save(); render(); }
// Spoken answers count when they are close enough to an accepted solution (80 % by edit distance).
function speechMatch(heard, answers) {
  let best = 0;
  for (const h of heard) for (const a of answers) {
    const x = plain(norm(h)), y = plain(norm(a));
    if (!x || !y) continue;
    best = Math.max(best, 1 - lev(x, y) / Math.max(x.length, y.length));
  }
  return { ok: best >= .8, typo: best >= .8 && best < 1 };
}
function micErrText(code) {
  if (code === "no-speech" || code === "no-match") return "Nichts verstanden. Tippe noch einmal aufs Mikrofon und sprich deutlich.";
  if (code === "permission") return "Kein Zugriff aufs Mikrofon. Erlaube ihn in den Einstellungen des Handys oder überspring das Sprechen.";
  return "Die Spracheingabe klappt gerade nicht. Überspring das Sprechen für eine Stunde.";
}
function startRecognition() {
  if (!L || L.checked || !L.cur || L.cur.type !== "speak") return;
  const ex = L.cur;
  const done = texts => { if (!L || L.cur !== ex || L.checked) return; L.mic = "done"; L.heard = texts; check(false); };
  const fail = code => {
    if (!L || L.cur !== ex) return;
    L.mic = "error"; L.micErr = code;
    if (!["no-speech", "no-match", "aborted"].includes(code)) speechBroken = true;
    render();
  };
  window.opensprachfuchsSpeech = msg => { if (msg && msg.type === "result") done(msg.texts || []); else if (msg && msg.type === "error") fail(msg.code); };
  L.mic = "listening"; L.micErr = ""; render();
  try { window.AndroidBridge.startListening(C.voice); } catch (e) { fail("unavailable"); }
}
