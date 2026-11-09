# Durchsicht der Sprachpakete (2026-11-09)

Durchgesehen von Claude (KI), nicht von Muttersprachlern. Ein Abgleich mit Lehrbüchern war nicht möglich (kein Zugriff, urheberrechtlich geschützt). Geprüft wurden alle Wörter, Sätze, Gesprächszeilen und Geschichten der Pakete EN, FR, ES, IT, PT, HR, DA, TR und NL auf Übersetzung, Grammatik, Rechtschreibung, Natürlichkeit und fehlende richtige Lösungen. Dazu kamen automatische Prüfungen: deutsche Texte gleich in allen Paketen, doppelte Alternativen, gleiche Wörter in einer Einheit, Satzzeichen, unübersetzte Einträge.

**Regeln:** Keine ID wurde geändert (vor und nach der Korrektur verglichen). Korrigiert wurden nur `t`, `de` und Alternativen; wo eine neue Formulierung zur Hauptlösung wurde, bleibt die alte meist als Alternative richtig. Für jedes neue Wort in Sätzen gibt es eine Tipp-Hilfe im Glossar. `npm test`: 0 Fehler.

| Paket | geänderte Einträge | neue Tipp-Hilfen | Qualität vorher |
|---|---|---|---|
| Dänisch | 83 | 6 | viele Artikelfehler und Infinitive mit „at“ |
| Türkisch | 56 | 29 | einige unidiomatische Sätze |
| Kroatisch | 34 | 15 | Satzstellung, Fälle, nur männliche Formen |
| Englisch | 26 | 7 | gut, einige steife Formulierungen |
| Niederländisch | 14 | 0 | sehr gut |
| Französisch | 12 | 9 | sehr gut |
| Italienisch | 8 | 3 | sehr gut, ein echter Fehler |
| Portugiesisch | 8 | 0 | sehr gut |
| Spanisch | 7 | 0 | sehr gut |

Zusätzlich in allen neun Paketen: deutscher Satz im Gespräch „Bestellen mit Allergie“ war falsch („Ist in der Soße Nüsse drin?“ → „Sind in der Soße Nüsse drin?“).

## Wichtigste Korrekturen

- **Italienisch:** `talk.s05`/`talk.s10` sagten „Ich spreche ein bisschen *Englisch*“ / „Wie sagt man das auf *Englisch*?“ mit *inglese*; in allen anderen Paketen steht die jeweilige Sprache. Jetzt „Italienisch“ / *italiano*.
- **Dänisch:** falsches Geschlecht (*et nederdel*, *et mode*, *en optog*, *et trappeopgang*, *en tilhørsforhold*), Stoffnamen mit unbestimmtem Artikel (*en regn*, *en sne*, *en tennis*, *en trafik*), rund 30 Verben mit „at“ als Hauptlösung (beim Tippen musste man „at“ mitschreiben; jetzt ohne, „at …“ bleibt richtig), „for koldt at bade“ → „for koldt til at bade“.
- **Türkisch:** „hala“ (Tante) statt „hâlâ“ (noch) bzw. „daha“ (noch dazu) in sieben Sätzen; „Davetiye için teşekkürler“ (Einladungskarte) → „Davetin için teşekkürler“; „Hafta sonuna kadar“ (bis zum Wochenende) → „Bu haftanın sonuna kadar“ (bis Ende der Woche); „bu hapler“ → „bu haplar“ (Vokalharmonie); „güveniyor“ (vertraut) für „setzt auf“ → „ağırlık veriyor“.
- **Kroatisch:** „pečeno janjetina“ → „pečenu janjetinu“; „Voliš li baviti se sportom?“ → „Voliš li se baviti sportom?“ (Wortstellung); „Jučer je bilo velike svađe“ → „Jučer je bila velika svađa“; weibliche Formen als richtige Antworten ergänzt (*napravila*, *dobila*, *kupila* …).
- **Französisch:** „dritte Klasse“ war *classe de troisième* (in Frankreich die 9. Klasse) → *CE2*; „Ich werde zwanzig“ war *J'ai vingt ans* → *Je vais avoir vingt ans*.
- **Portugiesisch:** *compromisso* heißt in Brasilien „Termin/Verpflichtung“, nicht „Kompromiss“ → *acordo* / *meio-termo*.
- **Englisch:** „I am in the third class“ → „I am in third grade“, „I am writing a test tomorrow“ → „I have a test tomorrow“, „The vote had a clear majority“ → „There was a clear majority in the vote“ u. a.
- **Gespräch „Mit Adresse zum Hotel“** (alle Sprachen geprüft): „Klimaanlage etwas kühler stellen“ war in mehreren Sprachen als „herunterdrehen“ übersetzt (mehrdeutig, eher „weniger kühlen“); jetzt eindeutig „kühler“.

## Zweifelsfälle für Muttersprachler

Diese Einträge habe ich nicht oder nur vorsichtig geändert; hier lohnt ein Blick von jemandem, der die Sprache spricht.

**Türkisch**
- `family.w11` die Ehefrau = „karı“: Wörterbuchwort, klingt allein aber oft derb; „eş“ und „hanım“ sind als Alternativen ergänzt. Hauptlösung festlegen.
- `time.w15` die Uhr = „kol saati“ (Armbanduhr); „saat“ als Alternative ergänzt, steht in derselben Einheit aber auch für „die Stunde“.
- `weather.w10` / `nature.w09` Gewitter = „fırtına“ (eigentlich Sturm); genauer wäre „gök gürültülü fırtına“.
- `travelrights.w11` der Ersatz = „yenisi“ (der/das Neue) – passt im Satzzusammenhang, als Einzelwort fraglich.
- `plans.s05` „Ich lade dich ein“ jetzt „Ben ısmarlıyorum“ (ich zahle); gemeint sein kann auch „Seni davet ediyorum“ (beides richtig).

**Dänisch**
- `describe.s07` Opa: „bedstefar“ als Hauptlösung, „morfar“/„farfar“ als Alternativen.
- `taxi-address` Klimaanlage: „skrue lidt op for airconditionen“ – prüfen, ob das eindeutig „kühler“ heißt.
- Mehrere Abstrakta stehen mit unbestimmtem Artikel (*en migration*, *en integration*, *en mangfoldighed*); grammatisch möglich, als Vokabel ungewohnt.

**Kroatisch**
- Viele Sätze haben nur die männliche Form (*Htio bih …*, *Zaboravio sam …*); bei den häufigsten ist die weibliche ergänzt, bei anderen nicht.
- `healthcare.w07` Sprechstunde jetzt „vrijeme primanja“ (vorher „ordinacija“ = Praxis).
- `airport.s09` „Haben Sie etwas zu verzollen?“ jetzt „Imate li nešto za carinjenje?“; die alte Form („za prijaviti“) gilt als umgangssprachlich und bleibt als Alternative.

**Englisch**
- Das Paket mischt amerikanische und britische Wörter (*neighbour*, *letterbox*, *colour* neben *apartment*, *trash*, *math*). Alternativen decken meist beides ab; eine Entscheidung für eine Variante wäre sauberer.

**Französisch**
- `healthcare.w05` Überweisung (ärztlich) jetzt „la lettre d'orientation“ (vorher „l'adressage“, ungebräuchlich).

**Italienisch**
- `healthcare.w01` Krankenkasse: „la cassa malattia“ gibt es in Italien nicht (Schweiz); jetzt „l'assicurazione sanitaria“ / „il servizio sanitario“.

**Spanisch, Niederländisch, Portugiesisch:** keine offenen Zweifel; die Änderungen sind kleine Verbesserungen und zusätzliche richtige Lösungen.

## Nicht geprüft

- Die Glossare (Tipp-Hilfen, zusammen rund 17.000 Einträge) nur stichprobenartig; neue Einträge sind ergänzt.
- Kölsch und Schweizerdeutsch (nicht Teil dieser Durchsicht).
- Aussprache/Stimme in der App.
