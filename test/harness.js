// Loads the game from app/ into Node with a minimal fake browser, the language packs from packs/ already installed.
const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");

const ROOT = path.join(__dirname, "..");
const SCRIPTS = fs.readFileSync(path.join(ROOT, "app", "index.html"), "utf8").match(/src="js\/[^"]+"/g).map(s => s.slice(5, -1));
const SRC = SCRIPTS.map(f => fs.readFileSync(path.join(ROOT, "app", f), "utf8")).join("\n;\n");
const packFiles = () => fs.readdirSync(path.join(ROOT, "packs")).filter(f => f.endsWith(".json"));

const el = () => ({ innerHTML: "", insertAdjacentHTML() {}, addEventListener() {}, value: "", focus() {}, click() {}, disabled: false, style: {}, textContent: "" });

/** A fresh game. `store` is the fake localStorage; packs are installed unless `packs: false`. */
function loadGame(windowExtra = {}, { store = {}, packs = true, fetch: fetchImpl, web = false } = {}) {
  if (packs) {
    const shas = {};
    for (const f of packFiles()) {
      const text = JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, "packs", f), "utf8")));
      const code = f.replace(".json", "");
      store["opensprachfuchs-pack-" + code] = text;
      shas[code] = createHash("sha256").update(text).digest("hex");
    }
    store["opensprachfuchs-packs"] = JSON.stringify(shas);
    if (!store["opensprachfuchs-state"]) store["opensprachfuchs-state"] = JSON.stringify({ onboarded: true, course: "en" });
  }
  let clickHandler = null;
  global.speechSynthesis = { cancel() {}, speak() {} };
  global.SpeechSynthesisUtterance = function () {};
  global.window = Object.assign({ scrollTo() {}, open() {}, speechSynthesis: global.speechSynthesis }, windowExtra);
  global.document = { getElementById: id => (id === "app" ? Object.assign(el(), { addEventListener: (t, f) => { if (t === "click") clickHandler = f; } }) : el()),
    addEventListener() {}, querySelectorAll: () => [], querySelector: () => el() };
  // Each game gets its own storage, so several players can run side by side in one test.
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  // web: the page as the web app in a browser (https), otherwise opened from a file.
  global.location = web ? { protocol: "https:", hostname: "example.org", origin: "https://example.org", pathname: "/", hash: "" } : { protocol: "file:", hostname: "" };
  global.setInterval = () => 0;
  global.setTimeout = () => 0;
  global.clearTimeout = () => {};
  global.fetch = fetchImpl || (() => Promise.reject(new Error("offline")));
  const exportsList = `nextExercise, setCourse, startLesson, exerciseHTML, footerHTML, evaluate, homeHTML, modalHTML, render, srs, srsUpdate, dueWords, ui, check,
    startDialog, dialogPick, dialogsFor, startMaster, masteryOf, buy, shopItems, shownStreak, finish, startBlitz, blitzAnswer, blitzTask, blitzTick, todaysQuests,
    claimQuests, dayRec, applyDecay, resetCourseFrom, cs, startTraining, pauseListening, resumeListening, fromSaved, MAX_HEARTS, startPlacement, cont, statsHTML,
    resultHTML, BADGES, done, speak, generate, startRecognition, pauseSpeaking, COURSES, acct, friends, createAccount, signIn, initAccount, pushSave, pullSave,
    deleteAccount, signOut, addFriend, acceptFriend, removeFriend, sendGift, claimGifts, loadFriends, reportLearningDay, sendReports, newKey, normalizeKey,
    deriveKeys, encryptState, decryptState, pairStreak, checkAppUpdate, hintSpans, exampleFor, unitUnlocked, startBonus, bonusKind, gameWords, wordSearchTap, scrambleTap, memoryTap, guessTap, guessNext, storyToQuestions, storyAnswer, bonusDone, setMyName, friendLink, parseFriendLink, handleFriendLink, keyReminderDue, checkKeyEnd, qrMatrix, qrSVG, wordKnown, exWords, NEW_PER_LESSON, lessonsOf, lessonsTotal, migrateLessons, fetchPackIndex, downloadPack, removePack, packUpdates, installPack, PACK_SHA,
    get PACK_INDEX() { return PACK_INDEX }, get PRIVACY_HTML() { return PRIVACY_HTML }, get result() { return result }, get L() { return L }, get st() { return st }, set st(v) { st = v },
    get view() { return view }, set view(v) { view = v }, UNITS: () => UNITS`;
  const g = new Function("localStorage", SRC + `;return { ${exportsList} };`)(localStorage);
  g.click = (act, data = {}) => clickHandler({ target: { closest: () => ({ dataset: Object.assign({ act }, data) }) } });
  g.store = store;
  return g;
}

module.exports = { loadGame, el, packFiles, ROOT };
