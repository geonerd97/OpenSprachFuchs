"use strict";
/* ---------- Events ---------- */
function updateCheckBtn() { const b = document.getElementById("checkBtn"); if (b) b.disabled = !answerReady(); }
/* Daily reminder: the Android app keeps the time and today's state and posts the notification itself. */
function syncReminder() {
  try {
    if (!APP || !window.AndroidBridge.setReminder) return;
    const [h, m] = String(st.settings.reminderTime || "19:00").split(":").map(Number);
    window.AndroidBridge.setReminder(!!st.settings.reminder, h || 0, m || 0);
  } catch (e) {}
}
function reportDay() { try { if (APP && window.AndroidBridge.reportDay) window.AndroidBridge.reportDay(st.lastDay || "", shownStreak()); } catch (e) {} }
app.addEventListener("change", e => {
  if (e.target.id === "reminderTime" && e.target.value) { st.settings.reminderTime = e.target.value; save(); syncReminder(); }
});
app.addEventListener("input", e => {
  if (e.target.id === "typeInput" && L) { L.typed = e.target.value; updateCheckBtn(); }
  if (e.target.id === "wordSearch") {
    const q = e.target.value.trim().toLowerCase(); let shown = 0;
    for (const r of document.querySelectorAll(".wrow")) { r.hidden = !!q && !r.dataset.q.includes(q); if (!r.hidden) shown++; }
    const none = document.getElementById("wordNone"); if (none) none.hidden = shown > 0;
  }
});
app.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (view === "home" && ui.pop && !e.target.closest(".pop") && !(el && el.dataset.act === "node")) { ui.pop = null; if (!el) { render(); return; } }
  if (!el) return;
  const a = el.dataset.act, ds = el.dataset;
  if (a === "closemodal" && e.target !== el) return; // clicks inside the modal box bubble to the scrim
  switch (a) {
    case "node": {
      if (ds.state === "locked") { ui.shake = ds.id; sfx("bad"); render(); setTimeout(() => { ui.shake = null; }, 400); return; }
      sfx("tap"); ui.pop = ui.pop === ds.id ? null : ds.id; render(); return;
    }
    case "start": startLesson(+ds.u, +ds.l); return;
    case "bonus": startBonus(+ds.u); return;
    case "installvoice": window.AndroidBridge.installVoice(); return;
    case "install": if (ui.installPrompt) { ui.installPrompt.prompt(); ui.installPrompt = null; render(); } return;
    case "installhide": st.installHidden = true; save(); render(); return;
    case "voicehide": st.voiceHidden = Object.assign({}, st.voiceHidden, { [CODE]: true }); save(); render(); return;
    case "ws": wordSearchTap(+ds.r, +ds.c); return;
    case "scr": scrambleTap(+ds.i); return;
    case "scrback": scrambleBack(); return;
    case "mem": memoryTap(+ds.i); return;
    case "guess": guessTap(ds.ch); return;
    case "storyall": storyReadAll(); return;
    case "storyquiz": storyToQuestions(); return;
    case "storyq": storyAnswer(+ds.i); return;
    case "train": startTraining(false); return;
    case "vocab": startTraining(true); return;
    case "blitz": ui.modal = null; startBlitz(); return;
    case "mic": startRecognition(); return;
    case "nospeak": pauseSpeaking(); return;
    case "resumespeak": resumeSpeaking(); return;
    case "dialog": ui.pop = null; startDialog(ds.id); return;
    case "fox": ui.foxN = (ui.foxN || 0) + 1; ui.foxHopUntil = Date.now() + 700; sfx("tap"); render(); return;
    case "dgroup": ui.dgroup = ui.dgroup === ds.g ? null : ds.g; render(); return;
    case "dlg": dialogPick(+ds.i); return;
    case "master": ui.pop = null; ui.mu = +ds.u; ui.modal = "master"; render(); return;
    case "startmaster": ui.modal = null; startMaster(+ds.u); return;
    case "shop": ui.pop = null; ui.shopMsg = ""; ui.modal = null; ui.tab = "shop"; view = "home"; render(); window.scrollTo(0, 0); return;
    case "tab": ui.pop = null; ui.shopMsg = ""; ui.tab = ds.tab; if (ds.tab === "friends") loadFriends(); render(); scrollToCurrent(); return;
    case "buy": if (buy(ds.id)) sfx("win"); render(); return;
    case "refill": startTraining(true, true); return;
    case "hearts": ui.pop = null; ui.modal = "hearts"; render(); return;
    case "courses": ui.pop = null; ui.modal = "courses"; render(); return;
    case "level": ui.pop = null; ui.level = ds.l; sfx("tap"); render(); return;
    case "pickcourse": ui.level = null; st.course = ds.c; setCourse(ds.c); save(); ui.modal = null; sfx("tap"); render(); window.scrollTo(0, 0); checkVoice(); return;
    case "settings": ui.updateNote = ""; ui.modal = "settings"; render(); return;
    case "managepacks": ui.pop = null; packs.error = ""; ui.modal = "packs"; render(); fetchPackIndex().catch(() => { packs.error = "Keine Verbindung zum Server."; }).then(render); return;
    case "reloadpacks": packs.error = ""; render(); fetchPackIndex().catch(() => { packs.error = "Keine Verbindung zum Server."; }).then(render); return;
    case "getpack": downloadPack(ds.c).then(() => { if (view === "langs" && UNITS.length) { view = "home"; ui.modal = null; render(); window.scrollTo(0, 0); } }); return;
    case "removepack": ui.rp = ds.c; ui.modal = "removepack"; render(); return;
    case "doremovepack": removePack(ui.rp); if (st.course === ui.rp) { st.course = Object.keys(COURSES)[0] || ""; setCourse(st.course); save(); } ui.modal = "packs"; render(); return;
    case "createaccount": acct.note = ""; createAccount().then(() => { st.onboarded = true; save(); ui.modal = null; ui.pendingFriend = !!ui.addPrefill; view = "newkey"; render(); loadFriends(); }); return;
    case "keydone": view = "home"; render(); window.scrollTo(0, 0); return;
    case "localonly": st.onboarded = true; save(); view = "home"; render(); return;
    case "gosignin": acct.note = ""; ui.modal = null; view = "signin"; render(); return;
    case "welcome": acct.note = ""; view = "welcome"; render(); return;
    case "dosignin": acct.busy = true; signIn((document.getElementById("keyInput") || {}).value).then(ok => { acct.busy = false; if (ok) { view = "home"; window.scrollTo(0, 0); } render(); }); return;
    case "account": ui.pop = null; acct.note = ""; ui.showKey = false; ui.showQR = false; ui.modal = "account"; render(); return;
    case "togglekey": ui.showKey = !ui.showKey; render(); return;
    case "toggleqr": ui.showQR = !ui.showQR; render(); return;
    case "keycheck": ui.pop = null; ui.keyMsg = ""; ui.showQR = false; ui.modal = "keycheck"; render(); return;
    case "dokeycheck": if (checkKeyEnd(val("keyEnd"))) sfx("win"); render(); return;
    case "keylater": st.keyRemindAt = Date.now() + 7 * 864e5; save(); render(); return;
    case "copykey": copyText(acct.key, "Schlüssel kopiert."); return;
    case "sharecode": shareText(`Lern mit mir auf OpenSprachFuchs! Mein Freundescode: ${acct.friendCode}\n${friendLink()}`); return;
    case "myqr": ui.pop = null; ui.modal = "myqr"; render(); return;
    case "savename": setMyName(val("myName")); ui.nameSaved = ui.modal !== "myqr"; render(); setTimeout(() => { ui.nameSaved = false; }, 0); return;
    case "newcode": newFriendCode().then(render); return;
    case "signout": ui.modal = "signout"; render(); return;
    case "dosignout": signOut().then(() => { ui.modal = null; view = "welcome"; render(); }); return;
    case "deleteaccount": acct.note = ""; ui.modal = "deleteaccount"; render(); return;
    case "dodeleteaccount": deleteAccount().then(ok => { if (ok) { ui.modal = "account"; acct.note = "Dein Konto wurde gelöscht."; } render(); }); return;
    case "privacy": ui.modal = "privacy"; render(); return;
    case "addfriend": friends.note = ""; ui.addPrefill = null; ui.modal = "addfriend"; render(); return;
    case "doaddfriend": addFriend(val("friendCode"), val("friendName")).then(ok => { if (ok) { ui.modal = null; ui.addPrefill = null; } render(); }); return;
    case "friend": friends.note = ""; ui.fid = ds.id; ui.modal = "friend"; render(); return;
    case "acceptfriend": acceptFriend(ds.id, val("friendName")).then(() => { ui.modal = null; render(); }); return;
    case "renamefriend": renameFriend(ds.id, val("friendName")); ui.modal = null; render(); return;
    case "removefriend": removeFriend(ds.id).then(() => { ui.modal = null; render(); }); return;
    case "gift": sendGift(ds.id); return;
    case "claimgifts": claimGifts(); return;
    case "openupdate": downloadUpdate(); return;
    case "updateinfo": ui.modal = "appupdate"; render(); return;
    case "releasepage": if (ui.appUpdate) openUrl(ui.appUpdate.url); return;
    case "checkupdate": checkAppUpdate(true); return;
    case "dismissupdate": ui.updateHidden = true; render(); return;
    case "words": ui.pop = null; ui.wu = +ds.u; ui.modal = "words"; render(); { const f = document.getElementById("wordSearch"); if (f && !("ontouchstart" in window)) f.focus(); } return;
    case "placement": ui.pop = null; ui.pu = +ds.u; ui.modal = "placement"; render(); return;
    case "startplacement": startPlacement(ui.pu); return;
    case "stats": ui.pop = null; ui.bar = null; view = "stats"; render(); window.scrollTo(0, 0); return;
    case "bar": ui.bar = +ds.i; render(); return;
    case "report": ui.modal = "report"; render(); return;
    case "sendreport": {
      const ex = L.cur, note = val("reportNote");
      const rep = { course: CODE, pack: (PACK_SHA[CODE] || "").slice(0, 12), unit: ex.type === "match" ? KEY_UNIT["w:" + ex.pairs[0].id] : KEY_UNIT[ex.key] || "", item: ex.key, type: ex.type,
        task: promptText(ex), expected: correctText(ex), given: L.res.given || "", note: note.trim().slice(0, 500) };
      st.reportQueue = [...(st.reportQueue || []), rep].slice(-20); save(); sendReports();
      L.reported = true; ui.modal = null; render(); return;
    }
    case "toggle": st.settings[ds.k] = !st.settings[ds.k]; if (ds.k === "reminder") syncReminder(); if (ds.k === "hearts" && st.settings.hearts) syncHearts(); save(); render(); return;
    case "reset": ui.modal = "reset"; render(); return;
    case "resetcourse": ui.modal = "resetcourse"; render(); return;
    case "dismissdecay": ui.decay = null; render(); return;
    case "resetfrom": ui.ru = +ds.u; ui.modal = "resetfrom"; render(); return;
    case "doresetfrom": resetCourseFrom(ui.ru); ui.modal = null; ui.pop = null; view = "home"; render(); window.scrollTo(0, 0); return;
    case "doreset": { const keep = { onboarded: true, course: st.course, friends: st.friends, dayReported: st.dayReported }; st = Object.assign(fromSaved(null), keep); setCourse(st.course); save(); ui.modal = null; render(); return; }
    case "closemodal": ui.modal = null; render(); return;
    case "home": clearInterval(blitzTimer); ui.modal = null; L = null; view = "home"; render(); scrollToCurrent(); return;
    case "quit": ui.modal = "quit"; render(); return;
    case "say": speak(ds.t, !!ds.slow); return;
    case "hint":
      L.hint = L.hint && L.hint.w === ds.w ? null : { w: ds.w, h: ds.h };
      if (L.hint && ds.l !== "de" && !listenPaused()) speak(ds.w);
      render(); return;
    case "sel": if (L.kind === "blitz") { blitzAnswer(+ds.i); return; } if (L.checked) return; L.sel = +ds.i; sfx("tap"); if (ds.say && !listenPaused()) speak(ds.say); render(); return;
    case "pick": if (L.checked) return; L.picked.push(+ds.id); sfx("tap"); render(); return;
    case "unpick": if (L.checked) return; L.picked = L.picked.filter(x => x !== +ds.id); render(); return;
    case "check": check(false); return;
    case "skip": check(true); return;
    case "cont": cont(); return;
    case "nolisten": pauseListening(); return;
    case "mute": if (listenPaused()) resumeListening(); else pauseListening(); return;
    case "resumelisten": resumeListening(); return;
    case "ml": case "mr": matchClick(a === "ml" ? "l" : "r", +ds.i); return;
  }
});
function matchClick(side, i) {
  const m = L.m; if (m.done.has(i)) return;
  if (side === "r" && !listenPaused()) speak(L.cur.pairs[i].t);
  m[side] = m[side] === i ? null : i; m.flash = null; m.okFlash = null;
  if (m.l !== null && m.r !== null) {
    if (m.l === m.r) {
      const k = m.l; m.okFlash = k; sfx("good"); m.l = m.r = null; render();
      srsUpdate("w:" + L.cur.pairs[k].id, true);
      setTimeout(() => { m.done.add(k); m.okFlash = null; if (m.done.size === L.cur.pairs.length) { L.checked = true; L.res = { ok: true, given: "" }; L.reported = false; L.done++; L.right++; trackAnswer(L.cur, true); comboHit(L.cur); save(); } render(); }, 260);
      return;
    }
    m.flash = { l: m.l, r: m.r }; sfx("bad"); m.l = m.r = null;
    setTimeout(() => { if (L && L.m === m) { m.flash = null; render(); } }, 450);
  } else sfx("tap");
  render();
}
document.addEventListener("keydown", e => {
  if (ui.modal) { if (e.key === "Escape") { ui.modal = null; render(); } return; }
  if (view === "signin" && e.key === "Enter" && e.target.id === "keyInput") { e.preventDefault(); document.querySelector('[data-act="dosignin"]').click(); return; }
  if (view === "stats" && e.key === "Escape") { view = "home"; render(); return; }
  if (view === "result" && e.key === "Enter") { e.preventDefault(); view = "home"; render(); return; }
  if (view !== "lesson" || !L) return;
  const inText = e.target.tagName === "TEXTAREA";
  if (e.key === "Enter" && !e.shiftKey) {
    if (!inText && e.target.closest && e.target.closest("button") && !L.checked) return; // let focused buttons activate
    e.preventDefault(); if (L.checked) cont(); else check(false); return;
  }
  if (e.key === "Escape") { ui.modal = "quit"; render(); return; }
  if (inText || L.checked) return;
  const ex = L.cur;
  if (ex.type === "dialog" && /^[1-3]$/.test(e.key)) { dialogPick(+e.key - 1); return; }
  if ((ex.type === "choice" || ex.type === "pic" || ex.type === "gap") && /^[1-9]$/.test(e.key) && +e.key <= ex.opts.length) {
    if (L.kind === "blitz") { blitzAnswer(+e.key - 1); return; }
    L.sel = +e.key - 1; sfx("tap"); render();
  }
  if ((ex.type === "bank" || ex.type === "listen") && e.key === "Backspace" && L.picked.length) { e.preventDefault(); L.picked.pop(); render(); }
});
/* Small helpers for the views above. */
/** Back on the path (issue #7): show the current lesson instead of the top, so a long path needs no scrolling back. */
function scrollToCurrent() {
  const node = view === "home" && ui.tab === "path" && typeof document.querySelector === "function" ? document.querySelector(".node.current") : null;
  if (node && node.scrollIntoView) node.scrollIntoView({ block: "center" }); else window.scrollTo(0, 0);
}
const val = id => ((document.getElementById(id) || {}).value || "");
function toast(msg) { friends.note = msg; acct.note = msg; render(); }
function copyText(text, msg) {
  try { if (APP && window.AndroidBridge.copy) { window.AndroidBridge.copy(text); toast(msg); return; } } catch (e) {}
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(msg), () => {});
}
function shareText(text) {
  try { if (APP && window.AndroidBridge.share) { window.AndroidBridge.share(text); return; } } catch (e) {}
  if (!APP && navigator.share) { navigator.share({ text }).catch(() => {}); return; }
  copyText(text, "Text zum Teilen kopiert.");
}
function openUrl(url) {
  try { if (APP && window.AndroidBridge.openUrl) { window.AndroidBridge.openUrl(url); return; } } catch (e) {}
  window.open(url, "_blank", "noopener");
}

setInterval(() => { if (view === "home" && !ui.modal && !ui.pop && st.settings.hearts && st.hearts < MAX_HEARTS) render(); }, 60000);
window.opensprachfuchsBack = () => {
  if (ui.modal) { ui.modal = null; render(); return true; }
  if (ui.pop) { ui.pop = null; render(); return true; }
  if (view === "lesson") { ui.modal = "quit"; render(); return true; }
  if (view === "home" && ui.tab !== "path") { ui.tab = "path"; render(); window.scrollTo(0, 0); return true; }
  if (view === "signin") { view = st.onboarded ? "home" : "welcome"; render(); return true; }
  if (!["home", "welcome", "langs", "newkey"].includes(view)) { view = "home"; L = null; render(); scrollToCurrent(); return true; }
  return false;
};
/* Start: first the welcome screen (once), then the language choice if no pack is installed yet. */
if (!st.onboarded) {
  let stored = null;
  try { stored = localStorage.getItem(ACCOUNT_KEY); } catch (e) {}
  if (stored) st.onboarded = true; else view = "welcome";
}
checkBadges();
ui.decay = applyDecay();
syncReminder(); reportDay();
render(); scrollToCurrent(); checkVoice();
// Friend links (QR code scanned with the camera): the link that started the app is handled once the account is known,
// later ones arrive through opensprachfuchsLink.
// In the web app the friend page /f links to the app as /#f/CODE/Name; the hash is removed again right away.
function webLink() {
  if (!WEB || !/^#f\//.test(location.hash || "")) return "";
  const url = location.origin + "/f#" + location.hash.slice(3);
  try { history.replaceState(null, "", location.pathname); } catch (e) {}
  return url;
}
const startLink = APP && window.AndroidBridge.takeLink ? window.AndroidBridge.takeLink() : webLink();
if (WEB && window.addEventListener) window.addEventListener("hashchange", () => { const url = webLink(); if (url) handleFriendLink(url); });
/* Web app: the service worker (sw.js, only in the built web app) keeps it working offline. Browsers that can install
   web apps themselves (Chrome on Android) hand over their install prompt, the notice on the path then offers a button. */
if (WEB && navigator.serviceWorker) navigator.serviceWorker.register("sw.js").catch(() => {});
if (window.addEventListener) window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); ui.installPrompt = e; render(); });
window.opensprachfuchsLink = url => { handleFriendLink(url); };
/* Back in the foreground (Android: onResume; browser: tab visible again): another device may have saved meanwhile. */
const resumeSync = () => { if (acct.aes && !acct.pending) pullSave().then(() => { if (view === "home" && !ui.modal) render(); }); };
window.opensprachfuchsResume = () => { checkVoice(); resumeSync(); };
if (WEB && document.addEventListener) document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") resumeSync(); });
initAccount().then(() => { if (startLink) handleFriendLink(startLink); sendReports(); checkPackUpdates(); checkAppUpdate(); });
