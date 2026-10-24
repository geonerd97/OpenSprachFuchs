# Datenschutzhinweis

OpenSprachFuchs erhebt nur, was für Sicherung und Freunde nötig ist. Es gibt keine Werbung, kein Tracking, keine Analyse- oder Absturzdienste und keine Schriftarten oder Skripte von Dritten. Dieser Text steht in kürzerer Form auch in der App (Profil → Datenschutz).

**Verantwortlich** für das Backend unter `opensprachfuchs.opensprachfuchs.workers.dev`: Martin Reger, E-Mail: opensprachfuchs(at)gmx.net

Wer OpenSprachFuchs mit einem eigenen Backend betreibt, ist dafür selbst verantwortlich und trägt seine Angaben hier und in `app/js/config.js` (`OPERATOR`) ein.

## Ohne Konto

Alles bleibt auf deinem Handy: Fortschritt, Einstellungen und die Sprachpakete. Der Server wird nur angefragt, um neue Versionen der Sprachpakete zu finden. Dabei werden keine Daten über dich übertragen.

## Mit Konto

Ein Konto ist ein zufälliger Schlüssel (16 Zeichen), den nur dein Handy kennt. Aus ihm leitet die App zwei Dinge ab:

- einen **Zugangscode**, mit dem sie sich beim Server meldet. Der Server speichert nur dessen SHA-256-Prüfsumme.
- einen **AES-Schlüssel**, mit dem sie den Spielstand verschlüsselt, bevor er hochgeladen wird. Der Server kann ihn nicht lesen.

Der Server speichert pro Konto:

| Angabe | Zweck |
|---|---|
| Prüfsumme des Zugangscodes | Anmeldung |
| verschlüsselter Spielstand und Zeitpunkt des Speicherns | Sicherung, Abgleich zwischen Geräten |
| öffentlicher Freundescode | Freundschaftsanfragen |
| letzter und vorletzter Lerntag (Datum) | gemeinsame Serien mit Freunden |
| Tag der Anlage und Tag der letzten Nutzung | automatisches Löschen unbenutzter Konten |

Für jede Freundschaft speichert er, wer mit wem befreundet ist, ob die Anfrage angenommen wurde, die gemeinsame Serie, an welchem Tag zuletzt ein Geschenk verschickt wurde und wie viele Geschenke noch ungeöffnet sind.

**Was Freunde sehen:**
- deinen Freundescode
- ob du heute gelernt hast
- eure gemeinsame Serie

Namen für Freunde vergibst du selbst. Sie liegen nur in deinem verschlüsselten Spielstand.

Es werden **keine** Namen, E-Mail-Adressen, Telefonnummern, Gerätekennungen oder Standortdaten erhoben.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO: Die Daten sind nötig, um die gewünschten Funktionen Sicherung und Freunde bereitzustellen.

## Fehlermeldungen

„Fehler melden“ schickt Folgendes an den Server, ohne Bezug zu deinem Konto:
- Sprache, Einheit und Aufgabe
- die erwartete Lösung
- deine Antwort und deine Notiz

Bitte schreib nichts Persönliches in die Notiz. Meldungen werden nach spätestens einem Jahr gelöscht.

## Technik und Dienstleister

- **Cloudflare** (Cloudflare, Inc., USA) betreibt den Server, also Worker und D1-Datenbank. Wie jeder Webserver verarbeitet Cloudflare dabei IP-Adressen, um die Anfragen auszuliefern und vor Missbrauch zu schützen; OpenSprachFuchs zählt Anfragen pro IP-Adresse für eine Minute (Rate Limiting) und speichert sie nicht. Cloudflare ist nach dem EU-US Data Privacy Framework zertifiziert. Mit Cloudflare ist ein Auftragsverarbeitungsvertrag abzuschließen (in den Cloudflare-Einstellungen verfügbar).
- **GitHub** (GitHub, Inc., USA): Ist im Code ein Repository eingetragen, fragt die App beim Start, höchstens alle 6 Stunden, bei GitHub nach einer neuen Version. GitHub sieht dabei deine IP-Adresse. Das lässt sich in den Einstellungen abschalten.
- **Sprachausgabe und Spracherkennung** erledigen die Dienste deines Handys, z. B. von Google. Für sie gelten deren Datenschutzbestimmungen.

## Speicherdauer und Löschen

- **Konto löschen:** unter Profil → Konto. Spielstand, Freundschaften und gemeinsame Serien werden sofort vom Server gelöscht.
- **Automatisch:** Konten, die 12 Monate nicht genutzt wurden, löscht der Server selbst.
- **Auf dem Handy:** „Abmelden“ oder das Deinstallieren der App entfernt alle Daten vom Gerät.

## Deine Rechte

Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.

Weil der Server nicht weiß, wer hinter einem Konto steckt, kann eine Auskunft nur mit deinem Schlüssel erfolgen. Die schnellste Löschung ist „Konto löschen“ in der App.
