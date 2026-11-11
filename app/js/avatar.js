"use strict";
/* ---------- The fox as avatar ----------
   Gems buy things for the fox to wear for good: a hat, glasses, something round the neck, clothes and a background.
   Purely cosmetic, nothing helps with learning. Some parts can't be bought but come free with a milestone.

   Saved in the encrypted save only (never sent anywhere on its own):
     st.avatar = { v: 1, owned: ["cap", ...], worn: { head: "cap", eyes: "sunglasses", ... }, bg: "bg_meadow", at: <ms> }
   owned: ids of the parts the player has, bought or earned. Ids are fixed names, never texts, so a part may get a new
          look or name without anyone losing it. Two saves are merged by joining both lists (mergeSaves in state.js).
   worn:  what the fox has on, one part per category (bg is kept apart, it is not worn). Missing key = nothing.
   at:    when worn/bg last changed; on a merge the save that changed the look last wins (see mergeSaves).
   Later, friends may get to see each other's fox: avatarLook() is the only part that would ever leave the device
   (worn + bg, no ids of owned parts); doing so needs an entry in PRIVACY.md and PRIVACY_HTML first.

   Adding a part: draw app/img/acc/<id>.svg in the fox's coordinates (the fox picture is 100 x 100, 0 0 = top left; the
   svg's viewBox is the box the part covers, it may reach outside 0..100) and add a line below with the same box in `at`
   ([left, top, width, height] in percent of the fox). Prices are in gems; `free` instead of a price makes it a milestone.
   The graphics are CC BY-SA 4.0 like the language packs (app/img/acc/LICENSE.md). */
const AVATAR_CATS = [
  // z: stacking order around the fox picture (z 2). Clothes sit behind the head, the rest in front.
  { id: "head", name: "Kopfbedeckung", em: "🧢", z: 5 },
  { id: "eyes", name: "Brille", em: "👓", z: 4 },
  { id: "neck", name: "Halstuch", em: "🧣", z: 3 },
  { id: "body", name: "Kleidung", em: "👕", z: 1 },
  { id: "bg", name: "Hintergrund", em: "🖼️", z: 0 },
];
const AVATAR_MILESTONES = {
  unit: { text: "Schließ deine erste Einheit ab.", test: () => Object.keys(COURSES).some(c => unitsDone(c) >= 1) },
  streak7: { text: "Lerne 7 Tage am Stück.", test: () => (st.bestStreak || 0) >= 7 },
  badge: { text: "Hol dir dein erstes Abzeichen.", test: () => Object.keys(st.badges || {}).length >= 1 },
  streak30: { text: "Lerne 30 Tage am Stück.", test: () => (st.bestStreak || 0) >= 30 },
};
const AVATAR_ITEMS = [
  { id: "cap", cat: "head", name: "Basecap", price: 80, at: [18, -4, 64, 30] },
  { id: "beanie", cat: "head", name: "Pudelmütze", free: "streak7", at: [20, -14, 60, 40] },
  { id: "crown", cat: "head", name: "Krone", price: 250, at: [30, -8, 40, 28] },
  { id: "straw_hat", cat: "head", name: "Strohhut", price: 100, at: [10, -6, 80, 32] },
  { id: "beret", cat: "head", name: "Baskenmütze", price: 90, at: [22, -4, 56, 28] },
  { id: "flower_crown", cat: "head", name: "Blumenkranz", free: "streak30", at: [18, 4, 64, 22] },
  { id: "sunglasses", cat: "eyes", name: "Sonnenbrille", price: 80, at: [12, 38, 76, 26] },
  { id: "round_glasses", cat: "eyes", name: "Runde Brille", free: "badge", at: [12, 38, 76, 28] },
  { id: "heart_glasses", cat: "eyes", name: "Herzbrille", price: 90, at: [12, 38, 76, 28] },
  { id: "monocle", cat: "eyes", name: "Monokel", price: 180, at: [54, 38, 34, 50] },
  { id: "scarf", cat: "neck", name: "Ringelschal", price: 60, at: [18, 78, 64, 42] },
  { id: "bandana", cat: "neck", name: "Entdecker-Halstuch", free: "unit", at: [20, 80, 60, 36] },
  { id: "bow_tie", cat: "neck", name: "Fliege", price: 50, at: [34, 84, 32, 16] },
  { id: "flower_lei", cat: "neck", name: "Blumenkette", price: 80, at: [18, 80, 64, 30] },
  { id: "hoodie", cat: "body", name: "Kapuzenpulli", price: 120, at: [4, 76, 92, 38] },
  { id: "striped_shirt", cat: "body", name: "Ringelshirt", price: 100, at: [4, 76, 92, 38] },
  { id: "raincoat", cat: "body", name: "Regenjacke", price: 110, at: [4, 76, 92, 38] },
  { id: "jersey", cat: "body", name: "Trikot", price: 130, at: [4, 76, 92, 38] },
  { id: "bg_meadow", cat: "bg", name: "Sommerwiese", price: 60, at: [-10, -10, 120, 126] },
  { id: "bg_beach", cat: "bg", name: "Strand", price: 100, at: [-10, -10, 120, 126] },
  { id: "bg_night", cat: "bg", name: "Sternenhimmel", price: 150, at: [-10, -10, 120, 126] },
  { id: "bg_mountains", cat: "bg", name: "Bergsee", price: 120, at: [-10, -10, 120, 126] },
  { id: "bg_city", cat: "bg", name: "Altstadt am Abend", price: 180, at: [-10, -10, 120, 126] },
];
const avatarItem = id => AVATAR_ITEMS.find(x => x.id === id);
const av = () => {
  const a = st.avatar || (st.avatar = {});
  if (!Array.isArray(a.owned)) a.owned = [];
  if (!a.worn || typeof a.worn !== "object") a.worn = {};
  a.v = a.v || 1;
  return a;
};
const ownsPart = id => !!st.avatar && Array.isArray(st.avatar.owned) && st.avatar.owned.includes(id);
// What the fox has on: one id per category (bg included), unknown ids (from a newer app version) left out.
function avatarLook(a = st.avatar) {
  const look = {};
  if (!a) return look;
  for (const [cat, id] of Object.entries(a.worn || {})) { const it = avatarItem(id); if (it && it.cat === cat && cat !== "bg") look[cat] = id; }
  if (a.bg && avatarItem(a.bg) && avatarItem(a.bg).cat === "bg") look.bg = a.bg;
  return look;
}
/* Wear a part (or take it off with id null). Only owned parts; the try-on in the shop doesn't go through here. */
function wearPart(cat, id) {
  if (id && (!ownsPart(id) || avatarItem(id).cat !== cat)) return false;
  const a = av();
  if (cat === "bg") a.bg = id || ""; else if (id) a.worn[cat] = id; else delete a.worn[cat];
  a.at = Date.now(); save();
  return true;
}
/* Buying: exactly the price, only once, never a milestone part. Bought parts are put on right away. */
function buyPart(id) {
  const it = avatarItem(id);
  if (!it || it.free || ownsPart(id) || !(it.price > 0) || (st.gems || 0) < it.price) return false;
  st.gems -= it.price;
  av().owned.push(id);
  wearPart(it.cat, id); // saves
  return true;
}
/* Milestones: each free part is handed out once, the first time its condition holds (after a round and at start). */
function checkAvatarMilestones() {
  const fresh = AVATAR_ITEMS.filter(it => it.free && !ownsPart(it.id) && AVATAR_MILESTONES[it.free] && AVATAR_MILESTONES[it.free].test());
  if (fresh.length) { av().owned.push(...fresh.map(it => it.id)); save(); }
  return fresh;
}
/* The fox with everything it wears, as layers in one box: the box is what moves (fox-bob, -hop, -cheer, -jump, -flip,
   -sad), so the parts always go along. Positions are percent of the fox, so they fit at every size.
   look: { head, eyes, neck, body, bg } (default: what the player wears). */
function foxFigureHTML(size, look = avatarLook()) {
  const z = Object.fromEntries(AVATAR_CATS.map(c => [c.id, c.z]));
  const layers = Object.entries(look).map(([cat, id]) => {
    const it = avatarItem(id);
    if (!it) return "";
    const [x, y, w, h] = it.at;
    return `<img class="acc acc-${cat}" data-part="${it.id}" src="img/acc/${it.id}.svg" alt="" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%;z-index:${z[cat]}">`;
  }).join("");
  const cls = ["fox-av", look.body || look.neck || look.bg ? "tall" : "", look.head || look.bg ? "hat" : ""].filter(Boolean).join(" ");
  // Clothes, scarves and backgrounds reach below the chin: room for them, so they don't cover the text underneath.
  const below = look.body || look.neck || look.bg ? `;margin-bottom:${Math.round(size * .18)}px` : "";
  return `<span class="${cls}" style="width:${size}px;height:${size}px${below}">${layers}<img class="fox-img" src="img/fox.webp" alt="" width="${size}" height="${size}"></span>`;
}
