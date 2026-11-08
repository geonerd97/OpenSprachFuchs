# Sprachpakete

Jede Sprache ist eine JSON-Datei `<code>.json`. Die App lädt sie vom Backend und behält sie auf dem Gerät; eine Kopie aller Hauptsprachen steckt außerdem in der APK, damit die App offline startet (Dialekte nicht, siehe [Dialekte](#dialekte-format-2)). Ein Update erkennt die App an der SHA-256-Prüfsumme in `index.json`, eine Versionsnummer muss man nicht pflegen.

```bash
node tools/packs.mjs check    # prüfen
node tools/packs.mjs format   # in das Hausformat bringen (eine Zeile pro Wort/Satz, gut lesbare Diffs)
node tools/packs.mjs build    # prüfen und nach worker/public/packs/ bauen (mit index.json)
node tools/packs.mjs bundle <Ordner> [--dialects]   # die Pakete für die APK (macht Gradle selbst)
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
  "glossary": { "et": "und" },       // Wörter für „Wörter antippen“ in Sätzen (Sprache → Deutsch, rückwärts auch Deutsch → Sprache)
  "glossaryDe": { "einen": "un" },   // deutsche Wörter, die das Glossar rückwärts nicht abdeckt (Deutsch → Sprache)
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
  ],
  "stories": [                       // Kurzgeschichten für die Sonderstation einer Einheit
    {
      "id": "food.story", "unit": "food", "title": "Im Café", "em": "☕",
      "lines": [{"de": "Lena geht heute ins Café.", "t": "Aujourd'hui, Lena va au café."}],
      "questions": [{"q": "Wo ist Lena?", "a": ["Im Café", "Im Hotel", "Im Park"]}]
    }
  ]
}
```

## Angaben für eine neue Sprache

Eine neue Sprache braucht in der App keine Codeänderung: Die Datei `packs/<code>.json` wird gefunden, geprüft und in APK und Web-App gebaut. Diese Kopfangaben legt das Paket fest:

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `format` | ja | `1`, oder `2` für die Felder in [Dialekte](#dialekte-format-2) |
| `code` | ja | zwei oder drei Kleinbuchstaben, gleich dem Dateinamen |
| `name` | ja | deutscher Name der Sprache; steht im Hinweis „Keine Stimme für …“ („kann kein ‹name›“), muss also hinter „kein“ passen (Türkisch, Niederländisch) |
| `short` | ja | Kürzel, Großbuchstaben (`TR`, `NL`) |
| `voice` | ja | BCP-47-Tag (`nl-NL`) für Sprachausgabe und Spracherkennung; wird mit `Locale.forLanguageTag` an Android übergeben und im Browser als `SpeechSynthesisUtterance.lang` genutzt. Er bestimmt auch die Großschreibung in den Sonderstationen (`toLocaleUpperCase`) |
| `color`, `note` | ja | Farbe `#RRGGBB`, kurze Beschreibung |
| `articles` | nein | RegExp (ohne Groß/klein) für Artikel am Wortanfang; leer oder fehlend = Sprache ohne Artikel |
| `gapSkip` | ja (Liste, darf leer sein) | kleine Wörter, die der Lückentext nie abfragt: Artikel, Pronomen, Hilfsverben |
| `glossary`, `glossaryDe` | nein, aber nötig | Tipp-Hilfe (siehe unten); `game-test.js` verlangt für jedes Wort eine Hilfe |

**Was die App mit `articles` macht** (`content.js`, `exercises.js`, `games.js`):
- Beim Tippen eines einzelnen Wortes darf der Artikel fehlen (`bare`).
- Die Tipp-Hilfe speichert jedes Wort auch ohne Artikel.
- Lückentext, Wortsuche und Buchstabensalat nehmen nur das Wort ohne Artikel.
- Der Ausdruck wird nur am Anfang geprüft; er muss deshalb mit `^` beginnen und jeden Artikel mit Leerzeichen oder Apostroph abschließen, sonst frisst er Wortanfänge (`^(de|het)` würde „dehydratie“ kürzen).
- Sprache ohne Artikel (Türkisch, wie Kroatisch): `"articles": ""`. Nomen stehen dann ohne Artikel im Paket.
- Steht der Artikel im Paket vor dem Nomen (Dänisch, Niederländisch), muss jede Form im Ausdruck stehen.

**`gapSkip`:** kleingeschrieben, genau so, wie das Wort im Satz steht. Die Angabe wirkt nur auf einzelne Wörter, nicht auf Wortgruppen.

**Tipp-Hilfe:** Jedes Wort in Sätzen, Gesprächen, Geschichten und in den deutschen Sätzen muss beim Antippen eine Übersetzung haben. Dafür braucht die App
- `glossary` mit allen Wortformen, die nicht schon als Vokabel vorkommen (Sprache → Deutsch, Schlüssel kleingeschrieben ohne Satzzeichen, Ausdrücke bis 5 Wörter),
- `glossaryDe` für deutsche Wörter, die das rückwärts gelesene Glossar nicht abdeckt.

Bei Sprachen mit vielen Wortformen (Türkisch mit Endungen, Niederländisch mit zusammengesetzten Wörtern) wird das Glossar entsprechend lang.

**Bekannte Eigenheiten der Antwortprüfung** (`norm` in `exercises.js`): Sie macht alles klein mit `toLowerCase()` (ohne Spracheinstellung), entfernt Satzzeichen und löst nur englische Kurzformen auf. Akzente werden beim Tippen toleriert (`plain`: Zerlegung und Entfernen der Zeichen U+0300–U+036F). Folgen:
- Türkisch: ç, ş, ğ, ö, ü gelten damit als Tippfehler-tolerant, **ı (punktloses i) zerfällt nicht** und zählt als ein Zeichen Abstand zu „i“; „İ“ wird zu „i̇“ (i mit Punkt), das nach dem Zerlegen wieder „i“ ergibt. Bei der Prüfung prüfen, ob „ı“/„i“ als richtig durchgehen soll.
- Niederländisch: „ij“ ist ein Digraph, keine Besonderheit für die Prüfung; `'t`, `'s`, `'n` laufen über die Apostroph-Normalisierung.

Beispiel für den Kopf eines niederländischen Pakets (ohne Inhalt, `units` bleibt leer, `check` meldet also bis zur Befüllung „keine Einheiten“):

```jsonc
{
  "format": 1,
  "code": "nl",
  "name": "Niederländisch", "short": "NL",
  "voice": "nl-NL",
  "color": "#F36C21",
  "note": "Niederländisch aus den Niederlanden",
  "articles": "^(de |het |een |'t )",
  "gapSkip": ["de", "het", "een", "ik", "je", "u"],
  "glossary": {},
  "glossaryDe": {},
  "units": [], "dialogs": [], "stories": []
}
```

Türkisch (`tr`, `tr-TR`, `"articles": ""`) hat im Kopf dieselben Felder, nur ohne Artikel; `gapSkip` enthält dort etwa Fragepartikel und Pronomen.

**Stimme auf dem Handy:** Die App fragt `TextToSpeech.isLanguageAvailable(Locale.forLanguageTag(voice))` ab. Fehlt die Stimme (`missing`) oder wird die Sprache nicht unterstützt (`none`), spricht die App nichts, Hörübungen werden zu Leseübungen, und im Lernweg erscheint „Keine Stimme für ‹name›“. Mit `missing` bietet der Knopf den Stimmen-Download an. `voice` sollte daher ein Tag sein, den Googles Sprachausgabe kennt (`tr-TR`, `nl-NL`).

## Regeln

- **`id`s sind fest.** Am `id` hängen Lernstufen, offene Fehler und Statistik der Spieler. Korrekturen ändern nur `de` und `t`. Neue Wörter bekommen die nächste freie Nummer, z. B. `basics.w14`.
- `t` (und bei Sätzen auch `de`) ist ein Text oder eine Liste `[Hauptlösung, Alternative, …]`. Alle Alternativen gelten als richtig; gezeigt wird die Hauptlösung.
- Jede Einheit braucht mindestens 4 Wörter. Bildaufgaben gibt es nur, wenn mindestens 4 Wörter ein Emoji (`pic`) haben.
- Satzzeichen nicht frei stehend schreiben („Ça va?“, nicht „Ça va ?“), sonst überspringt der Lückentext den Satz.
- Im Gespräch ist die erste der drei Antworten `a` die richtige; die App mischt sie.
- Sonderstationen: Hat eine Einheit eine Geschichte (`stories[].unit`), ist ihr fünfter Knopf diese Geschichte; sonst ein Minispiel aus den Wörtern der Einheit. Jede Frage hat genau drei Antworten auf Deutsch, die erste ist richtig. Bisher hat jede fünfte Einheit einer Stufe eine Geschichte.
- Gespräche können zu Kategorien gehören: `"group": "restaurant"` am Gespräch und oben im Paket `"dialogGroups": {"restaurant": {"title": "Im Restaurant", "em": "🍽️"}}`. Die App zeigt die Kategorien aufklappbar mit Fortschritt.
- `level` ist eines von A1, A2, B1, B2, C1, C2.

## Dialekte (Format 2)

Dialekte wie Kölsch oder Schweizerdeutsch haben oft keine feste Schreibweise und keine Stimme in der Sprachausgabe. Dafür gibt es `"format": 2`. Pakete mit Format 1 bleiben unverändert gültig; die neuen Felder sind alle freiwillig, aber **nur in Format 2 erlaubt** (`check` meldet sie sonst als Fehler). Apps bis Version 0.1.6 kennen nur Format 1 und bekommen Format-2-Pakete gar nicht erst angezeigt (siehe `index.json`).

| Feld | Wo | Bedeutung |
|---|---|---|
| `group` | Kopf | `"main"` (Standard, Liste „Sprachen“) oder `"dialects"` (Liste „Dialekte“) |
| `noTyping` | Kopf | `true`: keine Tipp-Aufgaben (Wort/Satz schreiben). Die App nimmt stattdessen Auswahl und Wortkarten; Sonderstationen ohne Geschichte sind Memory statt Wortsuche, Buchstabensalat und Wortraten |
| `noListen` | Kopf | `true`: keine Sprachausgabe, keine Hör- und Sprechaufgaben, keine Lautsprecher-Knöpfe, kein Hinweis „Keine Stimme für …“ |
| `speech` | Kopf | BCP-47-Tag nur für die Sprachausgabe, wenn er von `voice` abweichen soll (z. B. `"de-CH"`). Ohne Angabe gilt `voice` |
| `spellings` | Kopf | `true`: Die Alternativen in `t` sind andere Schreibweisen desselben Wortes. Die App zeigt sie als „auch geschrieben: …“ (sonst „auch: …“); beim Tippen gelten sie wie immer alle als richtig |
| `tr` | Wort, Satz, Gesprächs- und Geschichtszeile | Umschrift/Lesehilfe als Text, z. B. die Aussprache oder eine Schreibweise, die vom Standard abweicht. Steht klein unter dem Text (Wortkarte, Wortliste, „Was bedeutet …?“, Satz bauen ins Deutsche, Gespräche, Geschichten) |

**Stimme bei Dialekten:** `voice` bleibt der echte Tag der Sprache, er steuert auch die Großschreibung (`toLocaleUpperCase`). Kölsch hat den ISO-639-3-Code `ksh`, Schweizerdeutsch `gsw` (`gsw-CH`). Beide sind gültige BCP-47-Tags, aber weder Googles Sprachausgabe noch die üblichen Browser haben dafür eine Stimme. Die App erkennt das (Android: `none`, Browser: keine Stimme dieser Sprache in `speechSynthesis.getVoices()`) und zeigt „Keine Stimme für ‹name›“; Hörübungen werden dann zu Leseübungen. Mit `speech: "de-CH"` liest die App mit einer Stimme für Deutsch (Schweiz) vor, das ist allerdings Hochdeutsch und kein Schweizerdeutsch, und Android wie Browser nehmen auch eine andere deutsche Stimme, wenn es keine für die Schweiz gibt. Solange keine passende Stimme feststeht, ist `noListen: true` die ehrliche Wahl.

Kopf eines Dialekt-Pakets (ohne Inhalt):

```jsonc
{
  "format": 2,
  "code": "ksh",
  "name": "Kölsch", "short": "KSH",
  "voice": "ksh",
  "group": "dialects",
  "noTyping": true,
  "noListen": true,
  "spellings": true,
  "color": "#C8102E",
  "note": "Kölsch aus Köln",
  "articles": "",
  "gapSkip": [],
  "glossary": {}, "glossaryDe": {},
  "units": [ { "id": "basics", "…": "…",
    "words": [ {"id": "basics.w01", "de": "…", "t": ["Hauptschreibweise", "andere Schreibweise"], "tr": "Lesehilfe"} ] } ],
  "dialogs": [], "stories": []
}
```

Schweizerdeutsch sähe gleich aus mit `"code": "gsw"`, `"voice": "gsw-CH"`; die Kürzel `ksh`/`gsw` sind die Dateinamen (`ksh.json`, `gsw.json`).

**`index.json`:** Jeder Eintrag hat `group` und `format`. Pakete mit Format 1 stehen in `packs`, Pakete mit Format 2 in `packs2` (ältere Apps lesen nur `packs`). Die App führt beide Listen zusammen und zeigt sie in der Sprachauswahl nach Gruppen: „Sprachen“, dann „Dialekte“.

**APK:** Gradle baut mit `tools/packs.mjs bundle` einen eigenen Ordner mit eigenem `index.json` für `assets/packs/`. Darin sind alle Pakete der Gruppe `main`, Dialekte nur mit `./gradlew assembleDebug -PbundleDialects=true`. Die Hauptsprachen bleiben damit offline installierbar; Dialekte lädt die App vom Backend. Die Web-App bekommt wie bisher alle Pakete (`build`), lädt aber auch nur, was der Nutzer auswählt.

Die Inhalte stehen unter [CC BY-SA 4.0](LICENSE).
