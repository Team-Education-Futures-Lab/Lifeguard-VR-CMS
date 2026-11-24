---
description: "Takenlijst voor de feature Quest-API in het CMS"
---

# Tasks: Quest-API in het CMS

**Input**: Design documents from `/specs/007-quest-api/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/quest-api.md](contracts/quest-api.md),
[contracts/organisation-api.md](contracts/organisation-api.md), [quickstart.md](quickstart.md)

**Tests**: alleen unit- en integratietests van de backend (Vitest + Supertest tegen een echte
MariaDB), volgens research R10. Schrijf ze vóór de implementatie en controleer dat ze eerst
falen. **De e2e-tests (Playwright) schrijft het team zelf; ze staan niet in deze lijst** (spec
Clarifications 2026-11-24).

**Organization**: taken zijn gegroepeerd per user story, zodat elke story los te bouwen en te
testen is.

**Conventies** (constitution VI): code, commentaar, routes (`/api/quest/v1/link`, `/courses`,
`/videos`), velden (`linkCode`, `downloadSizeBytes`, `startStepId`, `nextStepId`) en foutcodes
(`invalid_link_code`, `relink_required`, `not_found`) zijn Engels. UI-teksten en `message` zijn
Nederlands, letterlijk zoals in [contracts/quest-api.md](contracts/quest-api.md), research R7 en
[contracts/organisation-api.md](contracts/organisation-api.md). Fouten hebben de bestaande vorm
`{ error: { code, message } }` (`backend/src/middleware/errorHandler.js`).

**Kernkeuzes** (research R1, R3, R5):
- De koppelcode zelf is de sleutel: `Authorization: Bearer <koppelcode>`. Er komt **geen** token,
  **geen** `.env`-sleutel, **geen** tabel en **geen** migratie.
- Welke cursussen een Quest ziet, staat **alleen** in `questLiveVersions(organisationId)` in
  `backend/src/modules/quest/questCatalog.js`. De lijst, de download en de videotoegang gebruiken
  niets anders.
- Video's: de API controleert alleen de toegang en roept `sendStoredFile` aan (`X-Accel-Redirect`
  in productie). Er wordt **niet** gefilterd op `Video.deletedAt`, `visibility` of `VideoAccess`.

**Bestaande code**: `liveVersions`, `versionContents` en `latestPublishedVersions` in
`backend/src/modules/courses/courseRepository.js`; `sendStoredFile` in
`backend/src/lib/sendStoredFile.js`; `generateQuestLinkCode` en `QUEST_LINK_ALPHABET` in
`backend/src/lib/codes.js`; `isCodeTaken` en `findActiveById` in
`backend/src/modules/organisations/organisationRepository.js`; de testhelpers in
`backend/tests/helpers/testApp.js` (`app`, `createOrganisationRow`, `agentWithSession`,
`createCourseRow`, `createPublishedVersionRow`, `createStepRow`, `createVideoRow` (schrijft een
bestand van 5 bytes, `"video"`), `softDeleteVideo`, `restrictVideo`); `Modal.vue` en
`OrganisationLayout.vue` in de frontend. Alle bestaande tests moeten groen blijven.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: kan parallel lopen (ander bestand, geen afhankelijkheid van onafgemaakte taken)
- **[Story]**: bij welke user story de taak hoort (US1–US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Startpunt vastleggen.

- [X] T001 Draai `npm test` in `backend/` en controleer dat de bestaande suite groen is vóór de wijzigingen. Er zijn geen nieuwe pakketten, migraties of `.env`-sleutels nodig (plan.md, research R1).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: De Quest-module, de middleware en de ene plek voor zichtbaarheid. Dit moet af zijn
voordat US1–US3 kunnen beginnen.

### Tests for Foundational

- [X] T002 [P] Breid `backend/tests/unit/codes.test.js` uit met `normalizeQuestLinkCode` en `isValidQuestLinkCode`. `" qz7k2m9x "` → `"QZ7K2M9X"`. Een niet-string → `""`. Geldig is alleen precies 8 tekens uit `QUEST_LINK_ALPHABET` (dus `"QZ7K2M9"`, `"QZ7K2M9XX"`, `"QZ7K2M9I"` en `"ZWEMBAD-A"` zijn ongeldig).

### Implementation for Foundational

- [X] T003 [P] Voeg `normalizeQuestLinkCode(value)` (trim + hoofdletters, een niet-string → `''`) en `isValidQuestLinkCode(code)` (`/^[0-9A-HJKMNP-TV-Z]{8}$/`, afgeleid van `QUEST_LINK_ALPHABET` en `QUEST_LINK_LENGTH`) toe aan `backend/src/lib/codes.js`.
- [X] T004 [P] Voeg aan `backend/src/lib/errors.js` toe: `invalidLinkCode()` → `AppError(401, 'invalid_link_code', 'Deze koppelcode klopt niet. Controleer de code in het CMS.')` en `relinkRequired()` → `AppError(401, 'relink_required', 'Deze Quest is niet meer gekoppeld. Koppel opnieuw met de koppelcode.')` (research R7).
- [X] T005 [P] Voeg `findActiveByQuestLinkCode(code, trx = db)` toe aan `backend/src/modules/organisations/organisationRepository.js`: `where({ questLinkCode: code }).whereNull('deletedAt')` en `.first('id', 'name')`.
- [X] T006 Maak `backend/src/middleware/requireQuest.js`. Lees **alleen** de `Authorization`-header (nooit cookies), verwacht `Bearer <code>`, normaliseer met `normalizeQuestLinkCode`, controleer met `isValidQuestLinkCode` en zoek de organisatie met `findActiveByQuestLinkCode`. Bij succes `req.quest = { organisationId, organisationName }`, anders `next(relinkRequired())`. Exporteer ook `getQuestOrganisationId(req)`, dat een Error gooit zonder `req.quest` (zelfde patroon als `getOrganisationId` in `requireOrganisation.js`). Log de header nooit (research R1).
- [X] T007 Maak `backend/src/modules/quest/questCatalog.js` met `questLiveVersions(organisationId, trx = db)`. Haal de `courseId`'s uit `OrganisationCourse` met `organisationId = :org AND isOwner = true` en geef `liveVersions(courseIds, trx)` terug (Map courseId → versie). Geef een lege Map als er geen cursussen zijn. Zet in commentaar dat dit **de enige plek** is voor "welke cursussen ziet deze Quest" (FR-006). Noteer ook wat FR-12 later hier verandert: `isOwner = false` toestaan en een overgenomen cursus via `parentCourseId` naar de live versie van het origineel laten wijzen (research R3, FR-008).
- [X] T008 Maak `backend/src/modules/quest/questRoutes.js` als `Router()` met als laatste middleware `notFoundHandler`, zodat een onbekende route onder `/api/quest/v1` een JSON-404 geeft en niet doorvalt naar de CSRF-controle. Koppel het in `backend/src/app.js` met `app.use('/api/quest/v1', express.json({ limit: '10kb' }), questRoutes)` **vóór** `app.use('/api', express.json(...), cookieParser(), csrf, session)`, met commentaar dat de Quest-API geen cookies, sessie of CSRF gebruikt (research R6, FR-003).

**Checkpoint**: Foundation klaar. `npm test` blijft groen.

---

## Phase 3: User Story 1 - Een Quest koppelen aan een organisatie (Priority: P1) 🎯 MVP

**Goal**: Een Quest controleert de koppelcode, krijgt de organisatie terug en kan daarna met de
code als sleutel verzoeken doen.

**Independent Test**: `POST /api/quest/v1/link` met de code van A geeft de naam van A, en
`GET /api/quest/v1/organisation` met die code als Bearer geeft 200. Een verzonnen code en de
loginCode geven `401 invalid_link_code`.

### Tests for User Story 1

- [X] T009 [P] [US1] Schrijf `backend/tests/integration/questLink.test.js` met `request(app)`, **zonder** CSRF-header. Gevallen:
  - een geldige code in kleine letters met spaties → 200 `{ linkCode: 'QZ7K2M9X', organisation: { id, name } }`;
  - de loginCode van A, een onbekende code, de code van een verwijderde organisatie (`createOrganisationRow({ deletedAt })`), een ontbrekende `linkCode`, `linkCode: 123` en een string van 60 tekens → allemaal 401 `invalid_link_code` met precies dezelfde `message` (FR-002);
  - `GET /api/quest/v1/organisation` met `Bearer <code>` → 200 `{ organisation: { id, name } }`, en met `bearer  <code in kleine letters> ` → ook 200;
  - zonder header, met `Basic …` en met een onbekende code → 401 `relink_required`;
  - na het zacht verwijderen van de organisatie → 401 `relink_required` (FR-004).
- [X] T010 [P] [US1] Schrijf `backend/tests/integration/questIsolation.test.js` (FR-003):
  - een geldige CMS-organisatiesessie (`agentWithSession`) zonder Bearer op `GET /api/quest/v1/organisation` → 401 `relink_required`;
  - `GET /api/organisation` met alleen `Authorization: Bearer <questLinkCode>` → 401 `not_authenticated`;
  - `GET /api/quest/v1/onbekend` **met** een geldige koppelcode als Bearer → 404 `not_found` (JSON);
  - `POST /api/quest/v1/onbekend` met een geldige koppelcode en zonder CSRF-header → 404, geen 403;
  - `GET /api/quest/v1/onbekend` **zonder** header → 401 `relink_required` (`requireQuest` staat vóór de `notFoundHandler`, T012).

### Implementation for User Story 1

- [X] T011 [US1] Maak `backend/src/modules/quest/questService.js` met `link(linkCode)`: normaliseer, controleer met `isValidQuestLinkCode` en zoek met `findActiveByQuestLinkCode`. Bij geen treffer `throw invalidLinkCode()`, anders `{ linkCode, organisation: { id, name } }`. Gebruik voor alle mislukte gevallen hetzelfde antwoord (research R2). Er komt geen afremming (spec Clarifications).
- [X] T012 [US1] Voeg routes toe in `backend/src/modules/quest/questRoutes.js`:
  - `POST /link` → `questService.link(req.body?.linkCode)`, zonder `requireQuest`;
  - `GET /organisation` met `requireQuest` → `{ organisation: { id, name } }` uit `req.quest`.

  Zet `router.use(requireQuest)` na `/link`, zodat alle volgende routes beschermd zijn.

**Checkpoint**: T009 en T010 slagen. Een Quest kan koppelen.

---

## Phase 4: User Story 2 - De lijst met gepubliceerde cursussen ophalen (Priority: P1)

**Goal**: Een gekoppelde Quest ziet precies de live cursussen van zijn organisatie, met naam,
beschrijving, versienummer, publicatiedatum en downloadgrootte.

**Independent Test**: Geef A een gepubliceerde cursus, een cursus met alleen een concept, een
onpubliceerde en een verwijderde cursus, en geef B een gepubliceerde cursus. `GET /courses` met de
code van A geeft precies één cursus, met de gegevens van de live versie.

### Tests for User Story 2

- [X] T013 [P] [US2] Schrijf `backend/tests/unit/questContent.test.js` voor `buildQuestContent` en `questContentBytes` (contracts/quest-api.md):
  - `steps` op id gesorteerd; een video-onderdeel `{ id, type: 'video', videoId, nextStepId }`; een vraag `{ id, type: 'question', questionText, feedback, answers }` met `answers` op `sortOrder` als `{ id, text, isCorrect, nextStepId }`;
  - `startStepId` is de stap met `isStart`;
  - `nextStepId: null` blijft `null`;
  - een video die in twee onderdelen zit, staat één keer in `videos` als `{ id, fileSizeBytes, durationSeconds, url: '/api/quest/v1/videos/<id>' }`;
  - geen `positionX`, `positionY`, `description` van een onderdeel, `courseVersionId` of `isStart` in de uitvoer;
  - `publishedAt` als ISO-string;
  - `questContentBytes(content) === Buffer.byteLength(JSON.stringify(content), 'utf8')`, ook met tekst die é en emoji bevat;
  - `downloadSizeBytes = Σ videos[].fileSizeBytes + questContentBytes`.
- [X] T014 [P] [US2] Schrijf `backend/tests/integration/questCourses.test.js` (SC-004):
  - organisatie A met cursussen in deze toestanden, opgezet met `createCourseRow`, `createPublishedVersionRow` en `createStepRow`: nooit gepubliceerd → afwezig; gepubliceerd (versie 1) → aanwezig; concept gewijzigd na publiceren → aanwezig met naam, beschrijving en versie van de **live** versie; opnieuw gepubliceerd → `versionNumber` 2; onpubliceerd (`unpublishedAt`) → afwezig; zacht verwijderde cursus → afwezig;
  - een gepubliceerde cursus van B staat niet in de lijst van A;
  - een organisatie zonder live cursussen → `{ courses: [] }`;
  - de velden zijn precies `id, name, description, versionNumber, publishedAt, downloadSizeBytes`;
  - de volgorde is op naam (hoofdletterongevoelig) en daarna op id;
  - `downloadSizeBytes` is gelijk aan Σ `fileSizeBytes` van de unieke video's + de bytelengte van de body van `GET /courses/:id` (SC-006, samen met US3; zolang US3 er niet is, vergelijk met `questContentBytes(buildQuestContent(...))`);
  - een zacht verwijderde video in de live versie telt mee;
  - zonder header → 401 `relink_required`.

### Implementation for User Story 2

- [X] T015 [P] [US2] Voeg `videoFiles(videoIds, trx = db)` toe aan `backend/src/modules/courses/courseRepository.js`. Het geeft een Map videoId → `{ id, storageKey, fileSizeBytes, durationSeconds }` en filtert bewust **niet** op `deletedAt`, `visibility` of `VideoAccess` (FR-014, constitution V; zet dat in commentaar). Een lege lijst geeft een lege Map. `fileSizeBytes` is een BIGINT: zet het om naar `Number`.
- [X] T016 [US2] Maak `backend/src/modules/quest/questContent.js` met:
  - `buildQuestContent(version, { steps, answers }, videosById)`, in de vorm van contracts/quest-api.md `GET /courses/:courseId`. Feedback hoort bij de vraag, niet bij het antwoord (spec Clarifications). Een vraag zonder `feedback` krijgt `null`;
  - `questContentBytes(content)` → `Buffer.byteLength(JSON.stringify(content), 'utf8')`;
  - `downloadSizeBytes(content)`.

  Exporteer ook `videoUrl(id)` → `/api/quest/v1/videos/${id}`.
- [X] T017 [US2] Voeg `listCourses(organisationId)` toe aan `backend/src/modules/quest/questService.js`: `questLiveVersions` → `versionContents([...versionIds])` → `videoFiles` voor alle gebruikte videoId's samen (maximaal drie queries na de catalogus, research R4) → per cursus `buildQuestContent` en `downloadSizeBytes` → `{ courses: [...] }`, gesorteerd zoals in T014.
- [X] T018 [US2] Voeg `GET /courses` toe in `backend/src/modules/quest/questRoutes.js` → `res.json(await questService.listCourses(getQuestOrganisationId(req)))`.

**Checkpoint**: T013 en T014 slagen (de vergelijking met de download na US3).

---

## Phase 5: User Story 3 - Eén cursus downloaden (Priority: P1)

**Goal**: De Quest haalt de inhoud van de live versie op, en daarna elke video. De API controleert
alleen de toegang en nginx levert de bytes.

**Independent Test**: Publiceer een cursus met twee video-onderdelen en een vraag.
`GET /courses/:id` geeft de inhoud van de live versie; beide video's geven 200 (of 206 met
`Range`); de grootte samen klopt met `downloadSizeBytes`. Een video van een cursus van B geeft 404.

### Tests for User Story 3

- [X] T019 [P] [US3] Schrijf `backend/tests/integration/questDownload.test.js`:
  - de inhoud is gelijk aan de live versie: stappen, antwoorden, `startStepId`, `nextStepId`'s, de feedback bij de vraag, versie en datum;
  - na het wijzigen van het concept blijft de download gelijk aan de live versie;
  - een video die in twee onderdelen zit, staat één keer in `videos`;
  - een zacht verwijderde video en een beperkte video (`softDeleteVideo`, `restrictVideo`) in de live versie staan in `videos`;
  - Σ `videos[].fileSizeBytes` + `Buffer.byteLength(res.text)` === `downloadSizeBytes` uit `GET /courses` (SC-006);
  - 404 `not_found` voor: een cursus van B, nooit gepubliceerd, onpubliceerd, zacht verwijderd, een niet bestaand id, en de id's `abc`, `0` en `-1`;
  - zonder header → 401 `relink_required`.
- [X] T020 [P] [US3] Schrijf `backend/tests/integration/questVideos.test.js` (de modus zonder nginx: `sendStoredFile` stuurt het bestand zelf):
  - een video in de live versie → 200, `Content-Type: video/mp4`, `Cache-Control: private, max-age=0, must-revalidate` en body `video`;
  - met `Range: bytes=2-` → 206 en body `deo` (FR-015, SC-008);
  - zacht verwijderd of beperkt maar in de live versie → 200 (FR-014);
  - 404 `not_found` voor: een video die alleen in het concept zit, alleen in een oudere (vervangen) versie, alleen in de bibliotheek, in een cursus van B, in een onpubliceerde cursus of in een verwijderde cursus, en voor een niet bestaand of misvormd id;
  - zonder header → 401;
  - met `useAccelRedirect`: voeg een geval toe dat `sendStoredFile` aanroept met `NODE_ENV=production`-gedrag (bijvoorbeeld via een mock van `config.NODE_ENV`, zoals in `backend/tests/unit/sendStoredFile.test.js`) en controleer `X-Accel-Redirect: /internal/videos/<storageKey>` zonder body (constitution III).

### Implementation for User Story 3

- [X] T021 [P] [US3] Voeg `isVideoInVersions(videoId, versionIds, trx = db)` toe aan `backend/src/modules/courses/courseRepository.js`: `CourseStep` met `whereIn('courseVersionId', versionIds)` en `where({ videoId })`, `.first('id')` → boolean. Een lege `versionIds` geeft `false` (data-model.md "Videotoegang").
- [X] T022 [US3] Voeg `getCourse(organisationId, courseId)` toe aan `backend/src/modules/quest/questService.js`. Haal de versie uit `questLiveVersions(organisationId)`; ontbreekt `courseId`, dan `throw notFound()` (FR-013). Daarna `versionContents([version.id])`, `videoFiles` en `buildQuestContent`. Gebruik **dezelfde** functies als `listCourses`, zodat de grootte klopt.
- [X] T023 [US3] Voeg `getVideoKey(organisationId, videoId)` toe aan `backend/src/modules/quest/questService.js`: `questLiveVersions` → `isVideoInVersions(videoId, versionIds)`. Is het resultaat `false`, dan `throw notFound()`. Anders volgt `videoFiles([videoId])` → `storageKey` (zonder filter op deletedAt of zichtbaarheid, FR-014).
- [X] T024 [US3] Voeg routes toe in `backend/src/modules/quest/questRoutes.js`:
  - `GET /courses/:courseId` → `getCourse`;
  - `GET /videos/:videoId` → `getVideoKey` en daarna `await sendStoredFile(res, key, { contentType: 'video/mp4', cacheControl: 'private, max-age=0, must-revalidate' })` (research R5, constitution III).

  Lees id's met dezelfde controle als `videoId(req)` in `backend/src/modules/videos/videoRoutes.js` (`/^[1-9]\d{0,9}$/`, anders `notFound()`). Zet dit in een kleine helper in `questRoutes.js`.

**Checkpoint**: T019 en T020 slagen, en ook de vergelijking van de grootte in T014. De keten
koppelen → lijst → download → video werkt.

---

## Phase 6: User Story 4 - De koppelcode zien en vernieuwen in het CMS (Priority: P2)

**Goal**: Op de pagina "Quest koppelen" ziet de organisatie haar koppelcode en kan ze een nieuwe
maken, met een bevestiging. Daarna werkt de oude code nergens meer.

**Independent Test**: Open "Quest koppelen", vernieuw de code en bevestig. Er staat een nieuwe
code. De oude code geeft `401` bij `/link` en als Bearer; de nieuwe code werkt.

### Tests for User Story 4

- [X] T025 [P] [US4] Schrijf `backend/tests/integration/questLinkRenew.test.js` (contracts/organisation-api.md):
  - `GET /api/organisation/quest-link` met een organisatiesessie → 200 `{ questLinkCode }` van de eigen organisatie;
  - een beheerderssessie → 403; zonder sessie → 401;
  - `POST /api/organisation/quest-link/renew` → 200 met een nieuwe code die voldoet aan `isValidQuestLinkCode` en verschilt van de oude;
  - daarna: de oude code bij `/api/quest/v1/link` → 401 `invalid_link_code` en als Bearer → 401 `relink_required`; de nieuwe code werkt bij beide (SC-005);
  - de code van organisatie B is niet veranderd (FR-019);
  - zonder CSRF-header → 403 `csrf_header_missing`;
  - een body met `organisationId` van B verandert alleen de eigen code.
- [X] T026 [P] [US4] Voeg aan `backend/tests/integration/questLinkRenew.test.js` (of `organisationsCreate.test.js`) een geval toe dat `renewQuestLinkCode` een code overslaat die al als loginCode of questLinkCode bestaat, ook van een verwijderde organisatie. Laat `generateQuestLinkCode` daarvoor eerst een bezette code teruggeven met `vi.mock` of `vi.spyOn` op `backend/src/lib/codes.js`.

### Implementation for User Story 4

- [X] T027 [P] [US4] Voeg `updateQuestLinkCode(trx, id, code)` toe aan `backend/src/modules/organisations/organisationRepository.js`: `update({ questLinkCode: code })` met `where({ id }).whereNull('deletedAt')`. Het geeft het aantal gewijzigde rijen terug.
- [X] T028 [US4] Exporteer in `backend/src/modules/organisations/organisationService.js` `generateUniqueQuestLinkCode` en voeg `renewQuestLinkCode(organisationId)` toe. Dat maakt een unieke code en voert `updateQuestLinkCode` uit. Bij `ER_DUP_ENTRY` wordt het tot 3 keer opnieuw geprobeerd (data-model.md). Zijn er 0 rijen gewijzigd, dan `throw notFound()`. Het geeft `{ questLinkCode }` terug.
- [X] T029 [US4] Voeg in `backend/src/modules/organisationSelf/organisationSelfRoutes.js` toe:
  - `GET /quest-link` → `{ questLinkCode }` van `findActiveById(getOrganisationId(req))`; ontbreekt de organisatie, dan `notFound()`;
  - `POST /quest-link/renew` → `renewQuestLinkCode(getOrganisationId(req))`.

  Het id komt alleen uit de sessie. Laat `GET /` ongewijzigd (research R8).
- [X] T030 [P] [US4] Maak `frontend/src/api/questLink.js` met `getQuestLink()` → `api('/organisation/quest-link')` en `renewQuestLink()` → `api('/organisation/quest-link/renew', { method: 'POST' })`. Volg de stijl van `frontend/src/api/courses.js`.
- [X] T031 [US4] Maak `frontend/src/views/QuestLinkView.vue` met de teksten letterlijk uit contracts/organisation-api.md:
  - titel "Quest koppelen" en de uitleg;
  - de code groot, in een monospace-letter, met `aria-label="Koppelcode"`;
  - de knop "Kopiëren" (`navigator.clipboard.writeText`), die daarna 2 seconden "Gekopieerd" toont;
  - de knop "Nieuwe koppelcode maken", die `Modal.vue` opent met de titel, de tekst en de knoppen "Nieuwe code maken" en "Annuleren". Annuleren verandert niets;
  - na bevestigen `renewQuestLink()`, de nieuwe code tonen en de melding "Er is een nieuwe koppelcode gemaakt." (`role="status"`);
  - bij een fout "Het maken van een nieuwe code is niet gelukt. Probeer het opnieuw." en de oude code blijft staan.

  Volg de opmaak van `frontend/src/views/StyleSettingsView.vue`.
- [X] T032 [US4] Voeg in `frontend/src/router.js` de route `{ path: 'quest', component: QuestLinkView }` toe onder de organisatie-layout. Voeg in `frontend/src/components/OrganisationLayout.vue` na "Huisstijl" het menu-item `<RouterLink to="/quest" active-class="on">Quest koppelen</RouterLink>` toe (spec Clarifications, FR-017).

**Checkpoint**: T025 en T026 slagen. De pagina werkt in de browser (handmatig, quickstart.md
stap 1 en 9).

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 [P] Voeg een korte sectie "Quest-API" toe aan `README.md`: de basis-URL `/api/quest/v1`, de koppelcode als Bearer, een link naar `specs/007-quest-api/contracts/quest-api.md`, en dat het vernieuwen van de koppelcode alle Quests afsluit.
- [X] T034 [P] Controleer in `nginx/default.conf` en `nginx/default.prod.conf` dat `location /api/` ook `/api/quest/v1` doorstuurt en dat `/internal/videos/` `internal` is. Er is geen wijziging verwacht (research R6). Zet bij `/internal/videos/` een regel commentaar dat ook de Quest-API deze locatie gebruikt.
- [X] T035 Controleer dat de code nergens de `Authorization`-header logt (`grep -rn "authorization" backend/src`, hoofdletterongevoelig) en dat `backend/src/middleware/errorHandler.js` bij een 500 alleen `err` logt en geen headers (research R1).
- [X] T036 [P] Schrijf `backend/tests/integration/questPerformance.test.js` (SC-002, SC-003):
  - maak voor één organisatie 100 gepubliceerde cursussen met elk 2 onderdelen en 1 video, in bulk via `db(...).insert([...])` zodat de opzet snel blijft;
  - `GET /api/quest/v1/courses` geeft 100 cursussen in minder dan 2000 ms (gemeten met `performance.now()` rond het verzoek);
  - maak één gepubliceerde cursus met 50 onderdelen (25 video's en 25 vragen met 4 antwoorden, verbonden);
  - `GET /api/quest/v1/courses/:id` voor die cursus duurt minder dan 2000 ms;
  - geef de test een eigen `timeout` van 30 s voor de opzet.
- [X] T037 Draai `npm test` en `npm run lint` in `backend/` en `npm run lint` in `frontend/` (als dat script bestaat). Alles moet groen zijn.
- [X] T038 Loop quickstart.md handmatig door op de stack met nginx (stappen 1–11), inclusief `Range` via nginx (stap 5) en het ontbrekende bestand (stap 11). Leg de bevindingen vast onderaan dit bestand. Het team gebruikt dit als basis voor de eigen e2e-tests.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen afhankelijkheden.
- **Foundational (Phase 2)**: na Setup. Blokkeert US1–US3. US4 heeft alleen T003 nodig
  (`isValidQuestLinkCode` in de tests); de koppelcheck in T025 heeft US1 nodig.
- **US1 (Phase 3)**: na Foundational.
- **US2 (Phase 4)**: na Foundational. Gebruikt in de tests `/api/quest/v1` met een Bearer-code, dus
  in de praktijk na T012 (`router.use(requireQuest)`).
- **US3 (Phase 5)**: na US2. Hergebruikt `questContent.js` (T016) en `videoFiles` (T015).
- **US4 (Phase 6)**: backend na US1 (T025 controleert `/link`); de frontendtaken T030–T032 kunnen
  parallel met US2/US3.
- **Polish (Phase 7)**: na alle stories.

### Within Each User Story

- Tests eerst; ze moeten falen.
- Repository → service → routes.
- Een story is af als de tests slagen en het checkpoint klopt.

### Parallel Opportunities

- Phase 2: T002, T003, T004 en T005 lopen parallel (verschillende bestanden). T006 heeft T003, T004
  en T005 nodig; T007 en T008 kunnen naast T006.
- US1: T009 ∥ T010.
- US2: T013 ∥ T014 ∥ T015.
- US3: T019 ∥ T020 ∥ T021.
- US4: T025 ∥ T026 ∥ T027 ∥ T030. De frontend (T030–T032) kan parallel met de backend van US2/US3.
- Polish: T033 ∥ T034 ∥ T036.

---

## Parallel Example: User Story 3

```text
Task: "T019 [US3] questDownload.test.js in backend/tests/integration/"
Task: "T020 [US3] questVideos.test.js in backend/tests/integration/"
Task: "T021 [US3] isVideoInVersions in backend/src/modules/courses/courseRepository.js"
```

## Parallel Example: User Story 4

```text
Task: "T025 [US4] questLinkRenew.test.js in backend/tests/integration/"
Task: "T027 [US4] updateQuestLinkCode in organisationRepository.js"
Task: "T030 [US4] frontend/src/api/questLink.js"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Phase 1 en 2.
2. US1 (koppelen), US2 (lijst) en US3 (downloaden). Samen is dat de keten die de Unity-app nodig
   heeft (constitution: eerst de volledige workflow).
3. **Stop en valideer**: quickstart.md stap 2–8 met een koppelcode uit de database of de
   beheeromgeving.

### Incremental Delivery

1. Foundation → US1: een Quest kan koppelen.
2. + US2: de Quest ziet de cursussen en kan updates herkennen (FR-06-VR).
3. + US3: de Quest kan downloaden. Het MVP is klaar voor de Unity-app.
4. + US4: de organisatie beheert de koppelcode zelf in het CMS.
5. Polish.

---

## Notes

- [P] = een ander bestand, zonder afhankelijkheid van onafgemaakte taken.
- Er is geen migratie en het ERD verandert niet (data-model.md).
- De e2e-tests (Playwright) schrijft het team zelf; ze zitten bewust niet in deze lijst.
- Commit na elke afgeronde taak of logische groep, op `Development`.

## Uitvoering (2026-11-24)

- T001: de nulmeting kon pas draaien nadat de testdatabase (`db-test`) was gestart; daarna is de
  hele suite gedraaid en groen (zie T037).
- T002–T036: gebouwd en getest. Alle tests zijn met een sabotage-run gecontroleerd: zonder de
  organisatiefilter in `questLiveVersions` of zonder de videocontrole in `getVideoKey` falen er 5
  tests (lijst, download en video's).
- T036: de prestatietest loopt ruim binnen 2 s voor 100 cursussen en voor 50 onderdelen.
- T037: backend 50 testbestanden / 422 tests groen, lint schoon; frontend 34 / 314 groen, lint
  schoon, `vite build` lukt.
- T026: `vi.mock` op `src/lib/codes.js` (niet `vi.spyOn`, dat werkt niet op ES-module-imports).
- T031: de bevestiging gebruikt de bestaande `confirmDialog` (die rendert de `Modal`-stijl uit
  `App.vue`), met de teksten uit contracts/organisation-api.md.

## Bevindingen T038 (handmatige rondgang via nginx, 2026-11-24)

Uitgevoerd op een losse Docker-stack (`docker compose -p t038`, eigen volumes, na afloop
verwijderd) via nginx op https://localhost, met twee organisaties en drie video's van 2 MB. De
cursus is via de echte CMS-API aangemaakt, opgeslagen en gepubliceerd.

| Stap | Resultaat |
|---|---|
| 1 | Pagina "Quest koppelen": menu-item, uitleg en code staan er (Vite-dev-server tegen dezelfde API, omdat de ingebouwde browser het zelfondertekende certificaat weigert). |
| 2 | `" qz7k2m9x "` → 200 met `linkCode: "QZ7K2M9X"` en Zwembad A; de loginCode → 401 `invalid_link_code`. |
| 3 | Lijst: alleen de gepubliceerde cursus (het concept niet), versie 1. |
| 4 | Download: 3 onderdelen, 2 video's, feedback bij de vraag; Σ videogroottes + bytes van het antwoord = `downloadSizeBytes` (4 194 980). |
| 5 | Video via nginx: 200, `video/mp4`, `Accept-Ranges: bytes`, SHA-256 gelijk aan het bestand. `Range: bytes=1000-` → 206, `Content-Range: bytes 1000-2097151/2097152`, juiste bytes. Zonder header → 401. |
| 6 | Video die alleen in de bibliotheek staat → 404. |
| 7 | Video 1 door de eigenaar verwijderd → blijft 206 zolang hij in de live versie zit. |
| 8 | Concept gewijzigd (video 1 vervangen door video 2, onderdelen behouden) en opnieuw gepubliceerd → lijst toont versie 2, de download alleen video 2, en video 1 geeft 404. Na onpubliceren: lijst leeg, download en video's 404. |
| 9 | Vernieuwen via de pagina: annuleren laat de code staan; bevestigen geeft een nieuwe code en één melding "Er is een nieuwe koppelcode gemaakt.". Oude code als sleutel → 401 `relink_required`, bij `/link` → 401 `invalid_link_code`; de nieuwe code werkt. |
| 10 | CMS-cookie op de Quest-API → 401 `relink_required`; koppelcode als Bearer op `/api/organisation` → 401. |
| 11 | Videobestand weggehaald: nginx geeft 404 en logt `open() … failed (2: No such file or directory)` in zijn foutlog; lijst en download blijven 200. |

**Aandachtspunten voor de e2e-tests en de app**
- Bij een ontbrekend bestand (stap 11) is de 404 van nginx een **HTML-pagina**, geen JSON met
  `error.code`. De Quest-app moet bij video's op de statuscode beslissen, niet op de body.
- "Kopiëren" (stap 1) kon niet getest worden: de verborgen browser-pane heeft geen toegang tot het
  klembord. Lukt kopiëren niet, dan gebeurt er niets zichtbaars (de code blijft wel staan). Test
  dit in een gewone browser.
- Geen fouten in de feature gevonden. Twee bevestigingen van bestaand gedrag: een verwijderde
  video kan niet in een **nieuw** onderdeel gekozen worden (feature 004), en na onpubliceren houdt
  zo'n video opnieuw publiceren tegen (feature 006 FR-012).
