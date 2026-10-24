<p align="center"><img src="docs/logo.webp" alt="OpenSprachFuchs-Logo: ein Comic-Fuchs mit einem blauen O" width="160"></p>

# OpenSprachFuchs

Eine freie Sprachlern-App für Android, inspiriert von Duolingo: ohne Werbung, ohne Tracking, ohne Abo. Gemacht für Deutschsprachige, die für Alltag und Urlaub **Englisch, Französisch, Spanisch oder brasilianisches Portugiesisch** lernen wollen.

OpenSprachFuchs ist ein unabhängiges Open-Source-Projekt und hat nichts mit Duolingo zu tun.

> ⚠️ **Experimentell:** OpenSprachFuchs ist in einer frühen Version (0.x). Funktionen, Datenformat und Backend können sich noch ändern, und es kann Fehler geben. Wichtige Lernfortschritte bitte nicht allein darauf verlassen.

## Funktionen

- **Lernweg** mit 40 Einheiten (160 Lektionen) pro Sprache: je 10 Einheiten in den Stufen A1, A2, B1 und B2, wählbar über Reiter, dazu ein Einstufungstest zum Überspringen
- **Übungen:**
  - Bilder und Paare zuordnen
  - Sätze aus Wortkarten bauen
  - Lückentext, Hören und selbst tippen
  - Nachsprechen über die Spracherkennung des Handys
  - Mini-Gespräche
- **Lernhilfen:**
  - Wörter in Sätzen antippen zeigt die Übersetzung
  - Wortlisten mit Suche
  - Wiederholung mit Lernstufen (Spaced Repetition)
- **Motivation:**
  - XP, Tagesziel, Serie, Combo-Bonus
  - Blitzrunde, Tagesaufgaben, Abzeichen, Statistik
  - Meisterschaft (Bronze, Silber, Gold)
  - Edelsteine und Shop
- **Freunde:**
  - bis zu 100 Freunde über einen Freundescode
  - eine gemeinsame Serie mit jedem Freund
  - täglich ein kostenloses Geschenk (5 💎)
- **Offline:** Alles außer Sicherung und Freunden funktioniert ohne Internet. Die Sprachpakete stecken in der App und kommen als Update vom Server.
- **Anonymes Konto:**
  - ein zufälliger Schlüssel statt Name, E-Mail oder Passwort
  - der Spielstand wird auf dem Handy verschlüsselt, bevor er gesichert wird
  - Details stehen in [PRIVACY.md](PRIVACY.md)

## Aufbau

| Pfad | Inhalt |
|---|---|
| [`app/`](app) | Die App selbst: HTML, CSS und JavaScript ohne Build-Schritt. Läuft in der Android-WebView. |
| [`android/`](android) | Android-Projekt: WebView, Sprachausgabe, Spracherkennung, Erinnerung |
| [`packs/`](packs) | Sprachpakete als JSON, eines pro Sprache ([Format](packs/README.md)) |
| [`worker/`](worker) | Backend für Cloudflare Workers + D1: Konten, verschlüsselte Spielstände, Freunde, Sprachpakete |
| [`tools/`](tools) | `packs.mjs` (Pakete prüfen und bauen), `release.sh` (Release auf GitHub) |
| [`test/`](test) | Tests für Spiellogik und Backend |

```mermaid
flowchart LR
  subgraph Handy
    A[Android-App<br>WebView + app/] --- P[(Sprachpakete<br>+ Spielstand)]
  end
  A -- "HTTPS: verschlüsselter Spielstand,<br>Freunde, Paket-Updates" --> W[Cloudflare Worker]
  W --- D[(D1-Datenbank)]
  W --- S[Sprachpakete<br>statische Dateien]
  A -. "einmal täglich: neue Version?" .-> G[GitHub Releases]
```

## Schnellstart für Entwickler

Voraussetzungen: **Node.js 22.5 oder neuer** und, für die App, **Android Studio** (bringt JDK und Android SDK mit).

```bash
npm test
```

Das prüft die Sprachpakete und lässt beide Tests laufen. Alles läuft lokal, ohne Konto bei Cloudflare.

Die Oberfläche lässt sich auch im Desktop-Browser ansehen, zum Beispiel mit `npx serve app`. Sprachausgabe, Spracherkennung und Erinnerung gibt es dort aber nur eingeschränkt.

## Backend einrichten (Cloudflare, kostenlos)

Der kostenlose Tarif von Cloudflare reicht für ein kleines Projekt: 100.000 API-Anfragen am Tag, 5 GB Datenbank, statische Dateien (die Sprachpakete) ohne Limit.

1. Ein Cloudflare-Konto anlegen und im Ordner `worker/` die Werkzeuge installieren:
   ```bash
   cd worker
   npm install
   npx wrangler login
   ```
2. Die Vorlage für die Konfiguration kopieren. `wrangler.toml` bleibt lokal und kommt nicht in Git.
   ```bash
   cp wrangler.example.toml wrangler.toml
   ```
3. Datenbank anlegen (`weur` = Westeuropa) und die ausgegebene `database_id` in `worker/wrangler.toml` eintragen:
   ```bash
   npx wrangler d1 create opensprachfuchs --location weur
   ```
4. Tabellen anlegen:
   ```bash
   npm run schema
   ```
5. Bauen und veröffentlichen. Das baut auch die Sprachpakete:
   ```bash
   npm run deploy
   ```
   Wrangler zeigt danach die Adresse, z. B. `https://opensprachfuchs.<dein-name>.workers.dev/`.
6. Diese Adresse in [`app/js/config.js`](app/js/config.js) als `BACKEND_URL` eintragen. Dort gehören auch dein GitHub-Repository (`GITHUB_REPO`, für Update-Hinweise) und unter `OPERATOR` Name und Kontakt des Betreibers hin. Letzteres verlangt die DSGVO für den Datenschutzhinweis.

**Fehlermeldungen aus der App lesen** („Fehler melden“):

```bash
npx wrangler d1 execute opensprachfuchs --remote --command "SELECT * FROM reports ORDER BY id DESC LIMIT 50"
```

**Lokal testen:** `npm run dev` startet den Worker unter `http://localhost:8787`. Wird die App über `localhost` geöffnet, nutzt sie automatisch dieses Backend.

## Android-App bauen

1. In Android Studio *File → Open* wählen und den Ordner `android/` öffnen. Das ganze Repository muss vorhanden sein, denn der Build holt sich `app/` und `packs/` aus dem übergeordneten Ordner. Er braucht dafür Node; liegt es nicht unter `/opt/homebrew/bin` oder `/usr/local/bin`, den Pfad mit `-PnodePath=/pfad/zu/node` angeben.
2. Zum Ausprobieren auf ▶ *Run* klicken, oder im Terminal:
   ```bash
   ./gradlew assembleDebug
   ```
   Die APK liegt danach unter `android/app/build/outputs/apk/debug/`.

### Release bauen und auf GitHub veröffentlichen

Releases müssen immer mit **demselben Schlüssel** signiert sein, sonst lassen sich Updates nicht über die alte Version installieren.

1. Einmalig einen Schlüssel erzeugen. **Datei und Passwörter gut sichern, nie ins Repository!**
   ```bash
   keytool -genkeypair -v -keystore ~/opensprachfuchs-release.jks -keyalg RSA -keysize 4096 -validity 10000 -alias opensprachfuchs
   ```
2. Die Datei `android/keystore.properties` anlegen. Sie steht in `.gitignore`.
   ```properties
   storeFile=/Users/<du>/opensprachfuchs-release.jks
   storePassword=…
   keyAlias=opensprachfuchs
   keyPassword=…
   ```
3. In [`android/app/build.gradle.kts`](android/app/build.gradle.kts) `versionCode` um 1 erhöhen und `versionName` setzen, z. B. `0.0.2`.
4. Bauen und veröffentlichen. Das braucht die [GitHub CLI](https://cli.github.com) und `gh auth login`:
   ```bash
   tools/release.sh
   ```
   Das Skript führt die Tests aus, baut die signierte APK und legt das Release `v<versionName>` mit der APK an. Versionen unter 1.0 werden auf GitHub als Vorabversion („Pre-release“, experimentell) markiert. Die App weist dann auf die neue Version hin.

**Auf dem Handy installieren:** die APK aus den GitHub-Releases herunterladen und öffnen. Beim ersten Mal fragt Android, ob Installationen aus dieser Quelle erlaubt sind.

## Mitmachen

Korrekturen an den Übersetzungen und neue Sprachen sind sehr willkommen. Wie das geht, steht in [CONTRIBUTING.md](CONTRIBUTING.md).

## Lizenz

- Code: [MIT](LICENSE)
- Sprachpakete in `packs/`: [CC BY-SA 4.0](packs/LICENSE)
