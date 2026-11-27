---
description: "Takenlijst voor de feature Gedeelde cursussen overnemen als verwijzing (FR-12, deel 2)"
---

# Tasks: Gedeelde cursussen overnemen als verwijzing (FR-12, deel 2)

**Input**: Design documents from `/specs/010-course-reference-takeover/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: werk zoals in de features 006 en 009, met per story gerichte tests:
- backend: tegen een echte MariaDB (Vitest + Supertest);
- frontend: Vitest + Vue Test Utils;
- e2e: Playwright.

Schrijf de tests vóór de implementatie en controleer dat ze eerst falen.

**Organization**: de taken zijn gegroepeerd per user story (US1–US5, genummerd zoals in spec.md),
zodat elke story los te bouwen en te testen is.

**Conventies** (constitutie VI):
- **Engels**: code, commentaar, routes (`/course-references`, `/update`, `/keep`), velden
  (`courseVersionId`, `declinedCourseVersionId`, `takenOver`, `receivers`, `receiverCount`,
  `newVersion`, `notice`, `withdrawn`) en foutcodes (`course_already_added`, `no_newer_version`).
- **Nederlands**: UI-teksten en `message`, letterlijk zoals in [contracts/ui.md](contracts/ui.md)
  en [contracts/api.md](contracts/api.md). In de interface staat nooit "verwijzing" (FR-023).

**Kernregels**:
- **Verwijzingen**: welke verwijzingen een organisatie heeft, wordt alleen bepaald door
  `referencesQuery` in `backend/src/modules/courseReferences/courseReferenceRepository.js`
  (research R3).
- **Toestand**: melding, nieuwere versie en reden van intrekken worden alleen bepaald door
  `referenceState` in `backend/src/lib/courseReference.js` (research R4).
- **Toegang tot nieuwe versies**: alleen via `libraryCoursesQuery` (specs/009) plus
  `liveVersions` (research R5). Schrijf geen eigen variant met `visibility` of `CourseAccess`.
- **Quests**: alleen `questLiveVersions` in `backend/src/modules/quest/questCatalog.js` verandert
  (research R6).
- **Eigenaarsroutes**: `ownCoursesQuery` blijft alleen `isOwner = TRUE` lezen. Wijzig die query
  niet; zo blijft bewerken van een verwijzing vanzelf 404 (FR-008).
- **Geen kopieën en geen geschiedenistabel**: er wordt niets gekopieerd (FR-003) en er komt geen
  overnamegeschiedenis (Clarifications, research R2).

**Bestaande code om te hergebruiken**:
- `backend/src/modules/courses/courseRepository.js`: `liveVersions`, `latestPublishedVersions`,
  `versionContents`, `videoFiles`, `isVideoInVersions`.
- `backend/src/modules/courseLibrary/courseLibraryRepository.js`: `libraryCoursesQuery`;
  `courseLibraryService.js` als voorbeeld voor een lijst in een vast aantal queries.
- `backend/src/modules/quest/questThumbnail.js`: `thumbnailVideoId`.
- `backend/src/lib/sendStoredFile.js`, `backend/src/lib/deadlockRetry.js` (`withDeadlockRetry`),
  `backend/src/lib/errors.js`.
- Testhelpers: `backend/tests/helpers/testApp.js` (`createCourseRow`, `createPublishedVersionRow`,
  `createStepRow`, `createVideoRow`, `restrictVideo`, `softDeleteVideo`, `createOrganisationRow`,
  `agentWithSession`), `backend/tests/helpers/quest.js` (`publishedCourse`, `route`, `questGet`,
  `questLink`), `backend/tests/helpers/sharing.js` (`saveRoute`, `publish`, `changeAvailability`,
  `library`).
- Frontend: `frontend/src/components/CourseLibraryDetailsDialog.vue`, `OwnerPill.vue`,
  `Modal.vue`, `PublicationStatus.vue`; `frontend/src/lib/publication.js` (`formatPublishedAt`),
  `frontend/src/lib/videoAccess.js` (`audience`, `countLosingAccess`, `confirmationText`),
  `frontend/src/lib/ui.js` (`confirmDialog`, `toast`); `frontend/src/views/CoursesView.vue`,
  `CourseLibraryView.vue`; `frontend/src/editor/PublishMenu.vue`, `PublishDialog.vue`,
  `UnpublishDialog.vue`, `CourseAvailabilityDialog.vue`.
- E2e: `e2e/helpers/course.js` (`createCompleteCourse`, `publishCourse`), `e2e/helpers/sharing.js`
  (`shareCourse`, `openCourseLibrary`, `libraryCard`, `choosePublishItem`), `e2e/helpers/org-api.js`.

Alle bestaande tests moeten groen blijven.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: kan parallel lopen (andere bestanden, geen afhankelijkheden)
- **[Story]**: de user story waar de taak bij hoort (US1–US5)
- Paden zijn relatief aan de root van de repository

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: de wijziging in het datamodel, de testhelpers en het ERD

- [X] T001 Maak de migratie `backend/src/db/migrations/20261127000001_course_references.js` (data-model.md § Migratie):
  - In `OrganisationCourse` twee kolommen toevoegen: `courseVersionId` en `declinedCourseVersionId`, allebei `integer().unsigned().nullable().references('id').inTable('CourseVersion')`.
  - Engels commentaar: `courseVersionId` = "the chosen version of a reference (isOwner = false); always NULL for the owner"; `declinedCourseVersionId` = "the live version for which the receiver chose to keep its current version; NULL otherwise".
  - Geen nieuwe tabel (research R2). Bestaande rijen blijven NULL.
  - `down`: eerst de FK's, dan de twee kolommen verwijderen.
- [X] T002 Pas `backend/tests/helpers/testApp.js` aan:
  - In `resetDatabase` moet `OrganisationCourse` vóór `CourseVersion` geleegd worden (nieuwe FK, data-model.md § Migratie).
  - Voeg `createReferenceRow({ organisationId, courseId, courseVersionId, declinedCourseVersionId = null, addedAt })` toe: een `OrganisationCourse`-rij met `isOwner: false`.
- [X] T003 [P] Werk het ERD `docs/Diagrams.simp` bij (research R12): `OrganisationCourse` krijgt `courseVersionId` en `declinedCourseVersionId` (beide FK → `CourseVersion`, NULL). Vul de notitie bij `isOwner` aan met "FALSE = overgenomen cursus (verwijzing); wijst naar `courseVersionId`". Er komt geen nieuwe tabel.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: de enige definities (verwijzingen, toestand), het verwijzingsdocument en de frontend-basis

**⚠️ CRITICAL**: geen story kan beginnen voordat deze fase klaar is

### Tests for Foundational

- [X] T004 [P] Schrijf `backend/tests/unit/courseReferenceState.test.js`: een tabel van gevallen voor `referenceState` met precies de rijen uit data-model.md § Toestand van een verwijzing, plus:
  - volgorde van redenen: eigenaar verwijderd én cursus verwijderd geeft `owner_deleted`; cursus verwijderd én geen live versie geeft `course_deleted`; geen live versie én geen toegang geeft `unpublished`;
  - `newVersion` is `null` bij elke `withdrawn` en bij live = gekozen versie;
  - `notice` is `false` als `live.id === declinedVersionId`, en `true` als er een nog nieuwere live versie is dan de geweigerde.
- [X] T005 [P] Schrijf `backend/tests/integration/courseReferenceRepository.test.js`:
  - `referencesQuery(B)` geeft alleen rijen met `isOwner = false` van B, ook naar een verwijderde cursus en van een verwijderde eigenaar (research R3);
  - nooit een eigenaarsrij en nooit een rij van een andere organisatie;
  - `receiversOf([courseId])` geeft per cursus de actieve ontvangers `{ id, name }`, alfabetisch, zonder verwijderde organisaties en zonder de eigenaar;
  - `versionsByIds` geeft de versierijen in dezelfde vorm als `latestPublishedVersions`.
- [X] T006 [P] Schrijf `frontend/tests/course-reference.test.js` voor `frontend/src/lib/courseReference.js`: de vier `withdrawn`-teksten met " Jullie houden versie N." (contracts/ui.md § Cursusoverzicht), "Nieuwe versie beschikbaar (versie N)", "Nieuwere versie beschikbaar (versie N)", en de zinnen over ontvangers in enkelvoud en meervoud (contracts/ui.md § Bij de eigenaar).

### Implementation for Foundational

- [X] T007 [P] Maak `backend/src/lib/courseReference.js` met de pure functie `referenceState({ chosen, live, declinedVersionId, courseDeleted, ownerDeleted, hasAccess })`, met de uitkomst `{ withdrawn, newVersion, notice }` precies volgens research R4. Er zijn geen database-aanroepen. Laat T004 slagen.
- [X] T008 Voeg `versionsByIds(versionIds, trx = db)` toe aan `backend/src/modules/courses/courseRepository.js`: een Map `id → versierij` met dezelfde kolommen als `latestPublishedVersions` (`id`, `courseId`, `versionNumber`, `name`, `description`, `publishedAt`, `unpublishedAt`). Bij een lege lijst een lege Map.
- [X] T009 Maak `backend/src/modules/courseReferences/courseReferenceRepository.js`, met bovenaan commentaar dat dit de enige definitie is (zoals in `courseLibraryRepository.js`):
  - `referencesQuery(organisationId, trx = db)`: `OrganisationCourse as r` met `r.organisationId = organisationId` en `r.isOwner = false`, join `Course as c` (geen filter op `deletedAt`), join de eigenaarsrij (`OrganisationCourse` met `isOwner = true`) en `Organisation as o` (geen filter op `deletedAt`). Select `r.courseId`, `r.addedAt`, `r.courseVersionId`, `r.declinedCourseVersionId`, `c.deletedAt as courseDeletedAt`, `o.id as ownerId`, `o.name as ownerName`, `o.deletedAt as ownerDeletedAt`. Gooi een fout bij een lege `organisationId`.
  - `insertReference(trx, organisationId, courseId, courseVersionId)`: `isOwner: false`, `addedAt: UTC_TIMESTAMP()`.
  - `setChosenVersion(trx, organisationId, courseId, courseVersionId)`: zet ook `declinedCourseVersionId` op NULL.
  - `setDeclinedVersion(trx, organisationId, courseId, courseVersionId)`.
  - `deleteReference(organisationId, courseId)`: alleen `isOwner = false`; geeft het aantal verwijderde rijen terug.
  - `receiversOf(courseIds, trx = db)`: Map `courseId → [{ id, name }]` van niet-verwijderde ontvangers, gesorteerd op `name`, `id`.

  Elke where-clause op `isOwner = false` staat expliciet. Laat T005 slagen.
- [X] T010 [P] Voeg aan `backend/src/lib/errors.js` toe:
  - `courseAlreadyAdded()`: 409, `course_already_added`, "Deze cursus staat al bij jullie cursussen.";
  - `noNewerVersion(reference)`: 409, `no_newer_version`, "Er is geen nieuwere versie om te gebruiken.", met `error.reference = reference`.

  Breid `send` in `backend/src/middleware/errorHandler.js` uit, zodat `reference` net als `issues` en `videos` in de JSON-fout komt.
- [X] T011 Maak `backend/src/modules/courseReferences/courseReferenceService.js` met de interne functie `loadReferences(organisationId, onlyCourseId = null, trx = db)`. Die bouwt de verwijzingsobjecten van contracts/api.md § Gedeeld in een vast aantal queries, ongeacht het aantal (research R10):
  1. `referencesQuery` (eventueel `.where('r.courseId', onlyCourseId)`);
  2. `versionsByIds` voor de gekozen versies en de geweigerde versies;
  3. `liveVersions` voor alle cursussen;
  4. `libraryCoursesQuery(organisationId).whereIn('c.id', ids)` voor `hasAccess`;
  5. `versionContents` en `videoFiles` voor de gekozen versies (`stepCount`, `videoCount`, en de afbeelding via `thumbnailVideoId`).

  Bepaal de toestand per verwijzing met `referenceState`. Geef `{ reference, imageKey }` terug. `thumbnailUrl` = `/api/organisation/course-references/<courseId>/thumbnail?v=<versionNumber>` als er een afbeelding is, anders `null` (research R11). Er zijn nooit onderdelen, video-id's of het concept. Export ook `toNoticeCount(references)`.
- [X] T012 Maak `backend/src/modules/courseReferences/courseReferenceRoutes.js` met een lege `Router` en de helper `idParam` (zoals in `courseLibraryRoutes.js`). Koppel hem in `backend/src/app.js` aan `/api/organisation`, achter `requireOrganisation`, na `courseLibraryRoutes`.
- [X] T013 [P] Maak `frontend/src/api/courseReferences.js` met `listReferences()`, `getReference(courseId)`, `addReference(courseId)`, `removeReference(courseId)`, `useNewVersion(courseId)` en `keepVersion(courseId)`, volgens contracts/api.md.
- [X] T014 [P] Maak `frontend/src/lib/courseReference.js` met `withdrawnText(reference)`, `newVersionLabel(reference)` en `receiversSentence(count)` / `losingReceiversSentence(count)`, letterlijk volgens contracts/ui.md. Gebruik de enkelvoud/meervoud-hulpfunctie van specs/009. Laat T006 slagen.
- [X] T015 Maak de Pinia-store `frontend/src/stores/courseReferences.js`:
  - state: `references`, `noticeCount`, `loaded`;
  - acties: `load()` (via `listReferences`; fouten worden stil genegeerd, de teller blijft dan 0), `replace(reference)` (één verwijzing bijwerken en `noticeCount` opnieuw tellen), `remove(courseId)`, `add(reference)` en `reset()`.
  - Bij uitloggen leeg maken, zoals de andere stores.

**Checkpoint**: verwijzingen kunnen gelezen en hun toestand bepaald worden; de stories kunnen beginnen

---

## Phase 3: User Story 1 - Een cursus uit de bibliotheek toevoegen aan de eigen organisatie (Priority: P1) 🎯 MVP

**Goal**: een organisatie voegt een gedeelde cursus toe als verwijzing; hij komt op haar Quests in de gekozen versie

**Independent Test**: A deelt een cursus algemeen. B voegt hem toe via het bibliotheekvenster. De bibliotheek van B toont "Toegevoegd". De Quest-API van B geeft de cursus met inhoud, thumbnail en video's; die van C niet.

### Tests for User Story 1

- [X] T016 [P] [US1] Schrijf `backend/tests/integration/courseReferenceAdd.test.js` (contracts/api.md § `POST /course-references`):
  - 201 met het verwijzingsobject. De rij heeft `isOwner = false`, een `addedAt` en `courseVersionId` = de live versie (FR-003, SC-007); die versie hoort bij dezelfde `courseId` en heeft `publishedAt` (data-model.md § OrganisationCourse). Er is geen nieuwe cursus, versie of stap bijgekomen (FR-003).
  - 404 voor een cursus die niet bestaat, verwijderd is, geen live versie heeft, `private` is, `selective` zonder B, of van B zelf is (FR-004). Overal dezelfde body.
  - 409 `course_already_added` bij een tweede keer (FR-005).
  - 400 bij een ontbrekende of ongeldige `courseId`.
  - Gelijktijdigheid (research R8): start toevoegen en beperken naar `private` tegelijk (`Promise.all`). Daarna geldt óf beide gelukt in de volgorde "toevoegen, dan beperken", óf toevoegen 404. Er mag nooit een verwijzing zijn naar een versie terwijl de cursus op het moment van toevoegen al `private` was.
  - Als beheerder: 401/403, zoals bij de andere organisatieroutes (FR-023).
- [X] T017 [P] [US1] Breid de Quest-tests uit (FR-010, research R6):
  - `backend/tests/integration/questCourses.test.js`: na toevoegen door B staat de cursus in `GET /api/quest/v1/courses` van B, met `id` = het origineel en `versionNumber` van de gekozen versie. Hij staat niet bij C. De eigen cursussen van B staan er nog.
  - `backend/tests/integration/questDownload.test.js`: `GET /courses/:id` van B geeft de inhoud van de gekozen versie.
  - `backend/tests/integration/questThumbnail.test.js`: de afbeelding van de gekozen versie.
  - `backend/tests/integration/questVideos.test.js`: een video "Alleen eigen organisatie" van A in de gekozen versie is voor de Quest van B te downloaden.
- [X] T018 [P] [US1] Breid `backend/tests/integration/courseLibrary.test.js` uit: `takenOver` is `false` vóór en `true` na toevoegen, alleen voor de organisatie die toevoegde. Een eigen cursus heeft geen `takenOver`.
- [X] T019 [P] [US1] Breid `frontend/tests/course-library-view.test.js` uit (contracts/ui.md § Venster in de cursusbibliotheek, § Bevestiging toevoegen):
  - knop `add-course` alleen bij een cursus van een andere organisatie met `takenOver = false`;
  - de bevestiging met de letterlijke tekst; annuleren roept de API niet aan;
  - na succes de toast, de pil `course-added` en de store bijgewerkt;
  - bij 404 de toast "Deze cursus is niet meer beschikbaar." en de lijst opnieuw geladen;
  - de pil "Toegevoegd" in de lijst.
- [X] T020 [P] [US1] Schrijf `e2e/tests/010-course-reference-takeover/take-over.spec.js` (US1 scenario's 1–6): A deelt een complete cursus algemeen (`shareCourse`). B opent de bibliotheek, voegt toe en ziet "Toegevoegd". Via de Quest-API met de koppelcode van B staat de cursus erin; bij C niet.

### Implementation for User Story 1

- [X] T021 [US1] Voeg `addReference(organisationId, body)` toe aan `courseReferenceService.js` (research R8):
  - valideer `courseId` (positief geheel getal, anders `validationError({ courseId: 'Laad de pagina opnieuw en probeer het nog eens.' })`);
  - in `withDeadlockRetry(() => db.transaction(...))`: lock de `Course`-rij met `.forShare()`; controleer met `libraryCoursesQuery(organisationId).where('c.id', courseId)` en `liveVersions` dat de cursus in de bibliotheek staat en live is; een eigen cursus (`ownerId === organisationId`) is ook `notFound()`;
  - bestaat er al een rij voor (organisatie, cursus), dan `courseAlreadyAdded()`. Vang ook een duplicate-key-fout af en zet die om;
  - `insertReference` met de live versie, en geef `loadReferences(organisationId, courseId, trx)` terug.
- [X] T022 [US1] Voeg `POST /course-references` toe aan `courseReferenceRoutes.js`. Lees alleen `courseId` uit de body; de organisatie komt uit `getOrganisationId(req)`. Antwoord 201.
- [X] T023 [US1] Wijzig `questLiveVersions` in `backend/src/modules/quest/questCatalog.js` (research R6):
  - eigen cursussen zoals nu;
  - plus `referencesQuery(organisationId, trx)` → `versionsByIds` van de `courseVersionId`'s, toegevoegd aan de Map met `courseId` als sleutel. Geen filter op `deletedAt`, `unpublishedAt`, `visibility` of de eigenaar (FR-011).
  - Werk het commentaar bovenaan bij: deel 2 is er, en dit is nog steeds de enige plek.

  Laat T017 slagen. Controleer dat `questPerformance.test.js` groen blijft.
- [X] T024 [US1] Voeg in `backend/src/modules/courseLibrary/courseLibraryService.js` het veld `takenOver` toe voor cursussen van andere organisaties. Gebruik één extra query: `OrganisationCourse` met `organisationId`, `isOwner = false` en `whereIn('courseId', ids)`. Laat T018 slagen.
- [X] T025 [US1] Pas `frontend/src/components/CourseLibraryDetailsDialog.vue` aan (contracts/ui.md § Venster in de cursusbibliotheek, § Bevestiging toevoegen):
  - de knop "Toevoegen aan mijn organisatie" met `confirmDialog` en de letterlijke tekst;
  - `addReference`, en daarna de store en een emit `added` zodat de lijst de pil toont;
  - "Toegevoegd" met de link "Bekijken bij mijn cursussen";
  - foutafhandeling bij 404 (emit `unavailable`) en 409.
- [X] T026 [US1] Pas `frontend/src/views/CourseLibraryView.vue` aan: de pil "Toegevoegd" bij `takenOver`, `added` bijwerken in de lijst, en bij `unavailable` de toast en de lijst opnieuw laden. Laat T019 slagen.

**Checkpoint**: overnemen werkt en de cursus staat op de Quests (MVP met US2)

---

## Phase 4: User Story 2 - Een overgenomen cursus in het eigen cursusoverzicht (Priority: P1)

**Goal**: de ontvanger ziet haar overgenomen cursussen, kan de samenvatting bekijken en de cursus weer verwijderen; bewerken kan nooit

**Independent Test**: B heeft een verwijzing (direct in de database of via US1). Het overzicht van B toont de cursus onder "Overgenomen cursussen" met "Overgenomen van A". Het venster toont de samenvatting zonder editor. Verwijderen haalt hem weg bij B en van de Quests van B, en verandert niets bij A of C.

### Tests for User Story 2

- [X] T027 [P] [US2] Schrijf `backend/tests/integration/courseReferenceList.test.js` (contracts/api.md § `GET /course-references`, `/:courseId`, `/thumbnail`):
  - de lijst is op naam gesorteerd, met naam, beschrijving, `version` (nummer, datum, `stepCount`, `videoCount`), `owner`, `addedAt` en `thumbnailUrl` uit de gekozen versie, niet uit de live versie (FR-006, FR-007);
  - geen `steps`, `answers`, video-id's of conceptvelden in het antwoord;
  - `GET /:courseId` voor een cursus zonder verwijzing, of een eigen cursus, geeft 404;
  - de thumbnail geeft de afbeelding van de gekozen versie, ook als die video "Alleen eigen organisatie" van A is (research R11); zonder afbeelding 404;
  - de video's van de overgenomen cursus staan niet in `GET /api/organisation/videos` van B (spec, Edge Cases), tenzij ze al op een andere manier voor B beschikbaar zijn.
- [X] T028 [P] [US2] Schrijf `backend/tests/integration/courseReferenceRemove.test.js` (FR-009):
  - `DELETE` geeft 204 en de rij is weg;
  - `Course`, versies, `visibility`, `CourseAccess` en de verwijzing van C zijn ongewijzigd;
  - de Quest van B ziet de cursus niet meer;
  - een tweede `DELETE` geeft 404; `DELETE` op een eigen cursus geeft 404 en verwijdert niets;
  - opnieuw toevoegen geeft een nieuwe `addedAt` en de live versie van dat moment.
- [X] T029 [P] [US2] Schrijf `backend/tests/integration/courseReferenceIsolation.test.js` (FR-008, FR-024, SC-003):
  - B met een verwijzing naar een cursus van A krijgt 404 op `GET/PUT/DELETE /api/organisation/courses/:id`, `publish`, `unpublish`, `availability` en de thumbnail van een onderdeel. A's cursus blijft ongewijzigd;
  - C kan de verwijzing van B niet lezen, verwijderen, bijwerken of houden (allemaal 404);
  - `GET /api/organisation/courses` van B bevat de overgenomen cursus niet (die zit alleen in `/course-references`).
- [X] T030 [P] [US2] Schrijf `backend/tests/integration/courseReferencePerformance.test.js` (research R10): 200 eigen en 200 overgenomen cursussen; `GET /course-references` en `GET /courses` samen binnen 2 s. Volg het patroon van `courseLibraryPerformance.test.js`.
- [X] T031 [P] [US2] Breid `frontend/tests/courses-view.test.js` uit (contracts/ui.md § Cursusoverzicht):
  - de kop "Overgenomen cursussen" alleen bij verwijzingen;
  - een rij met de thumbnail, de pil "Overgenomen van A" en "Op de Quest: versie N · datum";
  - geen knoppen om te bewerken of te verwijderen in de rij; klikken opent het venster;
  - de lege lijst met de extra zin en de link naar de cursusbibliotheek.
- [X] T032 [P] [US2] Schrijf `frontend/tests/taken-over-course-dialog.test.js` (contracts/ui.md § Venster van een overgenomen cursus, § Bevestiging verwijderen):
  - de samenvatting met "Toegevoegd op <datum>";
  - geen link naar de editor;
  - "Verwijderen uit mijn organisatie" met de bevestigingstekst, en de extra zin alleen bij `withdrawn`;
  - na succes de toast en een emit `removed`.
- [X] T033 [P] [US2] Schrijf `e2e/tests/010-course-reference-takeover/taken-over-course.spec.js` (US2 scenario's 1–6): B ziet de cursus in het overzicht, opent het venster, kan niet naar de editor (ook niet via de URL `/courses/<id>`: de editor laadt de cursus niet en toont dezelfde melding als bij een onbekende cursus), verwijdert hem en voegt hem opnieuw toe.

### Implementation for User Story 2

- [X] T034 [US2] Voeg aan `courseReferenceService.js` toe:
  - `listReferences(organisationId)` → `{ references, noticeCount }`, op naam (`localeCompare('nl', { sensitivity: 'base' })`, dan `courseId`);
  - `getReference(organisationId, courseId)` → het object, of `notFound()`;
  - `getReferenceThumbnailKey(organisationId, courseId)` → `imageKey`, of `notFound()`;
  - `removeReference(organisationId, courseId)` → `notFound()` als `deleteReference` 0 teruggeeft.
- [X] T035 [US2] Voeg aan `courseReferenceRoutes.js` toe:
  - `GET /course-references` en `GET /course-references/:courseId`;
  - `DELETE /course-references/:courseId` (204);
  - `GET /course-references/:courseId/thumbnail` via `sendStoredFile(res, key, { contentType: 'image/jpeg', cacheControl: 'private, max-age=3600' })`, waarbij de query-parameter `v` genegeerd wordt.

  Laat T027–T030 slagen.
- [X] T036 [US2] Maak `frontend/src/components/TakenOverCourseDialog.vue` (contracts/ui.md § Venster van een overgenomen cursus): `Modal` met de samenvatting (zoals `CourseLibraryDetailsDialog.vue`, met de pil "Overgenomen van <eigenaar>" via `OwnerPill`) en "Toegevoegd op". In de voet "Verwijderen uit mijn organisatie" (rood, links) met de bevestiging, en "Sluiten". Laat ruimte (een slot of sectie) voor het versieblok en de uitleg van US3/US4.
- [X] T037 [US2] Pas `frontend/src/views/CoursesView.vue` aan:
  - laad `listCourses()` en `courseReferences.load()` tegelijk (`Promise.all`);
  - toon de sectie "Overgenomen cursussen" met rijen (`data-test="taken-over-row"`) en de status in de opmaak van `PublicationStatus` met `status="published"` en de gekozen versie;
  - open `TakenOverCourseDialog` bij een klik, en werk de store en de lijst bij na `removed`;
  - voeg de extra zin met de link toe aan de lege lijst.

  Laat T031 en T032 slagen.

**Checkpoint**: US1 + US2 samen zijn de kleinste bruikbare versie: overnemen, zien, verwijderen

---

## Phase 5: User Story 3 - Melding bij een nieuwe versie en kiezen welke versie (Priority: P1)

**Goal**: bij een nieuwe versie van de eigenaar ziet de ontvanger een melding en kiest zij zelf; tot die keuze blijft de oude versie op de Quests

**Independent Test**: B heeft versie 1. A publiceert versie 2: B ziet de teller en de melding, en de Quest van B houdt versie 1. "Huidige versie houden": de melding verdwijnt. A publiceert versie 3: de melding komt terug. "Nieuwe versie gebruiken": de Quest van B krijgt versie 3.

### Tests for User Story 3

- [X] T038 [P] [US3] Schrijf `backend/tests/integration/courseReferenceVersions.test.js` (FR-012 – FR-016):
  - na een nieuwe publicatie van A: `newVersion` en `notice = true`, en `noticeCount = 1`. De Quest van B heeft nog de oude versie;
  - een concept opslaan of de beschikbaarheid wijzigen geeft geen melding (FR-016);
  - onpubliceren en opnieuw publiceren met dezelfde inhoud (dezelfde versie) geeft geen nieuwe melding (FR-016);
  - `keep`: `notice = false`, `newVersion` blijft, en `declinedCourseVersionId` = de live versie. Een volgende publicatie geeft weer `notice = true` (FR-015);
  - `update`: `courseVersionId` = de live versie van dat moment (van dezelfde cursus, met `publishedAt`), `declinedCourseVersionId = NULL`, en de Quest krijgt de nieuwe versie (FR-014);
  - twee publicaties zonder keuze: één melding met de nieuwste versie, en `update` kiest de nieuwste;
  - `update` zonder nieuwere versie, of bij `withdrawn`, geeft 409 `no_newer_version` met `reference`, en verandert niets;
  - `keep` zonder nieuwere versie geeft 200 en verandert niets;
  - gelijktijdig `update` en beperken naar `private` (research R8): de verwijzing wijst nooit naar een versie die gekozen werd nadat de toegang verviel.
- [X] T039 [P] [US3] Breid `frontend/tests/taken-over-course-dialog.test.js` uit met het versieblok:
  - de tekst met beide versies en datums;
  - "Huidige versie houden" alleen bij `notice`;
  - na `update` de toast "Jullie VR-brillen krijgen versie {M} bij de volgende synchronisatie." en de nieuwe versie in het venster;
  - bij 409 `no_newer_version` neemt het venster `reference` over, zonder foutmelding.
- [X] T040 [P] [US3] Breid `frontend/tests/courses-view.test.js` uit met het label "Nieuwe versie beschikbaar (versie N)" (met icoon, `data-test="new-version-notice"`) en de rustige tekst "Nieuwere versie beschikbaar (versie N)" na houden.
- [X] T041 [P] [US3] Schrijf `frontend/tests/organisation-layout.test.js`: de teller `notice-count` bij "Cursussen" alleen als `noticeCount > 0`, met `aria-label` in enkelvoud en meervoud. De store wordt bij het mounten geladen.
- [X] T042 [P] [US3] Schrijf `e2e/tests/010-course-reference-takeover/new-version.spec.js` (quickstart-scenario's 8–11): A publiceert een nieuwe versie; B ziet de teller en de melding; houden; A publiceert opnieuw; B kiest de nieuwe versie; de Quest-API van B geeft de nieuwe `versionNumber`.

### Implementation for User Story 3

- [X] T043 [US3] Voeg aan `courseReferenceService.js` toe:
  - `useNewVersion(organisationId, courseId)`: in één transactie met `.forShare()` op de `Course`-rij; bepaal de toestand opnieuw met `loadReferences(..., trx)`; zonder `newVersion` gooi je `noNewerVersion(reference)`; anders `setChosenVersion` met de live versie, en geef het bijgewerkte object terug;
  - `keepVersion(organisationId, courseId)`: met `newVersion` `setDeclinedVersion` op de live versie; geef het object terug.
- [X] T044 [US3] Voeg `POST /course-references/:courseId/update` en `POST /course-references/:courseId/keep` toe aan `courseReferenceRoutes.js`. Ze lezen geen body. Laat T038 slagen.
- [X] T045 [US3] Voeg het versieblok toe aan `frontend/src/components/TakenOverCourseDialog.vue` (contracts/ui.md): de knoppen `use-new-version` en `keep-version`, de toast, en het overnemen van `reference` bij 409. Werk de store bij met `replace`. Laat T039 slagen.
- [X] T046 [US3] Toon in `frontend/src/views/CoursesView.vue` de melding en de rustige tekst per rij, via `newVersionLabel` uit `frontend/src/lib/courseReference.js`. Werk na acties in het venster de rij bij uit de store. Laat T040 slagen.
- [X] T047 [US3] Voeg de teller toe aan `frontend/src/components/OrganisationLayout.vue`: `courseReferences.load()` in `onMounted`, en een rond getal naast "Cursussen" met `aria-label` (contracts/ui.md § Teller). Kleur is niet het enige signaal: het getal staat er. Roep `reset()` van de store aan bij uitloggen. Laat T041 slagen.

**Checkpoint**: ontvangers kiezen zelf welke versie op hun Quests staat

---

## Phase 6: User Story 4 - Wat er met een verwijzing gebeurt als de eigenaar intrekt, verwijdert of beperkt (Priority: P2)

**Goal**: ontvangers houden hun versie als de eigenaar intrekt, verwijdert of beperkt, of zelf verwijderd wordt; zij zien waarom, en de eigenaar ziet wie de cursus heeft overgenomen

**Independent Test**: B en C hebben een verwijzing. A beperkt naar alleen C: B houdt haar versie en ziet "deelt niet meer". A verwijdert de cursus: B en C houden hun versie met de bijbehorende uitleg. De bevestigingen bij A noemen het aantal ontvangers, en het menu toont hun namen.

### Tests for User Story 4

- [X] T048 [P] [US4] Breid `backend/tests/integration/courseReferenceList.test.js` uit met alle `withdrawn`-redenen (FR-017, FR-011):
  - onpubliceren → `unpublished`;
  - zacht verwijderen → `course_deleted`;
  - beperken naar `private` of naar `selective` zonder B → `no_access`;
  - de eigenaar door de beheerder verwijderd → `owner_deleted`, met de oude naam van de eigenaar.

  In elk geval is `newVersion = null` en `notice = false`, en geeft de Quest van B nog steeds de gekozen versie (inhoud, thumbnail, video's). Herstellen (opnieuw publiceren, weer toegang geven) maakt `withdrawn` weer `null`, en geeft een melding als de live versie nieuwer is.
- [X] T049 [P] [US4] Breid de eigenaarstests uit (FR-019, Clarifications):
  - `backend/tests/integration/courseLibrary.test.js`: een eigen gedeelde cursus heeft `receivers` (actieve ontvangers, alfabetisch); een cursus van een ander nooit;
  - `backend/tests/integration/courseAvailabilityDocument.test.js`: het conceptdocument heeft `receivers`;
  - `backend/tests/integration/courseStatus.test.js` (of de lijsttest): `GET /courses` heeft `receiverCount` per rij;
  - een verwijderde ontvanger telt nergens mee.
- [X] T050 [P] [US4] Breid `backend/tests/integration/courseCrud.test.js` uit: verwijderen van een cursus met ontvangers zet alleen `deletedAt`. De cursus en versies blijven bestaan, staan niet in `GET /courses` van A en niet in de bibliotheek (FR-018).
- [X] T051 [P] [US4] Breid de frontendtests uit (contracts/ui.md § Bij de eigenaar, § Cursusoverzicht):
  - `frontend/tests/courses-view.test.js`: de `withdrawn`-teksten per rij (geen melding, geen versieblok); de zin over ontvangers in de bevestiging van verwijderen bij `receiverCount > 0`;
  - `frontend/tests/taken-over-course-dialog.test.js`: bij `withdrawn` de uitleg en geen versieblok;
  - `frontend/tests/unpublish-dialog.test.js`: de zin over ontvangers;
  - `frontend/tests/course-sharing-editor.test.js`: "Overgenomen door …" in het publicatiemenu; in de beperk-bevestiging (PublishDialog en CourseAvailabilityDialog) de zin "{n} daarvan hebben …", alleen voor ontvangers die toegang verliezen;
  - `frontend/tests/course-library-view.test.js`: de rij "Overgenomen door" in het venster van een eigen cursus.
- [X] T052 [P] [US4] Schrijf `e2e/tests/010-course-reference-takeover/owner-withdraws.spec.js` (quickstart-scenario's 12–16): beperken, onpubliceren, opnieuw publiceren en verwijderen door A, met na elke stap de uitleg bij B en C en de Quest-API van B en C.

### Implementation for User Story 4

- [X] T053 [US4] Voeg in `backend/src/modules/courseLibrary/courseLibraryService.js` `receivers` toe voor eigen cursussen (`owner.isOwn`), via `receiversOf` uit `courseReferenceRepository.js` (één query voor alle eigen cursussen).
- [X] T054 [US4] Voeg in `backend/src/modules/courses/courseService.js` toe:
  - `receivers` in `toDraftDocument` (via `receiversOf([course.id], trx)`);
  - `receiverCount` per rij in `listCourses` (één query met `receiversOf` voor alle ids).

  Laat T049 en T050 slagen.
- [X] T055 [US4] Toon in `frontend/src/views/CoursesView.vue` en `TakenOverCourseDialog.vue` de uitleg via `withdrawnText`, grijs met een info-icoon (`data-test="withdrawn"`). Bij `withdrawn` is er geen versieblok. Geef `withdrawn` door aan de bevestiging van verwijderen (de extra zin, al gebouwd in T036).
- [X] T056 [US4] Pas de eigenaarsschermen aan (contracts/ui.md § Bij de eigenaar):
  - `frontend/src/editor/PublishMenu.vue`: "Overgenomen door {n} organisaties: <namen>" (`data-test="menu-receivers"`) uit `receivers` van het conceptdocument;
  - `frontend/src/editor/UnpublishDialog.vue`: de zin `receiversSentence(receivers.length)`;
  - `frontend/src/views/CoursesView.vue` (`remove`): de zin bij `receiverCount > 0`, na de zinnen van specs/006 en 009;
  - de beperk-bevestiging in `frontend/src/editor/PublishDialog.vue` en `CourseAvailabilityDialog.vue`: tel de ontvangers die niet in de nieuwe doelgroep zitten (met `audience` uit `frontend/src/lib/videoAccess.js`) en voeg `losingReceiversSentence(n)` toe als n > 0;
  - `frontend/src/components/CourseLibraryDetailsDialog.vue`: de rij "Overgenomen door" voor een eigen cursus.

  Laat T051 slagen.

**Checkpoint**: alle situaties van de eigenaar zijn afgehandeld en uitgelegd

---

## Phase 7: User Story 5 - Gebruik van video's door overgenomen versies (Priority: P2)

**Goal**: de video's in een gekozen versie blijven bestaan en te downloaden, ook als de eigenaar ze verwijdert of beperkt

**Independent Test**: B staat op versie 1 met video X. A vervangt X in versie 2 en verwijdert X. De Quest van B kan X nog downloaden, en de opruimtaak laat het bestand staan.

### Tests for User Story 5

- [X] T057 [P] [US5] Schrijf `backend/tests/integration/courseReferenceVideos.test.js` (FR-021, SC-005, research R7):
  - B op een oude versie met video X; A publiceert een versie zonder X en verwijdert X (zacht). `GET /api/quest/v1/videos/X` voor B werkt, en `runVideoFileCleanup()` verwijdert het bestand niet;
  - X beperkt naar "Alleen eigen organisatie" door de eigenaar: de Quest van B krijgt hem nog;
  - B stapt over naar de nieuwe versie: X geeft nu 404 voor de Quest van B (US5 scenario 4);
  - een video die alleen in de nieuwe live versie zit, geeft 404 voor B zolang B die versie niet koos.

### Implementation for User Story 5

- [X] T058 [US5] Werk het commentaar bij in `backend/src/jobs/videoFileCleanup.js`: een video in de gekozen versie van een verwijzing blijft staan, omdat gepubliceerde versies en hun onderdelen nooit verwijderd worden (research R7). Er is geen codewijziging nodig. Controleer dat T057 slaagt zonder andere wijzigingen; zo niet, los het op in `questCatalog.js` en niet met een nieuw "in gebruik"-mechanisme.

**Checkpoint**: alle user stories zijn los te gebruiken

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T059 [P] Werk het commentaar bij dat nog naar "FR-12 part 2 later" verwijst: `backend/src/modules/courseLibrary/courseLibraryService.js`, `courseLibraryRepository.js`, `backend/src/modules/courses/courseRepository.js` (bij `insertCourse` en `ownCoursesQuery`: "owner rows only; references live in courseReferences") en `frontend/src/api/courses.js`. De oude migraties laat je ongemoeid.
- [ ] T060 [P] Breid `backend/scripts/seed-courses.js` uit (en zo nodig `backend/tests/integration/seedCourses.test.js`): in de usability-omgeving heeft een organisatie minstens één overgenomen cursus van een tweede organisatie, met een nieuwere versie, zodat de melding te zien is (zie `docs/usability-testomgeving.md`).
- [X] T061 [P] Werk `docs/backlog.md` bij: noteer bij "Gedeelde cursussen overnemen als verwijzing (spec 010)" dat het gebouwd is, en zet de open punten van spec 009 R13 op afgehandeld (research R2, R13; User Story 4). Werk de status van FR-12 in `docs/Requirements.docx` alleen bij na akkoord van de gebruiker.
- [X] T062 Draai:
  - `npm run lint` in `backend/` en `frontend/`;
  - de volledige backend- en frontendtests (`docker compose --profile test run --rm --build api-test` en `docker compose --profile test run --rm --build web-build npm test`);
  - de e2e-tests van 003, 006, 009 en 010 (zie `docs/ci.md`).

  Alles moet groen zijn.
- [ ] T063 Loop de handmatige scenario's 1–18 van `specs/010-course-reference-takeover/quickstart.md` door, en controleer met de SQL-query uit de quickstart `addedAt`, `courseVersionId` en `declinedCourseVersionId`. Noteer afwijkingen in een tabel "Resultaten handmatige test" in de quickstart.

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Wanneer | Opmerking |
| --- | --- | --- |
| Setup (Phase 1) | direct | T001 vóór T002; T003 los |
| Foundational (Phase 2) | na Setup | blokkeert alle stories |
| US1 (Phase 3) | na Foundational | |
| US2 (Phase 4) | na Foundational | los van US1: de tests maken verwijzingen met `createReferenceRow`. Alleen de e2e-test T033 gebruikt het toevoegen uit US1 |
| US3 (Phase 5) | na US2 | gebruikt `TakenOverCourseDialog` en de rijen van het overzicht |
| US4 (Phase 6) | na US2 | de backendtaken T053–T054 kunnen al na Foundational; de frontend bouwt op het overzicht en het venster |
| US5 (Phase 7) | na US1 | gebruikt de wijziging in `questLiveVersions` (T023) |
| Polish (Phase 8) | na alle stories | |

### Within Each User Story

- Tests eerst, en ze falen eerst. Daarna repository → service → route → frontend-API → store → componenten → pagina.
- T007 en T009 vóór T011. T011 vóór T021, T034 en T043.
- T013–T015 vóór T025, T036 en T047.
- T021 vóór T022. T023 vóór T057.
- T034 vóór T035. T036 vóór T037. T043 vóór T044 vóór T045.
- T036 (venster) vóór T045 en T055.

### Parallel Opportunities

- T003 kan tegelijk met T001 en T002.
- De tests van Foundational (T004–T006) kunnen tegelijk. T007, T010, T013 en T014 raken elk een eigen bestand.
- Na Foundational kunnen US1 (backend: service toevoegen, `questCatalog`, bibliotheek; frontend: bibliotheekvenster) en US2 (backend: lijst/verwijderen; frontend: overzicht en nieuw venster) tegelijk. Let op: beide wijzigen `courseReferenceService.js` en `courseReferenceRoutes.js`; spreek de volgorde af of werk na elkaar in die twee bestanden.
- Binnen elke story kunnen alle tests met [P] tegelijk worden geschreven.
- US4-backend (T053, T054) kan tegelijk met US3.
- US5 (T057, T058) kan tegelijk met US3 en US4.

---

## Parallel Example: User Story 2

```bash
# Tests tegelijk schrijven:
Task: "T027 courseReferenceList.test.js in backend/tests/integration/"
Task: "T028 courseReferenceRemove.test.js in backend/tests/integration/"
Task: "T029 courseReferenceIsolation.test.js in backend/tests/integration/"
Task: "T030 courseReferencePerformance.test.js in backend/tests/integration/"
Task: "T031 courses-view.test.js in frontend/tests/"
Task: "T032 taken-over-course-dialog.test.js in frontend/tests/"
Task: "T033 taken-over-course.spec.js in e2e/tests/010-course-reference-takeover/"

# Backend en frontend tegelijk bouwen:
Task: "T034–T035 courseReferences-module (service, routes)"
Task: "T036 frontend/src/components/TakenOverCourseDialog.vue"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Phase 1 (Setup) en Phase 2 (Foundational).
2. Phase 3 (US1): toevoegen; de cursus staat op de Quests.
3. Phase 4 (US2): de cursus zien en weer verwijderen. **US1 + US2 samen zijn de kleinste versie
   die in gebruik kan**: zonder US2 kan een ontvanger niet zien wat ze heeft overgenomen en het
   niet ongedaan maken.
4. **STOP en VALIDEER**: quickstart 1–6 en 17.

### Incremental Delivery

1. Setup + Foundational: datamodel en definities.
2. US1 + US2: overnemen, zien, verwijderen (MVP). Nieuwe versies van de eigenaar komen dan nog
   niet bij ontvangers; die blijven op hun versie.
3. US3: meldingen en zelf kiezen.
4. US4: uitleg bij intrekken, verwijderen en beperken, en de ontvangers bij de eigenaar. Het
   gedrag (de versie blijft op de Quest) werkt al vanaf US1; US4 voegt de uitleg en de teksten toe.
5. US5: tests en commentaar voor het gebruik van video's.
6. Polish, daarna spec 011 (eigen kopie bij aanpassen, `docs/backlog.md`).

---

## Notes

- [P] = andere bestanden, geen afhankelijkheden.
- Verwijzingen, hun toestand, de toegang en wat een Quest ziet hebben elk één definitie
  (`referencesQuery`, `referenceState`, `libraryCoursesQuery`, `questLiveVersions`). Schrijf
  nergens een eigen variant.
- Een ontvanger krijgt nooit onderdelen, video-id's, het concept of andere versies dan de gekozen
  en de live versie (alleen nummer en datum) te zien. Controleer dat in elke nieuwe route.
- Wijzig `ownCoursesQuery` niet.
- Commit na elke taak of logische groep. Stop bij elk checkpoint om de story los te testen.

## Implementatienotities (2026-11-27)

- De Quest-tests van T017 staan in één nieuw bestand `backend/tests/integration/questCourseReferences.test.js`
  in plaats van verspreid over `questCourses`, `questDownload`, `questThumbnail` en `questVideos`.
- De eigenaarstests van T018, T049 en T050 staan in `backend/tests/integration/courseReferenceOwner.test.js`;
  `courseLibrary.test.js` en `courseCrud.test.js` kregen alleen de nieuwe velden `takenOver` en `receiverCount`
  in hun verwachtingen.
- De `withdrawn`-redenen van T048 staan in `courseReferenceList.test.js`; T029 test de editor-URL via de API (404).
- T003: de twee velden staan in het ERD; de tekstnotitie bij `isOwner` in `docs/Diagrams.simp` is niet aangepast
  (die tekst staat woord voor woord in losse alinea's en is beter in Software Ideas Modeler zelf bij te werken).
- T062: de backendtests zijn lokaal met Vitest tegen de `db-test`-container gedraaid, de frontendtests met Vitest,
  en de e2e-tests van 003, 006, 009 en 010 tegen de lokale stack (na `docker compose up -d --build` en
  `knex migrate:latest`). Alles groen. `docker compose --profile test run --rm --build api-test` is niet apart gedraaid.
- Open: T060 (seed voor de usability-omgeving) en T063 (handmatige scenario's), zie `docs/backlog.md`.
