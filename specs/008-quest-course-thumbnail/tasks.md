---
description: "Takenlijst voor de feature Thumbnail per cursus in de Quest-API"
---

# Tasks: Thumbnail per cursus in de Quest-API

**Input**: Design documents from `/specs/008-quest-course-thumbnail/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/quest-api-thumbnail.md](contracts/quest-api-thumbnail.md),
[quickstart.md](quickstart.md); het volledige contract staat in
[specs/007-quest-api/contracts/quest-api.md](../007-quest-api/contracts/quest-api.md).

**Tests**: API-tests zijn gevraagd (spec FR-016): unit- en integratietests van de backend (Vitest +
Supertest tegen een echte MariaDB), volgens research R7. Schrijf ze vóór de implementatie en
controleer dat ze eerst falen. E2e-tests (Playwright) maakt het team zelf; ze staan niet in deze
lijst.

**Organization**: taken zijn gegroepeerd per user story, zodat elke story los te bouwen en te
testen is.

**Conventies** (constitutie VI): code, commentaar, route (`/api/quest/v1/courses/:courseId/thumbnail`),
veld (`thumbnailUrl`) en functies zijn Engels. Er komen **geen** nieuwe foutcodes of meldingen:
alleen `relink_required` (401) en `not_found` (404) uit feature 007 (spec FR-017).

**Kernkeuzes** (research R1–R6):
- De afbeelding wordt **niet opgeslagen**: geen migratie, geen ERD-wijziging, geen nieuwe map op de
  VPS, geen wijziging in `nginx/`, `docker-compose*.yml` of `frontend/`.
- De keuze zit in **één pure functie** `thumbnailVideoId(steps, answers, videosById)` in
  `backend/src/modules/quest/questThumbnail.js`: breedte-eerst vanaf de stap met `isStart`;
  video-onderdeel met een video met `thumbnailStorageKey` → gekozen; anders verder via
  `nextCourseStepId` (video) of de antwoorden op `sortOrder` (vraag, A–D); elke stap één keer;
  niets gevonden of geen startstap → `null`.
- `thumbnailUrl` = `/api/quest/v1/courses/<courseId>/thumbnail?v=<versionNumber>` of `null`; het veld
  staat in `buildQuestContent` **direct na `publishedAt`** en de lijst neemt het daaruit over. Zo
  telt het automatisch mee in `downloadSizeBytes` (de afbeelding zelf niet).
- De route leest `req.query.v` **niet**. Toegang alleen via `questLiveVersions` (feature 007 FR-006).
- Levering: `sendStoredFile(res, key, { contentType: 'image/jpeg', cacheControl: 'private, max-age=0, must-revalidate' })`;
  `getInternalUrl` geeft al `/internal/videos/thumbnails/...` (bestaande nginx-location).
- `videoFiles` filtert **niet** op `Video.deletedAt`, `visibility` of `VideoAccess` (FR-005). Bij het
  verwijderen van een cursus wordt **geen** bestand gewist (FR-005a); de opruimtaak
  (`backend/src/jobs/videoFileCleanup.js`) blijft ongewijzigd.

**Bestaande code**: `questLiveVersions` in `backend/src/modules/quest/questCatalog.js`;
`buildQuestContent`, `videoUrl` en `downloadSizeBytes` in `backend/src/modules/quest/questContent.js`;
`buildContents`, `listCourses`, `getCourse` en `getVideoKey` in
`backend/src/modules/quest/questService.js`; `idParam` en de videoroute in
`backend/src/modules/quest/questRoutes.js`; `versionContents` en `videoFiles` in
`backend/src/modules/courses/courseRepository.js`; `sendStoredFile` in
`backend/src/lib/sendStoredFile.js`. Testhelpers: `publishedCourse`, `route` en `questGet` in
`backend/tests/helpers/quest.js`; `createVideoRow`, `createStepRow`, `createCourseRow`,
`createPublishedVersionRow`, `softDeleteVideo`, `restrictVideo` en `resetDatabase` in
`backend/tests/helpers/testApp.js`. `createVideoRow` schrijft voor elke video dezelfde `JPG_BYTES`
als thumbnail; een test die moet zien wélke thumbnail terugkomt, overschrijft het bestand op
`videoStorage.getPath(video.thumbnailStorageKey)` met eigen bytes per video.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: kan parallel lopen (andere bestanden, geen afhankelijkheid van een onafgemaakte taak)
- **[Story]**: bij welke user story de taak hoort (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Startpunt vastleggen; er is geen nieuwe infrastructuur.

- [X] T001 Draai `cd backend; npm test` en `npm run lint` op de huidige `Development` en noteer het resultaat onder een nieuwe sectie "Uitvoering" onderaan `specs/008-quest-course-thumbnail/tasks.md` (uitgangspunt voor SC-003), zonder iets te wijzigen in `backend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: De zoekregel en de gegevens die alle stories nodig hebben.

**⚠️ CRITICAL**: Geen story-werk vóór deze fase af is.

### Tests for Foundational

- [X] T002 [P] Schrijf `backend/tests/unit/questThumbnail.test.js` voor `thumbnailVideoId(steps, answers, videosById)` met rijen in de vorm van `versionContents` (`id`, `stepType`, `isStart`, `videoId`, `nextCourseStepId`; antwoorden met `courseStepId`, `sortOrder`, `nextCourseStepId`) en `videosById` als `Map` id → `{ id, thumbnailStorageKey }`. Gevallen: (a) start is video met thumbnail → die video; (b) start is vraag, antwoord A (sortOrder 0) → vraag → video Y, antwoord B (sortOrder 1) → video Z → Z (kortste weg wint); (c) start is vraag, A → video Y, B → video Z → Y (gelijke afstand, A wint), ook als de antwoorden in de invoer in omgekeerde volgorde staan; (d) lus: video-start zonder thumbnail → vraag → antwoord terug naar de start, geen andere video → `null` en de functie stopt; (e) een video-onderdeel dat niet vanaf de start bereikbaar is → telt niet mee; (f) geen enkel video-onderdeel → `null`; (g) eerste video heeft `thumbnailStorageKey: null` → overgeslagen, de volgende video op de route wordt gekozen; (h) video-onderdeel met `videoId: null` → overgeslagen, zoekt verder via `nextCourseStepId`; (i) geen stap met `isStart` → `null`; (j) video ontbreekt in `videosById` → overgeslagen. Controleer dat de test faalt (module bestaat nog niet)

### Implementation for Foundational

- [X] T003 Maak `backend/src/modules/quest/questThumbnail.js` met `export function thumbnailVideoId(steps, answers, videosById)` volgens research R1 (breedte-eerst met wachtrij en set bezochte stap-id's; vraag → antwoorden gesorteerd op `sortOrder`, `nextCourseStepId` null overslaan; video-onderdeel gekozen alleen als `videosById.get(videoId)?.thumbnailStorageKey` gevuld is). Pure functie zonder database, met een kort Engels commentaar dat naar specs/008 FR-002–FR-004 verwijst. T002 moet slagen
- [X] T004 [P] Breid `videoFiles` in `backend/src/modules/courses/courseRepository.js` uit zodat de select ook `thumbnailStorageKey` bevat; houd het commentaar dat er bewust niet op `deletedAt`, `visibility` of `VideoAccess` gefilterd wordt en voeg specs/008 FR-005 toe. Controleer dat `backend/tests/integration/questDownload.test.js` en `questVideos.test.js` nog slagen (het veld komt niet in `videos[]` van de inhoud)

**Checkpoint**: zoekregel getest; `videoFiles` levert de thumbnail-sleutel.

---

## Phase 3: User Story 1 - Per cursus een afbeelding in de lijst (Priority: P1) 🎯 MVP

**Goal**: De lijst geeft per cursus `thumbnailUrl` en de Quest kan de afbeelding ophalen.

**Independent Test**: Publiceer een cursus die met een video begint; `GET /courses` geeft
`thumbnailUrl` met `?v=1`, en dat adres levert de JPEG van die video. Een cursus zonder video's
heeft `null` en het adres geeft 404.

### Tests for User Story 1

- [X] T005 [P] [US1] Schrijf `backend/tests/integration/questThumbnail.test.js` (describe "Quest course thumbnail – list and fetch") met organisaties A (`QZ7K2M9X`) en B zoals in `questVideos.test.js`: (1) cursus via `publishedCourse` (start is vraag, antwoord A → video X): de lijst geeft `thumbnailUrl: '/api/quest/v1/courses/<id>/thumbnail?v=1'`; (2) een cursus waarvan de startstap een video is (bouw met `createCourseRow`, `createPublishedVersionRow`, `createStepRow` met `isStart: true`): het adres levert status 200, `Content-Type: image/jpeg`, `Cache-Control: private, max-age=0, must-revalidate` en precies de eigen bytes die de test vooraf naar het thumbnailbestand van die video schreef; (3) cursus "Vraag eerst" (A → vraag → video Y, B → video Z): bytes zijn die van Z; (4) cursus met één vraag zonder verbonden antwoorden: `thumbnailUrl: null` en het adres geeft 404 `not_found`; (5) zonder header en met een onbekende code → 401 `relink_required`; (6) cursus van B, niet bestaand id `999999`, id `abc` en `0` → 404 `not_found` met dezelfde body; (7) twee live cursussen met dezelfde eerste video: twee verschillende `thumbnailUrl`'s (elk met het eigen cursus-id) en beide adressen leveren dezelfde bytes. Controleer dat de tests eerst falen
- [X] T006 [P] [US1] Pas in `backend/tests/integration/questCourses.test.js` de verwachte veldenlijst aan naar `['description', 'downloadSizeBytes', 'id', 'name', 'publishedAt', 'thumbnailUrl', 'versionNumber']` en voeg één controle toe dat een cursus uit `publishedCourse` een `thumbnailUrl` heeft die eindigt op `?v=<versionNumber>`

### Implementation for User Story 1

- [X] T007 [US1] Voeg in `backend/src/modules/quest/questContent.js` `export function thumbnailUrl(courseId, versionNumber)` toe (`/api/quest/v1/courses/${courseId}/thumbnail?v=${versionNumber}`) en laat `buildQuestContent` direct na `publishedAt` het veld `thumbnailUrl` zetten: `thumbnailUrl(version.courseId, version.versionNumber)` als `thumbnailVideoId(steps, answers, videosById)` een id geeft, anders `null` (depends on T003, T004)
- [X] T008 [US1] Laat `listCourses` in `backend/src/modules/quest/questService.js` per cursus `thumbnailUrl: content.thumbnailUrl` opnemen, direct na `publishedAt` en vóór `downloadSizeBytes` (depends on T007)
- [X] T009 [US1] Voeg in `backend/src/modules/quest/questService.js` `export async function getCourseThumbnailKey(organisationId, courseId)` toe: live versie uit `questLiveVersions(organisationId).get(courseId)`, anders `throw notFound()`; daarna `versionContents([version.id])` en `videoFiles` van de video-id's in die stappen; `thumbnailVideoId(...)`; geen id → `throw notFound()`; anders de `thumbnailStorageKey` van die video teruggeven. Commentaar: alleen de live versie, ook bij zacht verwijderde of beperkte video's (specs/008 FR-005, FR-012) (depends on T003, T004)
- [X] T010 [US1] Voeg in `backend/src/modules/quest/questRoutes.js` na de route `/courses/:courseId` toe: `questRoutes.get('/courses/:courseId/thumbnail', ...)` met `idParam(req.params.courseId)`, `service.getCourseThumbnailKey(getQuestOrganisationId(req), id)` en `sendStoredFile(res, key, { contentType: 'image/jpeg', cacheControl: 'private, max-age=0, must-revalidate' })`. Lees `req.query.v` niet; commentaar dat `v` alleen het adres per versie uniek maakt (specs/008 research R3) en dat nginx de bytes levert (constitutie III). De route staat vóór `questRoutes.use(notFoundHandler)` en na `requireQuest` (depends on T009)
- [X] T011 [US1] Draai `backend/tests/unit/questThumbnail.test.js`, `backend/tests/integration/questThumbnail.test.js` en `questCourses.test.js`; alles groen

**Checkpoint**: US1 werkt: lijst met `thumbnailUrl` en de afbeelding is op te halen.

---

## Phase 4: User Story 2 - De afbeelding hoort bij de live versie (Priority: P1)

**Goal**: De afbeelding volgt alleen de live versie, blijft bij een verwijderde of beperkte video,
en is weg voor de Quest na onpubliceren of verwijderen, zonder dat het bestand gewist wordt.

**Independent Test**: Live versie met video A aan het begin, concept met video B: de Quest krijgt
A. Publiceer: `?v=2` en B. Verwijder B zacht: nog steeds B. Onpubliceer: 404.

### Tests for User Story 2

- [X] T012 [US2] Voeg aan `backend/tests/integration/questThumbnail.test.js` een describe "Quest course thumbnail – live version only" toe (geef elke video eigen thumbnail-bytes): (1) `publishedCourse` met versie 1 (`{ first: X.id }`); het concept dat `createCourseRow` maakt is leeg, dus voeg er met `route(course.draftVersionId, { first: Y.id })` (uit `backend/tests/helpers/quest.js`) een route aan toe die bij Y uitkomt: de afbeelding is nog steeds X en `thumbnailUrl` eindigt op `?v=1`; (2) `publishedCourse` met twee versies (versie 1 → video X, versie 2 → video Y): `thumbnailUrl` eindigt op `?v=2` en de bytes zijn die van Y; (3) hetzelfde adres met `?v=1`, `?v=99`, `?v=abc` en zonder `v` → telkens 200 met de bytes van Y; (4) de video van de afbeelding `softDeleteVideo` → nog 200 met dezelfde bytes; (5) idem met `restrictVideo` → nog 200; (6) laatste versie met `unpublishedAt` → 404 `not_found` en de cursus staat niet in de lijst; (7) cursus met `deletedAt` → 404 `not_found`, de cursus staat niet in `GET /courses`, en `fs.access` op `videoStorage.getPath(video.thumbnailStorageKey)` slaagt nog (het bestand is niet gewist, FR-005a); (8) na `POST /api/organisation/quest-link/renew` (zoals in `questLinkRenew.test.js`) of door `Organisation.questLinkCode` in de database te wijzigen geeft de oude code 401 `relink_required`; (9) video uit de centrale bibliotheek van B (`createVideoRow({ organisationId: b.id, visibility: 'selective', accessOrganisationIds: [a.id] })`, zoals `shared` in `questVideos.test.js`) als eerste video van een live cursus van A: 200 met zijn bytes, en na `restrictVideo` en daarna `softDeleteVideo` door B nog steeds 200 (spec Edge Cases, FR-005)

### Implementation for User Story 2

- [X] T013 [US2] Draai de tests van T012. Verwacht: groen zonder extra code, omdat T009 alleen `questLiveVersions` gebruikt en `videoFiles` niet filtert. Faalt een geval, los het dan op in `backend/src/modules/quest/questService.js` (`getCourseThumbnailKey`) zonder een tweede regel voor zichtbaarheid toe te voegen (spec FR-015), en voeg **geen** code toe aan `backend/src/jobs/videoFileCleanup.js` (FR-005a)

**Checkpoint**: US1 en US2 werken samen.

---

## Phase 5: User Story 3 - De afbeelding in de cursusinhoud (Priority: P2)

**Goal**: `GET /courses/:courseId` bevat hetzelfde `thumbnailUrl` als de lijst en
`downloadSizeBytes` blijft kloppen.

**Independent Test**: Download een live cursus: `thumbnailUrl` is gelijk aan dat in de lijst, en
Σ `videos[].fileSizeBytes` + bytes van het antwoord = `downloadSizeBytes`.

### Tests for User Story 3

- [X] T014 [P] [US3] Pas `backend/tests/unit/questContent.test.js` aan: het verwachte object van `buildQuestContent` krijgt `thumbnailUrl: '/api/quest/v1/courses/345/thumbnail?v=3'` direct na `publishedAt` (geef video 77 in de testdata een `thumbnailStorageKey`), plus een geval waarin geen enkele video een `thumbnailStorageKey` heeft → `thumbnailUrl: null`. Controleer met `Object.keys` dat `thumbnailUrl` direct na `publishedAt` staat
- [X] T015 [P] [US3] Pas `backend/tests/integration/questDownload.test.js` aan: het verwachte antwoord krijgt `thumbnailUrl: \`/api/quest/v1/courses/${course.courseId}/thumbnail?v=1\`` (de route van `publishedCourse` begint met een vraag; antwoord A gaat naar `own`). Laat de bestaande controle op `downloadSizeBytes` staan
- [X] T016 [US3] Voeg aan `backend/tests/integration/questThumbnail.test.js` een describe "Quest course thumbnail – content" toe: voor een cursus met en een cursus zonder afbeelding is `thumbnailUrl` in `GET /courses/:id` gelijk aan dat in `GET /courses`, en `downloadSizeBytes` uit de lijst = Σ `videos[].fileSizeBytes` + `Buffer.byteLength(res.text, 'utf8')` van de inhoud (spec FR-009); de afbeelding komt niet voor in `videos[]`

### Implementation for User Story 3

- [X] T017 [US3] Draai T014–T016. Verwacht: groen door T007 (het veld komt uit `buildQuestContent`). Pas alleen `backend/src/modules/quest/questContent.js` aan als de volgorde van de velden niet klopt

**Checkpoint**: alle stories werken.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T018 [P] Werk de sectie "Quest-API" in `README.md` bij met één zin: per cursus `thumbnailUrl` en `GET /api/quest/v1/courses/:courseId/thumbnail` (thumbnail van de eerste video in de live versie, via `X-Accel-Redirect`); geen nieuwe map of `.env`-instelling (verwijs naar specs/008)
- [X] T019 [P] Controleer dat `backend/tests/integration/questPerformance.test.js` (100 cursussen < 2 s, SC-004) groen blijft; meet daarnaast in `backend/tests/integration/questThumbnail.test.js` één ophaling van de afbeelding < 1 s (SC-005)
- [X] T020 Draai de hele suite en lint: `cd backend; npm test; npm run lint`. Alle tests groen, ook alle tests van feature 007 (SC-003)
- [X] T021 Sabotage-run (zoals in feature 007): zet tijdelijk in `backend/src/modules/quest/questThumbnail.js` diepte-eerst of de antwoorden niet gesorteerd, en in `getCourseThumbnailKey` het concept in plaats van de live versie; controleer dat tests falen, zet alles terug en noteer het resultaat onder "Uitvoering" in `specs/008-quest-course-thumbnail/tasks.md`
- [X] T022 Handmatige rondgang via nginx volgens `specs/008-quest-course-thumbnail/quickstart.md` (stappen 1–11, ook `X-Accel-Redirect` en de directe 404 op `/internal/videos/thumbnails/...`); noteer de bevindingen onder "Bevindingen T022" in `specs/008-quest-course-thumbnail/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen afhankelijkheden.
- **Foundational (Phase 2)**: na Setup; blokkeert alle stories.
- **US1 (Phase 3)**: na Foundational. Levert `thumbnailUrl` in de inhoud, de lijst en de route.
- **US2 (Phase 4)**: na US1 (gebruikt de route en `getCourseThumbnailKey`).
- **US3 (Phase 5)**: na T007 (het veld in `buildQuestContent`); kan parallel aan US2.
- **Polish (Phase 6)**: na alle stories.

### Within Each User Story

- Tests eerst schrijven en zien falen, dan implementeren.
- T003 vóór T007 en T009; T007 vóór T008; T009 vóór T010.

### Parallel Opportunities

- T002 en T004 (verschillende bestanden).
- T005 en T006 (verschillende testbestanden).
- T014 en T015 (verschillende testbestanden), en US3 als geheel naast US2.
- T018 en T019.

---

## Parallel Example: User Story 1

```text
Task: "T005 [US1] Schrijf backend/tests/integration/questThumbnail.test.js (lijst en ophalen)"
Task: "T006 [US1] Pas de veldenlijst aan in backend/tests/integration/questCourses.test.js"
```

## Parallel Example: User Story 3

```text
Task: "T014 [US3] thumbnailUrl in backend/tests/unit/questContent.test.js"
Task: "T015 [US3] thumbnailUrl in backend/tests/integration/questDownload.test.js"
```

---

## Implementation Strategy

### MVP First (Foundational + US1)

1. T001–T004: zoekregel en gegevens.
2. T005–T011: lijst met `thumbnailUrl` en de afbeelding ophalen. **Stop en controleer**: de
   Quest-app (Quest-spec 003) kan hiermee de cursuslijst met afbeeldingen bouwen.

### Incremental Delivery

1. US1 → de afbeelding is er.
2. US2 → bewijs dat hij alleen uit de live versie komt en blijft bij verwijderde video's.
3. US3 → de inhoud bevat hetzelfde adres; `downloadSizeBytes` getoetst.
4. Polish → README, prestaties, sabotage-run, handmatige rondgang.

---

## Notes

- [P] = andere bestanden, geen afhankelijkheden.
- Het contract is al bijgewerkt in de plan-fase (`specs/007-quest-api/contracts/quest-api.md`);
  bij een afwijking tijdens het bouwen eerst het contract aanpassen, alleen uitbreidend (FR-008).
- `X-Accel-Redirect` zelf wordt al getoetst in `backend/tests/unit/sendStoredFile.test.js`; de
  integratietests draaien zonder nginx en controleren de headers en de bytes.
- Commit na elke fase of logische groep.

## Uitvoering (2026-11-24)

- T001: uitgangspunt op `Development` vóór de wijzigingen: backend 50 testbestanden / 422 tests
  groen, lint schoon.
- T002–T017: gebouwd en getest, tests eerst (ze faalden eerst: module ontbrak, route gaf 404).
  US2 (T013) en US3 (T017) waren groen zonder extra code, zoals verwacht.
- T005: de test-helper `liveCourse` zet het concept eerst op versie 2, anders botst de unieke index
  `(courseId, versionNumber)` met de live versie 1.
- T019: `questPerformance.test.js` blijft groen (SC-004); de nieuwe test haalt een afbeelding ruim
  binnen 1 s op (SC-005).
- T020: backend 52 testbestanden / 452 tests groen (30 nieuw of aangepast), lint schoon.
- T021: sabotage-run. (1) antwoorden niet gesorteerd → 1 unit-test faalt; (2) diepte-eerst
  (`queue.pop()`) → eerst maar 1 test, daarom een unit-test toegevoegd waarin de dichtstbijzijnde
  video achter antwoord A zit; daarna falen er 2; (3) het concept in plaats van de live versie in
  `getCourseThumbnailKey` → 10 integratietests falen. Alles teruggezet en weer groen.

## Bevindingen T022 (handmatige rondgang via nginx, 2026-11-24)

Uitgevoerd op een losse Docker-stack (`docker compose -p t022`, eigen volumes, nginx op poort 8443,
na afloop met volumes en images verwijderd). De eigen stack op 80/443 is niet aangeraakt. De
gegevens (organisatie, vier video's met eigen thumbnail-bytes, drie cursussen) zijn met een los
script direct in de database van die stack gezet, niet via het CMS; publiceren, verwijderen en de
nieuwe koppelcode ook. Daardoor is stap 1 van de quickstart (de pagina "Quest koppelen") niet
opnieuw bekeken; die is niet veranderd.

| Stap | Resultaat |
|---|---|
| 1 | Lijst: "Video eerst" en "Vraag eerst" hebben `…/thumbnail?v=1`, "Zonder video" heeft `null`. |
| 2 | Inhoud: zelfde `thumbnailUrl`, direct na `publishedAt`; Σ video's + bytes van het antwoord = `downloadSizeBytes` (2602, 4928, 389). |
| 3 | Afbeelding via nginx: 200, `image/jpeg`, `Cache-Control: private, max-age=0, must-revalidate`, `X-Content-Type-Options: nosniff` (uit de `internal` location, dus nginx leverde de bytes). "Video eerst" → x, "Vraag eerst" → z (antwoord B is korter dan de weg via A). |
| 4 | "Zonder video" → 404; zonder header → 401 `relink_required`. |
| 5 | Concept begint met video w, niet gepubliceerd → nog `?v=1` en x. |
| 6 | Gepubliceerd → `?v=2` en w; het oude adres `?v=1` geeft ook w. |
| 7 | Video w zacht verwijderd → nog 200 met w. |
| 8 | Onpubliceerd → niet meer in de lijst, afbeelding 404 `not_found`. |
| 9 | Nieuwe koppelcode → oude code 401 `relink_required`, nieuwe code 200. |
| 10 | Direct `GET /internal/videos/thumbnails/…` → 404. |
| 11 | Thumbnailbestand weg → lijst en inhoud 200 met hetzelfde `thumbnailUrl`; de afbeelding geeft een HTML-404 van nginx en nginx logt `open() … failed (2: No such file or directory)`. Na terugzetten weer 200. |

**Aandachtspunt voor de Quest-app**: net als bij video's (feature 007, T038) is de 404 bij een
ontbrekend bestand een HTML-pagina van nginx, geen JSON. De app moet bij de afbeelding op de
statuscode beslissen en dan zijn eigen standaardafbeelding tonen.
