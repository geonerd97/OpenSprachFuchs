# Sprachpakete

Jede Sprache ist eine JSON-Datei `<code>.json`. Die App lädt sie vom Backend und behält sie auf dem Gerät; eine Kopie aller Pakete steckt außerdem in der APK, damit die App offline startet. Ein Update erkennt die App an der SHA-256-Prüfsumme in `index.json`, eine Versionsnummer muss man nicht pflegen.

```bash
node tools/packs.mjs check    # prüfen
node tools/packs.mjs format   # in das Hausformat bringen (eine Zeile pro Wort/Satz, gut lesbare Diffs)
node tools/packs.mjs build    # prüfen und nach worker/public/packs/ bauen (mit index.json)
```

## Aufbau

```jsonc
{
  "format": 1,                       // Version dieses Formats
  "code": "fr",                      // = Dateiname
  "name": "Französisch", "short": "FR",
  "voice": "fr-FR",                  // Sprache für Sprachausgabe und Spracherkennung des Handys
  "color": "#8C3FC8",                // Farbe der Sprache in der App
  "note": "Französisch aus Frankreich",
  "articles": "^(le |la |les |un |une |l')",  // Artikel, die beim Wörter-Tippen weggelassen werden dürfen (RegExp, ohne Groß/klein)
  "gapSkip": ["le", "la", "je"],     // Wörter, die der Lückentext nie abfragt
  "glossary": { "et": "und" },       // häufige Wörter für „Wörter antippen“ in Sätzen
  "units": [
    {
      "id": "basics", "title": "Erste Worte", "level": "A1", "colors": ["#2456E8", "#1A3FB0"],
      "desc": "Grüßen, bitten, danken: die Wörter für jeden Tag.",
      "words": [
        {"id": "basics.w01", "de": "hallo", "t": ["bonjour", "salut"], "pic": "👋"}
      ],
      "sentences": [
        {"id": "basics.s01", "de": ["Hallo, wie geht es dir?", "Hallo, wie geht's?"], "t": "Bonjour, comment ça va?"}
      ]
    }
  ],
  "dialogs": [
    {
      "id": "restaurant", "title": "Im Restaurant", "em": "🍽️", "desc": "Tisch bekommen, bestellen und zahlen.",
      "turns": [
        {"p": {"de": "Guten Abend! Haben Sie reserviert?", "t": "Bonsoir! Vous avez réservé?"},
         "a": [{"de": "Nein, einen Tisch für zwei, bitte.", "t": "Non, une table pour deux, s'il vous plaît."},
               {"de": "…", "t": "…"}, {"de": "…", "t": "…"}]}
      ]
    }
  ]
}
```

## Regeln

- **`id`s sind fest.** Am `id` hängen Lernstufen, offene Fehler und Statistik der Spieler. Korrekturen ändern nur `de` und `t`. Neue Wörter bekommen die nächste freie Nummer, z. B. `basics.w14`.
- `t` (und bei Sätzen auch `de`) ist ein Text oder eine Liste `[Hauptlösung, Alternative, …]`. Alle Alternativen gelten als richtig; gezeigt wird die Hauptlösung.
- Jede Einheit braucht mindestens 4 Wörter. Bildaufgaben gibt es nur, wenn mindestens 4 Wörter ein Emoji (`pic`) haben.
- Satzzeichen nicht frei stehend schreiben („Ça va?“, nicht „Ça va ?“), sonst überspringt der Lückentext den Satz.
- Im Gespräch ist die erste der drei Antworten `a` die richtige; die App mischt sie.
- `level` ist eines von A1, A2, B1, B2, C1, C2.

Die Inhalte stehen unter [CC BY-SA 4.0](LICENSE).
