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
| `snapshot-test.bat` | Legt de huidige toestand vast als nieuwe snapshot (`v1`, `v2`, …; een eigen naam kan met `snapshot-test.bat v3`). |
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
- Met 600 vulvideo's (1200 bestanden): snapshot 8 seconden, reset 9 seconden, daarna identiek.
- Na een reset is iedereen uitgelogd. Een open tabblad toont bij de volgende actie
  "Je sessie is verlopen. Log opnieuw in."; de tester moet dus opnieuw inloggen.

## Begintoestand (11-11-2026)

Uitgelezen uit `snapshots-usability\snapshot-v1\database.sql`, plus één wijziging daarna: de
taakvideo's en cursussen zijn van Mindlabs naar Nationale raad zwemveiligheid verplaatst (zie
open punten). Die wijziging zit nog niet in een snapshot.

### Accounts

De wachtwoorden zijn testwaarden en gelden alleen in deze lokale testomgeving.

| Account | Inloggen op | Gebruikersnaam / organisatiecode | Wachtwoord | Gebruik |
| --- | --- | --- | --- | --- |
| Beheerder | https://localhost:8443/admin/login | `beheer` | `Beheerwachtwoord` | Onderzoeker; taken in de beheeromgeving |
| Organisatie | https://localhost:8443/login | `NATIONALE-RAAD-ZWEMVEILIGHEID` | `Test123456` | Account van de tester |

### Organisaties (12, geen verwijderd)

Alle organisaties hebben het wachtwoord `Test123456`.

| Organisatie | Organisatiecode | Video's | Rol in de test |
| --- | --- | --- | --- |
| Nationale raad zwemveiligheid | NATIONALE-RAAD-ZWEMVEILIGHEID | 34 (23 vul + 11 taakvideo's) | Account van de tester; eigenaar van de taakvideo's en de cursussen |
| Yonder sport en beweging | YONDER-SPORT-EN-BEWEGING | 250 | Tester past de naam aan; organisatie met veel video's |
| Mindlabs | MINDLABS | 23 | Vulorganisatie |
| Fontys hogeschool | FONTYS-HOGESCHOOL | 23 | Vulorganisatie |
| Futures-lab | FUTURES-LAB | 23 | Vulorganisatie |
| Avans hogeschool | AVANS-HOGESCHOOL | 23 | Vulorganisatie |
| Zwembad veenendaal | ZWEMBAD-VEENENDAAL | 23 | Vulorganisatie |
| zwembad Oosterhout | ZWEMBAD-OOSTERHOUT | 23 | Vulorganisatie |
| Basischool de Westhoek | BASISCHOOL-DE-WESTHOEK | 23 | Vulorganisatie |
| Basischool de Rups | BASISCHOOL-DE-RUPS | 22 | Vulorganisatie |
| Basisschool de regenboog | BASISSCHOOL-DE-REGENBOOG | 22 | Vulorganisatie |
| Basisschool de regentes | BASISSCHOOL-DE-REGENTES | 22 | Vulorganisatie |

### Video's (511, geen verwijderd)

- **500 vulvideo's** uit `vul-videos-test.bat`: namen als "Kind onder water - peuterbad
  (avondsituatie)", willekeurig openbaar, selectief of privé, met grijze thumbnail; ze spelen
  niet af.
- **11 taakvideo's**, alle van **Nationale raad zwemveiligheid** en **privé** ("Alleen eigen organisatie"), elk 2 s:

| Groep | Video's |
| --- | --- |
| Taak 1, "Hulp in het diepe" | introductie · je springt meteen in · je slaat eerst alarm · je blijft kijken · afloop goed · afloop slecht |
| Bestaande cursus, "Toezicht bij de glijbaan" | overzicht · botsing onderaan · rustig ingrijpen |
| Half afgemaakte cursus, "Reanimatie aan de badrand" | melding · AED halen |

### Cursussen (2, beide concept, beide van Nationale raad zwemveiligheid)

**Toezicht bij de glijbaan** (bestaande cursus om aan te passen)

```text
[Start] Video "overzicht"
   └─ Vraag "Je ziet dat het fout gaat bij de glijbaan…"
        A "Ik grijp in" (goed) ─→ Video "rustig ingrijpen"   (einde)
        B "Ik wacht af"        ─→ Video "botsing onderaan"   (einde)
```

**Reanimatie aan de badrand** (half afgemaakte cursus)

```text
(geen startonderdeel)
Video "melding"
   └─ Vraag "Wat doe je met deze melding?"
        A "Je doet niks" (goed)         ─→ Video "AED halen"
        B "Je gaat meteen de AED halen" ─→ video-onderdeel zonder video
```

### Huisstijl

Geen enkele organisatie heeft een eigen huisstijl: overal staan de standaardkleuren en het
standaardlogo.

### Open punten bij snapshot v1

Controleren en zo nodig herstellen, daarna een nieuwe snapshot (`v2`):

- [x] **Taakvideo's en cursussen stonden bij Mindlabs, privé.** De tester logt in als Nationale
  raad zwemveiligheid en ziet ze dan niet: cursussen zijn per organisatie en privévideo's zijn
  alleen voor de eigenaar. **Besloten:** de tester blijft Nationale raad zwemveiligheid; de 11
  taakvideo's en beide cursussen zijn op 11-11-2026 in de database verplaatst (eigenaar van
  video 501–511 en van cursus 1 en 2 van Mindlabs naar Nationale raad zwemveiligheid). Ingelogd
  als de tester: beide cursussen staan in de lijst, de 11 video's zijn eigen video's (266
  zichtbaar in totaal) en alle video's in de cursussen zijn beschikbaar. Vastleggen in `v2`.
- [ ] **Tussenversies van de cursus uit taak 1** ("Hulp in het diepe") ontbreken; de video's
  zijn er wel.
- [ ] **Een paar cursussen om er één van te verwijderen** ontbreken.
- [ ] **Oude huisstijl** (oude kleuren en oud logo) is niet ingesteld bij de organisatie van de
  tester.
- [ ] **Half afgemaakte cursus:** antwoord A "Je doet niks" is als goed gemarkeerd en B "Je gaat
  meteen de AED halen" als fout. Klopt dat, of moet het andersom?
- [ ] **Tikfouten in de beschrijvingen** die testers te zien krijgen: "word" (wordt),
  "curus" (cursus), "reainamite" (reanimatie).
- [ ] *(Optioneel)* Taakvideo's van andere organisaties ("Hulp in het diepe: beeld vanaf de
  kant" van Yonder, algemeen beschikbaar; "Hulp in het diepe: onderwateropname" van Zwembad
  veenendaal, selectief voor Nationale raad zwemveiligheid), om te zien of de tester gedeelde
  video's vindt.

## Werkwijze tijdens het onderzoek

Eenmalig:

1. `start-test.bat` en daarna `maak-beheerder-test.bat`.
2. `vul-videos-test.bat` (één keer) en daarna de begintoestand aanvullen via het CMS op
   https://localhost:8443.
3. `snapshot-test.bat` (kiest zelf `v1`, `v2`, …), daarna `verify-test.bat` ter controle.

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
