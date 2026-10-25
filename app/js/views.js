"use strict";
/* ---------- Icons ---------- */
const I = {
  flame: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3.5 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.4 1.3-4.1 2.5-5 .1 1.6.9 2.8 2 3.2C11 8.6 11.6 5 12 2Z"/></svg>`,
  bolt: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.6L13.5 2Z"/></svg>`,
  heart: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-8-5.1-8-11.2A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8 3.2C20 15.9 12 21 12 21Z"/></svg>`,
  speaker: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>`,
  mic: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>`,
  speakerOff: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`,
  x: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  check: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  star: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z"/></svg>`,
  lock: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V7.5a5 5 0 0 1 10 0V10h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2.5 0h5V7.5a2.5 2.5 0 0 0-5 0V10Z"/></svg>`,
  trophy: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm10 4v3a2 2 0 0 0 1-1.7V7h-1ZM6 7v1.3A2 2 0 0 0 7 10V7H6Z"/></svg>`,
  gear: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>`,
  chev: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
};

/* ---------- Rendering ---------- */
const app = document.getElementById("app");
function render() {
  if (ui.pendingFriend && view === "home" && !ui.modal && UNITS.length) return openPendingFriend(); // opened through a friend's QR code
  syncHearts(); syncDay();
  if (view === "home" && !UNITS.length) view = "langs";
  if (view === "home") app.innerHTML = homeHTML();
  else if (view === "welcome") app.innerHTML = welcomeHTML();
  else if (view === "newkey") app.innerHTML = newKeyHTML();
  else if (view === "signin") app.innerHTML = signInHTML();
  else if (view === "langs") app.innerHTML = langsHTML();
  else if (view === "lesson") app.innerHTML = lessonHTML();
  else if (view === "result") app.innerHTML = resultHTML();
  else if (view === "fail") app.innerHTML = failHTML();
  else if (view === "stats") app.innerHTML = statsHTML();
  if (ui.modal) app.insertAdjacentHTML("beforeend", modalHTML());
  if (view === "lesson" && L.cur && L.cur.type === "type" && !L.checked) {
    const t = document.getElementById("typeInput"); if (t) { t.value = L.typed || ""; t.focus(); }
  }
}
function heartsLabel() { return st.settings.hearts ? st.hearts : "∞"; }
function ring(reached) {
  const r = 26, c = 2 * Math.PI * r;
  return `<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--line)" stroke-width="8"/>
    <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--gold)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${reached ? 0 : c}" transform="rotate(-90 32 32)"/>
    <g transform="translate(20 20)" style="color:var(--gold)">${reached ? I.check(24) : I.star(24)}</g></svg>`;
}
function homeHTML() {
  const streak = shownStreak(), goal = st.dayLessons >= 1, mistakes = cs().mistakes.length;
  let nextH = "";
  if (st.settings.hearts && st.hearts < MAX_HEARTS) { const m = Math.ceil((REGEN_MS - (Date.now() - st.heartsTs)) / 60000); nextH = `Nächstes Herz in ${Math.max(1, m)} Min.`; }
  let gi = 0, nth = 0;
  const level = shownLevel(), perLevel = UNITS.filter(x => x.level === level).length;
  const units = UNITS.map((u, ui_) => {
    if (u.level !== level) return "";
    nth++;
    const open = unitUnlocked(ui_), d = done(u.id);
    const nodes = [...Array(LESSONS_PER_UNIT).keys()].map(li => {
      const off = Math.round(Math.sin(gi++ * 0.95) * 62);
      const state = !open || li > d ? "locked" : li === d ? "current" : "done";
      const icon = state === "locked" ? I.lock(26) : state === "done" ? I.check(30) : li === LESSONS_PER_UNIT - 1 ? I.trophy(30) : I.star(30);
      const id = `${ui_}-${li}`;
      const pop = ui.pop === id && state !== "locked" ? `<div class="pop" role="dialog" style="--c:${u.c[0]}"><h3>${LESSON_NAMES[li]}</h3><p>${LESSON_DESC[li]} Lektion ${li + 1} von ${LESSONS_PER_UNIT}.</p>
        <button class="btn wide" data-act="start" data-u="${ui_}" data-l="${li}">${state === "done" ? "Wiederholen +10 XP" : "Starten +10 XP"}</button></div>` : "";
      return `<div class="node-wrap" style="transform:translateX(${off}px);--c:${u.c[0]};--cd:${u.c[1]}">${state === "current" && ui.pop !== id ? foxHTML(off > 0 ? "left" : "right") : ""}
        ${state === "current" && ui.pop !== id ? `<span class="start-tag">START</span>` : ""}
        ${state === "current" ? `<span class="ring">` : ""}<button class="node ${state} ${ui.shake === id ? "shake" : ""}" data-act="node" data-id="${id}" data-state="${state}" aria-label="${u.title}, ${LESSON_NAMES[li]}${state === "locked" ? ", gesperrt" : ""}">${icon}</button>${state === "current" ? "</span>" : ""}</div>${pop}`;
    }).join("") + bonusNodeHTML(u, ui_, open, Math.round(Math.sin(gi++ * 0.95) * 62));
    return `<section><div class="unit-head ${open ? "" : "locked"}" style="--c:${u.c[0]};--cd:${u.c[1]}">
      <div><div class="eyebrow" title="${esc(C.name)}, ${u.level}, Einheit ${nth} von ${perLevel}, ${u.words.length} Wörter">${esc(C.code)} – Stufe ${nth} von ${perLevel}</div><h2>${u.title}</h2><p>${u.desc}</p></div><div class="unit-side"><span class="cefr" title="Niveau nach GER">${u.level}</span>${masteryOf(u.id) ? `<span class="medal" title="Meisterschaft: ${MEDAL_NAMES[masteryOf(u.id)]}">${MEDALS[masteryOf(u.id)]}</span>` : ""}
        ${open && done(u.id) >= LESSONS_PER_UNIT && masteryOf(u.id) < 3 ? `<button class="wordsbtn" data-act="master" data-u="${ui_}" title="Einheit meistern">Meistern</button>` : ""}
        ${open ? `<button class="wordsbtn" data-act="words" data-u="${ui_}">Wörter</button>`
        : `<button class="wordsbtn test" data-act="placement" data-u="${ui_}" title="Einstufungstest: Einheiten überspringen">Test</button>`}</div></div>
      <div class="nodes">${nodes}</div></section>`;
  }).join("");
  return `<header class="topbar"><div class="topbar-in">
      <div class="brand"><span class="brand-mark">${logoHTML()}</span><span class="name">OpenSprachFuchs</span></div>
      <div class="stats"><button class="langchip" data-act="courses" title="Du lernst ${C.name}. Sprache wechseln" aria-label="Sprache wechseln, aktuell ${C.name}">${C.code}${I.chev(14)}</button>
        <span class="stat flame ${streak ? "" : "off"}" title="Tage in Folge">${I.flame(22)}${streak}</span>
        <span class="stat xp" title="Gesamt-XP">${I.bolt(22)}${st.xp}</span>
        <button class="stat gem statbtn" data-act="shop" title="Edelsteine und Shop" aria-label="Shop, ${st.gems} Edelsteine">💎${st.gems}</button>
        <button class="stat heart statbtn" data-act="hearts" title="Herzen" aria-label="Herzen: ${heartsLabel()}">${I.heart(22)}${heartsLabel()}</button></div></div></header>
    <main class="home tab-${ui.tab}">${tabHTML(ui.tab, { goal, mistakes, nextH, units })}</main>
    <nav class="tabbar" aria-label="Bereiche"><div class="tabbar-in">${TABS.map(t => `<button class="tab ${ui.tab === t.id ? "on" : ""}" data-act="tab" data-tab="${t.id}" ${ui.tab === t.id ? 'aria-current="page"' : ""}>
      <span class="tab-ico" aria-hidden="true">${t.em}</span><span>${t.name}</span>${t.badge() ? `<i class="tab-dot" aria-label="neu"></i>` : ""}</button>`).join("")}</div></nav>`;
}
/* Home is split into tabs, switched in the bar at the bottom, so no page gets too long. */
const TABS = [
  { id: "path", em: "🗺️", name: "Lernweg", badge: () => false }, // updates show as a notice on the path itself
  { id: "practice", em: "🏋️", name: "Üben", badge: () => false },
  { id: "friends", em: "👥", name: "Freunde", badge: () => friends.gifts > 0 || friends.list.some(f => f.status === "incoming") },
  { id: "shop", em: "💎", name: "Shop", badge: () => false },
  { id: "profile", em: "👤", name: "Profil", badge: () => acct.status === "gone" },
];
function tabHTML(tab, { goal, mistakes, nextH, units }) {
  if (tab === "practice") return `
    <div class="panel"><h3>Tagesziel${st.freezes ? ` <small class="muted" style="font-weight:600">· 🧊 ${st.freezes} Serienschutz</small>` : ""}${Date.now() < (st.boostUntil || 0) ? ` <small style="color:var(--gold-deep)">· ⚡ Doppel-XP</small>` : ""}</h3><div class="goal">${ring(goal)}<div><p><strong>${Math.min(st.dayLessons, 1)} / 1 Lektion</strong> heute</p>
      <p>${goal ? "Ziel erreicht. Deine Serie ist für heute gesichert." : "Schaff heute eine Lektion, damit deine Serie weiterläuft."}</p></div></div></div>
    <div class="panel"><h3>Tagesaufgaben</h3><div class="quests">${todaysQuests().map(q => { const v = Math.min(questValue(q), q.goal), ok = st.quests.claimed.includes(q.id);
      return `<div class="quest ${ok ? "done" : ""}"><span>${esc(q.text)}</span><small>${ok ? "✓ erledigt" : `${v} / ${q.goal}`}</small><span class="meter"><i style="width:${100 * v / q.goal}%"></i></span></div>`; }).join("")}</div>
      <p class="muted">${st.quests.bonus ? "Alle geschafft, die Bonustruhe ist geöffnet." : `Je Aufgabe +10 XP und 5 💎. Alle drei öffnen eine Bonustruhe: +20 XP, 15 💎 und ${BONUS_HEARTS} Herzen.`}</p></div>
    <div class="panel"><h3>Üben</h3>${(() => { const n = dueWords().length; return n ? `<p><strong>${n} ${n === 1 ? "Vokabel ist" : "Vokabeln sind"} heute zur Wiederholung fällig.</strong></p>` : ""; })()}<p class="muted">Wiederhole Vokabeln und Sätze aus allen freigeschalteten Einheiten. Fällige Wörter und deine Fehler kommen zuerst dran${mistakes ? ` (${mistakes} Fehler offen)` : ""}.${st.settings.hearts ? ` Beim Üben lädst du Herzen auf: +1 pro ${RIGHT_PER_HEART} richtige Antworten.` : ""}</p>
      ${st.settings.hearts && st.hearts < MAX_HEARTS ? `<button class="btn heartbtn wide" data-act="refill">Herzen auffüllen (${st.hearts} von ${MAX_HEARTS})</button>` : ""}
      ${listenPaused() ? `<p class="muted">Hören ist bis ${pauseUntilText()} Uhr pausiert. <button class="linkbtn" data-act="resumelisten">Wieder einschalten</button></p>` : ""}
      <button class="btn gold wide" data-act="vocab">Vokabeln üben</button>
      <button class="btn wide" data-act="blitz">${I.bolt(18)} Blitzrunde (60 Sek.)${cs().blitzBest ? ` · Rekord ${cs().blitzBest}` : ""}</button><button class="btn ghost wide" data-act="train">Gemischtes Training</button>
      <button class="btn ghost wide" data-act="words" data-u="-1">Alle Wörter durchsuchen</button>
      ${speakPaused() ? `<p class="muted">Sprechen ist bis ${clockText(st.speakOffUntil)} Uhr pausiert. <button class="linkbtn" data-act="resumespeak">Wieder einschalten</button></p>` : ""}${nextH ? `<p class="muted">${nextH}</p>` : ""}</div>
    ${dialogsHTML()}`;
  if (tab === "friends") return friendsPanelHTML();
  if (tab === "shop") return `<div class="panel"><h3>Shop</h3>${shopHTML()}</div>`;
  if (tab === "profile") return `
    <div class="panel"><h3>👤 ${st.myName ? esc(st.myName) : "Dein Name"}</h3>
      <p class="muted">Bleibt auf deinem Handy (und verschlüsselt in deiner Sicherung). Freunde sehen ihn nur, wenn sie deinen QR-Code scannen.</p>
      <div class="row"><input id="myName" class="search" value="${esc(st.myName || "")}" placeholder="z. B. Anna" maxlength="${MAX_MY_NAME}" autocomplete="off" aria-label="Dein Name">
      <button class="btn ghost" data-act="savename">Speichern</button></div>${ui.nameSaved ? `<p class="muted" role="status">Gespeichert.</p>` : ""}</div>
    <div class="panel"><h3>${esc(C.name)}</h3><p class="muted">${courseDone(CODE)} von ${UNITS.length * LESSONS_PER_UNIT} Lektionen geschafft · ${st.xp} XP gesamt</p>
      <button class="btn wide" data-act="stats">Statistik & Abzeichen</button>
      <button class="btn ghost wide" data-act="courses">Sprache wechseln</button>
      <button class="btn ghost wide" data-act="managepacks">Sprachen verwalten</button></div>
    <div class="panel"><h3>Konto</h3><p class="muted">${accountLine()}</p>
      <button class="btn ghost wide" data-act="account">Konto & Freundescode</button></div>
    <div class="panel"><button class="btn ghost wide" data-act="settings">${I.gear(18)} Einstellungen</button><button class="btn ghost wide" data-act="privacy">Datenschutz</button></div>`;
  return `${noticesHTML()}
    ${ui.decay && ui.decay.length ? `<div class="panel" role="status" style="border-color:var(--gold)"><h3>Lange nicht geübt</h3>
      ${ui.decay.map(n => `<p class="muted">${esc((COURSES[n.code] || { name: n.code }).name)}: ${n.days} Tage Pause, deshalb ${n.lost === 1 ? "eine Lektion" : n.lost + " Lektionen"} zurück. Wiederhol sie, und du bist schnell wieder da.</p>`).join("")}
      <button class="btn ghost wide" data-act="dismissdecay">Verstanden</button></div>` : ""}
    ${levelsHTML()}
    <div class="path">${units}</div>`;
}

function bubble(text, lang) {
  const target = lang !== "de";
  return `<div class="bubble"><span class="who">${target ? C.code : "DE"}</span><div class="say">${target ? `<button class="speak sm" data-act="say" data-t="${esc(text)}" aria-label="Vorlesen">${I.speaker(18)}</button>` : ""}<span>${hintSpans(text, target ? "t" : "de")}</span></div></div>${hintBox()}`;
}
function tilesHTML(ex) {
  const picked = L.picked.map(id => `<button class="tile" data-act="unpick" data-id="${id}">${esc(ex.tiles[id].t)}</button>`).join("");
  const bank = ex.tiles.map(t => `<button class="tile ${L.picked.includes(t.id) ? "ghost" : ""}" data-act="pick" data-id="${t.id}" ${L.picked.includes(t.id) ? 'tabindex="-1" aria-hidden="true"' : ""}>${esc(t.t)}</button>`).join("");
  return `<div class="answer" aria-label="Deine Antwort">${picked}</div><div class="bank">${bank}</div>`;
}
function optClass(i, ex) {
  if (!L.checked) return L.sel === i ? "sel" : "";
  if (i === ex.ans) return "right";
  return L.sel === i ? "wrong" : "";
}
function exerciseHTML(ex) {
  switch (ex.type) {
    case "choice": {
      const q = ex.rev ? ex.item.t : ex.item.de;
      if (ex.audio) return `<div class="tag">Hören</div><h2>Was bedeutet das Wort?</h2><div class="listen-row">
        <button class="speak big" data-act="say" data-t="${esc(q)}" aria-label="Abspielen">${I.speaker(44)}</button>
        <button class="speak slow" data-act="say" data-slow="1" data-t="${esc(q)}" aria-label="Langsam abspielen">0,6×</button></div>
        <div class="choices">${ex.opts.map((o, i) => `<button class="choice ${optClass(i, ex)}" data-act="sel" data-i="${i}"><span class="num">${i + 1}</span>${esc(o.de)}</button>`).join("")}</div>
        <div class="row" style="justify-content:center"><button class="btn ghost" data-act="nolisten">Kann gerade nicht hören</button></div>`;
      const head = ex.rev ? `Was bedeutet „${esc(q)}“?` : `Wie sagt man „${esc(q)}“?`;
      return `<div class="tag">${ex.rev ? "Neues Wort" : "Wortschatz"}</div><h2>${head}</h2>
        ${ex.rev ? `<div class="row" style="align-items:center"><button class="speak" data-act="say" data-t="${esc(q)}" aria-label="Vorlesen">${I.speaker(22)}</button></div>` : ""}
        <div class="choices">${ex.opts.map((o, i) => `<button class="choice ${optClass(i, ex)}" data-act="sel" data-i="${i}"${ex.rev ? "" : ` data-say="${esc(o.t)}"`}><span class="num">${i + 1}</span><span>${ex.rev ? esc(o.de) : esc(o.t)}</span></button>`).join("")}</div>`;
    }
    case "pic":
      return `<div class="tag">Neues Wort</div><h2>Welches Bild ist „${esc(ex.item.de)}“?</h2>
        <div class="pics">${ex.opts.map((o, i) => `<button class="pic ${optClass(i, ex)}" data-act="sel" data-i="${i}" data-say="${esc(o.t)}"><span class="em" aria-hidden="true">${o.pic}</span><span>${esc(o.t)}</span></button>`).join("")}</div>`;
    case "type":
      return `<div class="tag">Selbst schreiben</div><h2>${ex.word ? `Schreib das auf ${C.name}` : `Übersetze ins ${C.name}e`}</h2>${bubble(ex.src, "de")}
        <textarea id="typeInput" class="type" lang="${CODE}" placeholder="Auf ${C.name} tippen" autocomplete="off" autocapitalize="off" spellcheck="false" ${L.checked ? "disabled" : ""}></textarea>`;
    case "bank":
      return `<div class="tag">Satz bauen</div><h2>${ex.srcLang === "de" ? "Übersetze diesen Satz" : "Übersetze ins Deutsche"}</h2>${bubble(ex.src, ex.srcLang)}${tilesHTML(ex)}`;
    case "listen":
      return `<div class="tag">Hören</div><h2>Was hörst du?</h2><div class="listen-row">
        <button class="speak big" data-act="say" data-t="${esc(ex.text)}" aria-label="Abspielen">${I.speaker(44)}</button>
        <button class="speak slow" data-act="say" data-slow="1" data-t="${esc(ex.text)}" aria-label="Langsam abspielen">0,6×</button></div>${tilesHTML(ex)}
        <div class="row" style="justify-content:center"><button class="btn ghost" data-act="nolisten">Kann gerade nicht hören</button></div>`;
    case "gap":
      return `<div class="tag">Lückentext</div><h2>Fülle die Lücke</h2>
        <p class="gap-sent">${hintSpans(ex.before, "t")}${ex.before && !/[¿¡]$/.test(ex.before) ? " " : ""}<span class="slot">${L.sel !== null ? esc(ex.opts[L.sel]) : "&nbsp;"}</span>${hintSpans(ex.after, "t")}</p>
        ${hintBox()}<p class="hint">${esc(ex.de)}</p>
        <div class="bank">${ex.opts.map((o, i) => `<button class="tile ${L.sel === i ? "sel" : ""}" data-act="sel" data-i="${i}">${esc(o)}</button>`).join("")}</div>`;
    case "speak": {
      const state = L.mic || "idle";
      const msg = state === "listening" ? "Ich höre zu … sprich jetzt." : state === "error" ? micErrText(L.micErr) : "Tippe aufs Mikrofon und sprich den Satz nach.";
      return `<div class="tag">Sprechen</div><h2>Sprich diesen Satz</h2>${bubble(ex.text, CODE)}<p class="hint">${esc(ex.de)}</p>
        <div class="listen-row"><button class="speak big mic ${state === "listening" ? "on" : ""}" data-act="mic" aria-label="Aufnahme starten">${I.mic(44)}</button></div>
        <p class="muted" style="text-align:center;margin:0" role="status">${msg}</p>
        <div class="row" style="justify-content:center"><button class="btn ghost" data-act="nospeak">Kann gerade nicht sprechen</button></div>`;
    }
    case "dialog": {
      const d = L.dlg, sc = L.scene, turn = sc.turns[d.turn];
      const bubbles = d.log.map(x => `<div class="msg ${x.who}"><div class="say">${x.who === "p" ? `<button class="speak sm" data-act="say" data-t="${esc(x.line.t)}" aria-label="Vorlesen">${I.speaker(16)}</button>` : ""}
        <span>${hintSpans(x.line.t, "t")}<details><summary>Übersetzung</summary>${esc(x.line.de)}</details></span></div></div>`).join("");
      const opts = !L.checked && turn ? `<div class="choices">${d.order.map((idx, i) => { const l = turn.a[idx], wrong = d.wrong.includes(i);
        return `<button class="choice ${wrong ? "wrong" : ""}" data-act="dlg" data-i="${i}" ${wrong ? "disabled" : ""}><span class="num">${i + 1}</span><span>${esc(l.t)}${wrong ? `<small class="tr">„${esc(l.de)}“ passt hier nicht.</small>` : ""}</span></button>`; }).join("")}</div>` : "";
      return `<div class="tag">Gespräch</div><h2>${sc.em} ${esc(sc.title)}</h2><div class="chat">${bubbles}</div>${hintBox()}${opts}`;
    }
    case "game": return gameHTML();
    case "match": {
      const m = L.m, cls = (side, i) => m.done.has(i) ? "done" : (m.flash && m.flash[side] === i) ? "flash" : (m.okFlash === i) ? "ok" : (m[side] === i ? "sel" : "");
      return `<div class="tag">Paare</div><h2>Finde die Paare</h2><div class="match">
        <div class="col">${m.left.map(i => `<button class="mt ${cls("l", i)}" data-act="ml" data-i="${i}">${esc(ex.pairs[i].de)}</button>`).join("")}</div>
        <div class="col">${m.right.map(i => `<button class="mt ${cls("r", i)}" data-act="mr" data-i="${i}">${esc(ex.pairs[i].t)}</button>`).join("")}</div></div>`;
    }
  }
  return "";
}
function footerHTML() {
  const ex = L.cur;
  if (ex && ex.type === "game") return gameFooterHTML();
  if (ex && ex.type === "dialog") return L.checked
    ? `<footer class="l-foot ok"><div class="l-foot-in"><div class="fb" role="status"><span class="ico">${I.check(32)}</span><div><h3>Gespräch geschafft!</h3>${L.combo >= 3 ? `<p class="combo-note">🔥 ${L.combo} in Folge</p>` : ""}</div></div>
      <button class="btn good" id="contBtn" data-act="cont">Weiter</button></div></footer>`
    : `<footer class="l-foot"><div class="l-foot-in"><p class="muted" style="margin:0">Wähle die passende Antwort. Unterstrichene Wörter kannst du antippen.</p></div></footer>`;
  if (L.kind === "blitz") return `<footer class="l-foot ${L.checked ? (L.res.ok ? "ok" : "bad") : ""}"><div class="l-foot-in"><p style="margin:0;font-weight:800">Punkte: ${L.score}
    <span class="muted" style="font-weight:600">· Rekord in ${esc(C.name)}: ${cs().blitzBest || 0}</span></p>
    ${L.checked && !L.res.ok ? `<p style="margin:0;font-weight:700">${esc(correctText(ex))}</p>` : ""}</div></footer>`;
  if (!L.checked) {
    if (ex.type === "match") return `<footer class="l-foot"><div class="l-foot-in"><p class="muted">Tippe ein deutsches Wort und dann seine Übersetzung.</p></div></footer>`;
    return `<footer class="l-foot"><div class="l-foot-in"><button class="btn ghost" data-act="skip">Überspringen</button>
      <button class="btn good" id="checkBtn" data-act="check" ${answerReady() ? "" : "disabled"}>Prüfen</button></div></footer>`;
  }
  const r = L.res;
  const praise = pick(["Super!", "Richtig!", "Gut gemacht!", "Genau!", "Klasse!", "Perfekt!"]);
  const head = r.accents ? "Richtig! Achte auf die Akzente" : r.typo ? "Fast! Kleiner Tippfehler" : praise;
  const heard = ex.type === "speak" && r.given ? `<p>Verstanden: „${esc(r.given)}“</p>` : "";
  const combo = r.ok && L.combo >= 3 ? `<p class="combo-note">🔥 ${L.combo} in Folge${L.comboNow ? ` · Combo-Bonus +${L.comboNow} XP` : ""}</p>` : "";
  const body = r.ok ? `<h3>${head}</h3>${r.typo || r.accents || ex.type === "listen" || ex.type === "choice" || ex.type === "pic" ? `<p>${esc(correctText(ex))}</p>` : ""}${heard}${combo}`
    : `<h3>Richtige Lösung:</h3><p>${esc(correctText(ex))}</p>${heard}`;
  const t = targetOf(ex);
  return `<footer class="l-foot ${r.ok ? "ok" : "bad"}"><div class="l-foot-in"><div class="fb" role="status"><span class="ico">${r.ok ? I.check(32) : I.x(30)}</span><div>${body}</div>
    ${t ? `<button class="iconbtn" data-act="say" data-t="${esc(t)}" aria-label="Lösung vorlesen">${I.speaker(22)}</button>` : ""}
    ${L.reported ? `<span class="muted">Gemeldet, danke!</span>` : `<button class="linkbtn" data-act="report">Fehler melden</button>`}</div>
    <button class="btn ${r.ok ? "good" : "bad"}" id="contBtn" data-act="cont">Weiter</button></div></footer>`;
}
function lessonHTML() {
  const pct = Math.round(100 * L.done / Math.max(1, L.total));
  const left = L.kind === "blitz" ? Math.max(0, L.endsAt - Date.now()) : 0;
  const bar = L.kind === "blitz"
    ? `<div class="bar blitz" role="timer" aria-label="Verbleibende Zeit"><i id="blitzBar" style="width:${100 * left / BLITZ_MS}%"></i></div><span class="timer" id="blitzTime">${Math.ceil(left / 1000)} s</span>`
    : `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(pct, 3)}%"></i></div>`;
  return `<div class="lesson"><div class="l-top"><button class="iconbtn" data-act="quit" aria-label="Lektion beenden">${I.x(26)}</button>
      ${bar}${comboChip()}
      <button class="iconbtn mutebtn ${listenPaused() ? "on" : ""}" data-act="mute" title="${listenPaused() ? `Hören pausiert bis ${pauseUntilText()}. Tippen zum Einschalten` : "Hören für 1 Stunde pausieren"}"
        aria-label="${listenPaused() ? "Hören wieder einschalten" : "Hören für 1 Stunde pausieren"}">${listenPaused() ? I.speakerOff(24) : I.speaker(24)}</button>
      <span class="stat heart" style="font-weight:800" title="${L.kind === "placement" ? "Erlaubte Fehler" : "Herzen"}">${I.heart(24)}${L.kind === "placement" ? PLACEMENT_MAX - L.mistakes : L.kind === "master" ? Math.max(0, MASTER_ALLOWED[L.level] - L.mistakes + 1) : L.kind === "lesson" ? heartsLabel() : "∞"}</span></div>
    <main class="l-main">${exerciseHTML(L.cur)}</main>${footerHTML()}</div>`;
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function resultHTML() {
  const r = result;
  const line = r.streakUp ? `<strong style="color:var(--flame)">${r.streakUp} ${r.streakUp === 1 ? "Tag" : "Tage"}</strong> in Folge. Tagesziel erreicht, bis morgen!`
    : r.goal ? "Tagesziel erreicht!" : "";
  return `<div class="center"><div class="card">${foxCheerHTML(r.perfect || !!r.master || !!(r.blitz && r.blitz.record))}
    <h1>${r.master ? `${MEDALS[r.master.level]} ${MEDAL_NAMES[r.master.level]} für „${esc(r.master.title)}“!` : r.dialog ? "Gespräch geschafft!" : r.bonus ? `${esc(r.bonus)} geschafft!` : r.blitz ? `Blitzrunde: ${r.blitz.score} richtig!` : r.placement ? "Test bestanden!" : r.refill ? "Herzen aufgeladen!" : r.vocab ? "Vokabeln geübt!" : r.training ? "Training geschafft!" : r.unitDone ? "Einheit abgeschlossen!" : r.perfect ? "Fehlerfrei!" : "Lektion geschafft!"}</h1>
    ${r.heartsGained ? `<p class="stat heart" style="font-size:1.15rem;justify-content:center;font-weight:800">${I.heart(24)} +${r.heartsGained} ${r.heartsGained === 1 ? "Herz" : "Herzen"}</p>`
      : r.refill && st.settings.hearts && st.hearts < MAX_HEARTS ? `<p class="muted">Für ein Herz braucht es ${RIGHT_PER_HEART} richtige Antworten. Versuch es gleich noch einmal!</p>` : ""}
    ${r.placement ? `<p class="muted" style="font-size:1.05rem">Alle Einheiten bis „${esc(r.placement)}“ sind jetzt freigeschaltet.</p>` : ""}
    ${line ? `<p class="muted" style="font-size:1.05rem">${line}</p>` : ""}
    ${r.blitz ? `<p class="muted" style="font-size:1.05rem">${r.blitz.record ? `<strong style="color:var(--gold-deep)">Neuer Rekord in ${esc(C.name)}!</strong>` : `Dein Rekord in ${esc(C.name)}: ${r.blitz.best}`}</p>` : ""}
    ${r.comboBonus ? `<p class="combo-note">🔥 Beste Serie: ${r.bestCombo} in Folge · Combo-Bonus +${r.comboBonus} XP</p>` : r.bestCombo >= 5 ? `<p class="combo-note">🔥 Beste Serie: ${r.bestCombo} in Folge</p>` : ""}
    <p class="stat gem" style="font-size:1.15rem;justify-content:center">💎 +${r.gems} ${r.gems === 1 ? "Edelstein" : "Edelsteine"}${r.boosted ? ` · <span style="color:var(--gold-deep)">Doppel-XP aktiv</span>` : ""}</p>
    ${r.freezeUsed ? `<p class="muted">🧊 ${r.freezeUsed === 1 ? "Ein Serienschutz hat" : r.freezeUsed + " Serienschutze haben"} deine Serie gerettet.</p>` : ""}
    ${r.quests && r.quests.length ? `<div class="rewards">${r.quests.map(m => `<span>${esc(m)}</span>`).join("")}</div>` : ""}
    ${r.badges && r.badges.length ? `<div class="badge-new">${r.badges.map(b => `<span>${b.em} Neues Abzeichen: ${esc(b.name)}</span>`).join("")}</div>` : ""}
    <div class="tiles3"><div class="st" style="--c:var(--gold)"><small>XP</small><b>${I.bolt(20)}+${r.xp}</b></div>
      <div class="st" style="--c:var(--good)"><small>Genauigkeit</small><b>${r.acc}&nbsp;%</b></div>
      <div class="st" style="--c:var(--accent)"><small>Zeit</small><b>${fmtTime(r.secs)}</b></div></div>
    <button class="btn wide" id="contBtn" data-act="home">Weiter</button>
    ${r.blitz ? `<button class="btn gold wide" data-act="blitz">Noch eine Blitzrunde</button>` : ""}
    ${r.refill && st.settings.hearts && st.hearts < MAX_HEARTS ? `<button class="btn heartbtn wide" data-act="refill">Weiter auffüllen (${st.hearts} von ${MAX_HEARTS})</button>` : ""}</div></div>`;
}
function statsHTML() {
  const h = st.history || {}, days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayStr(d); days.push({ k, d, r: h[k] || { xp: 0, lessons: 0, right: 0, wrong: 0 } }); }
  const max = Math.max(10, ...days.map(x => x.r.xp)), top = Math.ceil(max / 10) * 10;
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const label = x => `${wd[x.d.getDay()]} ${x.d.getDate()}.${x.d.getMonth() + 1}.: ${x.r.xp} XP, ${x.r.lessons} ${x.r.lessons === 1 ? "Lektion" : "Lektionen"}`;
  const bars = days.map((x, i) => `<button class="barcol ${i === 13 ? "today" : ""} ${ui.bar === i ? "sel" : ""}" data-act="bar" data-i="${i}" aria-label="${label(x)}"><i style="height:${x.r.xp ? Math.max(2, 100 * x.r.xp / top) : 0}%"></i></button>`).join("");
  const xl = days.map((x, i) => `<span>${i % 2 === 1 || i === 13 ? (i === 13 ? "heute" : wd[x.d.getDay()]) : ""}</span>`).join("");
  const sum = Object.values(h).reduce((a, r) => ({ right: a.right + r.right, wrong: a.wrong + r.wrong }), { right: 0, wrong: 0 });
  const acc = sum.right + sum.wrong ? Math.round(100 * sum.right / (sum.right + sum.wrong)) + " %" : "–";
  const week = days.slice(7).reduce((a, x) => a + x.r.xp, 0);
  const langs = Object.entries(COURSES).map(([code, c]) => { const s = (st.courses[code] || {}).srs || {}, v = Object.values(s);
    return `<div class="lang" style="--c:${c.c}"><div class="row" style="align-items:center"><span class="code">${c.code}</span><b>${c.name}</b></div><dl>
      <dt>Lektionen</dt><dd>${courseDone(code)} / ${unitsFor(code).length * LESSONS_PER_UNIT}</dd><dt>Wörter geübt</dt><dd>${v.filter(e => e.box >= 1).length}</dd>
      <dt>Wörter sicher</dt><dd>${v.filter(e => e.box >= 3).length}</dd></dl></div>`; }).join("");
  const us = cs().unitStats || {};
  const ranked = UNITS.map(u => ({ u, e: us[u.id] })).filter(x => x.e && x.e.r + x.e.w >= 5).map(x => ({ ...x, a: x.e.r / (x.e.r + x.e.w) })).sort((a, b) => b.a - a.a);
  const row = x => `<div class="uacc"><span>${esc(x.u.title)}</span><span class="meter"><i style="width:${Math.round(100 * x.a)}%"></i></span><b>${Math.round(100 * x.a)} %</b></div>`;
  const unitsBlock = ranked.length < 2 ? `<p class="muted">Sobald du in mindestens zwei Einheiten geübt hast, siehst du hier deine stärksten und schwächsten Themen.</p>`
    : `<h3 style="font-size:1rem">Am sichersten</h3><div class="units-acc">${ranked.slice(0, 3).map(row).join("")}</div>
       <h3 style="font-size:1rem">Mehr üben</h3><div class="units-acc">${ranked.slice(-3).reverse().filter(x => !ranked.slice(0, 3).includes(x)).map(row).join("") || `<p class="muted">Alles im grünen Bereich.</p>`}</div>`;
  const badges = BADGES.map(b => `<div class="bdg ${st.badges && st.badges[b.id] ? "" : "off"}"><span class="em" aria-hidden="true">${b.em}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`).join("");
  const sel = ui.bar != null ? days[ui.bar] : days[13];
  return `<main class="stats-page"><button class="iconbtn back" data-act="home">← Zurück</button><h1>Statistik</h1>
    <div class="kpis"><div class="kpi"><small>Gesamt-XP</small><b>${st.xp}</b></div><div class="kpi"><small>Lektionen</small><b>${st.lessons}</b></div>
      <div class="kpi"><small>Längste Serie</small><b>${Math.max(st.bestStreak || 0, shownStreak())} ${Math.max(st.bestStreak || 0, shownStreak()) === 1 ? "Tag" : "Tage"}</b></div><div class="kpi"><small>Genauigkeit</small><b>${acc}</b></div></div>
    <section class="chart"><div class="chart-head"><h2>XP der letzten 14 Tage</h2><small>${week} XP in den letzten 7 Tagen · Skala bis ${top} XP</small></div>
      <div class="plot">${bars}</div><div class="xlabels" aria-hidden="true">${xl}</div><p class="chart-note" aria-live="polite">${label(sel)}</p></section>
    <section style="display:grid;gap:.8rem"><h2>Sprachen</h2><div class="langs">${langs}</div></section>
    <section class="panel"><h2>Themen in ${C.name}</h2>${unitsBlock}</section>
    <section style="display:grid;gap:.8rem"><h2>Abzeichen (${Object.keys(st.badges || {}).length} von ${BADGES.length})</h2><div class="badges">${badges}</div></section></main>`;
}
function failHTML() {
  if (ui.fail === "master") return `<div class="center"><div class="card fail">${foxSadHTML()}<h1>Noch nicht gemeistert</h1>
    <p class="muted">Für ${MEDAL_NAMES[ui.ml + 1]} sind höchstens ${MASTER_ALLOWED[ui.ml]} ${MASTER_ALLOWED[ui.ml] === 1 ? "Fehler" : "Fehler"} erlaubt. Versuch es gleich noch einmal, die Aufgaben sind jedes Mal andere.</p>
    <button class="btn gold wide" data-act="startmaster" data-u="${ui.mu}">Noch einmal</button><button class="btn ghost wide" data-act="home">Zurück zum Lernpfad</button></div></div>`;
  if (ui.fail === "placement") return `<div class="center"><div class="card fail">${foxSadHTML()}<h1>Test nicht bestanden</h1>
    <p class="muted">Du hattest ${PLACEMENT_MAX} Fehler. Kein Problem: Übe die Einheiten davor weiter oder versuch den Test später noch einmal.</p>
    <button class="btn wide" data-act="home">Zurück zum Lernpfad</button></div></div>`;
  return `<div class="center"><div class="card fail">${foxSadHTML()}<h1>Keine Herzen mehr</h1>
    <p class="muted">Lade sie mit Vokabeln wieder auf: +1 Herz pro ${RIGHT_PER_HEART} richtige Antworten. Außerdem kommt alle ${REGEN_MS / 60000} Minuten ein Herz von selbst zurück, und in den Einstellungen kannst du Herzen ganz abschalten.</p>
    <button class="btn heartbtn wide" data-act="refill">Herzen auffüllen</button><button class="btn ghost wide" data-act="home">Zurück zum Lernpfad</button></div></div>`;
}
function modalHTML() {
  if (ui.modal === "words") {
    const all = srs(), whole = ui.wu < 0, units = whole ? openUnits() : [UNITS[ui.wu]];
    const rows = units.flatMap(u => u.words.map(w => ({ w, u }))).map(({ w, u }) => { const e = all["w:" + w.id], box = e ? e.box : -1;
      const dots = [1, 2, 3, 4, 5].map(i => `<i class="${box >= i ? "on" : ""}"></i>`).join("");
      const q = [w.t, w.de, ...w.alt].join(" ").toLowerCase();
      return `<div class="wrow" data-q="${esc(q)}"><button class="speak sm" data-act="say" data-t="${esc(w.t)}" aria-label="${esc(w.t)} vorlesen">${I.speaker(16)}</button>
        <span><b>${esc(w.t)}</b><small>${esc(w.de)}${w.alt.length ? " · auch: " + esc(w.alt.join(", ")) : ""}</small>${whole ? `<small class="unit">${esc(u.title)}</small>` : ""}</span>
        <span class="dots" title="${box < 0 ? "noch nicht geübt" : "Lernstand " + Math.min(box, 5) + " von 5"}">${dots}</span></div>`; }).join("");
    return `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>${whole ? `Alle Wörter (${C.name})` : esc(units[0].title)}</h2>
      <input id="wordSearch" class="search" type="search" placeholder="Suchen, auf Deutsch oder ${C.name}" autocomplete="off" aria-label="Wörter durchsuchen">
      <p class="muted">Alle Vokabeln dieser Einheit. Die Punkte zeigen, wie gut ein Wort sitzt: Jede richtige Antwort bringt es eine Stufe weiter und verlängert die Pause bis zur nächsten Wiederholung.</p>
      <div class="wlist">${rows || `<p class="muted">Noch keine Einheit freigeschaltet.</p>`}</div><p class="muted" id="wordNone" hidden>Kein Wort gefunden.</p>
      <button class="btn wide" data-act="closemodal">Schließen</button></div></div>`;
  }
  if (ui.modal === "placement") {
    const [first, target] = placementRange(ui.pu), a = UNITS[first], b = UNITS[target];
    return `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>Einstufungstest</h2>
      <p class="muted">${PLACEMENT_PLAN.length} Aufgaben aus ${first === target ? `der Einheit „${esc(b.title)}“` : `den Einheiten „${esc(a.title)}“ bis „${esc(b.title)}“`}.
      Mit höchstens ${PLACEMENT_MAX - 1} Fehlern sind alle Einheiten bis „${esc(b.title)}“ freigeschaltet. Herzen kostet der Test nicht.</p>
      <button class="btn wide" data-act="startplacement">Test starten</button><button class="btn ghost wide" data-act="closemodal">Abbrechen</button></div></div>`;
  }
  if (ui.modal === "report") {
    const ex = L.cur;
    return `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>Fehler melden</h2>
      <p class="muted">Stimmt eine Übersetzung nicht, fehlt eine richtige Lösung oder klingt etwas komisch? Die Meldung geht ohne Bezug zu deinem Konto an das Projekt und wird als öffentliches Issue auf GitHub gesammelt, damit die Inhalte korrigiert werden können. Bitte nichts Persönliches in die Notiz schreiben.</p>
      <div class="wlist"><div><small class="muted">Aufgabe</small><b style="display:block">${esc(promptText(ex))}</b></div>
        <div><small class="muted">Erwartet</small><b style="display:block">${esc(correctText(ex))}</b></div>
        ${L.res.given ? `<div><small class="muted">Deine Antwort</small><b style="display:block">${esc(L.res.given)}</b></div>` : ""}</div>
      <textarea id="reportNote" class="type" style="min-height:5rem;font-size:1rem" placeholder="Was stimmt nicht? (optional)" aria-label="Anmerkung"></textarea>
      <button class="btn wide" data-act="sendreport">Melden</button><button class="btn ghost wide" data-act="closemodal">Abbrechen</button></div></div>`;
  }
  if (ui.modal === "resetcourse") {
    const rows = UNITS.map((u, i) => { const d = done(u.id), state = d >= LESSONS_PER_UNIT ? "fertig" : d ? `${d} von ${LESSONS_PER_UNIT} Lektionen` : "noch nicht begonnen";
      return `<div class="wrow" style="grid-template-columns:minmax(0,1fr) auto"><span><b>${i + 1}. ${esc(u.title)}</b><small>${state}</small></span>
        <button class="btn ghost" style="padding:.5rem .8rem;font-size:.75rem" data-act="resetfrom" data-u="${i}">Ab hier</button></div>`; }).join("");
    return `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>${C.name} zurücksetzen</h2>
      <p class="muted">Wähle die Einheit, ab der du neu anfangen willst. Sie und alle Einheiten danach werden zurückgesetzt, die davor bleiben erhalten.</p>
      <div class="wlist">${rows}</div><button class="btn ghost wide" data-act="closemodal">Abbrechen</button></div></div>`;
  }
  if (ui.modal === "resetfrom") {
    const u = UNITS[ui.ru];
    return `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>Ab „${esc(u.title)}“ zurücksetzen?</h2>
      <p class="muted">${ui.ru === 0 ? `Dein ganzer Fortschritt in ${C.name}` : `Einheit ${ui.ru + 1} und alle Einheiten danach in ${C.name}`} werden zurückgesetzt, samt Lernstufen der Vokabeln und offenen Fehlern dieser Einheiten.
      XP, Serie, Abzeichen und die anderen Sprachen bleiben, wie sie sind.</p>
      <button class="btn bad wide" data-act="doresetfrom">Zurücksetzen</button><button class="btn ghost wide" data-act="resetcourse">Andere Einheit wählen</button></div></div>`;
  }
  if (ui.modal === "master") {
    const u = UNITS[ui.mu], lvl = masteryOf(u.id);
    return `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>${MEDALS[lvl + 1]} ${MEDAL_NAMES[lvl + 1]}: ${esc(u.title)}</h2>
      <p class="muted">12 schwerere Aufgaben aus dieser Einheit, mit mehr Tippen${canSpeak() ? " und Sprechen" : ""} und ohne Worthilfen.
      Erlaubt ${MASTER_ALLOWED[lvl] === 0 ? "ist kein einziger Fehler" : `sind höchstens ${MASTER_ALLOWED[lvl]} Fehler`}. Herzen kostet es nicht.</p>
      ${lvl ? `<p class="muted">Bisher erreicht: ${MEDALS[lvl]} ${MEDAL_NAMES[lvl]}.</p>` : ""}
      <button class="btn gold wide" data-act="startmaster" data-u="${ui.mu}">Los geht's</button><button class="btn ghost wide" data-act="closemodal">Abbrechen</button></div></div>`;
  }
  if (ui.modal === "shop") return modal("Shop", shopHTML() + `<button class="btn ghost wide" data-act="closemodal">Schließen</button>`);
  if (ui.modal === "courses") {
    const items = Object.entries(COURSES).map(([code, c]) => `<button class="course ${code === CODE ? "on" : ""}" data-act="pickcourse" data-c="${code}" style="--c:${c.c}">
      <span class="code">${esc(c.code)}</span><span><b>${esc(c.name)}</b><small>${courseDone(code)} von ${unitsFor(code).length * LESSONS_PER_UNIT} Lektionen · ${esc(c.note)}</small></span></button>`).join("");
    return modal("Welche Sprache lernst du?", `<p class="muted">Jede Sprache hat ihren eigenen Lernpfad. XP, Serie und Herzen gelten für alle.</p><div class="courses">${items}</div>
      <button class="btn ghost wide" data-act="managepacks">Sprachen herunterladen oder entfernen</button>`);
  }
  if (ui.modal === "packs") return modal("Sprachen verwalten", packListHTML());
  if (ui.modal === "appupdate" && ui.appUpdate) {
    const u = ui.appUpdate, current = APP && window.AndroidBridge.appVersion ? window.AndroidBridge.appVersion() : "";
    return modal(`🦊 Version ${esc(u.version)} ist da`, `<p class="muted">Du hast ${current ? `Version ${esc(current)}` : "eine ältere Version"}. Die neue installiert sich über die alte, dein Fortschritt bleibt erhalten.${u.pre ? " Es ist eine experimentelle Vorabversion." : ""}</p>
      ${u.notes && u.notes.length ? `<div><b>Was ist neu</b><ul class="muted update-notes">${u.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
      <button class="btn good wide" data-act="openupdate">Herunterladen${u.size ? ` · ${(u.size / 1048576).toFixed(1).replace(".", ",")} MB` : ""}</button>
      <p class="muted">Nach dem Download die Datei öffnen. Beim ersten Mal fragt Android, ob Installationen aus dieser Quelle erlaubt sind.</p>
      <button class="btn ghost wide" data-act="releasepage">Auf GitHub ansehen</button><button class="btn ghost wide" data-act="closemodal">Später</button>`);
  }
  if (ui.modal === "removepack") {
    const c = COURSES[ui.rp];
    return modal(`${esc(c.name)} entfernen?`, `<p class="muted">Das Sprachpaket wird vom Gerät gelöscht. Dein Fortschritt in ${esc(c.name)} bleibt erhalten und ist wieder da, wenn du die Sprache neu herunterlädst.</p>
      <button class="btn bad wide" data-act="doremovepack">Entfernen</button><button class="btn ghost wide" data-act="managepacks">Abbrechen</button>`);
  }
  if (ui.modal === "account") {
    const ok = acct.key && acct.status !== "gone";
    return modal("Konto", `${ok ? `<div class="keybox"><small class="muted">Dein geheimer Schlüssel</small>
        <b class="key">${ui.showKey ? esc(acct.key) : "••••-••••-••••-••••"}</b>
        <div class="row"><button class="btn ghost" data-act="togglekey">${ui.showKey ? "Verbergen" : "Anzeigen"}</button><button class="btn ghost" data-act="copykey">Kopieren</button></div>
        <button class="linkbtn" data-act="toggleqr">${ui.showQR ? "QR-Code verbergen" : "Als QR-Code zeigen"}</button>${ui.showQR ? qrBox() : ""}
        <small class="muted">Mit dem Schlüssel holst du deinen Fortschritt auf ein neues Handy. Wer ihn kennt, hat Zugriff auf dein Konto. Gib ihn niemandem.</small></div>
      ${!st.keyChecked ? `<button class="btn ghost wide" data-act="keycheck">🔑 Prüfen, ob mein Schlüssel stimmt</button>` : `<p class="muted">🔑 Schlüssel geprüft und gesichert.</p>`}
      ${acct.friendCode ? `<div class="keybox"><small class="muted">Dein Freundescode (darfst du weitergeben)</small><b class="key">${esc(acct.friendCode)}</b>
        <div class="row"><button class="btn ghost" data-act="sharecode">Teilen</button><button class="btn ghost" data-act="newcode">Neuen Code erstellen</button></div></div>` : ""}
      <p class="muted">${accountLine()}</p>` : `<p class="muted">${accountLine()} Mit einem Konto wird er verschlüsselt gesichert, und du kannst Freunde hinzufügen. Es braucht weder Namen noch E-Mail.</p>
      <button class="btn wide" data-act="createaccount">Konto anlegen</button>`}
      ${acct.note ? `<p class="muted" role="status">${esc(acct.note)}</p>` : ""}
      <button class="btn ghost wide" data-act="gosignin">Mit einem anderen Schlüssel anmelden</button>
      ${ok ? `<button class="btn ghost wide" data-act="signout">Auf diesem Gerät abmelden</button><button class="btn ghost wide" data-act="deleteaccount">Konto löschen</button>` : ""}
      <button class="btn ghost wide" data-act="privacy">Datenschutz</button><button class="btn wide" data-act="closemodal">Schließen</button>`);
  }
  if (ui.modal === "keycheck") return modal("🔑 Schlüssel prüfen", st.keyChecked ? `<p role="status">${esc(ui.keyMsg || "Dein Schlüssel ist gesichert.")}</p><button class="btn wide" data-act="closemodal">Fertig</button>` : `
      <p class="muted">Schau auf deine Notiz (Zettel, Passwort-Manager …) und gib die <b>letzten vier Zeichen</b> deines Schlüssels ein.</p>
      <input id="keyEnd" class="search key" maxlength="6" placeholder="z. B. H3TV" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Letzte vier Zeichen">
      ${ui.keyMsg ? `<p class="muted" role="status">${esc(ui.keyMsg)}</p>` : ""}
      <button class="btn wide" data-act="dokeycheck">Prüfen</button>
      <details><summary class="muted">Ich habe ihn nicht notiert</summary><div class="keybox" style="margin-top:.6rem"><b class="key">${esc(acct.key)}</b>
        <div class="row"><button class="btn ghost" data-act="copykey">Kopieren</button><button class="btn ghost" data-act="toggleqr">QR-Code</button></div>${ui.showQR ? qrBox() : ""}
        <small class="muted">Jetzt aufschreiben oder im Passwort-Manager speichern, dann oben prüfen.</small></div></details>
      <button class="btn ghost wide" data-act="closemodal">Später</button>`);
  if (ui.modal === "signout") return modal("Abmelden?", `<p class="muted">Schlüssel und Fortschritt werden von diesem Gerät entfernt. Im Konto bleibt alles gesichert und kommt mit deinem Schlüssel zurück.
      Hast du den Schlüssel notiert?</p><button class="btn bad wide" data-act="dosignout">Abmelden</button><button class="btn ghost wide" data-act="account">Abbrechen</button>`);
  if (ui.modal === "deleteaccount") return modal("Konto löschen?", `<p class="muted">Dein gesicherter Spielstand, deine Freundschaften und gemeinsamen Serien werden sofort und endgültig vom Server gelöscht.
      Auf diesem Gerät kannst du ohne Konto weiterspielen.</p>${acct.note ? `<p class="muted" role="status">${esc(acct.note)}</p>` : ""}
      <button class="btn bad wide" data-act="dodeleteaccount">Endgültig löschen</button><button class="btn ghost wide" data-act="account">Abbrechen</button>`);
  if (ui.modal === "privacy") return modal("Datenschutz", PRIVACY_HTML + `<button class="btn wide" data-act="closemodal">Schließen</button>`);
  if (ui.modal === "addfriend") {
    const pre = ui.addPrefill || {};
    return modal("Freund hinzufügen", `<p class="muted">${pre.code ? `${pre.name ? `<b>${esc(pre.name)}</b> möchte` : "Jemand möchte"} mit dir lernen. Schick eine Anfrage, dann seid ihr befreundet, sobald sie angenommen ist.`
        : "Scanne den QR-Code deines Freundes mit der Kamera-App oder gib seinen Freundescode ein. Den Namen siehst nur du."}</p>
      <input id="friendCode" class="search" value="${esc(pre.code || "")}" placeholder="Freundescode, z. B. 7KQM-X4D2" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" aria-label="Freundescode">
      <input id="friendName" class="search" value="${esc(pre.name || "")}" placeholder="Name (nur auf deinen Geräten)" autocomplete="off" maxlength="30" aria-label="Name">
      ${!acct.key || acct.status === "gone" ? `<p class="muted">Für Freunde brauchst du ein Konto. Es braucht weder Namen noch E-Mail.</p><button class="btn wide" data-act="account">Konto anlegen</button>`
        : acct.status !== "ok" ? `<p class="muted">Gerade keine Verbindung. Versuch es gleich noch einmal.</p>` : ""}
      ${friends.note ? `<p class="muted" role="status">${esc(friends.note)}</p>` : ""}
      <button class="btn wide" data-act="doaddfriend" ${friends.busy || acct.status !== "ok" ? "disabled" : ""}>Anfrage schicken</button><button class="btn ghost wide" data-act="closemodal">Schließen</button>`);
  }
  if (ui.modal === "myqr") return modal("Mein QR-Code", `<p class="muted">Lass deine Freunde diesen Code mit der Kamera-App scannen. Ihre App öffnet sich dann mit deinem Freundescode${st.myName ? " und deinem Namen" : ""}.</p>
      ${st.myName ? "" : `<div class="row"><input id="myName" class="search" placeholder="Dein Name (optional)" maxlength="${MAX_MY_NAME}" autocomplete="off" aria-label="Dein Name"><button class="btn ghost" data-act="savename">Übernehmen</button></div>`}
      <div class="qrbox">${qrSVG(friendLink(), 240, "QR-Code mit deinem Freundescode")}<b>${st.myName ? esc(st.myName) + " · " : ""}${esc(acct.friendCode)}</b></div>
      <button class="btn ghost wide" data-act="sharecode">Link teilen</button>
      <small class="muted">Der Code enthält deinen Freundescode${st.myName ? " und deinen Namen" : ""}, nicht deinen geheimen Schlüssel. Einen neuen Freundescode bekommst du unter „Konto & Freundescode“.</small>
      <button class="btn wide" data-act="closemodal">Schließen</button>`);
  if (ui.modal === "friend") {
    const f = friends.list.find(x => String(x.id) === String(ui.fid));
    if (!f) return modal("Freund", `<p class="muted">Diese Freundschaft gibt es nicht mehr.</p><button class="btn wide" data-act="closemodal">Schließen</button>`);
    const incoming = f.status === "incoming";
    return modal(incoming ? "Freundschaftsanfrage" : esc(friendName(f)), `${incoming ? `<p class="muted">Code ${esc(f.code)} möchte mit dir befreundet sein. Ihr seht dann, ob der andere heute gelernt hat, und habt eine gemeinsame Serie.</p>` : ""}
      ${f.status === "accepted" ? `<p>🔥 <b>${pairStreak(f)} ${pairStreak(f) === 1 ? "Tag" : "Tage"}</b> gemeinsame Serie</p>` : ""}
      ${f.status === "outgoing" ? `<p class="muted">Deine Anfrage an Code ${esc(f.code)} wartet noch auf Antwort.</p>` : ""}
      ${f.status !== "outgoing" ? `<input id="friendName" class="search" value="${esc((st.friends || {})[f.id] || "")}" placeholder="Name (nur auf deinen Geräten)" autocomplete="off" maxlength="30" aria-label="Name">` : ""}
      ${friends.note ? `<p class="muted" role="status">${esc(friends.note)}</p>` : ""}
      ${incoming ? `<button class="btn good wide" data-act="acceptfriend" data-id="${f.id}">Annehmen</button><button class="btn ghost wide" data-act="removefriend" data-id="${f.id}">Ablehnen</button>`
        : f.status === "accepted" ? `<button class="btn wide" data-act="renamefriend" data-id="${f.id}">Name speichern</button><button class="btn ghost wide" data-act="removefriend" data-id="${f.id}">Freundschaft beenden</button>`
        : `<button class="btn ghost wide" data-act="removefriend" data-id="${f.id}">Anfrage zurückziehen</button>`}
      <button class="btn ghost wide" data-act="closemodal">Schließen</button>`);
  }
  if (ui.modal === "quit") return `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>Lektion beenden?</h2>
    <p class="muted">Dein Fortschritt in dieser Lektion geht verloren.</p><button class="btn wide" data-act="closemodal">Weiterlernen</button>
    <button class="btn ghost wide" data-act="home">Beenden</button></div></div>`;
  if (ui.modal === "hearts") {
    if (!st.settings.hearts) return `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>Herzen sind aus</h2>
      <p class="muted">Fehler kosten gerade nichts. Du kannst die Herzen in den Einstellungen wieder einschalten.</p><button class="btn wide" data-act="closemodal">Schließen</button></div></div>`;
    const m = st.hearts < MAX_HEARTS ? Math.max(1, Math.ceil((REGEN_MS - (Date.now() - st.heartsTs)) / 60000)) : 0;
    return `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>${st.hearts ? `Herzen: ${st.hearts} von ${MAX_HEARTS}` : "Keine Herzen mehr"}</h2>
      <p class="stat heart" style="font-size:1.3rem;gap:.15rem">${Array.from({ length: MAX_HEARTS }, (_, i) => `<span style="opacity:${i < st.hearts ? 1 : .25}">${I.heart(30)}</span>`).join("")}</p>
      <p class="muted">Jeder Fehler in einer Lektion kostet ein Herz. Beim Üben lädst du sie wieder auf: +1 Herz pro ${RIGHT_PER_HEART} richtige Antworten.
      ${m ? `Außerdem wächst in ${m} Min. ein Herz von selbst nach.` : "Du hast alle Herzen."}</p>
      ${st.hearts < MAX_HEARTS ? `<button class="btn heartbtn wide" data-act="refill">Herzen auffüllen (8 Vokabeln)</button><button class="btn gold wide" data-act="vocab">Vokabeln üben (12 Aufgaben)</button>` : ""}
      <button class="btn ghost wide" data-act="closemodal">${st.hearts < MAX_HEARTS ? "Später" : "Schließen"}</button></div></div>`;
  }
  if (ui.modal === "reset") return `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>Fortschritt löschen?</h2>
    <p class="muted">XP, Serie und die freigeschalteten Lektionen aller Sprachen werden zurückgesetzt, auch im gesicherten Spielstand.</p>
    <button class="btn bad wide" data-act="doreset">Alles löschen</button><button class="btn ghost wide" data-act="closemodal">Abbrechen</button></div></div>`;
  const tg = (k, label, sub) => `<div class="toggle"><span>${label}<small>${sub}</small></span><button class="sw" role="switch" aria-checked="${st.settings[k]}" data-act="toggle" data-k="${k}" aria-label="${label}"></button></div>`;
  return modal("Einstellungen", `<div>
    ${tg("sound", "Soundeffekte", "Töne bei richtig und falsch")}
    ${tg("audio", "Aussprache", hasTTS() ? "Wörter und Sätze vorlesen (Sprachausgabe des Handys)" : "Keine Sprachausgabe verfügbar")}
    ${tg("listen", "Hörübungen", "Übungen, bei denen du nur zuhörst")}
    ${speechSupported() ? tg("speak", "Sprechübungen", "Sätze laut nachsprechen (Mikrofon)") : ""}
    ${APP && window.AndroidBridge.setReminder ? `${tg("reminder", "Tägliche Erinnerung", "Benachrichtigung, wenn das Tagesziel noch offen ist")}
      ${st.settings.reminder ? `<div class="toggle"><span>Uhrzeit<small>Wann die Erinnerung kommen soll</small></span><input id="reminderTime" class="time-input" type="time" value="${esc(st.settings.reminderTime)}" aria-label="Uhrzeit der Erinnerung"></div>` : ""}` : ""}
    ${tg("decay", "Rückstufung bei Pause", `Nach ${DECAY_DAYS} Tagen ohne Üben geht es in der Sprache eine Lektion zurück`)}
    ${tg("hearts", "Herzen", "Fehler kosten ein Herz")}
    ${APP && CONFIG.GITHUB_REPO ? tg("updates", "Nach App-Updates suchen", "Beim Start bei GitHub nach einer neuen Version fragen (höchstens alle 6 Stunden)") : ""}</div>
    ${APP && CONFIG.GITHUB_REPO ? `<div style="display:grid;gap:.4rem">${ui.appUpdate ? `<button class="btn good wide" data-act="updateinfo">Version ${esc(ui.appUpdate.version)} herunterladen</button>`
      : `<button class="btn ghost wide" data-act="checkupdate">Jetzt nach Updates suchen</button>`}${ui.updateNote ? `<small class="muted" role="status">${esc(ui.updateNote)}</small>` : ""}</div>` : ""}
    <button class="btn wide" data-act="closemodal">Fertig</button>
    <button class="btn ghost wide" data-act="account">Konto & Freundescode</button>
    <button class="btn ghost wide" data-act="managepacks">Sprachen verwalten</button>
    <button class="btn ghost wide" data-act="privacy">Datenschutz</button>
    <button class="btn ghost wide" data-act="resetcourse">Fortschritt in ${esc(C.name)} zurücksetzen …</button><button class="btn ghost wide" data-act="reset">Alles zurücksetzen</button>
    <p class="muted" style="text-align:center">OpenSprachFuchs ${APP && window.AndroidBridge.appVersion ? esc(window.AndroidBridge.appVersion()) : ""} · freie Software${!APP || /^0\./.test(window.AndroidBridge.appVersion ? window.AndroidBridge.appVersion() : "0.") ? " · experimentell" : ""}</p>`);
}

/* ---------- Onboarding, languages, friends ---------- */
function shopHTML() {
  const rows = shopItems().map(it => `<div class="item"><span class="em" aria-hidden="true">${it.em}</span><span><b>${esc(it.name)}</b><small>${esc(it.desc)}</small>${it.note ? `<small>${esc(it.note)}</small>` : ""}</span>
    <button class="btn ${it.can && st.gems >= it.price ? "good" : ""}" data-act="buy" data-id="${it.id}" ${it.can && st.gems >= it.price ? "" : "disabled"}>💎 ${it.price}</button></div>`).join("");
  return `<p class="stat gem" style="font-size:1.2rem">💎 ${st.gems} Edelsteine</p>
    <p class="muted">Edelsteine gibt es für Lektionen (5, fehlerfrei 8), Übungsrunden (2), Blitzrunden (1 pro 5 Punkte), Tagesaufgaben, Abzeichen und Geschenke von Freunden.</p>
    ${ui.shopMsg ? `<p role="status" style="margin:0;font-weight:800;color:var(--good)">${esc(ui.shopMsg)}</p>` : ""}
    <div class="shop">${rows}</div>`;
}
/* The logo: the OpenSprachFuchs fox with the "O" (app/img/logo.webp; the launcher icon is cut out from the same picture). */
const logoHTML = () => `<img class="logo" src="img/logo.webp" alt="" width="34" height="34">`;
/* Tabs for the levels (A1, A2, B1, B2) above the path, each with its progress. */
function levelsHTML() {
  const cur = shownLevel();
  const tabs = levelsOf().map(l => {
    const idx = UNITS.map((u, i) => i).filter(i => UNITS[i].level === l), fin = idx.filter(i => unitComplete(i)).length;
    const locked = !unitUnlocked(idx[0]), all = fin === idx.length;
    return `<button class="level ${l === cur ? "on" : ""} ${locked ? "locked" : ""}" role="tab" aria-selected="${l === cur}" data-act="level" data-l="${l}"
      title="${l}: ${fin} von ${idx.length} Einheiten geschafft" aria-label="${LEVEL_NAMES[l] || l}, ${fin} von ${idx.length} Einheiten">
      <b><span>${LEVEL_NAMES[l] || l}</span>${all ? " ✓" : locked ? I.lock(11) : ""}</b><span class="meter"><i style="width:${100 * fin / idx.length}%"></i></span></button>`;
  }).join("");
  const first = UNITS.findIndex(u => u.level === cur);
  const hint = first > 0 && !unitUnlocked(first) ? `<p class="muted level-hint">${LEVEL_NAMES[cur] || cur} ist noch gesperrt. Schließ die Einheiten davor ab oder spring mit dem Einstufungstest („Test“ an einer Einheit) direkt hierher.</p>` : "";
  return `<div class="levels" role="tablist" aria-label="Niveaustufen">${tabs}</div>${hint}`;
}
/* Conversations, grouped by category (restaurant, taxi, ...): a row per category with its progress; tapping it shows its dialogues. */
function dialogsHTML() {
  const all = dialogsFor(CODE);
  if (!all.length) return "";
  const doneSet = cs().dialogs || {}, groups = C.dialogGroups || {}, order = [];
  for (const d of all) { const g = d.group || d.id; if (!order.includes(g)) order.push(g); }
  const rows = order.map(g => {
    const list = all.filter(d => (d.group || d.id) === g), fin = list.filter(d => doneSet[d.id]).length, open = ui.dgroup === g;
    const info = groups[g] || { title: list[0].title, em: list[0].em };
    const items = open ? `<div class="dlist">${list.map(d => `<button class="btn ghost wide dlg-item" data-act="dialog" data-id="${d.id}"><span>${d.em}&nbsp; ${esc(d.title)}<small>${esc(d.desc || "")}</small></span>${doneSet[d.id] ? "✓" : ""}</button>`).join("")}</div>` : "";
    return `<button class="dgroup ${open ? "on" : ""}" data-act="dgroup" data-g="${esc(g)}" aria-expanded="${open}"><span class="em" aria-hidden="true">${info.em}</span>
      <span><b>${esc(info.title)}</b><small>${fin} / ${list.length} Gespräche${fin === list.length ? " ✓" : ""}</small></span>${I.chev(18)}</button>${items}`;
  }).join("");
  return `<div class="panel"><h3>Gespräche</h3><p class="muted">Kleine Szenen aus dem Urlaub: Wähle im Gespräch die passende Antwort.</p>${rows}</div>`;
}
/* The fox from the logo: next to the current lesson on the path (tap it), cheering after every round, a bit sad when it didn't work out. */
const FOX_HELLO = { en: "Let's go!", fr: "Allez, on y va!", es: "¡Vamos!", it: "Andiamo!", pt: "Vamos lá!" };
function foxLine() {
  const streak = shownStreak(), lines = [FOX_HELLO[CODE] || "Los geht's!", "Ich glaub an dich!", "Eine Lektion am Tag reicht schon!", "Du schaffst das!", "Auf zur nächsten Lektion!"];
  if (streak > 1) lines.push(`🔥 ${streak} Tage in Folge!`);
  if (st.dayLessons >= 1) lines.push("Tagesziel geschafft, stark!");
  if (dueWords().length) lines.push(`${dueWords().length} Vokabeln wollen wiederholt werden.`);
  if (st.hearts < 3 && st.settings.hearts) lines.push("Üben füllt deine Herzen auf ❤️");
  const seed = [...dayStr()].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return lines[(seed + (ui.foxN || 0)) % lines.length];
}
const foxHTML = side => `<button class="path-fox ${side} ${Date.now() < (ui.foxHopUntil || 0) ? "hop" : ""}" data-act="fox" aria-label="Fuchs sagt: ${esc(foxLine())}">
  <span class="fox-say" aria-hidden="true">${esc(foxLine())}</span><img src="img/fox.webp" alt="" width="64" height="64"></button>`;
const foxCheerHTML = big => `<div class="fox-cheer ${big ? "flip" : ""}" aria-hidden="true"><img src="img/fox.webp" alt="" width="136" height="136">
  <span class="spark s1">✨</span><span class="spark s2">${big ? "🌟" : "⭐"}</span><span class="spark s3">✨</span>${big ? `<span class="spark s4">🎉</span>` : ""}</div>`;
const foxSadHTML = () => `<div class="fox-sad" aria-hidden="true"><img src="img/fox.webp" alt="" width="120" height="120"><span class="fox-say">Kopf hoch!</span></div>`;
const qrBox = () => `<div class="qrbox">${qrSVG(acct.key, 200)}<small class="muted">Auf dem neuen Handy mit der Kamera-App scannen, den Text kopieren und bei „Mit Schlüssel anmelden“ einfügen. Zeig den Code niemandem.</small></div>`;
const modal = (title, body) => `<div class="scrim" data-act="closemodal"><div class="modal" role="dialog" aria-modal="true"><h2>${title}</h2>${body}</div></div>`;
const brandHTML = () => `<div class="brand" style="justify-content:center"><span class="brand-mark">${logoHTML()}</span><span class="name">OpenSprachFuchs</span></div>`;
function welcomeHTML() {
  return `<div class="center"><div class="card">${brandHTML()}<h1>Sprachen lernen, frei und ohne Werbung</h1>
    <p class="muted" style="font-size:1.05rem">Für deinen Fortschritt bekommst du einen geheimen Schlüssel. Mehr braucht es nicht: keinen Namen, keine E-Mail, kein Passwort.</p>
    <button class="btn wide" data-act="createaccount">Los geht's</button>
    <button class="btn ghost wide" data-act="gosignin">Ich habe schon einen Schlüssel</button>
    <button class="linkbtn" data-act="localonly">Ohne Konto spielen, nur auf diesem Gerät</button>
    <button class="linkbtn" data-act="privacy">Datenschutz</button>
    <p class="muted"><b>Experimentelle Version:</b> Es kann noch Fehler geben, und manches ändert sich noch.</p></div></div>`;
}
function newKeyHTML() {
  return `<div class="center"><div class="card">${brandHTML()}<h1>Dein Schlüssel</h1>
    <div class="keybox"><b class="key">${esc(acct.key)}</b><button class="btn ghost" data-act="copykey">Kopieren</button></div>
    <p class="muted">Schreib ihn auf oder speichere ihn in deinem Passwort-Manager. Damit holst du deinen Fortschritt auf ein neues Handy.
      Ohne Schlüssel lässt sich ein Konto nicht wiederherstellen, und wer ihn kennt, hat Zugriff darauf. Du findest ihn später unter Profil → Konto.</p>
    ${acct.pending ? `<p class="muted">Gerade keine Verbindung: Das Konto wird angelegt, sobald du online bist.</p>` : ""}
    <button class="btn wide" data-act="keydone">Ich habe ihn notiert</button></div></div>`;
}
function signInHTML() {
  return `<div class="center"><div class="card">${brandHTML()}<h1>Mit Schlüssel anmelden</h1>
    <p class="muted">Gib den Schlüssel ein, den du beim ersten Start bekommen hast. Der gesicherte Fortschritt ersetzt den auf diesem Gerät.</p>
    <input id="keyInput" class="search key" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24" aria-label="Schlüssel">
    ${acct.note ? `<p class="muted" role="status">${esc(acct.note)}</p>` : ""}
    <button class="btn wide" data-act="dosignin" ${acct.busy ? "disabled" : ""}>Anmelden</button>
    <button class="btn ghost wide" data-act="${st.onboarded ? "home" : "welcome"}">Zurück</button></div></div>`;
}
function packListHTML() {
  if (!PACK_INDEX) return `<p class="muted">${packs.error ? esc(packs.error) : "Lade die Liste der Sprachen …"}</p>
    <button class="btn ghost wide" data-act="reloadpacks">Noch einmal versuchen</button>${Object.keys(COURSES).length ? `<button class="btn ghost wide" data-act="closemodal">Schließen</button>` : ""}`;
  const rows = PACK_INDEX.packs.map(p => { const have = !!COURSES[p.code], update = have && PACK_SHA[p.code] !== p.sha256, busy = packs.busy === p.code;
    const btn = busy ? `<button class="btn" disabled>Lädt …</button>`
      : !have ? `<button class="btn good" data-act="getpack" data-c="${p.code}">Laden · ${Math.max(1, Math.round(p.size / 1024))} KB</button>`
      : update ? `<button class="btn gold" data-act="getpack" data-c="${p.code}">Aktualisieren</button>`
      : `<button class="btn ghost" data-act="removepack" data-c="${p.code}" ${Object.keys(COURSES).length < 2 ? "disabled" : ""}>Entfernen</button>`;
    return `<div class="item"><span class="code" style="--c:${esc(p.color)}">${esc(p.short)}</span><span><b>${esc(p.name)}</b><small>${esc(p.note)} · ${p.units} Einheiten, ${p.words} Wörter</small>${have && !update ? "<small>✓ auf dem Gerät</small>" : ""}</span>${btn}</div>`; }).join("");
  return `<p class="muted">Jede Sprache ist ein kleines Paket, das auf dem Gerät bleibt. Neue Sprachen und Korrekturen kommen als Update.</p>
    ${packs.error ? `<p class="muted" role="status">${esc(packs.error)}</p>` : ""}<div class="shop packs">${rows}</div>
    ${Object.keys(COURSES).length ? `<button class="btn ghost wide" data-act="closemodal">Schließen</button>` : ""}`;
}
function langsHTML() {
  if (!PACK_INDEX && !packs.loading && !packs.error) {
    packs.loading = true;
    fetchPackIndex().catch(() => { packs.error = "Keine Verbindung. Zum Herunterladen einer Sprache braucht die App einmal Internet."; })
      .then(() => { packs.loading = false; render(); });
  }
  return `<div class="center"><div class="card">${brandHTML()}<h1>Welche Sprache möchtest du lernen?</h1>${packListHTML()}</div></div>`;
}
function noticesHTML() {
  const ups = packUpdates(), out = [];
  if (noVoice() && st.settings.audio && !(st.voiceHidden || {})[CODE]) out.push(`<div class="panel notice"><h3>🔇 Keine Stimme für ${esc(C.name)}</h3>
    <p class="muted">${voice.state === "missing" ? `Die Sprachausgabe deines Handys hat die Stimme für ${esc(C.name)} noch nicht heruntergeladen.` : `Die Sprachausgabe deines Handys kann kein ${esc(C.name)}.`}
    Bis dahin werden Hörübungen zu Leseübungen. Fehlt die Sprache ganz, hilft oft die kostenlose App „Speech Services by Google“ oder RHVoice.</p>
    <button class="btn wide" data-act="installvoice">Stimme installieren</button>
    <div class="row" style="justify-content:flex-end"><button class="linkbtn" data-act="voicehide">Nicht mehr anzeigen</button></div></div>`);
  if (ups.length) out.push(`<div class="panel notice"><h3>Neue Inhalte</h3><p class="muted">Für ${ups.map(c => esc(COURSES[c].name)).join(", ")} gibt es ein Update mit Verbesserungen.</p>
    ${ups.map(c => `<button class="btn gold wide" data-act="getpack" data-c="${c}" ${packs.busy ? "disabled" : ""}>${packs.busy === c ? "Lädt …" : `${esc(COURSES[c].name)} aktualisieren`}</button>`).join("")}</div>`);
  if (ui.appUpdate && !ui.updateHidden) out.push(`<div class="panel notice"><h3>🦊 Neue App-Version ${esc(ui.appUpdate.version)}</h3>
    <p class="muted">Die neue Version installiert sich über die alte, dein Fortschritt bleibt erhalten.</p>
    <button class="btn wide" data-act="openupdate">Herunterladen${ui.appUpdate.size ? ` · ${(ui.appUpdate.size / 1048576).toFixed(1).replace(".", ",")} MB` : ""}</button>
    <div class="row" style="justify-content:space-between"><button class="linkbtn" data-act="updateinfo">Was ist neu?</button><button class="linkbtn" data-act="dismissupdate">Später</button></div></div>`);
  if (keyReminderDue()) out.push(`<div class="panel notice"><h3>🔑 Ist dein Schlüssel sicher?</h3>
    <p class="muted">Ohne deinen Schlüssel ist dein Fortschritt auf einem neuen Handy verloren. Prüf kurz, ob du ihn richtig notiert hast.</p>
    <button class="btn wide" data-act="keycheck">Jetzt prüfen</button><button class="linkbtn" data-act="keylater">In einer Woche erinnern</button></div>`);
  if (acct.status === "gone") out.push(`<div class="panel notice"><h3>Konto nicht gefunden</h3><p class="muted">${accountLine()}</p><button class="btn ghost wide" data-act="account">Konto</button></div>`);
  return out.join("");
}
function friendsPanelHTML() {
  if (acct.status === "none" || acct.status === "gone") return `<div class="panel"><h3>Freunde</h3><p class="muted">Mit einem Konto lernst du mit bis zu ${MAX_FRIENDS} Freunden: gemeinsame Serien und tägliche Geschenke.</p>
    <button class="btn ghost wide" data-act="account">Konto anlegen</button></div>`;
  const rows = friends.list.map(f => {
    const name = esc(friendName(f));
    if (f.status === "incoming") return `<div class="friend"><span>👋 <b>Anfrage</b><small>Code ${esc(f.code)}</small></span><button class="btn good" data-act="friend" data-id="${f.id}">Ansehen</button></div>`;
    if (f.status === "outgoing") return `<div class="friend"><span><b>${name}</b><small>wartet auf Antwort</small></span><button class="iconbtn" data-act="friend" data-id="${f.id}" aria-label="Details">…</button></div>`;
    const s = pairStreak(f), me = st.lastDay === dayStr(), them = friendLearnedToday(f);
    return `<div class="friend"><span><b>${name}</b><small>🔥 ${s} ${s === 1 ? "Tag" : "Tage"} gemeinsam · ${them ? "hat heute gelernt ✓" : "heute noch nicht"}${s && !(me && them) ? " · heute weitermachen!" : ""}</small></span>
      ${f.canGift ? `<button class="btn gold" data-act="gift" data-id="${f.id}" title="${GIFT_GEMS} Edelsteine schenken">🎁</button>` : ""}
      <button class="iconbtn" data-act="friend" data-id="${f.id}" aria-label="Details zu ${name}">…</button></div>`;
  }).join("");
  return `<div class="panel"><h3>Freunde${friends.list.length ? ` <small class="muted" style="font-weight:600">· ${friends.list.filter(f => f.status === "accepted").length} von ${MAX_FRIENDS}</small>` : ""}</h3>
    ${friends.gifts ? `<button class="btn gold wide" data-act="claimgifts">🎁 ${friends.gifts} ${friends.gifts === 1 ? "Geschenk" : "Geschenke"} öffnen</button>` : ""}
    ${rows ? `<div class="friends">${rows}</div>` : `<p class="muted">Lernt zusammen: Wenn ihr beide an einem Tag eine Runde schafft, wächst eure gemeinsame Serie. Jeden Tag könnt ihr euch ${GIFT_GEMS} 💎 schenken.</p>`}
    ${friends.note && !ui.modal ? `<p class="muted" role="status">${esc(friends.note)}</p>` : ""}
    ${acct.friendCode ? `<button class="btn wide" data-act="myqr">📷 Mein QR-Code für Freunde</button>` : ""}
    ${acct.status === "offline" ? `<p class="muted">Gerade keine Verbindung. Freunde brauchen Internet, alles andere geht auch offline.</p>` : ""}
    ${friends.list.length < MAX_FRIENDS ? `<button class="btn ghost wide" data-act="addfriend" ${acct.status !== "ok" ? "disabled" : ""}>Freund hinzufügen</button>` : ""}</div>`;
}
const PRIVACY_HTML = `<div class="privacy">
  <p>OpenSprachFuchs erhebt nur, was für Sicherung und Freunde nötig ist. Es gibt keine Werbung, kein Tracking und keine Analyse-Dienste.</p>
  <h3>Auf deinem Gerät</h3><p class="muted">Fortschritt, Einstellungen, heruntergeladene Sprachpakete und dein Schlüssel.</p>
  <h3>Auf dem Server (nur mit Konto)</h3><ul class="muted">
    <li>eine Prüfsumme deines Zugangs (nicht der Schlüssel selbst)</li>
    <li>dein Spielstand, auf dem Handy verschlüsselt; der Server kann ihn nicht lesen</li>
    <li>dein öffentlicher Freundescode, der letzte Tag mit einer abgeschlossenen Runde, Tag der Anlage und der letzten Nutzung</li>
    <li>Freundschaften: wer mit wem, gemeinsame Serie, an welchem Tag ein Geschenk verschickt wurde</li></ul>
  <p class="muted">Deine Freunde sehen deinen Freundescode, ob du heute gelernt hast und eure gemeinsame Serie. Namen für Freunde vergibst du selbst; sie liegen nur verschlüsselt in deinem Spielstand.</p>
  <h3>Dein Name und QR-Code</h3><p class="muted">Deinen eigenen Namen bekommt der Server nie. Er steht nur auf deinem Handy, verschlüsselt im Spielstand und in deinem QR-Code bzw. Link, also bei denen, die ihn von dir bekommen. Code und Name stehen im Link hinter „#“; dieser Teil wird nicht an den Server geschickt.</p>
  <h3>Fehlermeldungen</h3><p class="muted">„Fehler melden“ schickt Aufgabe, erwartete Lösung, deine Antwort und deine Notiz ohne Bezug zu deinem Konto. Die Meldungen werden als öffentliche Issues auf GitHub gesammelt. Schreib bitte nichts Persönliches hinein.</p>
  <h3>Technik</h3><p class="muted">Der Server läuft bei Cloudflare, das zur Auslieferung und gegen Missbrauch IP-Adressen verarbeitet; OpenSprachFuchs speichert sie nicht.${CONFIG.GITHUB_REPO ? " Die Suche nach App-Updates fragt beim Start, höchstens alle 6 Stunden, bei GitHub an (abschaltbar)." : ""}</p>
  <h3>Löschen</h3><p class="muted">Unter Profil → Konto → „Konto löschen“ wird alles sofort vom Server entfernt. Konten, die 12 Monate nicht genutzt werden, löscht der Server von selbst.</p>
  ${CONFIG.OPERATOR ? `<h3>Verantwortlich</h3><p class="muted">${esc(CONFIG.OPERATOR)}</p>` : ""}</div>`;
