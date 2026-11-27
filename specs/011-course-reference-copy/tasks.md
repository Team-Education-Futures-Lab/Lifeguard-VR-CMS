---
description: "Takenlijst voor de feature Een overgenomen cursus aanpassen als eigen kopie (FR-12, deel 3, en FR-14)"
---

# Tasks: Een overgenomen cursus aanpassen als eigen kopie (FR-12, deel 3, en FR-14)

**Input**: Design documents from `/specs/011-course-reference-copy/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: werk zoals in de features 006, 009 en 010, met per story gerichte tests:
- backend: tegen een echte MariaDB (Vitest + Supertest);
- frontend: Vitest + Vue Test Utils;
- e2e: Playwright.

Schrijf de tests vóór de implementatie en controleer dat ze eerst falen.

**Organization**: de taken zijn gegroepeerd per user story (US1–US4, genummerd zoals in spec.md),
zodat elke story los te bouwen en te testen is.

**Conventies** (constitutie VI):
- **Engels**: code, commentaar, routes (`/course-references/:courseId/copy`), velden (`basedOn`,
  `courseName`, `ownerName`, `keptFromOriginal`, `hasCopy`), functies (`copyReference`,
  `grantedVideoIds`, `basedOnOf`, `findOwnCopyOf`) en foutcodes (`course_already_copied`).
- **Nederlands**: UI-teksten en `message`, letterlijk zoals in [contracts/ui.md](contracts/ui.md)
  en [contracts/api.md](contracts/api.md). In de interface staat nooit "verwijzing" (FR-019).

**Kernregels**:
- **Aanpassen** gebeurt alleen in `copyReference` in
  `backend/src/modules/courseReferences/courseReferenceService.js`, in één transactie (research R1).
  Het origineel, zijn versies, zijn beschikbaarheid en rijen van andere organisaties worden niet
  geschreven (FR-008).
- **Meegekregen video's** worden alleen bepaald door `grantedVideoIds` in
  `backend/src/modules/courses/courseRepository.js`: video's in versie 1 van een cursus met
  `parentCourseId IS NOT NULL`, met `Video.deletedAt IS NULL` (research R4). Schrijf geen eigen
  variant.
- **Gebaseerd op** wordt alleen bepaald door `basedOnOf` (research R6): nieuwste gepubliceerde
  versie van het origineel, nooit een conceptnaam; geen filter op `deletedAt`.
- **Eigenaarsroutes**: `ownCoursesQuery` en de afscherming blijven ongewijzigd. Een kopie is
  gewoon een eigen cursus. De enige uitzonderingen voor kopieën zijn de deelregel (R5) en de
  video-uitzondering (R4).
- **Geen migratie**: `Course.parentCourseId` bestaat al (research R10). Opslaan (`checkVideos`),
  de videobibliotheek (`visibleVideosQuery`), `libraryCoursesQuery` en `questCatalog` veranderen
  niet.

**Bestaande code om te hergebruiken**:
- `backend/src/modules/courses/courseRepository.js`: `copyVersionAsDraft`, `freezeDraft`,
  `latestPublishedVersions`, `liveVersions`, `findOwnCourse`, `ownCoursesQuery`.
- `backend/src/modules/courseReferences/courseReferenceRepository.js`: `referencesQuery`,
  `receiversOf`.
- `backend/src/lib/deadlockRetry.js` (`withDeadlockRetry`), `backend/src/lib/errors.js`,
  `backend/src/middleware/errorHandler.js` (extra velden in de JSON-fout, zoals `reference`).
- `backend/src/lib/courseCheck.js` (`checkCourse`), `frontend/src/lib/completeness.js` (dezelfde
  regels; `frontend/tests/course-check-parity.test.js` bewaakt dat ze gelijk blijven).
- Testhelpers: `backend/tests/helpers/testApp.js` (`createCourseRow` met `parentCourseId`,
  `createPublishedVersionRow`, `createStepRow`, `createVideoRow`, `restrictVideo`,
  `softDeleteVideo`, `createReferenceRow`, `createOrganisationRow`, `agentWithSession`),
  `backend/tests/helpers/quest.js`, `backend/tests/helpers/sharing.js` (`saveRoute`, `publish`,
  `changeAvailability`, `library`).
- Frontend: `frontend/src/components/TakenOverCourseDialog.vue`, `CourseLibraryDetailsDialog.vue`;
  `frontend/src/stores/courseReferences.js` (`remove`, `load`); `frontend/src/lib/ui.js`
  (`confirmDialog`, `toast`); `frontend/src/editor/context.js` (`confirmLosingVideo`, `isLost`).
- E2e: `e2e/helpers/course.js`, `e2e/helpers/sharing.js`, `e2e/helpers/references.js`,
  `e2e/helpers/org-api.js`; voorbeelden in `e2e/tests/010-course-reference-takeover/`.

Alle bestaande tests moeten groen blijven.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: kan parallel lopen (andere bestanden, geen afhankelijkheden)
- **[Story]**: de user story waar de taak bij hoort (US1–US4)
- Paden zijn relatief aan de root van de repository

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: testhelpers en het ERD

- [X] T001 [P] Voeg aan `backend/tests/helpers/sharing.js` toe: `copyReference(agent, courseId)` = `agent.post('/api/organisation/course-references/<courseId>/copy')` met de CSRF-header zoals de andere helpers, en `takenOverCourse({ ownerId, receiverId, steps })`: maakt een gepubliceerde, algemeen gedeelde cursus van de eigenaar met de gegeven onderdelen (via `createCourseRow`, `createPublishedVersionRow`, `createStepRow`, `visibility: 'public'`) en een verwijzing van de ontvanger op die versie (`createReferenceRow`). Geeft `{ courseId, versionId, stepIds }`.
- [X] T002 [P] Voeg aan `e2e/helpers/references.js` toe: `copyTakenOverCourse(page, name)`: opent in het cursusoverzicht de overgenomen cursus met die naam, klikt "Aanpassen" (`data-test="copy-reference"`), bevestigt met "Aanpassen" en wacht tot de URL `/courses/<id>` is.
- [X] T003 [P] Werk het ERD `docs/Diagrams.simp` bij (research R10): vul de notitie bij `Course.parentCourseId` aan met "gevuld voor een aangepaste kopie van een overgenomen cursus (spec 011); zo'n cursus staat nooit in de bibliotheek en is altijd 'private'". Geen nieuwe tabellen of velden.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: de enige definities (meegekregen video's, gebaseerd op, bestaande kopie), de fout en de frontend-basis

**⚠️ CRITICAL**: geen story kan beginnen voordat deze fase klaar is

### Tests for Foundational

- [X] T004 [P] Schrijf `backend/tests/integration/courseCopyRepository.test.js` (data-model.md § Afgeleide gegevens):
  - `grantedVideoIds([copyId])` geeft de video's van de onderdelen van versie 1 van een kopie; niet die van versie 2 of later; zonder zacht verwijderde video's; wel een beperkte video (`restrictVideo`) en een video van een verwijderde organisatie. Lege Set voor een cursus zonder `parentCourseId`.
  - `basedOnOf([copyId, ownId])` geeft voor de kopie `{ courseName, ownerName }` met de naam van de **nieuwste gepubliceerde** versie van het origineel (niet het concept, ook als die ingetrokken is), ook als het origineel of de eigenaar verwijderd is; geen sleutel voor een gewone cursus.
  - `findOwnCopyOf(organisationId, originalId)` geeft het id van een niet-verwijderde eigen kopie van dat origineel, anders `undefined`; nooit een kopie van een andere organisatie of een verwijderde kopie.
  - `findOwnCourse` geeft ook `parentCourseId`.
- [X] T005 [P] Schrijf `frontend/tests/course-reference.test.js` (uitbreiden) voor de nieuwe teksten in `frontend/src/lib/courseReference.js`: `basedOnText({ courseName, ownerName })` = "Gebaseerd op <courseName> van <ownerName>", `copyConfirmation(reference)` (titel, tekst met versienummer, naam en eigenaar, en knoppen, letterlijk contracts/ui.md § Bevestiging aanpassen), en de hint "Jullie hebben al een aangepaste kopie van deze cursus.".

### Implementation for Foundational

- [X] T006 Breid `backend/src/modules/courses/courseRepository.js` uit (research R4, R6, R3); geef elke functie Engels commentaar dat het de enige definitie is:
  - `findOwnCourse`: select ook `c.parentCourseId`.
  - `grantedVideoIds(courseIds, trx = db)`: Map `courseId → Set(videoId)`; join `Course as c` (`c.parentCourseId IS NOT NULL`) → `CourseVersion as cv` (`cv.versionNumber = 1`) → `CourseStep as s` (`s.videoId IS NOT NULL`) → `Video as v` (`v.deletedAt IS NULL`). Eén query; lege Map bij een lege lijst.
  - `basedOnOf(courseIds, trx = db)`: Map `courseId → { courseName, ownerName }` voor cursussen met `parentCourseId`: `latestPublishedVersions(parentIds)` voor de naam, en de eigenaarsrij (`OrganisationCourse` met `isOwner = true`) van het origineel → `Organisation.name`. Geen filter op `deletedAt`. Vast aantal queries.
  - `findOwnCopyOf(organisationId, originalCourseId, trx = db)`: `Course as c` met `c.parentCourseId = originalCourseId`, `c.deletedAt IS NULL`, en een `OrganisationCourse`-rij van de organisatie met `isOwner = true`. Geeft het id of `undefined`.
  - `insertCopyCourse(trx, organisationId, originalCourseId)`: `Course` met `parentCourseId`, `visibility: 'private'`, `createdAt`/`updatedAt` = `UTC_TIMESTAMP()`, plus `OrganisationCourse` (`isOwner: true`, `addedAt` = `UTC_TIMESTAMP()`). Geeft het nieuwe id.

  Laat T004 slagen.
- [X] T007 [P] Voeg aan `backend/src/lib/errors.js` toe: `courseAlreadyCopied(courseId)`: 409, `course_already_copied`, "Deze cursus is al aangepast. De aangepaste cursus staat bij je cursussen.", met `error.courseId = courseId`. Breid `send` in `backend/src/middleware/errorHandler.js` uit zodat `courseId` (als het op de fout staat) in de JSON-fout komt, zoals `reference`.
- [X] T008 [P] Voeg aan `frontend/src/api/courseReferences.js` toe: `copyReference(courseId)` = `POST /api/organisation/course-references/<courseId>/copy`; geeft `{ courseId }`.
- [X] T009 [P] Voeg aan `frontend/src/lib/courseReference.js` toe: `basedOnText`, `copyConfirmation(reference)`, `HAS_COPY_HINT` en `COPY_NOT_SHARED` ("Een aangepaste cursus is alleen voor jouw organisatie en kan niet gedeeld worden."), letterlijk volgens contracts/ui.md. Laat T005 slagen.

**Checkpoint**: de afgeleide regels bestaan; de stories kunnen beginnen

---

## Phase 3: User Story 1 - Een overgenomen cursus aanpassen en een eigen kopie krijgen (Priority: P1) 🎯 MVP

**Goal**: "Aanpassen" maakt in één transactie een eigen kopie van de gekozen versie en opent de editor

**Independent Test**: B heeft een cursus van A overgenomen op versie 2 (A heeft intussen versie 3). B klikt "Aanpassen" en bevestigt: de editor opent met de inhoud van versie 2; het cursusoverzicht toont de kopie met "Gebaseerd op <cursus> van A" en niet meer de overgenomen cursus.

### Tests for User Story 1

- [X] T010 [P] [US1] Schrijf `backend/tests/integration/courseReferenceCopy.test.js` (contracts/api.md § `POST /course-references/:courseId/copy`):
  - 201 met `{ courseId }` van een nieuwe cursus; `Course.parentCourseId` = origineel, `visibility = 'private'`; `OrganisationCourse` van B met `isOwner = true`; de verwijzingsrij van B is weg.
  - De kopie heeft precies twee versies: versie 1 met `publishedAt` gevuld en `unpublishedAt` NULL, versie 2 met `publishedAt` NULL (data-model.md § CourseVersion).
  - De inhoud van beide versies is gelijk aan de **gekozen** versie (naam, beschrijving, onderdelen, `isStart`, vragen, antwoorden met `isCorrect` en `sortOrder`, verbindingen, posities, `videoId`), ook als A een nieuwere live versie heeft, of als B "Huidige versie houden" koos (FR-003, spec Edge Cases). Vergelijk met `sameContent` uit `backend/src/lib/courseContent.js`.
  - Ook als A de cursus heeft ingetrokken, verwijderd of beperkt (B zonder toegang), of A zelf verwijderd is (FR-001).
  - `GET /courses/<kopie>` geeft het conceptdocument met `status = 'published'`, `publication.versionNumber = 1`, `draftVersionNumber = 2`, `basedOn = { courseName, ownerName }`; `GET /courses` bevat de kopie met `basedOn`; `GET /course-references` bevat het origineel niet meer en `noticeCount` telt het niet meer.
  - 404 voor een onbekend id, een eigen cursus, een cursus zonder verwijzing van B, en een niet-numeriek id.
- [X] T011 [P] [US1] Schrijf `backend/tests/integration/courseReferenceCopyConcurrency.test.js` (FR-006, SC-004): 10 gelijktijdige verzoeken (`Promise.all`) voor dezelfde verwijzing geven precies één 201 en voor de rest `409 course_already_copied` met `courseId` = de kopie; in de database precies één cursus met dat `parentCourseId` van B. Een `DELETE /course-references/:id` tegelijk met `copy`: óf de verwijzing is weg zonder kopie, óf er is een kopie zonder verwijzing (FR-005). `POST /course-references/:id/update` ("Nieuwe versie gebruiken") tegelijk met `copy`: de inhoud van de kopie is gelijk aan de versie waar de verwijzing op stond op het moment dat `copy` de rij vergrendelde (oude of nieuwe versie, nooit een mengsel), en er is daarna geen verwijzing meer (spec, Edge Cases "versie net gewisseld").
- [X] T012 [P] [US1] Breid `backend/tests/integration/questCourseReferences.test.js` uit (FR-018, SC-007): na aanpassen geeft `GET /courses` van een Quest van B de kopie (nieuw id, versie 1) en niet het origineel; de inhoud en video's van de kopie zijn te downloaden; de vorm van de antwoorden is gelijk.
- [X] T013 [P] [US1] Breid `frontend/tests/taken-over-course-dialog.test.js` uit (contracts/ui.md § Venster, § Bevestiging): de knop "Aanpassen" staat er ook bij een melding en bij elke `withdrawn`; annuleren roept de API niet aan; bevestigen roept `copyReference` aan, haalt de verwijzing uit de store en navigeert naar `/courses/<id>`; de knop is uitgeschakeld zolang het verzoek loopt; bij `409 course_already_copied` een toast met de servertekst en het venster sluit; bij 404 de toast uit contracts/ui.md. De tekst van het venster en de bevestiging bevat nergens het woord "verwijzing" (FR-019).
- [X] T014 [P] [US1] Breid `frontend/tests/courses-view.test.js` uit: een eigen cursus met `basedOn` toont "Gebaseerd op <cursus> van <organisatie>" (`data-test="based-on"`) en geen pil "Overgenomen van"; zonder `basedOn` geen regel.

### Implementation for User Story 1

- [X] T015 [US1] Voeg aan `backend/src/modules/courseReferences/courseReferenceRepository.js` toe: `lockReference(trx, organisationId, courseId)`: de rij met `isOwner = false` `FOR UPDATE`, geeft `{ courseVersionId }` of `undefined`; en `deleteReferenceInTransaction(trx, organisationId, courseId)` (alleen `isOwner = false`).
- [X] T016 [US1] Voeg `copyReference(organisationId, courseId)` toe aan `backend/src/modules/courseReferences/courseReferenceService.js` (research R1 – R3), in `withDeadlockRetry(() => db.transaction(...))`:
  1. `lockReference`; zonder rij: `findOwnCopyOf(organisationId, courseId, trx)` → `courseAlreadyCopied(id)`, anders `notFound()`;
  2. `insertCopyCourse(trx, organisationId, courseId)`;
  3. `copyVersionAsDraft(trx, courseVersionId, copyId, 1)` → `freezeDraft(trx, v1)` → `copyVersionAsDraft(trx, v1, copyId, 2)`;
  4. `deleteReferenceInTransaction`;
  5. return `{ courseId: copyId }`.

  Engels commentaar met verwijzing naar spec 011 FR-003 – FR-008 en spec 010 R13. Niets van het origineel wordt geschreven of vergrendeld.
- [X] T017 [US1] Voeg aan `backend/src/modules/courseReferences/courseReferenceRoutes.js` toe: `POST /course-references/:courseId/copy` → `res.status(201).json(await service.copyReference(getOrganisationId(req), courseId(req)))`; geen body lezen. Laat T010 – T012 slagen.
- [X] T018 [US1] Voeg `basedOn` toe in `backend/src/modules/courses/courseService.js`: in `toDraftDocument` (`(await repo.basedOnOf([course.id], trx)).get(course.id) ?? null`) en in `listCourses` (één `basedOnOf` voor alle rijen). Bij een gewone cursus `null`.
- [X] T019 [US1] Pas `frontend/src/components/TakenOverCourseDialog.vue` aan (contracts/ui.md): knop "Aanpassen" (`data-test="copy-reference"`) naast "Verwijderen uit mijn organisatie"; `confirmDialog` met `copyConfirmation(current)`; bij bevestigen `copyReference`, `store.remove(courseId)`, `router.push('/courses/' + id)` en de toast "Je eigen kopie is klaar. Je kunt hem nu aanpassen."; foutafhandeling voor 409 en 404 (lijsten opnieuw laden via de store en `emit('removed')`/`emit('close')`). Laat T013 slagen.
- [X] T020 [P] [US1] Pas `frontend/src/views/CoursesView.vue` aan: onder de naam van een eigen cursus met `basedOn` een rustige regel `basedOnText(c.basedOn)` (`data-test="based-on"`). Laat T014 slagen.
- [X] T021 [P] [US1] Pas de kop van `frontend/src/editor/CourseEditor.vue` aan: als het conceptdocument `basedOn` heeft, de regel `basedOnText(...)` (`data-test="editor-based-on"`) bij de naam. Zorg dat `basedOn` via `frontend/src/lib/courseMapping.js` / de editorstate beschikbaar is zonder het in het opgeslagen concept mee te sturen.
- [X] T022 [US1] Schrijf `e2e/tests/011-course-reference-copy/copy-course.spec.js` (quickstart scenario's 1 – 4): annuleren verandert niets; aanpassen opent de editor met de gekozen versie en "Gebaseerd op"; het cursusoverzicht toont de kopie en niet meer de overgenomen cursus; de teller in de navigatie telt de melding niet meer.

**Checkpoint**: aanpassen werkt end-to-end; de kopie staat op de Quests

---

## Phase 4: User Story 2 - De kopie is een gewone eigen cursus (Priority: P1)

**Goal**: de kopie werkt als elke eigen cursus, maar kan nooit gedeeld worden of in de bibliotheek komen

**Independent Test**: B wijzigt in de kopie een vraag en publiceert (versie 2 van de kopie op de Quests), onpubliceert en verwijdert hem. Een poging om de kopie te delen wordt geweigerd; de kopie staat in geen enkele bibliotheek.

### Tests for User Story 2

- [X] T023 [P] [US2] Schrijf `backend/tests/integration/courseCopySharing.test.js` (FR-013, SC-006):
  - `POST /courses/<kopie>/publish` zonder `visibility` of met `"private"` lukt; met `"public"` of `"selective"` → `400 validation_failed` (het bestaande foutformaat), `fields.visibility` = "Een aangepaste cursus kan niet gedeeld worden.", en er verandert niets (geen nieuwe versie, `visibility` blijft `private`, geen `CourseAccess`).
  - `PUT /courses/<kopie>/availability` met `"public"`/`"selective"` → dezelfde 422; met `"private"` lukt.
  - `GET /course-library` van A, B en C bevat de kopie nooit, ook niet nadat B gepubliceerd heeft; `GET /course-library/<kopie>` → 404.
  - Gewone cursussen van B kunnen nog steeds gedeeld worden (regressie).
- [X] T024 [P] [US2] Schrijf `backend/tests/integration/courseCopyOwnCourse.test.js` (FR-011): opslaan, publiceren (versie 2 van de kopie, daarna nieuw concept versie 3), onpubliceren en verwijderen van de kopie werken zoals bij een eigen cursus; de Quest-API van B volgt; het origineel verandert bij geen van deze stappen.
- [X] T025 [P] [US2] Breid `frontend/tests/course-sharing-editor.test.js` (of `frontend/tests/publish-dialog.test.js`) uit: bij een concept met `basedOn` toont `PublishDialog` geen `AvailabilityPicker` maar de zin `COPY_NOT_SHARED` (`data-test="copy-not-shared"`) en stuurt het publiceren geen `visibility`; `PublishMenu` toont geen "Beschikbaarheid wijzigen". Zonder `basedOn` alles zoals nu.

### Implementation for User Story 2

- [X] T026 [US2] Pas `resolveAvailability` in `backend/src/modules/courses/courseService.js` aan (research R5): geef de cursus (met `parentCourseId` uit `findOwnCourse`) mee; is het een kopie en is `choices.visibility` gezet en niet `'private'`, gooi `validationError({ visibility: 'Een aangepaste cursus kan niet gedeeld worden.' })` vóór er iets geschreven wordt. Werkt voor `publishCourse` en `changeAvailability`. Laat T023 en T024 slagen.
- [X] T027 [US2] Pas `frontend/src/editor/PublishDialog.vue` en `frontend/src/editor/PublishMenu.vue` aan (contracts/ui.md § Publiceren): bij `basedOn` geen `AvailabilityPicker`, geen bibliotheekzin, wel `COPY_NOT_SHARED`; de `confirm`-emit stuurt dan geen `visibility`; het menu-item "Beschikbaarheid wijzigen" staat er niet. Geef `basedOn` door vanuit `frontend/src/editor/CourseEditor.vue`. Laat T025 slagen.
- [X] T028 [US2] Schrijf `e2e/tests/011-course-reference-copy/copy-is-own-course.spec.js` (quickstart scenario 7): na aanpassen een tekst wijzigen en publiceren zonder deelkeuze in het venster; status "Op de Quest: versie 2"; onpubliceren en verwijderen; de kopie staat in de bibliotheek van geen enkele organisatie.

**Checkpoint**: de kopie is volledig te beheren en blijft privé

---

## Phase 5: User Story 3 - Meegekregen video's blijven bruikbaar in de kopie (Priority: P1)

**Goal**: video's uit de gekozen versie blijven in de kopie werken buiten de bibliotheek en na beperken; verwijderde video's volgen constitutie V

**Independent Test**: de kopie van B bevat video X (niet in de bibliotheek van B). B publiceert na een wijziging: lukt, Quests kunnen X downloaden. A beperkt X; B onpubliceert en publiceert opnieuw: lukt. X staat niet in de videobibliotheek en de videokeuze van B.

### Tests for User Story 3

- [X] T029 [P] [US3] Schrijf `backend/tests/integration/courseCopyVideos.test.js` (FR-014 – FR-017, SC-005; data-model.md tabel bij § Meegekregen video's):
  - In het conceptdocument van de kopie heeft de video `available: false`, `keptFromOriginal: true`; bij een gewone cursus altijd `keptFromOriginal: false`.
  - `publication.hasUnavailableVideo` is `false` als alleen meegekregen video's buiten de bibliotheek vallen.
  - Opslaan en publiceren met X lukt; na `restrictVideo(X)` ook; na onpubliceren en opnieuw publiceren ook ("Dit geldt ook voor publiceren nadat de kopie is ingetrokken").
  - Na `softDeleteVideo(Y)` (meegekregen): zolang de kopie gepubliceerd is, lukt publiceren van een nieuwe versie met Y; na onpubliceren geeft publiceren `422 course_incomplete` met "Video niet meer beschikbaar: kies een andere." (FR-015, Clarifications Q1).
  - X in een nieuw onderdeel of een ander bestaand onderdeel zetten (opslaan) → `422` op `steps.<i>.videoId` (bestaande regel, FR-016); ook in een andere cursus van B.
  - In het onderdeel met X een andere video zetten en opslaan, daarna X in datzelfde onderdeel terugzetten en opslaan → `422` op `steps.<i>.videoId` (spec US3, scenario 4).
  - `GET /videos` van B bevat X niet.
  - Een Quest van B downloadt X (FR-017); de opruimtaak (`runVideoFileCleanup`) laat de bestanden van een zacht verwijderde meegekregen video in de kopie staan.
- [X] T030 [P] [US3] Breid `frontend/tests/completeness.test.js` en `frontend/tests/course-mapping.test.js` uit: een video met `available: false` en `keptFromOriginal: true` geeft geen probleem "Video niet meer beschikbaar"; `courseMapping` neemt `keptFromOriginal` over (standaard `false`). Houd `frontend/tests/course-check-parity.test.js` groen met de nieuwe derde set aan backendkant.
- [X] T031 [P] [US3] Breid `frontend/tests/unavailable-video-warning.test.js` uit: bij het weghalen van een meegekregen video verschijnt de waarschuwing met de tekst uit contracts/ui.md § Editor; bij een gewone onbeschikbare video de bestaande tekst.

### Implementation for User Story 3

- [X] T032 [US3] Pas `backend/src/lib/courseCheck.js` aan: `checkCourse(draft, { libraryVideoIds, liveVideoIds, grantedVideoIds = new Set() })`; een video is alleen `videoUnavailable` als hij in geen van de drie sets staat. Werk het commentaar bij (spec 011 FR-014, research R4).
- [X] T033 [US3] Pas `backend/src/modules/courses/courseService.js` aan (research R4):
  - `toStepVideo` krijgt `grantedVideoIds` en zet `keptFromOriginal: granted.has(row.id)`;
  - `toDraftDocument` haalt `grantedVideoIds([course.id])` op en geeft die door;
  - `publicationInfo` haalt `grantedVideoIds` voor alle cursussen op en telt meegekregen video's niet mee in `hasUnavailableVideo`;
  - `publishCourse` geeft de set van de cursus door aan `checkCourse` als `grantedVideoIds`.

  `checkVideos` (opslaan) blijft ongewijzigd. Laat T029 slagen.
- [X] T034 [US3] Pas `frontend/src/lib/courseMapping.js` (`keptFromOriginal: keptFromOriginal === true`) en `frontend/src/lib/completeness.js` aan (geen `videoUnavailable` als `keptFromOriginal`), zodat ze dezelfde regel volgen als `courseCheck.js`. Laat T030 slagen.
- [X] T035 [US3] Pas `confirmLosingVideo` in `frontend/src/editor/context.js` aan: bij een video met `keptFromOriginal` de tekst "Deze video komt uit de cursus waarop jouw kopie gebaseerd is en staat niet in jouw videobibliotheek. Haal je hem weg, dan kun je hem daarna niet opnieuw toevoegen."; `isLost` blijft "niet in de bibliotheek". Controleer dat het canvas (`frontend/src/editor/VideoNode.vue`, `StepBadges.vue`) een meegekregen video niet rood markeert. Laat T031 slagen.
- [X] T036 [US3] Schrijf `e2e/tests/011-course-reference-copy/copy-videos.spec.js` (quickstart scenario's 8 – 10): meegekregen video blijft na beperken; publiceren na onpubliceren lukt; verwijderde meegekregen video na onpubliceren geeft de fout; de video staat niet in de videobibliotheek of de videokeuze.

**Checkpoint**: FR-14 werkt; constitutie V blijft gelden

---

## Phase 6: User Story 4 - Het origineel en de andere organisaties merken niets (Priority: P1)

**Goal**: aanpassen raakt alleen de eigen organisatie; latere wijzigingen aan het origineel raken de kopie niet; de bibliotheek wijst op een bestaande kopie

**Independent Test**: B past een cursus van A aan; bij A en C is niets veranderd en A ziet B niet meer bij "Overgenomen door". A publiceert, onpubliceert, beperkt en verwijdert daarna: de kopie en de Quests van B veranderen niet. In de bibliotheek ziet B bij het origineel de hint en kan het opnieuw toevoegen.

### Tests for User Story 4

- [X] T037 [P] [US4] Schrijf `backend/tests/integration/courseReferenceCopyIsolation.test.js` (FR-008 – FR-010, FR-020, SC-003, SC-006):
  - Na aanpassen door B: de versies, het concept, de live versie, `visibility`, `CourseAccess` en `deletedAt` van het origineel zijn gelijk aan ervoor (snapshot van de rijen); de verwijzing, `declinedCourseVersionId` en `GET /course-references/<id>` van C zijn ongewijzigd.
  - `receivers` in het conceptdocument van A en `receiverCount` in `GET /courses` van A bevatten B niet meer; nergens in de antwoorden voor A staat de kopie of `parentCourseId`.
  - Daarna publiceert A een nieuwe versie, onpubliceert, beperkt en verwijdert, en wordt A verwijderd: de inhoud en versies van de kopie, de Quest-API van B en `GET /course-references` van B (geen melding) veranderen niet; `basedOn` volgt de namen (research R6).
  - C kan de verwijzing van B niet aanpassen (404) en B kan niet de cursus van C aanpassen; een beheerderssessie kan de route niet gebruiken.
  - Geen enkel antwoord voor A (conceptdocument, `GET /courses`, `GET /course-library`, `GET /course-library/<id>`) bevat de kopie, haar id of `parentCourseId`, en `receivers`/`receiverCount` bevatten B niet (FR-010). Lekt er iets, pas dan het betreffende antwoord in `backend/src/modules/courses/courseService.js` of `backend/src/modules/courseLibrary/courseLibraryService.js` aan.
- [X] T038 [P] [US4] Breid `backend/tests/integration/courseLibrary.test.js` uit (FR-021): `GET /course-library/<origineel>` voor B geeft `hasCopy: true` na aanpassen, `false` na het verwijderen van de kopie, `false` voor C en `false` voor A (eigen cursus); B kan daarna `POST /course-references` voor het origineel doen (201), en dan staan de kopie en de nieuwe overgenomen cursus beide bij B.
- [X] T039 [P] [US4] Breid `frontend/tests/course-library-view.test.js` uit: het venster toont de hint `HAS_COPY_HINT` (`data-test="has-copy-hint"`) naast "Toevoegen aan mijn organisatie" als `hasCopy` waar is en de cursus niet is toegevoegd; de bevestiging bij toevoegen heeft de nieuwe zin "De cursus blijft van <eigenaar>. Wil je hem aanpassen, dan maak je later een eigen kopie." (contracts/ui.md § Gewijzigde tekst). Het venster bevat nergens het woord "verwijzing" (FR-019).

### Implementation for User Story 4

- [X] T040 [US4] Voeg in `backend/src/modules/courseLibrary/courseLibraryService.js` `hasCopy` toe aan het venster (`getLibraryCourse`): `Boolean(await findOwnCopyOf(organisationId, id))` voor een cursus van een andere organisatie, `false` voor een eigen cursus. De lijst verandert niet. Laat T038 slagen.
- [X] T041 [US4] Pas `frontend/src/components/CourseLibraryDetailsDialog.vue` aan: de hint bij `hasCopy`; de tekst van de toevoeg-bevestiging zoals contracts/ui.md § Gewijzigde tekst (via `frontend/src/lib/courseReference.js` of de bestaande plek van die tekst). Laat T039 slagen.
- [X] T042 [P] [US4] Werk de documentatie van spec 010 bij voor de gewijzigde toevoeg-bevestiging (analyse I1): in `specs/010-course-reference-takeover/spec.md` (User Story 1, scenario 2: "kan niet zelf bewerkt worden") en `specs/010-course-reference-takeover/contracts/ui.md` (§ Bevestiging toevoegen) de nieuwe zin "De cursus blijft van <eigenaar>. Wil je hem aanpassen, dan maak je later een eigen kopie.", met een korte notitie "gewijzigd door spec 011".
- [X] T043 [US4] Schrijf `e2e/tests/011-course-reference-copy/original-unchanged.spec.js` (quickstart scenario's 5, 6, 11, 12): A en C zien niets veranderen; A ziet B niet meer bij "Overgenomen door"; B ziet de hint in de bibliotheek; twee tabbladen tegelijk → één kopie en de melding in het tweede tabblad.

**Checkpoint**: alle stories werken los van elkaar

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T044 [P] Werk `docs/backlog.md` bij: "Eigen kopie van een overgenomen cursus bij aanpassen (spec 011)" gebouwd; nieuw item "Koppeling tussen oude en nieuwe cursus op de Quest na aanpassen" (research R7, in overleg over API-contract en Quest-app); nieuw item "Een aangepaste kopie delen" (Clarifications Q3, buiten scope). Zet hetzelfde Quest-item ook in `docs/backlog-quest-app.md`. Werk `docs/Requirements.docx` alleen bij na akkoord van de gebruiker.
- [X] T045 [P] Werk commentaar bij dat nog zegt dat `parentCourseId` altijd NULL is: `backend/src/modules/courseLibrary/courseLibraryRepository.js`, `backend/src/modules/courses/courseRepository.js`, `backend/src/modules/quest/questCatalog.js` (kopie = eigen cursus), `backend/src/jobs/videoFileCleanup.js` (versies van een kopie houden video's in gebruik). Oude migraties niet aanpassen.
- [ ] T046 [P] Breid `backend/scripts/seed-courses.js` uit (en zo nodig `backend/tests/integration/seedCourses.test.js`): in de usability-omgeving heeft een organisatie een aangepaste kopie van een overgenomen cursus met een meegekregen video buiten haar bibliotheek (zie `docs/usability-testomgeving.md`).
- [X] T047 Voeg een prestatietest toe aan `backend/tests/integration/courseReferenceCopy.test.js` (of een apart bestand): aanpassen van een cursus met 100 onderdelen duurt minder dan 2 s (research R12); het cursusoverzicht met 200 eigen cursussen waarvan 100 kopieën blijft binnen de grens van spec 010.
- [X] T048 Draai:
  - `npm run lint` in `backend/` en `frontend/`;
  - de volledige backend- en frontendtests (`docker compose --profile test run --rm --build api-test` en `docker compose --profile test run --rm --build web-build npm test`);
  - de e2e-tests van 006, 009, 010 en 011 (zie `docs/ci.md`).

  Alles moet groen zijn.
- [ ] T049 Loop de handmatige scenario's 1–12 van `specs/011-course-reference-copy/quickstart.md` door en controleer de database met de SQL uit de quickstart. Noteer afwijkingen in een tabel "Resultaten handmatige test" in de quickstart.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen afhankelijkheden.
- **Foundational (Phase 2)**: na Setup; blokkeert alle stories.
- **US1 (Phase 3)**: na Foundational. Levert de kopie; US2, US3 en US4 testen op een kopie maar kunnen voor hun backendtests de kopie ook direct met `createCourseRow({ parentCourseId })` maken, en zijn daarom los te bouwen.
- **US2 (Phase 4)**, **US3 (Phase 5)**, **US4 (Phase 6)**: na Foundational; onderling onafhankelijk. Hun e2e-tests (T028, T036, T043) hebben US1 nodig (knop "Aanpassen").
- **Polish (Phase 7)**: na de gewenste stories.

### Within Each User Story

- Tests eerst, falen controleren.
- Repository → service → routes → frontend → e2e.
- `courseService.js` wordt door US1 (T018), US2 (T026) en US3 (T033) aangepast: niet tegelijk in hetzelfde bestand werken; volgorde T018 → T026 → T033 als ze door één persoon gedaan worden.
- `CourseEditor.vue` wordt door T021 en T027 aangepast: na elkaar.

### Parallel Opportunities

- T001 – T003 samen.
- T004, T005, T007, T008, T009 samen; T006 na T004.
- Alle testtaken binnen een story ([P]) samen.
- US2, US3 en US4 (backend) parallel na Foundational, met de waarschuwing over `courseService.js` hierboven.
- Polish T044 – T046 samen.

---

## Parallel Example: User Story 3

```text
Task: "T029 [US3] courseCopyVideos.test.js"
Task: "T030 [US3] completeness/course-mapping tests"
Task: "T031 [US3] unavailable-video-warning test"
# daarna
Task: "T032 [US3] courseCheck.js"  → "T033 [US3] courseService.js"
Task: "T034 [US3] courseMapping/completeness.js"   (parallel met T032/T033)
Task: "T035 [US3] context.js waarschuwing"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 3)

1. Phase 1 en 2.
2. US1: aanpassen werkt, editor opent, Quests houden de cursus.
3. US3: zonder de video-uitzondering kan een kopie met gedeelde video's niet gepubliceerd worden; voor de meeste gedeelde cursussen is US1 pas bruikbaar samen met US3.
4. **STOP en valideer** met quickstart scenario's 1 – 4 en 7 – 10.

### Incremental Delivery

1. Setup + Foundational.
2. US1 + US3 → demo (MVP).
3. US2 → kopie privé en volledig beheerbaar.
4. US4 → isolatie bewezen, hint in de bibliotheek.
5. Polish.

---

## Notes

- [P] = andere bestanden, geen afhankelijkheden.
- Elke story is los te testen; e2e-tests per story leunen op de knop uit US1.
- Commit na elke taak of logische groep.
- Geen migratie: als je toch een schemawijziging nodig denkt te hebben, eerst terug naar research R10.

## Implementatienotities (2026-11-27)

- **Tests**: backend in Docker (`api-test`) 77/77 testbestanden groen; frontend 40/40 bestanden (399
  tests, lokaal met Vitest); lint groen in `backend/` en `frontend/`. E2e: 011 (4 tests) en 006, 009,
  010 (28 tests) groen. Van de volledige e2e-set falen lokaal 6 tests van 002, omdat de vaste
  testorganisatie in de lokale database al video's heeft (ze verwachten een lege bibliotheek); in CI
  is de database leeg.
- **Afwijking van het contract**: delen van een kopie geeft `400 validation_failed` (het bestaande
  foutformaat), niet `422 validation_error`; contracts/api.md en research.md zijn bijgewerkt. De
  bevestiging bij "Aanpassen" is één alinea, omdat het bevestigingsvenster platte tekst toont
  (contracts/ui.md bijgewerkt).
- **Gevonden bij het testen**: "Nieuwe versie gebruiken" tegelijk met "Aanpassen" gaf een 500 door
  `ER_CHECKREAD` (snapshot-isolatie van MariaDB 11.8). `withDeadlockRetry` probeert die fout nu ook
  opnieuw, en "Huidige versie houden" gebruikt de wrapper nu ook.
- **T001**: `copyReference` staat in `backend/tests/helpers/references.js`, naast de andere helpers
  voor overgenomen cursussen; `publishedCourse` + `createReferenceRow` maken de situatie al, een
  aparte `takenOverCourse` was niet nodig. **T003**: de notitie in het ERD beschreef de kopie al.
- **Open**: T046 (seed voor de usability-omgeving; ook T060 van spec 010 staat nog open) en T049
  (handmatige scenario's).
