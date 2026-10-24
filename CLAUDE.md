# OpenSprachFuchs – freie Sprachlern-App für Android

## Worum es geht
Open-Source-Sprachlern-App nach dem Vorbild von Duolingo, für Deutschsprachige, die für Alltag und Urlaub **Englisch, Französisch, Spanisch, Italienisch und brasilianisches Portugiesisch** lernen. Die Oberfläche ist komplett auf Deutsch. Öffentlich auf GitHub: https://github.com/geonerd97/OpenSprachFuchs (Code MIT, Sprachpakete CC BY-SA 4.0, Konto `geonerd97`). Die APK baut der Maintainer lokal auf dem Mac und lädt sie als GitHub-Release hoch (`tools/release.sh`).
Verantwortlich/Kontakt: M. Reger, opensprachfuchs@gmx.net (bewusst abgekürzt und ohne Anschrift, Entscheidung des Maintainers).

## Grundsätze (Vorgaben des Maintainers)
- **Nur Android-App** (WebView), keine Web-App. Möglichst wenig Speicher; die APK ist ~1,5 MB.
- **Funktioniert offline.** Nur Sicherung, Freunde und Updates brauchen Internet. Die Sprachpakete stecken zusätzlich in der APK (`assets/packs/`), damit auch der erste Start offline klappt.
- **Modular:** jede Sprache ist ein JSON-Paket (`packs/`), herunterladbar und aktualisierbar. Die App meldet Updates für Pakete (Prüfsumme) und für sich selbst (GitHub-Releases).
- **Anonym und datensparsam:** Konto = zufälliger Schlüssel (4×4 Zeichen), keine Klar- oder Benutzernamen, Spielstand auf dem Handy verschlüsselt. Konto löschen und Datenschutzhinweis sind eingebaut. Alles, was neu an den Server geht, muss in `PRIVACY.md` und `PRIVACY_HTML` beschrieben werden.
- **Freunde** über einen öffentlichen Freundescode (nicht den Schlüssel), max. 100 (offene Anfragen zählen mit; Issue #2, vorher 5), Namen nur lokal (im verschlüsselten Spielstand). Gemeinsame Serie pro Freund (Variante A), täglich ein kostenloses Geschenk (5 💎).
- Backend kostenlos bei **Cloudflare** (Worker + D1 + statische Dateien). Live unter `https://opensprachfuchs.opensprachfuchs.workers.dev/`, D1-Datenbank `opensprachfuchs` in Westeuropa (`weur`). Deploy: `cd worker && npm run deploy`.
- **Keine Liga.** Thai, Schweizerdeutsch und Kölsch sollen später als Pakete nachgeliefert werden (die Inhalte der Vorversion liegen nicht im öffentlichen Repository; der Maintainer hat sie im privaten Verlauf auf seinem Gitea). Das Paketformat braucht dafür noch Umschrift, `noTyping`/`noListen` und abweichende Stimme.

## Stand (2026-10-24)
- **Release 0.0.1** (experimentell, GitHub-Pre-release): https://github.com/geonerd97/OpenSprachFuchs/releases/tag/v0.0.1, Tag auf `a916bee`.
- **Backend live:** https://opensprachfuchs.opensprachfuchs.workers.dev/ (Worker `opensprachfuchs`, D1 `opensprachfuchs` in `weur`, workers.dev-Subdomain des Kontos `opensprachfuchs`). Alte Worker/Datenbanken (betterlingo, openlingo) sind gelöscht.
- **Git lokal:** Der Ordner heißt noch `~/Betterlingo`. Branch `opensource` folgt `github/main` (Remote `github`). `origin` ist das private Gitea (`…/Bubulingo.git`) mit dem alten Verlauf; dorthin nichts vom neuen Stand pushen. Pushen nach GitHub mit `git -c credential.helper= -c credential.helper='!gh auth git-credential' push github opensource:main` (die gh-CLI ist als `geonerd97` angemeldet). Commits in diesem Repo laufen als `geonerd97 <277867742+geonerd97@users.noreply.github.com>`.
- **Signatur:** `~/opensprachfuchs-release.jks` + `android/keystore.properties` (beides nicht in Git, muss gesichert sein; ohne diesen Schlüssel keine Updates mehr). Alte Schlüssel `~/betterlingo-release.jks`, `~/openlingo-release.jks` werden nicht mehr gebraucht.
- **Cloudflare-Zugang:** Wrangler ist per OAuth angemeldet (Konto martin150897@gmail.com). Die Subdomain wurde über die API geändert (`/accounts/<id>/workers/subdomain`, Token aus `~/Library/Preferences/.wrangler/config/default.toml`).
- Offene Punkte beim Maintainer: Test auf echten Handys läuft (Fairphone 5, Galaxy Tab S6 Lite), Auftragsverarbeitungsvertrag (DPA) mit Cloudflare.

## Aufbau
| Pfad | Inhalt |
|---|---|
| `app/` | Die App: `index.html`, `styles.css`, `js/*.js`. Kein Build-Schritt, keine Abhängigkeiten, Systemschriften. Die Skripte teilen sich den globalen Gültigkeitsbereich, Reihenfolge wie in `index.html`. |
| `android/` | WebView-App, Paket `de.opensprachfuchs.app`, Version 0.0.4 (versionCode 6, experimentell; 0.x-Releases sind auf GitHub Pre-releases) |
| `packs/` | Sprachpakete `en/fr/es/it/pt.json`, Format in `packs/README.md` |
| `worker/` | Cloudflare Worker (`src/index.js`), `schema.sql`, `wrangler.example.toml` (Vorlage; die echte `wrangler.toml` mit der Datenbank-ID ist lokal und gitignored); `public/` wird gebaut (gitignored) |
| `tools/packs.mjs` | `check` / `format` / `build` (nach `worker/public/packs/` inkl. `index.json` mit sha256) |
| `tools/release.sh` | Tests, signierte Release-APK, GitHub-Release `v<versionName>` |
| `test/` | `game-test.js` (Spiellogik), `backend-test.js` (Worker gegen SQLite statt D1, gesteuert über den echten App-Code), `harness.js` |

### app/js
- `config.js`: `CONFIG.BACKEND_URL`, `GITHUB_REPO`, `OPERATOR` (Platzhalter, beim Deployment eintragen), `APP` (AndroidBridge vorhanden), `BACKEND` (auf localhost automatisch `http://localhost:8787/`), `fetchTimeout`.
- `content.js`: installierte Pakete in localStorage (`opensprachfuchs-pack-<code>`, Liste mit sha256 in `opensprachfuchs-packs`), `COURSES`, `fetchPackIndex` (Backend, sonst mitgelieferte `packs/`; nur Backend-Index zählt für Updates), `downloadPack`, `packUpdates`, `setCourse` → `UNITS` mit Wörtern `{id, t, alt, de, pic}` und Sätzen `{id, t, tAlt, de, deAlt}`, Tipp-Hilfe `HINT_T`/`HINT_DE`.
- `state.js`: Spielstand `st` in `opensprachfuchs-state`, Serie, Herzen, SRS, Statistik, Abzeichen, Rückstufung, Tagesaufgaben, Shop. **Fortschritt hängt an festen IDs** (`w:basics.w01`, `s:…`), nicht am Text.
- `account.js`: Schlüssel (Crockford Base32, 80 Bit) → PBKDF2-SHA256 (150.000 Runden) → Token (Bearer, Server speichert SHA-256) + AES-GCM-Schlüssel. Spielstand = base64([Version][IV][Chiffrat]), Version 1 = gzip. `createAccount` (offline möglich, `pending`), `signIn`, `initAccount`, `pushSave`/`pullSave` (neueres `savedAt` gewinnt, Server antwortet 409 bei älterem), `deleteAccount`, `signOut`, `reportLearningDay`, Fehlermeldungs-Warteschlange `st.reportQueue`, App-Update-Check `checkAppUpdate(force)` (GitHub `/releases?per_page=10`, nicht `/releases/latest`, weil das Pre-releases auslässt und alle 0.x-Versionen Pre-releases sind; beim Start höchstens alle 6 Std., abschaltbar, dazu „Jetzt nach Updates suchen“ in den Einstellungen). Ein gefundenes Update wird in `opensprachfuchs-update` gemerkt, bis es installiert ist: Dialog `appupdate` einmal pro Version (mit „Was ist neu“ aus den Release-Notizen), Hinweis im Lernweg, „Herunterladen“ öffnet direkt die APK (`downloadUpdate`).
- `friends.js`: `loadFriends`, `addFriend`, `acceptFriend`, `removeFriend`, `sendGift`, `claimGifts`, `pairStreak` (gilt, solange `streakDay` heute oder gestern ist), Namen in `st.friends[id]`.
- `audio.js`: Soundeffekte, Sprachausgabe über `AndroidBridge.speak` (im Desktop-Browser `speechSynthesis`), Hören/Sprechen pausieren, Spracherkennung nur in der App.
- `exercises.js`: Lektionspläne, Antwortprüfung (`norm`, `lev`), Generatoren `GEN.*`, `generate()` mit Fallbacks.
- `lesson.js`: Ablauf aller Runden (Lektion, Training, Einstufungstest, Blitzrunde, Gespräch, Meisterschaft), `finish()`.
- `views.js`: Rendering. Logo `logoHTML()` (`app/img/logo.webp`). Startseite mit **Tab-Leiste unten** (`TABS`: Lernweg, Üben, Freunde, Shop, Profil; `ui.tab`), Onboarding-Ansichten `welcome`/`newkey`/`signin`/`langs`, Dialoge (`modalHTML`), `PRIVACY_HTML`.
- `main.js`: Klick-Delegation über `data-act`, Tastatur, Zurück-Taste (`window.opensprachfuchsBack`: Dialog → Lektion → Tab Lernweg → App verlassen), Start.

### Backend (`worker/src/index.js`)
Routen: `POST/GET/DELETE /api/account`, `POST /api/account/friend-code`, `GET/PUT /api/save`, `POST /api/day`, `GET/POST /api/friends`, `POST /api/friends/:id/accept`, `DELETE /api/friends/:id`, `POST /api/friends/:id/gift`, `POST /api/gifts/claim`, `POST /api/report`, `GET /api/ping`. Statische Pakete unter `/packs/`.
- Tabellen: `accounts` (auth-Hash, friend_code, created, seen, last_day, prev_day, save, saved_at), `friendships` (a, b, accepted, streak, streak_day, gift_a/b, gifts_for_a/b), `reports` (ohne Kontobezug).
- Gemeinsame Serie: Beim Melden eines Lerntags zählt jede Freundschaft, deren anderer Teil denselben Tag als `last_day` oder `prev_day` hat.
- Statische Pakete bekommen CORS über `public/_headers` (schreibt `tools/packs.mjs build`).
- Rate Limiting per IP (Bindings `LIMIT_API`, `LIMIT_STRICT`, IP wird nicht gespeichert). Cron löscht täglich Konten nach 365 Tagen ohne Nutzung und alte Meldungen.
- CORS `*`, weil die App von `https://appassets.androidplatform.net` kommt.

### Android
- Gradle 9.5, AGP 9.3.3, compileSdk/targetSdk 36, minSdk 26.
- Vor jedem Build führt `buildPacks` (Exec, Node; Pfad über `-PnodePath`) `tools/packs.mjs build` aus. `copyWeb` synchronisiert `../app` und die gebauten Pakete nach `app/src/main/assets/` (gitignored).
- `MainActivity.kt`: WebView über `WebViewAssetLoader`, nur HTTPS (keine Cleartext-Konfiguration mehr). Name unter dem Icon: „SprachFuchs“ (`launcher_name`), sonst „OpenSprachFuchs“ (`app_name`).
- Brücke `AndroidBridge`:
  - `speak`, `speakQueued` (nach dem aktuellen Satz), `stop`, `hasVoice`
  - `canRecognize`, `startListening`, `stopListening`
  - `setReminder`, `reportDay` (für `Reminders.kt`)
  - `appVersion`, `copy`, `share`, `openUrl`
- Release-Signatur aus `android/keystore.properties` (gitignored).

## Inhalte und Funktionen (unverändert aus der Vorversion übernommen)
Lernweg mit 40 Einheiten à 4 Lektionen = 160 Lektionen pro Sprache, je 10 Einheiten in A1, A2, B1, B2 (in den Paketen nach Stufe sortiert; Reiter über dem Pfad: `levelsHTML`, `shownLevel`, `LEVEL_NAMES`, `ui.level`; nach der letzten Einheit einer Stufe öffnet sich der nächste Reiter; begonnene Einheiten bleiben offen), Einstufungstest, Übungstypen choice/choiceRev/listenWord/pic/bank/bankRev/listen/type/typeSent/gap/match/speak, Wörter antippen, Wortliste mit Suche, Spaced Repetition (Stufen 0–6), Gespräche (20 pro Sprache, 5 je Kategorie), Meisterschaft, Combo, Blitzrunde, Tagesaufgaben, Edelsteine und Shop (Serienschutz, Herzen, Doppel-XP, Pausenschutz), 5 Herzen (Issue #4: 1 Herz alle 40 Min., +1 pro 6 richtige Antworten beim Üben, Bonustruhe 2) mit Auffüllrunde, Hören/Sprechen pausieren, Rückstufung nach 14 Tagen Pause, Zurücksetzen ab Einheit, Statistik und 14 Abzeichen, tägliche Erinnerung. Antwortprüfung ignoriert Groß/klein und Satzzeichen, toleriert Akzente und kleine Tippfehler, englische Kurzformen werden aufgelöst.

## Prüfen
`npm test` (Node ≥ 22.5): Paketprüfung, Spiellogik (27.000 Übungen in 5 Sprachen, 0 Fehler, dazu alle Tabs, Stufen-Reiter, Dialoge, App-Modus und Update-Prüfung) und Backend (Konto, Verschlüsselung, Anmelden auf zweitem Gerät, Freunde, Serie, Geschenke, Limit, Löschen, Offline-Konto, Paket-Updates, Aufräumen). `./gradlew assembleDebug` in `android/` baut die APK. Das Backend ist deployt und live geprüft (Konto, Spielstand, Lerntag, Freunde, Löschen, CORS). Ein Test auf einem echten Handy steht noch aus.

## Verlauf
- Bis 2026-10-22: Version 1 (damals „Betterlingo“) als einzelne HTML-Datei mit Raspberry-Pi-Server (Piper-Stimmen), 7 Sprachen; nicht im öffentlichen Verlauf.
- 2026-10-23: Umbenennung in Openlingo, dann wegen Namensgleichheit mit anderen GitHub-Projekten in **OpenSprachFuchs** (technisch `opensprachfuchs`). Kontakt opensprachfuchs@gmx.net. Logo (seit 2026-10-24, vom Maintainer): lächelnder Comic-Fuchskopf (`docs/logo.webp`, App `app/img/logo.webp`, Launcher-Icon als Adaptive Icon: ausgeschnittener Fuchs in `mipmap-*/ic_launcher_foreground.webp` auf Creme `#FEF6E9`, 57 dp groß, damit die Ohren auch in runden Masken passen). Keine Eule (Abgrenzung zu Duolingo).
- 2026-10-24: Issue #6: 5 Gespräche pro Kategorie (Restaurant, Taxi, Hotel, Apotheke), 20 pro Sprache; Paketfeld `group` pro Gespräch und `dialogGroups` (Titel, Emoji); im Üben-Tab aufklappbare Kategorien mit Fortschritt (`dialogsHTML`, `ui.dgroup`).
- 2026-10-24: Issue #5 (Gespräche sprechen übereinander): Die Antwort des Gegenübers wird jetzt hinter den eigenen Satz in die Warteschlange der Sprachausgabe gestellt (`speak(text, slow, queued)`, Brücke `speakQueued` mit QUEUE_ADD und 0,5 s Pause) statt nach festen 1,4 s. Update-Mitteilung mit Dialog und direktem APK-Download.
- 2026-10-24: Italienisch als fünfte Sprache (alle 40 Einheiten und 4 Gespräche, `it-IT`, Übersetzung von Claude, ungeprüft). Neues Logo (Fuchskopf). Issue #1 geschlossen.
- 2026-10-24: 20 neue Einheiten pro Sprache (A1: Familie, Kleidung, Zuhause; A2: Flughafen, Strand, Handy; B1: Wohnung, Arbeit, Kochen, Bank, Natur; B2: Umwelt, Medien, Bewerbung, Gefühle, Behörden, Gesund leben, Technik, Reklamieren, Gesellschaft), Stufen-Reiter im Lernweg. Übersetzungen von Claude, noch nicht von Muttersprachlern geprüft.
- 2026-10-23/24: Repository öffentlich, Release 0.0.1 (APK nachträglich mit korrigiertem Update-Check ersetzt).
- 2026-10-23: Neuaufbau als Open-Source-Projekt: Android-only, Sprachpakete, Cloudflare-Backend mit anonymem Schlüssel-Konto und verschlüsselten Spielständen, Freunde (gemeinsame Serien, Geschenke), offline-fähig, Tab-Leiste unten. Pi-Server, Docker, Web-App/PWA, Thai und Dialekte entfernt.

## Arbeitsweise
- Aufgaben kommen als GitHub-Issues (https://github.com/geonerd97/OpenSprachFuchs/issues). Vor einer Änderung `npm test`, nach Änderungen an `app/` oder `android/` zusätzlich `./gradlew assembleDebug`; Änderungen am Backend mit `cd worker && npm run deploy` ausrollen.
- Neue Version: `versionCode` +1 und `versionName` in `android/app/build.gradle.kts`, committen, pushen, `tools/release.sh` (braucht die gh-Credentials wie oben, z. B. über `GIT_CONFIG_COUNT`).

## Mögliche nächste Schritte
- Auftragsverarbeitungsvertrag mit Cloudflare abschließen
- Rückmeldungen aus den Handy-Tests (Issues)
- Thai, Schweizerdeutsch, Kölsch als Pakete (Format erweitern)
- Sprachpakete von Muttersprachlern prüfen lassen
- Eigene Schriftart als Datei in der App (aktuell Systemschrift, keine Google Fonts wegen Datenschutz/offline)
