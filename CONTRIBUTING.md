# Mitmachen

Danke, dass du helfen möchtest! Am meisten bringen gerade:

- Korrekturen an Übersetzungen, am besten von Muttersprachler·innen
- fehlende richtige Lösungen
- neue Sprachen

## Eine Übersetzung korrigieren

1. Die Sprache in [`packs/`](packs) öffnen, z. B. `packs/fr.json`. Jede Zeile ist ein Wort oder ein Satz:
   ```json
   {"id":"basics.s02","de":"Mir geht es gut, danke.","t":["Ça va bien, merci.","Je vais bien, merci."]}
   ```
   Der erste Eintrag in `t` ist die Hauptlösung, die weiteren gelten ebenfalls als richtig.
2. Ändern, dann prüfen:
   ```bash
   node tools/packs.mjs check
   ```
3. Pull Request stellen.

**Die `id` nie ändern.** Am `id` hängt der Lernfortschritt der Spieler. Neue Einträge bekommen die nächste freie Nummer.

Fehlermeldungen aus der App („Fehler melden“) sammeln sich im Backend. Wer es betreibt, kann sie abfragen (siehe README) und als Issues anlegen.

## Eine neue Sprache hinzufügen

1. Eine bestehende Datei kopieren, z. B. `packs/es.json` nach `packs/it.json`.
2. Kopfdaten anpassen:

   | Feld | Bedeutung |
   |---|---|
   | `code` | wie der Dateiname, z. B. `it` |
   | `name`, `short` | Name und Kürzel, z. B. „Italienisch“ und „IT“ |
   | `voice` | Sprachcode für Sprachausgabe und Spracherkennung, z. B. `it-IT` |
   | `articles` | regulärer Ausdruck für Artikel, die beim Tippen optional sind |
   | `gapSkip` | Wörter, die der Lückentext nicht abfragen soll |
   | `glossary` | häufige Wörter für die Tipp-Hilfe in Sätzen |

3. Alle `t`-Werte übersetzen. Die deutschen Texte (`de`), die IDs und die Einheiten bleiben gleich.
4. Die Datei mit `node tools/packs.mjs format` formatieren, mit `npm test` prüfen und einen Pull Request stellen.

Das genaue Format steht in [`packs/README.md`](packs/README.md). Nach dem nächsten `npm run deploy` im Ordner `worker/` taucht die Sprache in der App unter „Sprachen verwalten“ auf. Mit dem nächsten App-Release steckt sie auch offline in der App.

## Am Code mitarbeiten

- `app/` ist einfaches JavaScript ohne Build-Schritt und ohne Abhängigkeiten. Die Dateien teilen sich einen globalen Gültigkeitsbereich und werden in der Reihenfolge aus `app/index.html` geladen.
- Vor jedem Pull Request `npm test` laufen lassen.
- Neue Daten, die die App an den Server schickt, bitte immer auch in [PRIVACY.md](PRIVACY.md) und im Datenschutztext der App (`PRIVACY_HTML` in `app/js/views.js`) beschreiben. Grundsatz: so wenig wie möglich, nichts Lesbares über Personen.

## Lizenz deiner Beiträge

Mit einem Beitrag stimmst du zu, dass Code unter der [MIT-Lizenz](LICENSE) und Inhalte in `packs/` unter [CC BY-SA 4.0](packs/LICENSE) veröffentlicht werden.
