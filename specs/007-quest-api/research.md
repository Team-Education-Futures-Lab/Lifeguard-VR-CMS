# Research: Quest-API in het CMS

Alle punten uit Technical Context zijn bekend; hieronder staan de ontwerpkeuzes, met de reden en
de alternatieven die we hebben afgewogen.

## R1. Wat is een "koppeling"? De koppelcode zelf, zonder token, geheim of tabel

- **Decision**: De Quest stuurt de koppelcode eerst naar `POST /link` en bewaart hem daarna. Bij
  elk volgend verzoek stuurt hij de code mee als `Authorization: Bearer <koppelcode>`. De
  middleware `requireQuest` trimt de code, zet hem in hoofdletters en zoekt een niet-verwijderde
  organisatie met die `questLinkCode` (één query op een unieke index). Wordt er een gevonden, dan
  komt `req.quest = { organisationId }`; anders volgt `401 relink_required`. Na het vernieuwen van
  de code of het verwijderen van de organisatie klopt de bewaarde code niet meer, dus de Quest is
  direct afgesloten (FR-004, SC-005). Er is niets dat kan verlopen (FR-005).
- **Rationale**: Wie de koppelcode heeft, kan toch al koppelen; een apart token geeft dus niet
  meer of minder toegang dan de code. Deze aanpak heeft geen geheim in `.env` nodig, geen tabel,
  geen ERD-wijziging en geen opruimwerk (Clarifications). `POST /link` blijft bestaan, zodat de app
  de code bij het invoeren kan controleren en de naam van de organisatie kan tonen.
- **Alternatives considered**:
  - *Ondertekend token met `QUEST_TOKEN_SECRET` in `.env`* (eerste versie van dit plan): de server
    ondertekent `organisatie-id + koppelcode` met een geheime sleutel. Dit voegt alleen toe dat de
    koppelcode niet leesbaar op de Quest staat. Daarvoor is wel een extra geheim nodig, en als dat
    geheim verandert, moeten alle Quests opnieuw koppelen. Afgewezen: het team wil geen extra
    `.env`-instellingen, en de toegang is dezelfde.
  - *Tabel `QuestLink` met gehashte willekeurige tokens* (zoals `Session`): maakt het later
    mogelijk om één Quest af te sluiten, maar dat valt buiten scope. Het vraagt een nieuwe tabel in
    het ERD. Kan later worden toegevoegd: dan geeft `POST /link` een token terug en accepteert
    `requireQuest` dat naast de code.
- **Gevolg**: De koppelcode staat in de opslag van de Quest-app. Dat is acceptabel: een Quest die
  in verkeerde handen valt, sluit de organisatie af door een nieuwe code te maken (FR-018). In
  logregels wordt de `Authorization`-header nooit gelogd.

## R2. De koppelcode normaliseren en controleren

- **Decision**: De invoer wordt getrimd en in hoofdletters gezet en daarna exact vergeleken met
  `Organisation.questLinkCode` van een niet-verwijderde organisatie. Een loginCode, een onbekende
  code of de code van een verwijderde organisatie krijgen allemaal `401 invalid_link_code` met
  hetzelfde bericht (FR-002). Een code met een verkeerde vorm (leeg, te lang) krijgt hetzelfde
  antwoord, zodat de vorm niets prijsgeeft. Er komt geen afremming (Clarifications).
- **Rationale**: Dit sluit aan bij feature 001 (8 tekens, alfabet zonder I/L/O/U). Een uniforme
  fout voorkomt dat iemand kan opmaken welke codes bestaan.
- **Alternatives considered**: Ook streepjes of spaties in de code weghalen. Dat is niet nodig,
  want de app toont de code zonder scheidingstekens.

## R3. Eén plek voor "welke cursussen ziet deze Quest"

- **Decision**: Een nieuwe functie `questLiveVersions(organisationId, trx)` in
  `backend/src/modules/quest/questCatalog.js`:
  1. de cursus-id's uit `OrganisationCourse` voor deze organisatie, nu met `isOwner = true`;
  2. `liveVersions(courseIds)` uit feature 006 (niet verwijderd, gepubliceerd en niet
     onpubliceerd, hoogste versie).

  Uitkomst: `Map courseId → live versie`. De lijst, het downloaden (`courseId` moet in de map
  zitten, anders `404`) en de videotoegang (de video moet in een van deze versies zitten) roepen
  alleen deze functie aan (FR-006).
- **Rationale**: `liveVersions` is al "de enige definitie van live" (specs/006 research R1).
  `OrganisationCourse` is volgens het ERD al de koppeltabel voor overgenomen cursussen (FR-12).
  Voor FR-12 hoeft later alleen stap 1 te veranderen: `isOwner = false` toestaan en een
  overgenomen cursus naar de live versie van de originele cursus laten wijzen (`parentCourseId`).
  Lijst, download en videotoegang blijven dan ongewijzigd (FR-008).
- **Alternatives considered**: `ownCoursesQuery` hergebruiken. Die vraag is vastgemaakt aan het
  concept en aan `isOwner = true` en bedient de editor; de Quest gaat over live versies. Een losse
  functie houdt beide betekenissen gescheiden.

## R4. Vorm van de cursusinhoud en de downloadgrootte

- **Decision**: De inhoud is één JSON-document per cursus (zie contracts/quest-api.md):
  cursusgegevens, `startStepId`, `steps[]` (id, type, videoId of questionText/feedback,
  nextStepId), `answers` per vraag (id, text, isCorrect, nextStepId) en
  `videos[]` (id, fileSizeBytes, durationSeconds, url), elke video één keer. De id's zijn de
  database-id's van de vastgezette versie; die veranderen nooit meer (specs/006 FR-004). Video-id's
  zijn `Video.id` en gelden over alle cursussen heen, zodat de app een video maar één keer hoeft op
  te slaan (FR-04-VR).
  `downloadSizeBytes = Σ fileSizeBytes (unieke video's) + bytelengte van de UTF-8 JSON-inhoud`.
  De inhoud wordt door één functie (`buildQuestContent`) opgebouwd en geserialiseerd. De lijst
  gebruikt diezelfde functie, zodat de grootte en de download altijd overeenkomen (FR-010, SC-006).
- **Rationale**: Deterministisch en controleerbaar. Voor 100 cursussen zijn dat drie queries
  (`versionContents` voor alle live versies samen, plus één query voor de grootte van de video's).
- **Alternatives considered**: alleen de video's tellen. Dat is eenvoudiger, maar voldoet niet aan
  FR-010. De grootte als kolom opslaan bij publiceren: een schemawijziging plus een migratie voor
  bestaande versies, en het formaat kan later veranderen.
- **Feedback**: in het datamodel staat feedback per vraagonderdeel (`CourseStep.feedback`), niet
  per antwoord. De download volgt het datamodel: `feedback` hoort bij de vraag (spec,
  Clarifications 2026-11-24).

## R5. Toegang tot video's voor de Quest

- **Decision**: `GET /api/quest/v1/videos/:id`: `requireQuest` → `questLiveVersions` → staat
  `videoId` in een van die versies? (één query: `CourseStep` met `courseVersionId IN (…)` en
  `videoId = ?`) → `Video.storageKey` ophalen, **zonder** filter op `deletedAt` of zichtbaarheid
  (constitutie V, FR-014) → `sendStoredFile(res, key, { contentType: 'video/mp4', cacheControl:
  'private, max-age=0, must-revalidate' })`. In alle andere gevallen `404 not_found`.
- **Rationale**: Dit is hetzelfde patroon als bij de thumbnails (specs/002 R8). nginx beantwoordt
  `Range`-verzoeken zelf op de interne locatie, dus hervatten werkt (FR-015, SC-008). Zonder nginx
  ondersteunt Express `res.sendFile` ook `Range`.
- **Alternatives considered**: ondertekende, tijdelijke video-URL's (secure_link-module). Dan
  hoeft de API niet bij elk deelverzoek te controleren, maar het is meer nginx-configuratie, er
  komt een tweede geheim bij en de toegang is moeilijker in te trekken. Elk deelverzoek kost nu één
  korte controle; dat is acceptabel.
- **Ontbrekend bestand**: nginx geeft 404 en legt het vast in zijn foutlog; de API logt niets; in ontwikkeling geeft de API 500
  via de errorHandler. In beide gevallen blijven de lijst en de inhoud werken (edge case). In
  quickstart.md staat hoe je dit controleert.

## R6. Plaats in de Express-app en nginx

- **Decision**: In `app.js` wordt `app.use('/api/quest/v1', express.json({ limit: '10kb' }),
  questRoutes)` gemount **vóór** `app.use('/api', …, cookieParser(), csrf, session)`. Zo leest
  de Quest-API nooit cookies en vraagt hij niet om de CSRF-header (de koppelcode staat in een
  header, niet in een cookie, dus CSRF speelt niet). `questRoutes` gebruikt `requireQuest` voor alles behalve `POST /link`.
  Een onbekende route onder `/api/quest/v1` krijgt een `404` in JSON (`notFoundHandler`).
  nginx: `location /api/` stuurt alles al door en `/internal/videos/` bestaat al; er is geen
  wijziging nodig.
- **Rationale**: Gescheiden toegang (FR-003). Een CMS-cookie geeft geen toegang, omdat
  `requireQuest` alleen de `Authorization`-header leest. Een koppelcode in de header geeft geen
  toegang tot het CMS, omdat `session` alleen de cookie leest.
- **Versie**: `/v1` in het pad (FR-020). Een wijziging die bestaande apps breekt, krijgt `/v2`;
  velden toevoegen mag binnen v1.

## R7. Foutcodes voor de Quest

| Situatie | HTTP | `code` | `message` (NL) |
|---|---|---|---|
| Ongeldige koppelcode (FR-002) | 401 | `invalid_link_code` | "Deze koppelcode klopt niet. Controleer de code in het CMS." |
| Geen, onbekende of vernieuwde koppelcode in de header (FR-004) | 401 | `relink_required` | "Deze Quest is niet meer gekoppeld. Koppel opnieuw met de koppelcode." |
| Cursus of video niet zichtbaar of niet bestaand (FR-013, FR-014) | 404 | `not_found` | "Niet gevonden." |
| Ongeldige body bij koppelen | 401 | `invalid_link_code` | (zie boven) |

De vorm is dezelfde als in de bestaande API: `{ error: { code, message } }`. De app beslist op `error.code`.

## R8. Koppelcode vernieuwen in het CMS

- **Decision**: `GET /api/organisation/quest-link` geeft `{ questLinkCode }` terug.
  `POST /api/organisation/quest-link/renew` maakt een nieuwe code met de bestaande
  `generateUniqueQuestLinkCode` (uniek over loginCodes en questLinkCodes, ook van verwijderde
  organisaties), zet die met `UPDATE … WHERE id = ? AND deletedAt IS NULL` en geeft
  `{ questLinkCode }` terug. Lukt de unieke index toch niet (`ER_DUP_ENTRY`, een race), dan wordt
  het tot 3 keer opnieuw geprobeerd. Het organisatie-id komt alleen uit de sessie (FR-019).
- **Rationale**: Dit sluit aan bij de bestaande organisatieroutes en houdt de admin-routes
  ongemoeid. De CSRF-header geldt hier gewoon (CMS-route).
- **Alternatives considered**: de code meesturen in `GET /api/organisation`. Die route wordt bij
  elke pagina geladen en de code hoort alleen op de eigen pagina.

## R9. Frontend: pagina "Quest koppelen"

- **Decision**: Een route `/quest` met `QuestLinkView.vue` en een menu-item "Quest koppelen" na
  "Huisstijl". De pagina toont de code groot en in een monospace-letter, met tekens die goed uit
  elkaar te houden zijn, en heeft een knop "Kopiëren", een korte uitleg in eenvoudige taal (NFR-03)
  en de knop "Nieuwe koppelcode maken", die een `Modal` opent. Alle teksten staan letterlijk in
  [contracts/organisation-api.md](contracts/organisation-api.md) (Frontend-teksten); dat contract
  is leidend.
- **Rationale**: Clarifications (eigen pagina) en SC-007. De bestaande `Modal` geeft dezelfde
  bevestigingsstijl als bij publiceren.

## R10. Tests

- **Unit**: `buildQuestContent` (vorm, unieke video's, grootte gelijk aan de bytelengte, geen
  posities); het normaliseren van de koppelcode (trimmen, hoofdletters, verkeerde vorm).
- **Integratie (Supertest)**: koppelen (geldig, kleine letters en spaties, loginCode, verwijderde
  organisatie, onbekend); lijst (alle statussen uit SC-004, andere organisatie, leeg); download
  (inhoud gelijk aan de live versie, concept gewijzigd na publiceren, 404's); video's (live wel,
  concept, oude versie of bibliotheek niet, zacht verwijderd of beperkt in de live versie wel,
  `Range` geeft 206 in de modus zonder nginx); vernieuwen (de oude code als sleutel en bij koppelen
  geweigerd, de nieuwe werkt, andere organisatie ongemoeid); scheiding (een CMS-cookie op een
  Quest-route → 401, een koppelcode in de header op een CMS-route → 401). Daarbij steeds de
  controle dat de grootte overeenkomt (SC-006).
- **e2e (Playwright)**: valt buiten de taken van deze feature; het team schrijft deze tests zelf
  (Clarifications). quickstart.md beschrijft de handmatige rondgang via nginx die als basis kan
  dienen.
