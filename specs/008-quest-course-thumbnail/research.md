# Research: Thumbnail per cursus in de Quest-API

Alle punten uit Technical Context zijn bekend; er waren geen open vragen. Hieronder staan de
ontwerpkeuzes, met de reden en de alternatieven die we hebben afgewogen. De code van feature 007
(`backend/src/modules/quest/`) is het uitgangspunt.

## R1. De afbeelding kiezen: één pure functie op de inhoud van de live versie

- **Decision**: Een nieuwe pure functie `thumbnailVideoId(steps, answers, videosById)` in
  `backend/src/modules/quest/questThumbnail.js` krijgt dezelfde gegevens die
  `buildQuestContent` al krijgt (de stappen en antwoorden uit `versionContents` en de video's uit
  `videoFiles`) en geeft het id van de video terug waarvan de thumbnail de cursusafbeelding is, of
  `null`. Werkwijze (spec FR-002–FR-004):
  1. Begin bij de stap met `isStart`. Geen startstap → `null`.
  2. Breedte-eerst zoeken met een wachtrij en een set bezochte stap-id's (elke stap één keer; een
     lus stopt vanzelf).
  3. Een video-onderdeel met een video die een `thumbnailStorageKey` heeft → klaar, dat is de
     video. Een video-onderdeel zonder video of zonder thumbnail → zet `nextCourseStepId` in de
     wachtrij en zoek verder.
  4. Een vraag → zet de `nextCourseStepId` van de antwoorden in de wachtrij, in volgorde van
     `sortOrder` (A–D). Antwoorden zonder volgende stap worden overgeslagen.
  5. Wachtrij leeg → `null`.

  Breedte-eerst met de antwoorden in volgorde A–D geeft precies "minste aantal stappen, bij gelijke
  afstand het eerdere antwoord" uit FR-003. Stappen die niet vanaf de start bereikbaar zijn, komen
  nooit in de wachtrij.
- **Rationale**: Een pure functie is met unit-tests volledig te toetsen (lus, gelijke afstand,
  onbereikbare stappen) zonder database. Omdat ze dezelfde invoer gebruikt als de cursusinhoud,
  kan de afbeelding nooit van een andere versie komen dan de inhoud (FR-001, FR-007).
- **Alternatives considered**:
  - *De keuze opslaan bij het publiceren* (een kolom op `CourseVersion`): sneller bij het
    ophalen, maar vraagt een migratie, een ERD-wijziging en een backfill voor alle al gepubliceerde
    versies. Afgewezen: de berekening is goedkoop (zie R4) en het ERD blijft liever gelijk
    (Clarifications).
  - *Diepte-eerst zoeken (altijd eerst antwoord A volgen)*: kan een video ver weg kiezen terwijl
    antwoord B direct naar een video gaat. Afgewezen: past niet bij "eerste video op de route".
  - *Recursief SQL (CTE) in de database*: lastig leesbaar en te testen, en de stappen staan voor
    de lijst toch al in het geheugen. Afgewezen.

## R2. Het veld `thumbnailUrl` in de inhoud en de lijst

- **Decision**: `buildQuestContent(version, contents, videosById)` krijgt een extra veld
  `thumbnailUrl`, direct na `publishedAt`:
  `/api/quest/v1/courses/<courseId>/thumbnail?v=<versionNumber>` als `thumbnailVideoId` een id
  geeft, anders `null`. `listCourses` neemt het veld over uit de inhoud, ook direct na
  `publishedAt`. `videoFiles` selecteert daarvoor ook `thumbnailStorageKey` (zonder filter op
  `deletedAt` of beschikbaarheid, zoals nu, FR-005).
- **Rationale**: De lijst bouwt de inhoud al op om `downloadSizeBytes` te berekenen (specs/007
  research R4). Doordat het veld in de inhoud zit, telt het automatisch mee in de bytes van de
  inhoud en blijft `downloadSizeBytes` volgens dezelfde definitie kloppen (FR-009), en zijn lijst
  en inhoud altijd gelijk (FR-007). De afbeelding zelf zit niet in `videos[]` en telt dus niet mee.
- **Alternatives considered**:
  - *Het veld alleen in de lijst toevoegen en apart berekenen*: dan kunnen lijst en inhoud
    uit elkaar lopen. Afgewezen.
  - *Een object `thumbnail: { url, fileSizeBytes }`*: geeft de app de grootte, maar die is niet
    nodig (een afbeelding van 1024×512 is klein) en het opvragen van de grootte op schijf kost een
    `stat` per cursus. Afgewezen; kan later binnen v1 als extra veld.

## R3. Het versienummer in het adres (`?v=`)

- **Decision**: Het adres bevat `?v=<versionNumber>` van de live versie (Clarifications). De route
  leest `req.query.v` niet: de afbeelding en de toegang hangen alleen af van de koppeling en de
  live versie op het moment van het verzoek (FR-010).
- **Rationale**: Een nieuw versienummer geeft een nieuw adres, zodat de app afbeeldingen per adres
  kan bewaren. Omdat `v` genegeerd wordt, breekt een oud adres nooit en kan `v` geen toegang geven
  tot een oudere versie.
- **Alternatives considered**: zie Clarifications (vast adres; `ETag`). Het versie-id
  (`CourseVersion.id`) in plaats van het nummer is afgewezen: het nummer staat al in het contract
  en is wat de app vergelijkt.

## R4. De afbeelding ophalen: `GET /courses/:courseId/thumbnail`

- **Decision**: Nieuwe functie `getCourseThumbnailKey(organisationId, courseId)` in
  `questService.js`: de live versie uit `questLiveVersions` (FR-015), daarna `versionContents` en
  `videoFiles` voor die ene versie, `thumbnailVideoId`, en de `thumbnailStorageKey` van die video.
  Geen live versie of geen afbeelding → `notFound()` (FR-012). De route in `questRoutes.js` valt
  achter `requireQuest` (dus `401 relink_required` zonder geldige koppeling, FR-011), gebruikt
  dezelfde `idParam` (verkeerde vorm → 404) en levert het bestand met de bestaande
  `sendStoredFile(res, key, { contentType: 'image/jpeg', cacheControl: 'private, max-age=0, must-revalidate' })`.
- **Rationale**: Hetzelfde patroon als `getVideoKey` en de videoroute van feature 007. Het kost
  drie kleine query's plus de query's van `questLiveVersions`; ruim binnen SC-005 (1 s).
- **Alternatives considered**:
  - *`Cache-Control: private, max-age=3600`* zoals de thumbnails in het CMS: dan kan een
    tussenliggende cache of de app een uur lang een afbeelding tonen van een cursus die intussen
    onpubliceerd is of na een vernieuwde koppelcode. Afgewezen voor de Quest (FR-014); met `?v=`
    in het adres kan de app zelf bewaren zonder dat de server dat toestaat.
  - *Doorverwijzen naar de bestaande CMS-route voor thumbnails*: die vraagt een CMS-sessie en
    controleert beschikbaarheid in de bibliotheek. Afgewezen.

## R5. nginx: geen wijziging

- **Decision**: Thumbnails staan in dezelfde opslag als video's (`thumbnails/<organisationId>/<uuid>.jpg`
  onder `VIDEOS_DIR`, specs/002 research R2). `getInternalUrl(key)` geeft daarvoor al een adres
  onder `/internal/videos/`, en die `internal` location bestaat in `nginx/default.conf` en
  `nginx/default.prod.conf`. `/api/` wordt al doorgestuurd. nginx en Docker Compose veranderen niet.
- **Rationale**: De CMS-thumbnails gebruiken deze weg al; constitutie III blijft gelden.
- **Alternatives considered**: een aparte `location /internal/thumbnails/`: geen voordeel, wel
  twee configuraties die gelijk moeten blijven. Afgewezen.

## R6. Bestaat het bestand nog?

- **Decision**: `thumbnailUrl` wordt bepaald uit de gegevens in de database
  (`thumbnailStorageKey`), zonder te controleren of het bestand op schijf staat. Ontbreekt het
  bestand, dan mislukt alleen het ophalen van de afbeelding, net als bij een ontbrekend videobestand
  (specs/007 Edge Cases). De opruimtaak (specs/002 FR-020a) wist een thumbnail pas als geen enkel
  onderdeel van een cursus nog naar de video verwijst, dus nooit zolang de video in een live versie
  zit (FR-005). Bij het verwijderen of onpubliceren van een cursus wordt geen bestand gewist; de
  afbeelding is dan alleen niet meer bereikbaar (FR-005a, Clarifications). Er komt geen code in de
  opruimtaak bij en geen nieuwe map op de VPS.
- **Rationale**: Een `stat` per cursus in de lijst kost tijd (SC-004) voor een situatie die alleen
  bij een fout in de opslag voorkomt.
- **Alternatives considered**: bij een ontbrekend bestand `thumbnailUrl: null` geven. Afgewezen om
  de reden hierboven.

## R7. Tests

- **Decision**:
  - *Unit* (`backend/tests/unit/questThumbnail.test.js`): `thumbnailVideoId` met start = video;
    start = vraag, video na antwoord B op afstand 1 en na antwoord A op afstand 2 (B wint); gelijke
    afstand (A wint); lus terug naar de start; onbereikbare video; geen video; video zonder
    thumbnail overgeslagen; video-onderdeel zonder video; geen startstap.
    `backend/tests/unit/questContent.test.js` uitbreiden met `thumbnailUrl` (met en zonder
    afbeelding).
  - *Integratie* (`backend/tests/integration/questThumbnail.test.js`): `thumbnailUrl` in lijst en
    inhoud gelijk en met het versienummer; ophalen geeft `image/jpeg` met de bytes van de juiste
    thumbnail; concept wijkt af van live; opnieuw gepubliceerd (nieuwe video en nieuw `v`); oud of
    onjuist `v` (genegeerd); video zacht verwijderd of beperkt (blijft); geen video op de route
    (`null` en 404); onpubliceerd, verwijderd (404, en het thumbnailbestand staat nog op schijf voor
    de bibliotheek, FR-005a), andere organisatie, niet bestaand, verkeerde id-vorm
    (404); zonder koppelcode en met een oude koppelcode na vernieuwen (401 `relink_required`);
    `downloadSizeBytes` = Σ video's + bytes van de inhoud (met `thumbnailUrl`); headers
    `Content-Type` en `Cache-Control`. `X-Accel-Redirect` zelf is al getoetst in
    `unit/sendStoredFile.test.js` en wordt in de handmatige rondgang via nginx gecontroleerd.
  - *Bestaande tests aanpassen*: `questCourses.test.js` (de lijst van velden krijgt
    `thumbnailUrl`), `questDownload.test.js` (het verwachte antwoord krijgt `thumbnailUrl`) en
    `unit/questContent.test.js`. Alle andere tests van feature 007 blijven ongewijzigd slagen
    (SC-003). `questPerformance.test.js` blijft de grens van 2 s toetsen (SC-004).
- **Rationale**: FR-016 vraagt API-tests voor alle gevallen. De keuze van de video is het lastigste
  deel en zit daarom apart in unit-tests.
- **Alternatives considered**: alleen integratietests: elk geval van de zoekregel vraagt dan een
  cursus in de database; trager en minder precies. Afgewezen.
