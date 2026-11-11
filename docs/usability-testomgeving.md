# Usability-testomgeving

Een aparte kopie van het CMS voor usability tests, met een vaste begintoestand die met één
commando terug te zetten is. De ontwikkelomgeving blijft er helemaal buiten.

## Hoe de scheiding werkt

- De testomgeving draait als apart Docker Compose-project met de naam `usability`. Daardoor
  krijgt ze eigen containers, een eigen netwerk en eigen opslag: `usability_db-data` (database),
  `usability_uploads` (logo's) en `usability_videos` (video's en thumbnails). De
  ontwikkelomgeving gebruikt `contentmanagementsysteem_db-data` enz.; die worden nooit geraakt.
- In `docker-compose.yml` staat geen vaste `container_name` en alle opslag is een *named
  volume* (geen map in het project). Daarom is de projectnaam genoeg voor de scheiding.
- Alleen de poorten zouden botsen (beide willen 80 en 443). `docker-compose.usability.yml`
  zet de testomgeving daarom op **https://localhost:8443**. Dev en test kunnen tegelijk draaien.
- De app-versie ligt vast: de images worden één keer gebouwd. Code die je daarna wijzigt,
  komt pas in de testomgeving met `start-test.bat --build`.

## De scripts

Alle scripts staan in de hoofdmap van het project en kunnen met een dubbelklik of vanuit een
opdrachtprompt worden gestart.

| Script | Wat het doet |
| --- | --- |
| `start-test.bat` | Start de testomgeving en werkt de databasestructuur bij als dat nodig is. |
| `stop-test.bat` | Stopt de testomgeving; alle gegevens blijven bewaard. |
| `snapshot-test.bat v1` | Legt de huidige toestand vast als snapshot `v1`. |
| `reset-test.bat` | Zet de testomgeving terug naar de actieve snapshot. |
| `verify-test.bat` | Controleert of de testomgeving exact gelijk is aan de snapshot. |
| `maak-beheerder-test.bat` | Maakt een beheeraccount aan in de testomgeving. |
| `vul-videos-test.bat` | Voegt ±500 vulvideo's toe (unieke namen, willekeurig openbaar/selectief/privé; de helft bij Yonder). Eén keer uitvoeren: elke keer komen er video's bij. De vulvideo's hebben een grijze thumbnail en spelen niet af. |

### snapshot-test.bat (een momentopname maken)

1. Zet de app even stil, zodat er tijdens het kopiëren niets verandert.
2. Schrijft de hele database weg naar een tekstbestand (`database.sql`): alle accounts,
   organisaties, video-gegevens, cursussen met vragen en antwoorden, huisstijl en het actielog.
   Inlogsessies worden bewust niet bewaard.
3. Pakt alle geüploade logo's in één bestand in (`uploads.tar`).
4. Pakt alle video's en thumbnails in één bestand in (`videos.tar`). Half afgemaakte uploads
   horen niet bij de begintoestand en worden overgeslagen.
5. Start de app weer en onthoudt deze snapshot als de *actieve* snapshot.

Elke snapshot krijgt een versienaam (`snapshot-v1`, `snapshot-v2`, ...) in de map
`snapshots-usability\`. Een bestaande versie wordt nooit overschreven, zodat je altijd terug
kunt naar een eerdere versie.

### reset-test.bat (terugzetten)

1. Vraagt ter bevestiging J/N (overslaan met `reset-test.bat /y`).
2. Zet de app even stil.
3. Gooit de database van de testomgeving helemaal weg en bouwt hem opnieuw op uit
   `database.sql`. Alles wat een tester heeft aangemaakt, gewijzigd of verwijderd is daarna
   weer zoals in de snapshot.
4. Maakt de opslag voor logo's en video's helemaal leeg en zet de bestanden uit de snapshot
   terug. Een logo of video die de tester heeft geüpload, is daarna weg; een verwijderde
   video is terug.
5. Start de app weer.

Met `reset-test.bat v1` ga je naar een specifieke versie; die wordt dan de actieve snapshot.

### verify-test.bat (controleren)

Maakt een nieuwe database-dump en vergelijkt die byte voor byte met de dump in de snapshot.
Van elk logo-, video- en thumbnailbestand berekent het een vingerafdruk (MD5) en vergelijkt
die met de bestanden in de snapshot. Uitkomst: "identiek" of een lijst met verschillen.

## Gemeten (test met 1 organisatie, 30 video's, 5 cursussen, 1 logo)

- Snapshot maken: ongeveer 8–9 seconden.
- Reset: 8–12 seconden. Met echte, grote videobestanden duurt stap 4 langer (de bestanden
  worden gekopieerd); meet dit opnieuw met je eigen begintoestand.
- Na een reset gaf `verify-test.bat` "identiek" voor database, logo's en video's.
- Na een reset is iedereen uitgelogd. Een open tabblad toont bij de volgende actie
  "Je sessie is verlopen. Log opnieuw in."; de tester moet dus opnieuw inloggen.

## Werkwijze tijdens het onderzoek

Eenmalig:

1. `start-test.bat` en daarna een beheerder aanmaken (de opdracht staat in de uitvoer).
2. De begintoestand vullen via het CMS op https://localhost:8443.
3. `snapshot-test.bat v1`, daarna `verify-test.bat` ter controle.

Per tester:

1. `reset-test.bat /y`.
2. Browser opschonen (zie hieronder) en inloggen of het inlogscherm klaarzetten.

Midden in een test: `reset-test.bat /y`, de tester logt opnieuw in.

## Wat de reset níet terugzet

- **De browser.** De cursuseditor onthoudt de gekozen weergave in de browser
  (`localStorage`), en de browser kan ingevulde formulieren en wachtwoorden onthouden. Gebruik
  een apart browserprofiel voor de test en wis tussen testers de sitegegevens van
  `localhost:8443` (of het hele profiel). Accepteer de certificaatwaarschuwing vooraf in dat
  profiel, zodat de tester die niet ziet.
- **De bestanden op het bureaublad** die de tester zelf uploadt (die staan buiten de app).
- **De app-code.** Als je na het maken van een snapshot nieuwe code met een databasemigratie
  in de testomgeving zet, past de oude snapshot daar niet meer bij. Maak dan een nieuwe
  snapshot.

Let op: cookies van `localhost` worden door browsers niet per poort gescheiden. Ben je in
hetzelfde browserprofiel ook in de ontwikkelomgeving (https://localhost) ingelogd, dan
verdringen die sessies elkaar. Ook daarom een apart browserprofiel.
