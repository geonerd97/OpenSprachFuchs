"use strict";
/* ---------- Friends ----------
   Friends find each other by their public friend code (not the secret key). A request becomes a friendship once
   the other side accepts it. Each friendship has its own shared streak: days on which both finished a round.
   Once a day you can send each friend a free gift of GIFT_GEMS gems. Names for friends are chosen locally and
   stored only inside the encrypted save (st.friends), never readable on the server. */
const MAX_FRIENDS = 5, GIFT_GEMS = 5;
const friends = { list: [], gifts: 0, loaded: false, busy: false, note: "" };

async function loadFriends() {
  if (acct.status !== "ok") return;
  const r = await api("GET", "friends");
  if (r.status !== 200) return;
  friends.list = r.data.friends || []; friends.gifts = r.data.gifts || 0; friends.loaded = true;
  // Names of friendships that ended are dropped from the save.
  const ids = new Set(friends.list.map(f => String(f.id)));
  let changed = false;
  for (const id of Object.keys(st.friends || {})) if (!ids.has(id)) { delete st.friends[id]; changed = true; }
  if (changed) save();
  if (view === "home" && !ui.modal) render();
}
const friendName = f => (st.friends || {})[f.id] || `Code ${f.code}`;
const formatFriendCode = s => { const c = String(s || "").toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/[^0-9A-Z]/g, ""); return c.length === 8 ? c.slice(0, 4) + "-" + c.slice(4) : ""; };
/** The shared streak as it stands today: it lasts while the last shared day is today or yesterday. */
const pairStreak = f => f.streakDay === dayStr() || f.streakDay === yesterday() ? f.streak || 0 : 0;
const friendLearnedToday = f => f.lastDay === dayStr();

async function friendCall(method, path, body, okNote) {
  friends.busy = true; friends.note = ""; render();
  const r = await api(method, path, body);
  friends.busy = false;
  const msg = { not_found: "Zu diesem Code gibt es niemanden. Stimmt er?", self: "Das ist dein eigener Code.", exists: "Ihr seid schon befreundet oder es gibt schon eine Anfrage.",
    limit: `Mehr als ${MAX_FRIENDS} Freunde gehen nicht, bei dir oder deinem Gegenüber.`, already_sent: "Heute hast du schon ein Geschenk geschickt.", rate_limited: "Zu viele Versuche. Warte bitte eine Minute." };
  if (r.status === 0) friends.note = "Keine Verbindung. Bitte versuch es gleich noch einmal.";
  else if (r.status >= 400) friends.note = msg[r.data.error] || "Das hat nicht geklappt.";
  else friends.note = okNote || "";
  await loadFriends();
  render();
  return r;
}
async function addFriend(codeInput, name) {
  const code = formatFriendCode(codeInput);
  if (!code) { friends.note = "Ein Freundescode hat 8 Zeichen, zum Beispiel 7KQM-X4D2."; render(); return false; }
  const r = await friendCall("POST", "friends", { code }, "");
  if (r.status !== 200) return false;
  st.friends = st.friends || {};
  if (name.trim()) st.friends[r.data.id] = name.trim().slice(0, 30);
  friends.note = r.data.status === "accepted" ? "Ihr seid jetzt befreundet." : "Anfrage geschickt. Sobald sie angenommen ist, zählt eure gemeinsame Serie.";
  save(); render();
  return true;
}
async function acceptFriend(id, name) {
  const r = await friendCall("POST", `friends/${id}/accept`, undefined, "Ihr seid jetzt befreundet.");
  if (r.status === 200 && name.trim()) { st.friends[id] = name.trim().slice(0, 30); save(); render(); }
}
const removeFriend = id => friendCall("DELETE", `friends/${id}`, undefined, "");
function renameFriend(id, name) {
  st.friends = st.friends || {};
  if (name.trim()) st.friends[id] = name.trim().slice(0, 30); else delete st.friends[id];
  save();
}
const sendGift = id => friendCall("POST", `friends/${id}/gift`, undefined, `Geschenk verschickt: ${GIFT_GEMS} 💎.`);
async function claimGifts() {
  const r = await friendCall("POST", "gifts/claim", undefined, "");
  if (r.status === 200 && r.data.gifts > 0) {
    const gems = r.data.gifts * GIFT_GEMS;
    st.gems = (st.gems || 0) + gems; save();
    friends.note = `🎁 ${r.data.gifts} ${r.data.gifts === 1 ? "Geschenk" : "Geschenke"} geöffnet: +${gems} 💎`;
    sfx("win"); render();
  }
}
