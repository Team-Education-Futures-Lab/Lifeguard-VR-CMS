---
description: "Takenlijst voor de feature Cursussen delen en de centrale cursusbibliotheek (FR-12, deel 1)"
---

# Tasks: Cursussen delen en de centrale cursusbibliotheek (FR-12, deel 1)

**Input**: Design documents from `/specs/009-course-sharing-library/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: werk zoals in de features 003 en 006, met per story gerichte tests:
- backend: tegen een echte MariaDB (Vitest + Supertest);
- frontend: Vitest + Vue Test Utils;
- e2e: Playwright.

Schrijf de tests vóór de implementatie en controleer dat ze eerst falen.

**Organization**: de taken zijn gegroepeerd per user story, zodat elke story los te bouwen en te
testen is.

**Conventies** (constitutie VI):
- **Engels**: code, commentaar, routes (`/course-library`, `/availability`), velden (`visibility`,
  `accessOrganisationIds`, `acknowledgedVideoIds`), tabellen (`CourseAccess`) en foutcodes
  (`shared_videos_warning`, `course_not_live`).
- **Nederlands**: UI-teksten en `message`, letterlijk zoals in [contracts/ui.md](contracts/ui.md)
  en [contracts/api.md](contracts/api.md).

**Kernregels**:
- **Bibliotheek**: welke cursussen erin staan, wordt alleen bepaald door `libraryCoursesQuery`
  (research R2).
- **Live versie**: alleen bepaald door `liveVersions` in `courseRepository.js` (specs/006 R1).
- **Waarschuwing**: welke video's erin komen, wordt alleen bepaald door `sharedVideosWarning` in
  `backend/src/lib/courseSharing.js` (research R4).
- **Wat andere organisaties zien**: alleen de samenvatting van de live versie, nooit onderdelen,
  video-id's, het concept of oude versies (FR-016, FR-018).
- **Ongewijzigd**: Quest en bewerken blijven alleen voor de eigen organisatie. Wijzig
  `questLiveVersions` en `ownCoursesQuery` niet (FR-026, research R12).

**Bestaande code om te hergebruiken**:
- `backend/src/lib/videoChoices.js`: `VISIBILITIES`, `validateVisibility`,
  `parseOrganisationIds`, `validateAccessOrganisations`.
- `backend/src/modules/videos/videoRepository.js`: `visibleVideosQuery` en
  `listAccessOrganisations`, als voorbeeld.
- `backend/src/modules/courses/courseRepository.js`: `liveVersions`, `versionContents`,
  `videoFiles`, `libraryVideoIds`.
- `backend/src/modules/quest/questThumbnail.js`: `thumbnailVideoId`.
- `backend/src/lib/sendStoredFile.js`.
- Testhelpers in `backend/tests/helpers/testApp.js` (`createCourseRow`, `createPublishedVersionRow`,
  `createStepRow`, `createVideoRow`, `restrictVideo`, `softDeleteVideo`, `createOrganisationRow`,
  `agentWithSession`) en `backend/tests/helpers/quest.js` (`publishedCourse`, `route`).
- Frontend: `frontend/src/components/AvailabilityPicker.vue`, `OwnerPill.vue`, `Modal.vue`;
  `frontend/src/lib/videoAccess.js`, `videoLibrary.js`; `frontend/src/views/VideosView.vue` en
  `VideoDetailsDialog.vue` (als voorbeeld voor de bibliotheek); `frontend/src/editor/PublishDialog.vue`,
  `PublishMenu.vue`, `UnpublishDialog.vue`, `context.js`; `frontend/src/views/CoursesView.vue`;
  `e2e/helpers/course.js`.

Alle bestaande tests moeten groen blijven.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: kan parallel lopen (andere bestanden, geen afhankelijkheden)
- **[Story]**: de user story waar de taak bij hoort (US1–US5, genummerd zoals in spec.md)
- Paden zijn relatief aan de root van de repository

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: de wijziging in het datamodel en in het ERD

- [X] T001 Maak de migratie `backend/src/db/migrations/20261126000001_course_sharing.js` (data-model.md § Migratie):
  - In `Course` de kolom `visibility` toevoegen: `table.enu('visibility', ['public', 'selective', 'private']).notNullable().defaultTo('private')`.
  - De kolom `isSharedInLibrary` verwijderen.
  - De tabel `CourseAccess` aanmaken, met `courseId` (unsigned, NOT NULL, references `Course.id`) en `organisationId` (unsigned, NOT NULL, references `Organisation.id`), `primary(['courseId', 'organisationId'])` en `index(['organisationId'])`.
  - Engels commentaar zoals in `20261023000001_create_video_access.js`.
  - `down` doet het omgekeerde: `isSharedInLibrary` BOOLEAN NOT NULL DEFAULT false terug.
  - Bestaande cursussen krijgen `private` en versies worden niet aangeraakt (FR-005).
- [X] T002 Haal elke verwijzing naar `isSharedInLibrary` weg:
  - de insert in `insertCourse` in `backend/src/modules/courses/courseRepository.js` (de default `private` geldt dan);
  - `backend/scripts/seed-courses.js`;
  - `createCourseRow` in `backend/tests/helpers/testApp.js` (krijgt daarbij de optionele parameters `visibility = 'private'` en `accessOrganisationIds = []`, die rijen in `CourseAccess` schrijven). Geef dezelfde twee optionele parameters ook aan `publishedCourse` in `backend/tests/helpers/quest.js`, die ze doorgeeft aan `createCourseRow`; de tests van US2 en US5 (T023, T024, T051) zetten zo gedeelde live cursussen op;
  - `backend/tests/integration/questPerformance.test.js`;
  - de verwachting in `backend/tests/integration/courseCrud.test.js` (wordt `visibility: 'private'`).

  Voeg `CourseAccess` toe aan `resetDatabase` in `backend/tests/helpers/testApp.js`, vóór `Course`.
  Controleer met `grep -rn isSharedInLibrary backend/src backend/scripts backend/tests` dat alleen de
  oude migratie nog treffers geeft.
- [X] T003 [P] Werk `docs/Diagrams.simp` bij (research R14):
  - In de entiteit `Course` het attribuut `isSharedInLibrary` (BOOLEAN) vervangen door `visibility` (ENUM `public`/`selective`/`private`, `nullable="false"`), in hetzelfde formaat als `Video.visibility`.
  - Een entiteit `CourseAccess` toevoegen (`courseId`, `organisationId`, samen PK), met relaties naar `Course` en `Organisation`, naar het voorbeeld van `VideoAccess`.
  - De notitie bij `OrganisationCourse` en `parentCourseId` blijft staan.
  - Controleer dat het bestand geldige XML blijft en verder niets verandert.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: de regel voor de waarschuwing, de beschikbaarheid lezen en schrijven, de
beschikbaarheid in de documenten, en de gedeelde frontendonderdelen

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

### Tests for Foundational

- [X] T004 [P] Schrijf `backend/tests/unit/courseSharingWarning.test.js` (research R4, data-model.md § Lijst voor de waarschuwing) als een tabel van gevallen voor `sharedVideosWarning({ before, after, contentVideos, previousVideoIds, allOrganisationIds })`:
  - van `private` naar `public` → alle beperkte video's;
  - zonder live versie (`before.live = false`) naar `selective` → alle;
  - van `selective` [B] naar `selective` [B, C] → alle;
  - van `selective` [B] naar `public` → alle;
  - van `public` naar `selective` [B] → alleen nieuwe;
  - van `public` naar `public` met dezelfde video's → `[]`;
  - van `public` naar `public` met een nieuwe beperkte video → alleen die;
  - naar `private` → `[]`;
  - zonder beperkte video's → `[]`.

  Een video telt als beperkt bij `visibility` `selective` of `private`, bij een gevulde `deletedAt`,
  en bij een verwijderde eigenaar (`ownerDeleted: true`). Een video van een andere organisatie die
  selectief met de eigenaar gedeeld is, telt ook mee. De uitkomst staat in de volgorde van
  `contentVideos`, met elke video één keer.
- [X] T005 [P] Schrijf `backend/tests/integration/courseAvailabilityDocument.test.js` (research R10):
  - `GET /api/organisation/courses/:id` geeft `availability: { visibility: 'private', accessOrganisations: [] }` voor een nieuwe cursus.
  - Na het zetten van `visibility: 'selective'` met `CourseAccess` voor B en C (via `createCourseRow`) staat `accessOrganisations` alfabetisch, als `[{ id, name }]`.
  - Een verwijderde organisatie (`Organisation.deletedAt` gevuld) valt weg.
  - `GET /api/organisation/courses` geeft per rij `visibility`.
- [X] T006 [P] Breid `frontend/tests/video-access.test.js` uit: `confirmationText(1, 'course')` geeft "1 organisatie kan deze cursus daarna niet meer zien in de cursusbibliotheek." en `confirmationText(3, 'course')` geeft "3 organisaties kunnen deze cursus daarna niet meer zien in de cursusbibliotheek.". De bestaande teksten voor video's (zonder tweede argument) blijven gelijk.

### Implementation for Foundational

- [X] T007 Maak `backend/src/lib/courseSharing.js` (research R4), met alleen pure functies:
  - `isRestrictedVideo(video)`: `visibility !== 'public' || deletedAt !== null || ownerDeleted`.
  - `audience({ live, visibility, accessOrganisationIds }, allOrganisationIds)`: een `Set`. Leeg zonder live versie of bij `private`; alle organisaties bij `public`; de gekozen organisaties bij `selective`.
  - `isWider(before, after, allOrganisationIds)`.
  - `sharedVideosWarning({ before, after, contentVideos, previousVideoIds, allOrganisationIds })`: geeft `[{ id, name }]`.

  Engels commentaar dat verwijst naar FR-009 en FR-010. Laat T004 slagen.
- [X] T008 Voeg aan `backend/src/lib/errors.js` toe:
  - `sharedVideosWarning(videos)`: `AppError(409, 'shared_videos_warning', "Deze cursus bevat video's die niet algemeen beschikbaar zijn.")`, met `error.videos = videos`.
  - `courseNotLive()`: `AppError(409, 'course_not_live', 'Publiceer de cursus eerst.')`.

  Breid de errorhandler in `backend/src/middleware/errorHandler.js` uit, zodat `videos` in de
  JSON-fout komt (net als `issues` bij `course_incomplete`).
- [X] T009 Voeg aan `backend/src/modules/courses/courseRepository.js` toe:
  - `courseAvailability(courseId, trx)`: geeft `{ visibility, accessOrganisations: [{ id, name }] }`. Alleen actieve organisaties, gesorteerd op `o.name`, net als `listAccessOrganisations` bij video's.
  - `setCourseAvailability(trx, courseId, { visibility, accessOrganisationIds })`: zet `Course.visibility`, verwijdert alle `CourseAccess`-rijen van de cursus en voegt bij `selective` de nieuwe toe. Verandert `updatedAt` niet (research R9).
  - `contentVideoRows(versionId, trx)`: de video's van de video-onderdelen in id-volgorde, elke video één keer, met `id`, `name`, `visibility`, `deletedAt` en `ownerDeleted` (join op `Organisation` van de eigenaar). Zonder filter op `deletedAt` of beschikbaarheid.
  - `activeOrganisationIds(exceptId, trx)`.

  Lees in `listOwnCourses` ook `c.visibility` mee.
- [X] T010 Werk `backend/src/modules/courses/courseService.js` bij (research R10): `toDraftDocument` krijgt `availability` (via `courseAvailability`) en `listCourses` geeft per rij `visibility`. Werk de verwachte documenten in de bestaande backendtests bij die het hele document vergelijken: `courseCrud.test.js`, `courseStatus.test.js`, `coursePublish.test.js` en eventueel andere. Laat T005 slagen.
- [X] T011 [P] Maak `confirmationText(count, noun = 'video')` in `frontend/src/lib/videoAccess.js` algemeen. Bij `noun = 'course'` geeft hij de teksten uit T006. `audience` en `countLosingAccess` blijven gelijk. Laat T006 slagen.
- [X] T012 [P] Geef `frontend/src/components/AvailabilityPicker.vue` een prop `subject` (`'video'` als standaard, of `'course'`), met de hulpteksten uit contracts/ui.md § Beschikbaarheid kiezen voor cursussen. De teksten voor video's blijven ongewijzigd. Voeg in `frontend/tests/` een test toe (bijvoorbeeld in `upload-dialog.test.js` of een nieuwe `availability-picker.test.js`) voor beide sets hulpteksten.
- [X] T013 Werk de frontendtests en testdocumenten bij voor de nieuwe velden `availability` (conceptdocument) en `visibility` (lijst): `frontend/tests/editorHarness.js`, `frontend/tests/publishHarness.js` en `frontend/tests/courses-view.test.js`. Alle frontendtests blijven groen.

**Checkpoint**: de beschikbaarheid staat in de database en in de documenten (overal "Alleen eigen
organisatie"), en de regel voor de waarschuwing bestaat en is getest.

---

## Phase 3: User Story 1 - Beschikbaarheid kiezen bij het publiceren (Priority: P1) 🎯 MVP

**Goal**: in de bevestiging van het publiceren de beschikbaarheid kiezen. Die wordt samen met de
inhoud opgeslagen, als alles of niets (FR-001 t/m FR-005, FR-008).

**Independent Test**: als A drie cursussen publiceren, één met elke beschikbaarheid (selectief
voor B). In de database en in het conceptdocument staan de juiste `visibility` en rijen in
`CourseAccess`. Een ongeldige keuze verandert niets (spec US1).

### Tests for User Story 1

- [X] T014 [P] [US1] Schrijf `backend/tests/integration/coursePublishAvailability.test.js` (FR-002, FR-003, FR-008, research R8). Gebruik cursussen zonder beperkte video's, zodat er geen waarschuwing nodig is:
  - **Keuzes**: `POST /courses/:id/publish` met `{ visibility: 'public' }` geeft `200` en `availability.visibility: 'public'`. Met `{ visibility: 'selective', accessOrganisationIds: [B] }` komt er een rij in `CourseAccess`. Daarna met `{ visibility: 'private' }` (via "niets nieuws", of na een wijziging) verdwijnen alle rijen in `CourseAccess`.
  - **Zonder body**: de beschikbaarheid blijft gelijk.
  - **Ongeldige invoer**: `visibility: 'x'` geeft `400`, met `fields.visibility` = "Kies een beschikbaarheid.". `selective` zonder organisaties geeft `400`, met `fields.accessOrganisationIds` = "Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’.". De eigen organisatie, een onbekend of een verwijderd id in de lijst geeft `400` "Kies alleen organisaties uit de lijst.". In al deze gevallen is er niets gepubliceerd (geen nieuwe versie) en de beschikbaarheid ongewijzigd.
  - **Alles of niets**: een onvolledige cursus met `visibility: 'public'` geeft `422 course_incomplete` en de beschikbaarheid blijft `private`.
  - **Bestaande cursussen**: een cursus die vóór de migratie gepubliceerd was (`createPublishedVersionRow`) heeft `private` (FR-005).
- [X] T015 [P] [US1] Breid `backend/tests/integration/courseIsolation.test.js` uit: `POST /courses/:id/publish` met een beschikbaarheid, voor een cursus van een andere organisatie, geeft `404` en verandert niets (FR-008).
- [X] T016 [P] [US1] Breid `frontend/tests/publish-dialog.test.js` uit (contracts/ui.md § Bevestiging publiceren):
  - in de modus `confirm` staat de picker (`data-test="availability"`, cursusteksten);
  - de voorselectie komt uit de prop `availability` (bij een nieuwe cursus `private`);
  - de zin onder de picker hoort bij `public` en `selective`;
  - bij `selective` zonder organisatie is de bevestigknop uitgeschakeld;
  - `confirm` emit `{ visibility, accessOrganisationIds }`;
  - bij een live, gedeelde cursus vraagt een beperktere keuze eerst om bevestiging, met `confirmationText(n, 'course')`. Op "Annuleren" volgt geen `confirm`.
- [X] T017 [P] [US1] Schrijf `e2e/tests/009-course-sharing-library/share-on-publish.spec.js` (quickstart 2, 3, 16): maak een complete cursus via `e2e/helpers/course.js` en open "Publiceren".
  - "Alleen eigen organisatie" is voorgeselecteerd.
  - Kies "Algemeen beschikbaar" en bevestig: de cursus is gepubliceerd.
  - Open het menu opnieuw voor de volgende versie: "Algemeen beschikbaar" is voorgeselecteerd.
  - "Selectief beschikbaar" zonder organisatie toont de melding en de knop is uitgeschakeld.

### Implementation for User Story 1

- [X] T018 [US1] Laat in `backend/src/modules/courses/courseService.js` `publishCourse(courseId, organisationId, body = {})` de beschikbaarheid lezen (research R8):
  - **Velden controleren, vóór de transactie**: is `visibility` aanwezig, controleer dan met `validateVisibility` en `parseOrganisationIds`. Bij `selective`: `validateAccessOrganisations(ids, organisationId, trx)`. Fouten bundelen in één `validationError`.
  - **In de transactie**, na de controle op compleetheid en vóór de vertakkingen van specs/006: de gekozen beschikbaarheid bewaren. Is die er niet, dan de huidige (`courseAvailability`).
  - **Na de vertakking** (nieuwe versie, terugzetten of niets nieuws): `setCourseAvailability`.
  - Het document na afloop geeft de nieuwe `availability`. Laat T014 slagen.
- [X] T019 [US1] Laat in `backend/src/modules/courses/courseRoutes.js` de route `POST /courses/:id/publish` alleen `visibility`, `accessOrganisationIds` en `acknowledgedVideoIds` uit de body lezen en ze doorgeven aan `publishCourse`. Laat T015 slagen.
- [X] T020 [P] [US1] Laat `publishCourse(id, choices)` in `frontend/src/api/courses.js` de body `{ visibility, accessOrganisationIds, acknowledgedVideoIds }` versturen. Zonder `choices` gaat er geen body mee.
- [X] T021 [US1] Breid `frontend/src/editor/PublishDialog.vue` uit volgens contracts/ui.md § Bevestiging publiceren:
  - nieuwe props `availability` (uit het conceptdocument), `organisations` (lijst met actieve andere organisaties) en `live` (boolean);
  - een lokale kopie van de keuze, met `AvailabilityPicker subject="course"` en de zin onder de picker;
  - "Publiceren" is uitgeschakeld als `isAvailabilityValid` faalt;
  - bij beperken (`countLosingAccess(current, next, allIds) > 0` en `live`) eerst een tweede bevestiging met `confirmationText(n, 'course')` en de knoppen "Wijzigen" en "Annuleren" (FR-007);
  - `confirm` emit de keuze.

  Laat T016 slagen.
- [X] T022 [US1] Werk de editor bij:
  - `frontend/src/editor/context.js`: `publish(choices)` geeft de keuze door aan `publishRequest`. Houd `availability` uit het teruggegeven document bij in de editorstaat (naast `publication`).
  - `frontend/src/editor/CourseEditor.vue` en `frontend/src/views/EditorView.vue`: geef de beschikbaarheid aan de dialoog, en de lijst organisaties via de bestaande API `GET /api/organisation/organisations`. Haal die één keer op bij het openen van de dialoog. Bij een fout toont "Selectief beschikbaar" de tekst "Er zijn nog geen andere organisaties."

  Laat T017 slagen.

**Checkpoint**: publiceren met een beschikbaarheid werkt van begin tot eind. Bestaande cursussen
blijven "Alleen eigen organisatie".

---

## Phase 4: User Story 2 - Gedeelde cursussen vinden in de centrale cursusbibliotheek (Priority: P1)

**Goal**: een nieuwe pagina "Cursusbibliotheek" met precies de live, originele, gedeelde
cursussen die voor de organisatie beschikbaar zijn. Per cursus een samenvatting, met zoeken,
filteren en sorteren (FR-013 t/m FR-022).

**Independent Test**: A deelt een cursus algemeen, B deelt er een selectief met A. A ziet beide
(de eigen met "Eigen"), C ziet alleen die van A. Een cursus van A met "Alleen eigen organisatie"
is voor B ook buiten de interface om `404` (spec US2).

### Tests for User Story 2

- [X] T023 [P] [US2] Schrijf `backend/tests/integration/courseLibrary.test.js` (FR-014, FR-015, FR-017, SC-001). Gebruik drie organisaties en cursussen in alle toestanden, opgezet met `publishedCourse` en `createCourseRow` met `visibility`.
  - **Wie ziet wat** via `GET /api/organisation/course-library`:
    - public, selective (B), private, een concept (`visibility: 'public'`, zonder live versie), een onpubliceerde cursus (public), een verwijderde cursus (public) en een cursus met `parentCourseId` (public);
    - B ziet precies public en selective;
    - C ziet alleen public;
    - de eigenaar A ziet zijn eigen public en selective met `owner.isOwn: true`, plus `visibility` en `accessOrganisations`, maar niet private;
    - cursussen waarvan de eigenaar verwijderd is, zijn nergens te zien.
  - **Velden**: `versionNumber` en `publishedAt` komen van de live versie, ook als het concept gewijzigd is (`published_changed`) en een andere naam heeft. `stepCount` is het aantal onderdelen van de live versie, `videoCount` het aantal verschillende video's.
  - **Volgorde**: nieuwste `publishedAt` eerst.
  - **Details**: `GET /course-library/:id` geeft hetzelfde object.

  Schrijf daarnaast `backend/tests/integration/courseLibraryPerformance.test.js` (SC-006), naar het
  voorbeeld van `questPerformance.test.js`: voeg in bulk 200 algemeen gedeelde live cursussen van
  een andere organisatie in (elk met een paar onderdelen en een video). `GET /course-library` geeft
  dan `200` met 200 cursussen binnen 2000 ms (gemeten met `performance.now()`).
- [X] T024 [P] [US2] Schrijf `backend/tests/integration/courseLibraryIsolation.test.js` (FR-016, FR-018, FR-021, FR-022, FR-028, SC-002, research R6):
  - **Alleen voor organisaties** (FR-028): een beheerderssessie (`agentWithSession({ administratorId })`) krijgt op `GET /api/organisation/course-library`, `/:id` en `/:id/thumbnail` dezelfde weigering als op de andere routes onder `/api/organisation` (zie `organisationIsolation.test.js`), en zonder sessie `401`.
  - **404 met dezelfde body als voor een onbekend id**: `GET /course-library/:id` en `/thumbnail` voor een private cursus van een andere organisatie, een selectieve cursus zonder rij voor de kijker, een onbekend id en `abc`.
  - **Geen inhoud**: het object heeft geen sleutels `steps`, `answers`, `videoId`, `draftVersionNumber` of `status`. Een niet-eigenaar krijgt ook geen `visibility` of `accessOrganisations`.
  - **Thumbnail**: B krijgt `thumbnailUrl: null`, en `/thumbnail` geeft `404`, als de video van de afbeelding van A `private` is. Is die video `public`, dan krijgt B een URL en geeft `/thumbnail` `200` met `X-Accel-Redirect`. A (eigenaar) krijgt bij een private video wel een URL.
  - **Bewerken blijft verboden**: `GET`, `PUT` en `DELETE /api/organisation/courses/:id`, `publish` en `unpublish` van een gedeelde cursus van A, als B: `404` (FR-022).
- [X] T025 [P] [US2] Schrijf `frontend/tests/course-library.test.js` voor `frontend/src/lib/courseLibrary.js` (FR-019):
  - zoeken op naam, beschrijving en eigenaar (een deel van een woord, zonder verschil voor hoofdletters en accenten);
  - de filters `all`, `own` en `others`, en `ownerId`;
  - sorteren op `newest`, `oldest`, `name-asc` en `name-desc`, met id als tiebreak;
  - alles samen.
- [X] T026 [P] [US2] Schrijf `frontend/tests/course-library-view.test.js` en `frontend/tests/course-library-details.test.js` (contracts/ui.md § Cursusbibliotheek en § Details):
  - **Lijst**: per cursus thumbnail of neutrale afbeelding, naam, ingekorte beschrijving, `OwnerPill`, "Versie {n} · {datum}" en "{x} onderdelen · {y} video's".
  - **Pil**: klik op de pil van een andere organisatie geeft het label "Organisatie: <naam> ✕".
  - **Leeg**: "Er zijn nog geen gedeelde cursussen." zonder cursussen; "Geen cursussen gevonden" met de knop "Zoekterm en filters wissen" zonder resultaten.
  - **Venster**: na openen en sluiten zijn de zoekterm en de filters gelijk.
  - **Details**: volledige beschrijving met regels; voor de eigenaar de beschikbaarheid met organisatienamen en "Openen in de editor"; voor anderen alleen "Sluiten".
- [X] T027 [P] [US2] Schrijf `e2e/tests/009-course-sharing-library/course-library.spec.js` (quickstart 3, 9, 10). Maak via de API cursussen voor twee organisaties.
  - Als B "Cursusbibliotheek" in het menu openen: de cursus van A staat er met de pil van A.
  - Zoeken, op de pil klikken en sorteren werken.
  - Het venster toont geen knoppen om te bewerken.
  - De private cursus van A staat er niet.

### Implementation for User Story 2

- [X] T028 [US2] Maak `backend/src/modules/courseLibrary/courseLibraryRepository.js` met `libraryCoursesQuery(organisationId, trx = db)`, precies volgens data-model.md § Bibliotheek van organisatie X:
  - joins: `Course as c`, `OrganisationCourse as oc` (`isOwner = true`), `Organisation as o` op de eigenaar, en een left join op `CourseAccess as a` voor de organisatie;
  - filters: `c.deletedAt IS NULL`, `c.parentCourseId IS NULL`, `o.deletedAt IS NULL`, `c.visibility <> 'private'`, en (eigenaar = organisatie, of public, of selective met een rij in `a`);
  - velden: `c.id`, `c.visibility`, `o.id as ownerId`, `o.name as ownerName`;
  - een `requireId` zoals in de andere repositories, en commentaar dat dit de enige definitie is (research R2).
- [X] T029 [US2] Maak `backend/src/modules/courseLibrary/courseLibraryService.js` (research R6, R7):
  - **`listLibraryCourses(organisationId)`** haalt de rijen uit T028 op en houdt met `liveVersions` alleen cursussen met een live versie over. Daarna:
    - `versionContents` voor de live versies, voor `stepCount` en `videoCount`;
    - `videoFiles` en `thumbnailVideoId` voor de video van de afbeelding;
    - `libraryVideoIds(organisationId, …)` voor de regel: `thumbnailUrl` = `/api/organisation/course-library/:id/thumbnail` als die video bestaat, een `thumbnailStorageKey` heeft, en (de kijker eigenaar is of de video in de set staat); anders `null`;
    - bij de eigenaar `visibility` en `accessOrganisations` (via `courseAvailability`).
  - **`getLibraryCourse(id, organisationId)`**: hetzelfde object, of `notFound()`.
  - **`getLibraryThumbnailKey(id, organisationId)`**: de `thumbnailStorageKey` volgens dezelfde regel, of `notFound()`.
  - Geen query per cursus: het aantal queries hangt niet af van het aantal cursussen (SC-006).
- [X] T030 [US2] Maak `backend/src/modules/courseLibrary/courseLibraryRoutes.js`:
  - `GET /course-library` geeft `{ courses }`;
  - `GET /course-library/:id`;
  - `GET /course-library/:id/thumbnail` via `sendStoredFile(res, key, { contentType: 'image/jpeg', cacheControl: 'private, max-age=3600' })`;
  - een id-controle zoals `idParam` in `courseRoutes.js`;
  - de organisatie alleen via `getOrganisationId(req)`.

  Koppel de routes in `backend/src/app.js` aan de keten onder `/api/organisation`, na `courseRoutes`.
  Laat T023 en T024 slagen.
- [X] T031 [P] [US2] Maak `frontend/src/api/courseLibrary.js` met `listLibraryCourses()` en `getLibraryCourse(id)`.
- [X] T032 [P] [US2] Maak `frontend/src/lib/courseLibrary.js`:
  - `OWNERSHIP_OPTIONS`: "Alle cursussen", "Eigen cursussen", "Van andere organisaties";
  - `SORT_OPTIONS`: "Nieuwste publicatie eerst", "Oudste publicatie eerst", "Naam (A–Z)", "Naam (Z–A)";
  - `DEFAULT_SORT = 'newest'`;
  - `filterCourses`, `sortCourses` en `libraryView`, die `normalizeForSearch` uit `frontend/src/lib/videoLibrary.js` hergebruiken.

  Laat T025 slagen.
- [X] T033 [US2] Maak `frontend/src/components/CourseLibraryDetailsDialog.vue` volgens contracts/ui.md § Details van een cursus:
  - gebruik `Modal.vue` en `OwnerPill.vue`;
  - de datum via `formatPublishedAt` uit `frontend/src/lib/publication.js`;
  - de beschikbaarheid in tekst voor de eigenaar, met een `RouterLink` "Openen in de editor" naar `/courses/:id`.
- [X] T034 [US2] Maak `frontend/src/views/CourseLibraryView.vue` volgens contracts/ui.md § Cursusbibliotheek, naar het voorbeeld van `frontend/src/views/VideosView.vue`:
  - één keer laden;
  - zoeken, filteren, sorteren en het organisatiefilter in de browser;
  - de lege toestanden;
  - het venster uit T033;
  - de scrollpositie bewaren.

  Laat T026 slagen.
- [X] T035 [US2] Voeg de route `{ path: 'course-library', component: CourseLibraryView }` toe aan de routes van de organisatie in `frontend/src/router.js`, en het menu-item "Cursusbibliotheek" na "Cursussen" in `frontend/src/components/OrganisationLayout.vue` (`active-class="on"`). Werk `frontend/tests/router.test.js` bij als die de routes opsomt. Laat T027 slagen.

**Checkpoint**: de bibliotheek toont precies de juiste cursussen. Andere organisaties zien alleen
de samenvatting.

---

## Phase 5: User Story 3 - Waarschuwing bij video's die niet algemeen beschikbaar zijn (Priority: P1)

**Goal**: delen met beperkte video's lukt alleen nadat de eigenaar precies de video's in de
waarschuwing heeft bevestigd. De server beslist zelf (FR-009 t/m FR-012).

**Independent Test**: een cursus met een video "Alleen eigen organisatie" en een "Algemeen
beschikbaar" publiceren met "Algemeen beschikbaar".
- De waarschuwing noemt alleen de eerste video.
- "Annuleren" verandert niets.
- "Doorgaan" publiceert de cursus, en hij staat in de bibliotheek.

### Tests for User Story 3

- [X] T036 [P] [US3] Breid `backend/tests/integration/coursePublishAvailability.test.js` uit (FR-009, FR-010, FR-012, SC-003, research R3):
  - **Eerste keer delen**: met een private video, een selectieve video en een public video: `publish` met `public` zonder `acknowledgedVideoIds` geeft `409 shared_videos_warning`, met `videos` = de private en de selectieve video in de volgorde van de onderdelen. Geen nieuwe versie en `visibility` blijft `private`.
  - **Gedeeltelijk bevestigd**: met één van de twee id's opnieuw `409`.
  - **Volledig bevestigd**: met beide id's `200`, gepubliceerd en `public`.
  - **Niet delen**: met `private` en dezelfde video's `200` zonder waarschuwing.
  - **Wijziging zonder nieuwe beperkte video**: daarna de tekst wijzigen en opnieuw `public` publiceren geeft `200` zonder waarschuwing (geval c).
  - **Nieuwe beperkte video**: een nieuwe beperkte video toevoegen en publiceren geeft `409`, met alleen die video.
  - **Ook beperkt**: een zacht verwijderde video die in de live versie zit, en een video van een andere organisatie die selectief met de eigenaar gedeeld is, staan in de lijst.
  - **Opnieuw delen**: na onpubliceren opnieuw publiceren met `public` geeft `409`, met alle beperkte video's (geval a).
  - **Volgorde van controles**: een onvolledige cursus met beperkte video's geeft `422` (de compleetheid wordt eerst gecontroleerd).
- [X] T037 [P] [US3] Schrijf `frontend/tests/shared-videos-warning.test.js` (contracts/ui.md § Waarschuwing):
  - titel, tekst en een lijst met namen (`data-test="warning-video"`);
  - "Annuleren" emit `cancel`;
  - "Doorgaan" emit `continue`;
  - `role="alertdialog"`;
  - Escape geldt als annuleren.
- [X] T038 [P] [US3] Breid `frontend/tests/publish-button.test.js` uit (of maak een nieuwe test met `publishHarness.js`):
  - bij `409 shared_videos_warning` verschijnt de waarschuwing;
  - "Annuleren" brengt terug naar de bevestiging met dezelfde keuze;
  - "Doorgaan" verstuurt opnieuw met `acknowledgedVideoIds` = de id's uit de 409;
  - een tweede 409 toont de nieuwe lijst.
- [X] T039 [P] [US3] Breid `e2e/tests/009-course-sharing-library/share-on-publish.spec.js` uit (quickstart 4, 5, 6): een cursus met een eigen private video delen.
  - De waarschuwing toont de naam van de video.
  - "Annuleren" laat de cursus ongepubliceerd.
  - Opnieuw met "Doorgaan" is de cursus gepubliceerd.
  - Na een tekstwijziging volgt bij opnieuw publiceren geen waarschuwing.

### Implementation for User Story 3

- [X] T040 [US3] Voeg in `backend/src/modules/courses/courseService.js` een helper `checkSharingWarning(trx, { course, before, after, contentVersionId, previousVersionId, acknowledgedVideoIds })` toe (research R3, R4). Die:
  - haalt `contentVideoRows(contentVersionId)`, `versionVideoIds(previousVersionId)` (leeg zonder vorige live versie) en `activeOrganisationIds(eigenaar)` op;
  - roept `sharedVideosWarning` aan;
  - gooit `sharedVideosWarning(videos)` (errors.js) als niet elke video in `acknowledgedVideoIds` staat. `acknowledgedVideoIds` wordt gecontroleerd met `parseOrganisationIds`-achtige logica (positieve gehele getallen; anders `400`, veld `acknowledgedVideoIds`).
- [X] T041 [US3] Roep in `publishCourse` `checkSharingWarning` aan:
  - **Waar**: na de controle op compleetheid en vóór het vastzetten.
  - **Huidige toestand (`before`)**: of de cursus live is en de huidige beschikbaarheid.
  - **Nieuwe toestand (`after`)**: live met de gekozen beschikbaarheid.
  - **Inhoud**: bij een nieuwe versie het concept, bij terugzetten de laatst gepubliceerde versie.
  - **Vorige versie**: de huidige live versie, als die er is.

  Laat T036 slagen.
- [X] T042 [P] [US3] Maak `frontend/src/components/SharedVideosWarningDialog.vue` volgens contracts/ui.md § Waarschuwing (`role="alertdialog"`, z-index boven `PublishDialog`). Laat T037 slagen.
- [X] T043 [US3] Vang in `frontend/src/editor/context.js` en `frontend/src/editor/CourseEditor.vue` een fout met `code === 'shared_videos_warning'` op bij publiceren:
  - toon `SharedVideosWarningDialog` met `error.videos`;
  - bij "Doorgaan" opnieuw `publish({ ...choices, acknowledgedVideoIds: videos.map((v) => v.id) })`;
  - bij "Annuleren" terug naar `PublishDialog` met de keuze ingevuld.

  Controleer dat `frontend/src/api/client.js` `videos` uit de foutbody doorgeeft (net als `issues`); pas hem anders aan. Laat T038 en T039 slagen.

**Checkpoint**: delen met beperkte video's vraagt altijd om een bewuste bevestiging, ook buiten de
interface om.

---

## Phase 6: User Story 4 - Beschikbaarheid van een gepubliceerde cursus wijzigen (Priority: P2)

**Goal**: "Beschikbaarheid wijzigen" in het publicatiemenu, zonder nieuwe versie, met de
bevestiging bij beperken en de waarschuwing bij een groter publiek (FR-006, FR-007).

**Independent Test**: een algemeen gedeelde cursus wijzigen naar "Selectief beschikbaar" voor B.
Na de bevestiging ziet C hem niet meer en B wel. Versienummer en datum zijn ongewijzigd.

### Tests for User Story 4

- [X] T044 [P] [US4] Schrijf `backend/tests/integration/courseAvailabilityChange.test.js` (FR-006, research R9):
  - **Wijzigen**: `PUT /api/organisation/courses/:id/availability` met `{ visibility: 'selective', accessOrganisationIds: [B] }` op een live public cursus zonder beperkte video's geeft `200`, met `availability` bijgewerkt. `status`, `publication.versionNumber`, `publication.publishedAt` en `Course.updatedAt` zijn ongewijzigd en er is geen nieuwe `CourseVersion`. C ziet de cursus niet meer in `GET /course-library`, B wel.
  - **Zonder live versie**: een concept of een onpubliceerde cursus geeft `409 course_not_live`, met "Publiceer de cursus eerst.".
  - **Ontbrekende of ongeldige `visibility`**: geeft `400`.
  - **Groter publiek met beperkte video's**: van `private` naar `public` met een beperkte video in de live versie geeft `409 shared_videos_warning`. Na bevestigen `200`.
  - **Beperken**: van `public` naar `selective` met beperkte video's geeft geen waarschuwing.
  - **Andermans cursus**: geeft `404` (breid ook `courseIsolation.test.js` uit).
- [X] T045 [P] [US4] Schrijf `frontend/tests/course-availability-dialog.test.js` (contracts/ui.md § Beschikbaarheid wijzigen):
  - voorgevuld;
  - bij beperken eerst `confirmationText(n, 'course')`;
  - "Opslaan" roept `changeCourseAvailability` aan;
  - een 409-waarschuwing toont `SharedVideosWarningDialog`, en "Doorgaan" verstuurt opnieuw met de bevestigde id's;
  - succes geeft de melding "Beschikbaarheid opgeslagen".

  Breid `frontend/tests/publish-button.test.js` uit: het menu-item `change-availability` staat
  alleen bij een live cursus, ook bij niet-opgeslagen wijzigingen.
- [X] T046 [P] [US4] Schrijf `e2e/tests/009-course-sharing-library/change-availability.spec.js` (quickstart 7, 8):
  - een live gedeelde cursus via het menu beperken tot B, met de bevestiging "1 organisatie kan …" (drie organisaties actief);
  - als C is de cursus daarna weg uit de bibliotheek;
  - de versie in de editor is ongewijzigd.

### Implementation for User Story 4

- [X] T047 [US4] Voeg `changeAvailability(courseId, organisationId, body)` toe aan `backend/src/modules/courses/courseService.js`, in één transactie met `withDeadlockRetry`:
  - de velden controleren zoals in T018, maar `visibility` is verplicht;
  - `lockCurrentDraft`;
  - de live versie ophalen via `liveVersions`, anders `courseNotLive()`;
  - `checkSharingWarning`, met als huidige toestand de huidige beschikbaarheid en als nieuwe de keuze, met de live versie als inhoud en als vorige versie (geval c kan dan niet voorkomen);
  - `setCourseAvailability` (verandert `updatedAt` niet);
  - het conceptdocument teruggeven.

  Voeg in `backend/src/modules/courses/courseRoutes.js` `PUT /courses/:id/availability` toe, die
  alleen `visibility`, `accessOrganisationIds` en `acknowledgedVideoIds` leest. Laat T044 slagen.
- [X] T048 [P] [US4] Voeg `changeCourseAvailability(id, choices)` (`PUT /api/organisation/courses/:id/availability`) toe aan `frontend/src/api/courses.js`.
- [X] T049 [US4] Maak `frontend/src/editor/CourseAvailabilityDialog.vue` volgens contracts/ui.md § Beschikbaarheid wijzigen:
  - de picker met `subject="course"`;
  - de bevestiging bij beperken;
  - na een 409 de waarschuwing via `SharedVideosWarningDialog`;
  - emit `saved` met het document.
- [X] T050 [US4] Voeg aan `frontend/src/editor/PublishMenu.vue` het item "Beschikbaarheid wijzigen" toe (`data-test="change-availability"`, alleen bij een live versie, nooit uitgegrijsd door niet-opgeslagen wijzigingen). Laat `frontend/src/editor/CourseEditor.vue` het venster uit T049 openen en na `saved` met `applyPublication` (of een nieuwe `applyAvailability` in `context.js`) alleen `availability` overnemen, zonder het concept of de geschiedenis van ongedaan maken te verversen. Laat T045 en T046 slagen.

**Checkpoint**: de eigenaar kan een live cursus breder of minder breed delen zonder nieuwe versie.

---

## Phase 7: User Story 5 - Uit de bibliotheek bij onpubliceren of verwijderen (Priority: P2)

**Goal**: onpubliceren en verwijderen halen een cursus meteen uit de bibliotheek. De
bevestigingen zeggen dat. Een open bibliotheek gaat netjes om met een cursus die intussen weg is
(FR-023 t/m FR-025).

**Independent Test**: een algemeen gedeelde cursus onpubliceren, waarna B hem niet meer ziet.
Opnieuw publiceren stelt "Algemeen beschikbaar" voor. Na verwijderen geeft de cursus ook bij
opvragen `404`.

### Tests for User Story 5

- [X] T051 [P] [US5] Breid `backend/tests/integration/courseLibrary.test.js` uit (FR-023, FR-024, SC-004):
  - na `POST /unpublish` is de cursus weg uit `GET /course-library` van B, en geeft `GET /course-library/:id` `404`;
  - `availability.visibility` blijft `public` in het conceptdocument van A;
  - na opnieuw publiceren (met waarschuwing als dat nodig is) staat hij er weer;
  - na `DELETE /courses/:id` is hij weg en geeft hij `404`.
- [X] T052 [P] [US5] Breid `frontend/tests/unpublish-dialog.test.js` en `frontend/tests/courses-view.test.js` uit (FR-025):
  - bij een gedeelde cursus (`visibility !== 'private'`) staat de zin "Andere organisaties zien hem dan ook niet meer in de cursusbibliotheek." in de bevestiging van onpubliceren en van verwijderen, en bij `private` niet;
  - `CoursesView` toont bij een gepubliceerde cursus de beschikbaarheid in tekst (contracts/ui.md § Status en overzicht).

  Breid `frontend/tests/course-library-view.test.js` uit: `getLibraryCourse` geeft `404`, waarna
  de toast "Deze cursus is niet meer beschikbaar." verschijnt, het venster sluit en de cursus uit
  de lijst gaat.
- [X] T053 [P] [US5] Schrijf `e2e/tests/009-course-sharing-library/leave-library.spec.js` (quickstart 12, 13):
  - A onpubliceert, waarna B de cursus na herladen niet meer ziet;
  - A publiceert opnieuw, en "Algemeen beschikbaar" is voorgeselecteerd;
  - B heeft de bibliotheek open terwijl A verwijdert. B klikt de cursus aan en krijgt de toast, en de cursus verdwijnt uit de lijst.

### Implementation for User Story 5

- [X] T054 [US5] Voeg aan `frontend/src/editor/UnpublishDialog.vue` een prop `shared` (boolean) toe, met de extra zin uit contracts/ui.md. Geef hem door vanuit `frontend/src/editor/CourseEditor.vue` (`availability.visibility !== 'private'`).
- [X] T055 [US5] Werk `frontend/src/views/CoursesView.vue` bij:
  - de beschikbaarheid in tekst onder de status van een gepubliceerde cursus: "Alleen eigen organisatie", "Algemeen beschikbaar" of "Selectief beschikbaar", zonder aantal organisaties (contracts/ui.md § Status en overzicht);
  - de extra zin in de bevestiging van verwijderen bij `visibility !== 'private'`.
- [X] T056 [US5] Handel in `frontend/src/views/CourseLibraryView.vue` een `404` van `getLibraryCourse` af (research R11): de toast "Deze cursus is niet meer beschikbaar.", het venster sluiten en de cursus uit de geladen lijst halen. Laat T052 en T053 slagen.

**Checkpoint**: alle user stories werken los en samen.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T057 [P] Breid `backend/tests/integration/questCourses.test.js` uit (FR-026, research R12): een algemeen gedeelde live cursus van A staat niet in `GET /api/quest/v1/courses` van een Quest van B, en `GET /api/quest/v1/courses/:id` van die cursus geeft voor B `404`.
- [ ] T058 [P] Breid `backend/scripts/seed-courses.js` uit (en indien nodig `backend/tests/integration/seedCourses.test.js`): de usability-omgeving krijgt minstens één algemeen gedeelde gepubliceerde cursus van een tweede organisatie, zodat de cursusbibliotheek niet leeg is (zie `docs/usability-testomgeving.md`).
- [X] T059 [P] Werk het commentaar bij dat nog naar "FR-12 later" of "always false in this feature" verwijst:
  - `backend/src/modules/quest/questCatalog.js`: noem dat deel 1 er is en deel 2 alleen deze functie verandert;
  - het commentaar bij `OrganisationCourse` in `courseRepository.js`;
  - `frontend/src/api/courses.js`.

  De oude migraties laat je ongemoeid.
- [X] T060 [P] Werk `docs/backlog.md` bij: noteer bij "Gedeelde cursussen overnemen (FR-12, deel 2)" dat deel 1 gebouwd is, en de open punten uit research R13 (verwijzing en later beperken; vastleggen van de toestemming voor beperkte video's). Werk de status van FR-12 in `docs/requirements.docx` alleen bij na akkoord van de gebruiker ("Deels geïmplementeerd").
- [X] T061 Draai:
  - `npm run lint` in `backend/` en `frontend/`;
  - de volledige backend- en frontendtests (`docker compose --profile test run --rm --build api-test` en `docker compose --profile test run --rm --build web-build npm test`);
  - de e2e-tests van 003, 006 en 009 (zie `docs/ci.md`).

  Alles moet groen zijn.
- [ ] T062 Loop de handmatige scenario's 1–16 van `specs/009-course-sharing-library/quickstart.md` door, en controleer met de SQL-query uit de quickstart de waarden van `visibility` en `CourseAccess`. Noteer afwijkingen in een tabel "Resultaten handmatige test" in de quickstart.

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Wanneer | Opmerking |
| --- | --- | --- |
| Setup (Phase 1) | direct | T001 vóór T002 (de migratie moet bestaan voordat tests de kolom gebruiken); T003 los |
| Foundational (Phase 2) | na Setup | blokkeert alle stories |
| US1 (Phase 3) | na Foundational | |
| US2 (Phase 4) | na Foundational | los van US1: de backend- en frontendtests zetten de beschikbaarheid direct in de database of in testdata. Alleen de e2e-test T027 heeft US1 nodig, omdat hij cursussen deelt via `POST /publish` met een beschikbaarheid |
| US3 (Phase 5) | na US1 | gebruikt de body van `publishCourse` en de dialoog |
| US4 (Phase 6) | na US3 | gebruikt `checkSharingWarning` en `SharedVideosWarningDialog` |
| US5 (Phase 7) | na US2 | voor de bibliotheek. De dialoogteksten (T054, T055) kunnen al na Foundational |
| Polish (Phase 8) | na alle stories | |

### Within Each User Story

- Tests eerst, en ze falen eerst. Daarna repository → service → route → frontend-API → componenten → editor of pagina.
- T007 vóór T040. T009 vóór T018, T029 en T047.
- T018 vóór T019. T021 vóór T022.
- T028 vóór T029 vóór T030. T032 en T033 vóór T034 vóór T035.
- T040 vóór T041. T042 vóór T043.
- T047 vóór T049 vóór T050.

### Parallel Opportunities

- T003 kan tegelijk met T001 en T002.
- De tests van Foundational (T004–T006) kunnen tegelijk. T011 en T012 kunnen tegelijk met T007–T010.
- Na Foundational kunnen US1 en US2 tegelijk worden gebouwd: backend (`courseService.js` tegen een nieuwe module `courseLibrary/`) en frontend (de editor tegen een nieuwe pagina). Ze raken geen gedeelde bestanden, behalve `backend/src/app.js` (alleen US2).
- Binnen US2 kunnen T023–T027 tegelijk, en T031 en T032 tegelijk met T028–T030.
- US3 en US4 raken allebei `courseService.js`, `context.js` en `CourseEditor.vue`: die niet tegelijk wijzigen.
- T054 en T055 (US5) kunnen tegelijk met US3 en US4.

---

## Parallel Example: User Story 2

```bash
# Tests tegelijk schrijven:
Task: "T023 courseLibrary.test.js in backend/tests/integration/"
Task: "T024 courseLibraryIsolation.test.js in backend/tests/integration/"
Task: "T025 course-library.test.js in frontend/tests/"
Task: "T026 course-library-view.test.js en course-library-details.test.js"
Task: "T027 course-library.spec.js in e2e/tests/009-course-sharing-library/"

# Backend en frontend tegelijk bouwen:
Task: "T028–T030 courseLibrary-module (repository, service, routes)"
Task: "T031 frontend/src/api/courseLibrary.js"
Task: "T032 frontend/src/lib/courseLibrary.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 + 3)

1. Phase 1 (Setup) en Phase 2 (Foundational).
2. Phase 3 (US1): delen bij publiceren.
3. Phase 4 (US2): de bibliotheek. Delen is nu zichtbaar.
4. Phase 5 (US3): de waarschuwing. Pas daarmee is delen veilig, omdat beperkte video's niet
   ongemerkt meegaan. **US1 + US2 + US3 samen zijn de kleinste versie die in gebruik kan.**
5. **STOP en VALIDEER**: quickstart 1–6, 9–11, 16.

### Incremental Delivery

1. Setup + Foundational: alles nog "Alleen eigen organisatie".
2. US1 + US2 + US3: delen en vinden (MVP).
3. US4: beschikbaarheid wijzigen.
4. US5: de teksten en de nette afhandeling bij verdwijnen. Het verdwijnen zelf werkt al door US2.
5. Polish, daarna deel 2 (overnemen, `docs/backlog.md`).

---

## Notes

- [P] = andere bestanden, geen afhankelijkheden.
- De bibliotheek, "live" en de waarschuwing hebben elk één definitie (T028, `liveVersions`, T007).
  Schrijf nergens een eigen variant.
- Andere organisaties krijgen nooit inhoud, video-id's, het concept of de gekozen organisaties
  te zien (FR-016, FR-018). Controleer dat in elke nieuwe route.
- Wijzig `questLiveVersions` en `ownCoursesQuery` niet. Die horen bij deel 2.
- Commit na elke taak of logische groep. Stop bij elk checkpoint om de story los te testen.
