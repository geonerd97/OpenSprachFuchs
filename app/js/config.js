"use strict";
/* ---------- Configuration ----------
   BACKEND_URL: your Cloudflare Worker (see README, "Backend einrichten"). It serves the API and the language packs.
   GITHUB_REPO: "owner/name" of the repository with the APK releases; the app then points out new versions.
   Leave it empty to switch the update check off. */
const CONFIG = {
  BACKEND_URL: "https://app.opensprachfuchs.workers.dev/",
  GITHUB_REPO: "geonerd97/OpenSprachFuchs",
  // Who runs the backend (name and contact), shown in the privacy notice. Required by the GDPR when you run it publicly.
  OPERATOR: "M. Reger, E-Mail: opensprachfuchs@gmx.net",
};

/* Inside the Android app the page talks to the phone through window.AndroidBridge. */
const APP = typeof window !== "undefined" && !!window.AndroidBridge;
/* In a browser (web app, tools/web.mjs) the page can be added to the home screen and then runs on its own ("standalone"). */
const WEB = !APP && typeof location !== "undefined" && /^https?:$/.test(location.protocol || "");
const IOS = typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
function standalone() { try { return !!(navigator.standalone || matchMedia("(display-mode: standalone)").matches); } catch (e) { return false; } }
/* During development (page opened from localhost) the local worker from `npx wrangler dev` is used. */
const BACKEND = typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname || "")
  ? "http://localhost:8787/" : CONFIG.BACKEND_URL.replace(/\/?$/, "/");

/** fetch() that gives up after `ms`, so a dead connection never blocks the game. */
function fetchTimeout(url, opts = {}, ms = 8000) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), ms) : 0;
  return fetch(url, Object.assign({}, opts, ctl ? { signal: ctl.signal } : {})).finally(() => clearTimeout(timer));
}
