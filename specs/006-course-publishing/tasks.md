---
description: "Takenlijst voor de feature Cursus publiceren en onpubliceren, met de basis voor versies"
---

# Tasks: Cursus publiceren en onpubliceren, met de basis voor versies

**Input**: Design documents from `/specs/006-course-publishing/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: zoals in feature 004 en 005: per story gerichte tests tegen een echte MariaDB
(Vitest + Supertest), frontendtests (Vitest + Vue Test Utils) en e2e (Playwright). Schrijf ze vóór
de implementatie en controleer dat ze eerst falen.

**Organization**: taken zijn gegroepeerd per user story, zodat elke story los te bouwen en te
testen is.

**Conventies** (constitution VI): code, commentaar, routes (`/publish`, `/unpublish`), velden
(`unpublishedAt`, `draftVersionNumber`, `keptByLiveVersion`), statuswaarden (`draft`, `published`,
`published_changed`) en foutcodes (`course_incomplete`, `draft_replaced`) Engels; UI-teksten en
`message` Nederlands, letterlijk zoals in [contracts/ui.md](contracts/ui.md) en
[contracts/api.md](contracts/api.md). Veldnamen in de database exact zoals in het ERD.

**Versiemodel** (Clarifications, [data-model.md](data-model.md)): het concept is de versie met
`publishedAt IS NULL` en draagt het volgende versienummer. Publiceren zet het concept zelf vast en
maakt een nieuw concept als kopie. Live = de vastgezette versie met het hoogste `versionNumber`,
mits `unpublishedAt IS NULL` en `Course.deletedAt IS NULL`. Er komt **geen**
`Course.publishedCourseVersionId` en **geen** `contentHash`.

**Bestaande code**: `backend/src/modules/courses/` (repository, service, routes),
`backend/src/lib/courseDraft.js`, `backend/src/lib/deadlockRetry.js`, de testhelpers in
`backend/tests/helpers/testApp.js` (`createCourseRow`, `createStepRow`, `createVideoRow`,
`softDeleteVideo`, `restrictVideo`), `frontend/src/lib/completeness.js`,
`frontend/src/lib/courseMapping.js`, `frontend/src/editor/context.js`,
`frontend/src/editor/CourseEditor.vue`, `frontend/src/views/CoursesView.vue`,
`frontend/src/views/EditorView.vue`, en `e2e/helpers/course.js`. Alle bestaande tests moeten groen
blijven.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5, as numbered in spec.md)
- Paden zijn relatief aan de repository-root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: het enige nieuwe veld en het ERD

- [X] T001 Maak de migratie `backend/src/db/migrations/20261123000001_course_version_unpublished_at.js`: `CourseVersion.unpublishedAt` DATETIME, nullable ("Alleen bij een vastgezette versie: gevuld = onpubliceerd (UTC)"), met Engels commentaar zoals de bestaande migraties; `down` verwijdert de kolom. Bestaande rijen blijven ongewijzigd (concepten houden `versionNumber` 1)
- [X] T002 [P] Vervang in `frontend/Dockerfile` de regel `COPY backend/tests/fixtures/videos/ /backend/tests/fixtures/videos/` door `COPY backend/tests/fixtures/ /backend/tests/fixtures/`, zodat de frontendtests in Docker ook de gedeelde testset `course-check-cases.json` (T004) vinden; pas het commentaar erboven aan (testvideo's én de gedeelde testgevallen van de controle, research R5)
- [X] T003 [P] Voeg `unpublishedAt` (DATETIME, nullable) toe aan de entiteit `CourseVersion` in `docs/Diagrams.simp`, met hetzelfde attribuutformaat als `publishedAt` (nieuwe `uid`/`cid`, `nullable="true"`); controleer dat het bestand nog opent (XML geldig) en dat verder niets verandert

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: live versie bepalen, inhoud vergelijken, dezelfde controle op de server, status in de
documenten, en de bescherming tegen opslaan in een vervangen concept (R14)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

- [X] T004 [P] Maak de gedeelde testset `backend/tests/fixtures/course-check-cases.json` (research R5): een lijst `{ name, draft, liveVideoIds, libraryVideoIds, expected: [{ code, step?, answer? }] }`, waarbij `draft` een **volledig** concept-document van contracts/api.md is (`id`, `name`, `description`, `draftVersionNumber`, `status`, `publication`, en onderdelen met alle velden: `id`, `stepType`, `isStart`, `positionX`, `positionY`, `videoId`, `video` (`null` of `{ id, name, durationSeconds, thumbnailUrl, available, keptByLiveVersion }`), `nextStepId`, `questionText`, `feedback`, `answers[{ id, answerText, isCorrect, nextStepId }]`), zodat `toEditor` het zonder aanvullen kan omzetten; `step` en `answer` in `expected` zijn de index in de lijst met onderdelen en antwoorden. Minstens één geval per code (`empty`, `noStart`, `noEnd`, `unreachable`, `answerOpen`, `neverEnds`, `noVideo`, `videoUnavailable`, `noQuestion`, `emptyAnswer`), een complete cursus zonder meldingen, een onbeschikbare video die in `liveVideoIds` staat (geen melding, FR-012) en dezelfde video zonder live versie (wel `videoUnavailable`)
- [X] T005 [P] Schrijf `backend/tests/unit/courseCheck.test.js`: draai elk geval uit T004 door `checkCourse` en vergelijk codes, `stepId` en `answerId` (0 vals positief, 0 vals negatief, SC-002); controleer dat de `message` per code letterlijk gelijk is aan de tabel in data-model.md
- [X] T006 [P] Schrijf `frontend/tests/course-check-parity.test.js`: lees `../backend/tests/fixtures/course-check-cases.json` (zoals de frontend al de testvideo's van de backend gebruikt), zet elk `draft` om met `toEditor` uit `frontend/src/lib/courseMapping.js` (met `video.available`/`keptByLiveVersion` uit `libraryVideoIds`/`liveVideoIds`), draai `checkCourse` uit `frontend/src/lib/completeness.js` en verwacht dezelfde codes op dezelfde onderdelen als de backend
- [X] T007 [P] Schrijf `backend/tests/unit/courseContent.test.js` (research R4): `sameContent` is waar voor een concept en zijn kopie met andere id's; waar als alleen `positionX/Y` verschillen; onwaar bij een andere naam, beschrijving, vraagtekst, feedback, antwoordtekst, goed antwoord, `videoId`, `isStart` of verbinding; verbindingen worden vergeleken op positie in id-volgorde, niet op id
- [X] T008 [P] Schrijf `backend/tests/integration/courseStatus.test.js`: met `createCourseRow` en directe inserts van vastgezette versies: `GET /courses` en `GET /courses/:id` geven `status: "draft"` en `publication: null` zonder vastgezette versie; `published` met `publication: { versionNumber, publishedAt (ISO), hasUnavailableVideo: false }` als het concept inhoudelijk gelijk is aan de hoogste vastgezette versie; `published_changed` als het afwijkt; `draft` als de hoogste vastgezette versie `unpublishedAt` heeft (ook als een lagere versie dat niet heeft); `lastPublishedVersionNumber` in het concept-document; `video.keptByLiveVersion` per video-onderdeel
- [X] T009 [P] Schrijf `backend/tests/integration/courseDraftReplaced.test.js` (research R14): `PUT /courses/:id` zonder `draftVersionNumber` of met een niet-geheel getal → `400 validation_failed` met veld `draftVersionNumber`; met een ander nummer dan het huidige concept → `409 draft_replaced`, `message` "Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw om verder te werken.", en de database ongewijzigd; met het juiste nummer → `200` zoals voorheen; **gelijktijdig**: start een `PUT` (met het oude nummer) en een `POST /publish` op hetzelfde moment (bijvoorbeeld 10 keer na elkaar, met `Promise.all`) → de `PUT` krijgt altijd `200` (kwam vóór het publiceren) of `409 draft_replaced`, nooit `404`, en de vastgezette versie is nooit gewijzigd

### Implementation for Foundational

- [X] T010 Maak `backend/src/lib/courseCheck.js` (research R5, R6): pure functie `checkCourse(draft, { libraryVideoIds, liveVideoIds })` met exact de regels van `frontend/src/lib/completeness.js` (zelfde volgorde, zelfde codes, zelfde Nederlandse teksten uit de tabel in data-model.md), werkend op het concept-document (`nextStepId`, `answers`); `videoUnavailable` alleen als de video niet in `libraryVideoIds` en niet in `liveVideoIds` staat; elke melding `{ code, message, stepId?, answerId? }`. Laat T005 slagen
- [X] T011 [P] Maak `backend/src/lib/courseContent.js` (research R4): `canonicalContent({ name, description, steps, answers })` volgens het schema in data-model.md (onderdelen in id-volgorde, antwoorden in `sortOrder`, `next` als index, geen id's en geen posities) en `sameContent(a, b)`. Laat T007 slagen
- [X] T012 Voeg aan `backend/src/modules/courses/courseRepository.js` toe (research R1, R4): `latestPublishedVersions(courseIds, trx)` (per cursus de vastgezette versie met het hoogste `versionNumber`, met `id`, `versionNumber`, `publishedAt`, `unpublishedAt`); `liveVersions(courseIds, trx)` = die rijen met `unpublishedAt IS NULL` van cursussen met `deletedAt IS NULL` (de enige definitie van "live", met commentaar dat de latere Quest-API hem ook gebruikt); `versionContents(versionIds, trx)` die onderdelen en antwoorden van meerdere versies in twee queries laadt; `liveVideoIds(versionId, trx)`; en lees `versionNumber` mee in `findOwnCourse`
- [X] T013 Voeg in `backend/src/modules/courses/courseService.js` een functie `publicationInfo(courses, organisationId, trx)` toe (research R4, R8) die voor een lijst cursussen `status`, `publication` (`versionNumber`, `publishedAt` als ISO-tijd, `hasUnavailableVideo` = de live versie bevat een video die niet in `libraryVideoIds` staat) en `lastPublishedVersionNumber` berekent met de helpers van T012 en `sameContent`; gebruik hem in `listCourses` (vervangt `status: 'draft'`) en in `toDraftDocument` (voeg ook `draftVersionNumber` toe, en `keptByLiveVersion` aan `toStepVideo`). Laat T008 slagen
- [X] T014 Breid `validateDraft` in `backend/src/lib/courseDraft.js` uit met het verplichte gehele getal `draftVersionNumber` (anders veld `draftVersionNumber`, melding "Laad de pagina opnieuw om verder te werken."), en laat `saveDraftTransaction` in `backend/src/modules/courses/courseService.js` na het vergrendelen van het concept `409` met code `draft_replaced` en `message` "Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw om verder te werken." geven als het afwijkt van `course.versionNumber` (voeg een helper `draftReplaced()` toe aan `backend/src/lib/errors.js`). **Gelijktijdig publiceren** (research R14): vindt `findOwnCourse(…, { forUpdate: true })` geen concept, controleer dan met een tweede query of de cursus wel van deze organisatie is en niet verwijderd (bijvoorbeeld `ownCourseExists(courseId, organisationId, trx)` in `courseRepository.js`, op `Course` + `OrganisationCourse` zonder de join op het concept); zo ja, en het meegestuurde `draftVersionNumber` is niet meer het nummer van het concept → `409 draft_replaced` in plaats van `404`. Doe hetzelfde in `publishCourse` en `unpublishCourse` (T027, T050): concept niet gevonden maar cursus bestaat → probeer het concept opnieuw op te halen (één keer) in plaats van `404`. Laat T009 slagen
- [X] T015 Werk de bestaande backendtests bij die `PUT` gebruiken (`backend/tests/integration/courseSave.test.js`, `courseVideos.test.js`, `courseUnavailableVideo.test.js`, `courseCrud.test.js`, `courseIsolation.test.js`, `courseConnections.test.js`, `seedCourses.test.js`, `backend/tests/unit/courseDraft.test.js`): elk verzoek krijgt `draftVersionNumber: 1`; verwachte documenten krijgen `status: "draft"`, `publication: null`, `lastPublishedVersionNumber: null`, `draftVersionNumber: 1` en per video `keptByLiveVersion: false`
- [X] T016 [P] Laat `saveCourse` in `e2e/helpers/course.js` `draftVersionNumber` meesturen (lees het eerst uit `GET /api/organisation/courses/:id`)
- [X] T017 Breid `frontend/src/lib/courseMapping.js` uit: `toEditor` neemt `keptByLiveVersion` over in `stepVideos[videoId]` en geeft `draftVersionNumber`, `status`, `publication` en `lastPublishedVersionNumber` terug naast `course` en `stepVideos`; `toPayload` krijgt `draftVersionNumber` als argument en zet het in de payload; pas de aanroep in `frontend/src/editor/context.js` (`saveDraft`) aan en werk `frontend/tests/course-mapping.test.js` bij
- [X] T018 Werk de bestaande frontendtests en hun testdocumenten bij voor de nieuwe velden van het concept-document en de lijst (`draftVersionNumber`, `status`, `publication`, `lastPublishedVersionNumber`, per video `keptByLiveVersion`): `frontend/tests/editorHarness.js`, `frontend/tests/course-dirty.test.js`, `frontend/tests/unavailable-video-warning.test.js`, `frontend/tests/question-node.test.js` en `frontend/tests/courses-view.test.js`; controleer dat opslaan in deze tests `draftVersionNumber` meestuurt; alle frontendtests groen
- [X] T019 Pas `checkCourse` in `frontend/src/lib/completeness.js` aan (FR-013): `videoUnavailable` alleen als `stepVideos[videoId]?.available === false && stepVideos[videoId]?.keptByLiveVersion !== true`; werk het commentaar bovenaan bij (de server gebruikt dezelfde regels in `backend/src/lib/courseCheck.js`, gedeelde testset T004); breid `frontend/tests/completeness.test.js` uit met beide gevallen. Laat T006 slagen
- [X] T020 [P] Maak `frontend/src/lib/publication.js` (research R13, contracts/ui.md § Status): `formatPublishedAt(iso)` met `Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeStyle: 'short' })` → "23 november 2026 om 14:05"; `statusLabel({ status, publication, lastPublishedVersionNumber })` → `{ title, detail }` met exact de teksten uit de tabel in contracts/ui.md; test in `frontend/tests/publication-status.test.js`
- [X] T021 [P] Maak `frontend/src/components/PublicationStatus.vue` op basis van T020: toont `title` en `detail` als tekst (kleur nooit het enige signaal), `data-test="publication-status"` en `data-status` met de API-waarde; props `status`, `publication`, `lastPublishedVersionNumber`, `compact` (voor de tabelrij)

**Checkpoint**: status en publicatie staan in beide documenten (nog altijd "Concept"), de controle bestaat aan beide kanten met dezelfde uitkomst, en opslaan vraagt het conceptnummer

---

## Phase 3: User Story 1 - Een complete cursus publiceren (Priority: P1) 🎯 MVP

**Goal**: een complete cursus publiceren vanuit de editor, vastgezet als versie met nummer en datum, en daarna verder bewerken (FR-001–FR-004, FR-008–FR-010)

**Independent Test**: complete cursus publiceren en bevestigen → "Gepubliceerd · Versie 1 · <datum>" in de editor; de vastgezette versie bevat precies de inhoud van dat moment (spec US1)

### Tests for User Story 1

- [X] T022 [P] [US1] Schrijf `backend/tests/integration/coursePublish.test.js` (SC-004, FR-004, FR-009, FR-010): `POST /courses/:id/publish` op een complete cursus → `200`, het concept-document heeft `status: "published"`, `publication.versionNumber: 1`, `draftVersionNumber: 2`; in de database is de oude conceptrij nu versie 1 met `publishedAt` gezet en dezelfde onderdeel- en antwoord-id's, en er is een nieuw concept versie 2 met nieuwe id's, dezelfde inhoud (`sameContent`), dezelfde verbindingen (binnen de eigen versie), `isStart`, posities en `videoId`'s; na een opslag van het nieuwe concept is versie 1 onveranderd; `Course.updatedAt` is bijgewerkt
- [X] T023 [P] [US1] Breid `backend/tests/integration/courseIsolation.test.js` uit (FR-002, SC-005): `POST /courses/:id/publish` voor een cursus van een andere organisatie, een onbekend id en een (zacht) verwijderde cursus → `404 not_found`; niets veranderd
- [X] T024 [P] [US1] Schrijf `frontend/tests/publish-dialog.test.js` (contracts/ui.md § Bevestiging publiceren): titel "Cursus publiceren?" en de tekst voor de eerste keer zonder live versie; "Nieuwe versie publiceren?" met de tekst over vervangen als er een live versie is; de extra zin "Je wijzigingen worden eerst opgeslagen." alleen bij niet-opgeslagen wijzigingen; "Annuleren" sluit zonder iets aan te roepen
- [ ] T025 [P] [US1] Schrijf `e2e/tests/006-course-publishing/publish.spec.js` (quickstart 2, 3, 7): complete cursus via de API, in de editor "Publiceren" → bevestigen → melding "Gepubliceerd als versie 1" en status "Gepubliceerd" met "Versie 1"; daarna een wijziging zonder opslaan → "Publiceren" toont "Je wijzigingen worden eerst opgeslagen." → na bevestigen "Gepubliceerd als versie 2"; "Annuleren" verandert niets

### Implementation for User Story 1

- [X] T026 [US1] Voeg aan `backend/src/modules/courses/courseRepository.js` toe (research R3): `freezeDraft(trx, versionId)` (`publishedAt = UTC_TIMESTAMP()`) en `copyVersionAsDraft(trx, fromVersionId, courseId, versionNumber)` die een nieuwe `CourseVersion` (naam, beschrijving, `publishedAt` en `unpublishedAt` NULL) maakt, de onderdelen in id-volgorde kopieert met een map oud-id → nieuw-id (`stepType`, `isStart`, `videoId`, `questionText`, `feedback`, `description`, `positionX`, `positionY`), de antwoorden kopieert (`answerText`, `isCorrect`, `sortOrder`), en daarna `nextCourseStepId` van onderdelen en antwoorden via de map zet; geeft het nieuwe versie-id terug
- [X] T027 [US1] Voeg `publishCourse(courseId, organisationId)` toe aan `backend/src/modules/courses/courseService.js` (research R3), in één transactie met `withDeadlockRetry`: concept vergrendelen met `findOwnCourse(…, { forUpdate: true })`; niet gevonden → `notFound()`, behalve als de cursus wel van deze organisatie is en niet verwijderd (gelijktijdig gepubliceerd, T014): dan het concept één keer opnieuw ophalen en vergrendelen; concept laden; `checkCourse` met `libraryVideoIds` en `liveVideoIds` van de live versie; bij meldingen `AppError(422, 'course_incomplete', 'De cursus is nog niet klaar om te publiceren.')` met `issues` (breid de errorhandler in `backend/src/middleware/errorHandler.js` uit zodat `issues` in de JSON komt); vergelijken met de laatst vastgezette versie: gelijk en live → niets; gelijk en `unpublishedAt` gezet → `unpublishedAt = NULL` via `setUnpublishedAt(trx, versionId, null)` in `courseRepository.js` zonder nieuwe versie (FR-017); anders `freezeDraft` + `copyVersionAsDraft(…, versionNumber + 1)`; `touchCourse`; het nieuwe concept-document teruggeven (met `publicationInfo`). Laat T022 slagen
- [X] T028 [US1] Voeg `POST /courses/:id/publish` toe aan `backend/src/modules/courses/courseRoutes.js` (geen body gelezen; `res.json(await service.publishCourse(…))`). Laat T023 slagen
- [X] T029 [P] [US1] Voeg `publishCourse(id)` (`POST /api/organisation/courses/:id/publish`) toe aan `frontend/src/api/courses.js`
- [X] T030 [P] [US1] Maak `frontend/src/editor/PublishDialog.vue` (`role="alertdialog"`, `data-test="publish-dialog"`) met de modus "confirm" volgens contracts/ui.md § Bevestiging publiceren; props `hasLive`, `liveVersionNumber`, `dirty`; emits `confirm`/`cancel`. Laat T024 slagen
- [X] T031 [US1] Voeg `publish()` toe aan `frontend/src/editor/context.js` (research R7, R14): bij wijzigingen eerst `saveDraft()` (stopt als dat mislukt), dan `publishCourse`; bij succes een event/callback met het nieuwe concept-document zodat de editor het overneemt; `publishing` als ref om knoppen uit te schakelen; netwerk- of serverfout → toast "Publiceren is niet gelukt. Probeer het opnieuw."
- [X] T032 [US1] Laat `frontend/src/views/EditorView.vue` na publiceren het teruggegeven concept-document gebruiken en de editor opnieuw opbouwen (bijvoorbeeld met een `key` op `CourseEditor` gebaseerd op `draftVersionNumber`), zodat id's, `stepVideos` en de geschiedenis van ongedaan maken vers beginnen; de weergave (canvas/lijst) en de canvaspositie (zoom en verschuiving) blijven behouden, een geselecteerd of geopend onderdeel wordt gesloten (contracts/ui.md § Na afloop)
- [X] T033 [US1] Voeg in `frontend/src/editor/CourseEditor.vue` toe: `PublicationStatus` in de balk, knop "Publiceren" (`data-test="publish"`, uitgeschakeld tijdens een verzoek) die `PublishDialog` opent, en na succes de korte melding "Gepubliceerd als versie {n}" in de bestaande `saved-flash`. Laat T025 slagen

**Checkpoint**: publiceren werkt van begin tot eind; de status in de editor klopt

---

## Phase 4: User Story 2 - Niet publiceren zolang de cursus niet af is (Priority: P1)

**Goal**: een onvolledige cursus wordt niet gepubliceerd; de docent ziet wat er mist en waar, ook als alleen de server het ziet; een onbeschikbare video mag alleen mee als hij in de live versie zit (FR-005–FR-007, FR-012, FR-013)

**Independent Test**: één antwoord los laten en publiceren → niets gepubliceerd, "Antwoord B is nog niet verbonden" bij de juiste vraag; hetzelfde verzoek buiten de interface → `422` (spec US2)

### Tests for User Story 2

- [X] T034 [P] [US2] Breid `backend/tests/integration/coursePublish.test.js` uit (FR-006, SC-002): voor een paar gevallen uit `course-check-cases.json` (opgeslagen via `PUT`) geeft `POST /publish` `422 course_incomplete` met precies de verwachte `issues` (`code`, `message`, `stepId`, `answerId` = de echte id's), en de database is ongewijzigd (geen nieuwe versie, `publishedAt` nog NULL); een gepubliceerde cursus met een onvolledig concept → `422` en de vorige versie blijft live (US3 scenario 5)
- [X] T035 [P] [US2] Schrijf `backend/tests/integration/coursePublishVideos.test.js` (FR-012, SC-008): video van een andere organisatie in de live versie, eigenaar verwijdert hem (`softDeleteVideo`) of beperkt hem (`restrictVideo`) → concept wijzigen en publiceren lukt, de nieuwe versie bevat de video; dezelfde situatie zonder live versie (nooit gepubliceerd) → `422` met `videoUnavailable` op dat onderdeel; de video zit in de live versie in een ander onderdeel dan in het concept → toegestaan (het gaat om de video); `GET` geeft `keptByLiveVersion` juist
- [X] T036 [P] [US2] Breid `frontend/tests/publish-dialog.test.js` uit met de modus "Nog niet klaar om te publiceren" (contracts/ui.md): titel, tekst "Los deze punten eerst op:", meldingen gegroepeerd met `groupIssues`, een klik op een melding met onderdeel emit `open-step` met het knooppunt-id en sluit; "Sluiten"
- [ ] T037 [P] [US2] Schrijf in `e2e/tests/006-course-publishing/publish.spec.js` (quickstart 1, 8, 9): nieuwe cursus zonder video's → "Publiceren" → dialoog met twee keer "Kies een video", klik opent het onderdeel, niets gepubliceerd; een antwoord los, opslaan, "Publiceren" → "Antwoord B is nog niet verbonden"; `POST /publish` via de API → `422` met dezelfde melding

### Implementation for User Story 2

- [X] T038 [US2] Breid `PublishDialog.vue` in `frontend/src/editor/PublishDialog.vue` uit met de modus "issues" (prop `issues`, editor-knooppunt-id's), gebruik `groupIssues` uit `frontend/src/lib/completeness.js`. Laat T036 slagen
- [X] T039 [US2] Laat `publish()` in `frontend/src/editor/context.js` eerst de eigen controle gebruiken: zijn er meldingen, dan geen serververzoek maar de dialoog in modus "issues" en alle huidige meldingen rood (`flaggedIssueIds`, zoals na opslaan in specs/005 FR-022a); bij `422` van de server de `issues` omzetten naar knooppunt-id's (`s<stepId>`, antwoord-id's via de bestaande sleutelfuncties in `frontend/src/lib/courseMapping.js`) en dezelfde dialoog tonen
- [X] T040 [US2] Koppel in `frontend/src/editor/CourseEditor.vue` `open-step` uit de dialoog aan hetzelfde gedrag als een klik in de lijst "nog te doen" (onderdeel openen en in beeld brengen). Laat T037 slagen

**Checkpoint**: publiceren wordt in de browser én op de server tegengehouden met begrijpelijke meldingen

---

## Phase 5: User Story 3 - Wijzigingen opnieuw publiceren (Priority: P1)

**Goal**: status "gepubliceerd met wijzigingen", opnieuw publiceren als nieuwe versie, niets doen als er niets nieuws is, en een editor met een vervangen concept netjes laten stoppen (FR-008, FR-009, FR-018–FR-020, R9, R14)

**Independent Test**: publiceren, vraagtekst wijzigen en opslaan → "wijzigingen nog niet gepubliceerd"; opnieuw publiceren → versie 2 live met de nieuwe tekst (spec US3)

### Tests for User Story 3

- [X] T041 [P] [US3] Breid `backend/tests/integration/coursePublish.test.js` uit: na publiceren een inhoudelijke wijziging opslaan → `published_changed`; alleen posities wijzigen → `published`; een wijziging en haar terugdraaiing opslaan → `published`; opnieuw publiceren → versie 2 live, versie 1 bewaard en niet live, nieuw concept versie 3; publiceren terwijl het concept gelijk is aan de live versie → `200`, geen nieuwe versie (R9); 20 gelijktijdige `POST /publish` op een gewijzigde cursus → precies één nieuwe versie, geen dubbele `versionNumber` (SC-006); **SC-003**: een cursus met 50 onderdelen (25 video, 25 vragen met 2 antwoorden, allemaal verbonden) publiceren en daarna onpubliceren duurt elk minder dan 3 seconden (`performance.now()` rond het verzoek)
- [X] T042 [P] [US3] Schrijf `frontend/tests/publish-button.test.js`: de knop "Publiceren" is uitgeschakeld bij `status: "published"` met de tekst "Er is niets nieuws om te publiceren", en ingeschakeld bij `draft` en `published_changed`
- [ ] T043 [P] [US3] Schrijf `e2e/tests/006-course-publishing/republish.spec.js` (quickstart 3–6, 18): na publiceren is "Publiceren" uitgeschakeld; blok verschuiven + opslaan → "Gepubliceerd"; vraagtekst wijzigen + opslaan → "Gepubliceerd · wijzigingen nog niet gepubliceerd" met "Op de Quest: versie 1"; terugdraaien + opslaan → "Gepubliceerd"; twee tabbladen: in tab 1 publiceren, in tab 2 opslaan → dialoog "Cursus is intussen gepubliceerd" met de tekst van de server en "Pagina opnieuw laden"

### Implementation for User Story 3

- [X] T044 [US3] Zorg in `CourseEditor.vue` (`frontend/src/editor/CourseEditor.vue`) dat "Publiceren" uitgeschakeld is bij `status === 'published'` met de hulptekst "Er is niets nieuws om te publiceren" (`title` en zichtbare tekst/tooltip, toegankelijk), en dat de status na elke opslag uit het antwoord van `PUT` wordt bijgewerkt (zonder herladen, FR-019). Laat T042 slagen
- [X] T045 [US3] Toon in `frontend/src/editor/context.js`/`CourseEditor.vue` bij `409 draft_replaced` op opslaan een dialoog (`role="alertdialog"`) "Cursus is intussen gepubliceerd" met de `message` van de server en de knop "Pagina opnieuw laden" (`location.reload()`); de lokale wijzigingen blijven tot dan zichtbaar. Laat T043 slagen

**Checkpoint**: de volledige cyclus bewerken → publiceren → bewerken → opnieuw publiceren werkt, ook met twee tabbladen

---

## Phase 6: User Story 4 - Een cursus onpubliceren (Priority: P2)

**Goal**: onpubliceren met bevestiging, alles bewaren, later opnieuw publiceren of de laatste versie terugzetten; verwijderen haalt de cursus ook van de Quest (FR-015–FR-017, FR-021)

**Independent Test**: onpubliceren → status "Concept" (verbeterronde V6), concept ongewijzigd; direct weer publiceren → versie 2 weer live (spec US4)

### Tests for User Story 4

- [X] T046 [P] [US4] Schrijf `backend/tests/integration/courseUnpublish.test.js` (FR-016, FR-017, FR-021): `POST /unpublish` op een gepubliceerde cursus → `200`, `status: "draft"`, `publication: null`, `lastPublishedVersionNumber` gelijk aan de oude live versie, `unpublishedAt` gezet bij die versie, concept en versies ongewijzigd; nogmaals → `200`, niets veranderd; daarna publiceren zonder wijzigingen → dezelfde versie weer live met hetzelfde nummer en dezelfde `publishedAt`, `unpublishedAt` weer NULL, geen nieuwe versie; daarna publiceren met een wijziging → nieuwe versie; onpubliceren met een verwijderde video in de live versie → `publication.hasUnavailableVideo` was `true`, en opnieuw publiceren geeft `422 videoUnavailable`; een gepubliceerde cursus verwijderen (`DELETE`) → `204`, `GET /courses` toont hem niet, versies nog in de database, en `liveVersions` geeft voor die cursus niets; **FR-014**: een video van een andere organisatie in de live versie, eigenaar verwijdert hem (`softDeleteVideo`), `runVideoFileCleanup()` uit `backend/src/jobs/videoFileCleanup.js` draaien → het videobestand en de thumbnail bestaan nog (zolang een `CourseStep` van de cursus naar de video wijst)
- [X] T047 [P] [US4] Breid `backend/tests/integration/courseIsolation.test.js` uit (FR-002, SC-005): `POST /courses/:id/unpublish` voor een cursus van een andere organisatie, een onbekend id en een (zacht) verwijderde cursus → `404 not_found`; niets veranderd
- [X] T048 [P] [US4] Schrijf `frontend/tests/unpublish-dialog.test.js` (contracts/ui.md § Bevestiging onpubliceren): titel, tekst, extra zin bij `hasUnavailableVideo`, "Onpubliceren"/"Annuleren"
- [ ] T049 [P] [US4] Schrijf `e2e/tests/006-course-publishing/unpublish.spec.js` (quickstart 10, 11, 16): onpubliceren → "Concept" met "Niet gepubliceerd (was versie 2)"; direct weer publiceren → melding "Versie 2 staat weer op de VR-brillen"; een gepubliceerde cursus verwijderen in het overzicht → bevestiging noemt de VR-brillen, daarna weg

### Implementation for User Story 4

- [X] T050 [US4] Voeg `unpublishCourse(courseId, organisationId)` toe aan `backend/src/modules/courses/courseService.js` (transactie, concept vergrendelen; niet gevonden → `notFound()`, behalve in het geval van T014: dan één keer opnieuw ophalen; is er een live versie, dan `unpublishedAt = UTC_TIMESTAMP()` via `setUnpublishedAt(trx, versionId, value)` in `courseRepository.js`; `touchCourse`; concept-document teruggeven) (`setUnpublishedAt` bestaat al uit T027). Voeg `POST /courses/:id/unpublish` toe aan `courseRoutes.js`. Laat T046 en T047 slagen
- [X] T051 [P] [US4] Voeg `unpublishCourse(id)` toe aan `frontend/src/api/courses.js` en `unpublish()` aan `frontend/src/editor/context.js` (status bijwerken uit het antwoord, melding "Cursus is niet meer gepubliceerd", fouttoast zoals bij publiceren)
- [X] T052 [US4] Maak `frontend/src/editor/UnpublishDialog.vue` (of een modus van `PublishDialog.vue`) volgens contracts/ui.md, en voeg in `frontend/src/editor/CourseEditor.vue` de secundaire knop "Onpubliceren" (`data-test="unpublish"`) toe, alleen zichtbaar/te gebruiken met een live versie; na terugzetten (FR-017) de melding "Versie {n} staat weer op de VR-brillen" in plaats van "Gepubliceerd als versie {n}" (vergelijk `publication.versionNumber` met `lastPublishedVersionNumber` van vóór het verzoek). Laat T048 slagen
- [X] T053 [US4] Breid de verwijderbevestiging in `frontend/src/views/CoursesView.vue` uit: bij een rij met `status !== 'draft'` de extra zin "Deze cursus is gepubliceerd. Na verwijderen is hij niet meer te downloaden op de VR-brillen." Laat T049 slagen

**Checkpoint**: onpubliceren, terugzetten en verwijderen gedragen zich volgens het datamodel

---

## Phase 7: User Story 5 - In het overzicht zien wat live staat (Priority: P2)

**Goal**: het cursusoverzicht toont per cursus de status met versie en datum (FR-018, FR-019)

**Independent Test**: drie cursussen in de drie statussen → elk de juiste tekst, de gepubliceerde met versie en datum (spec US5)

### Tests for User Story 5

- [ ] T054 [P] [US5] Schrijf `e2e/tests/006-course-publishing/course-list-status.spec.js` (SC-007): cursussen in de toestanden nooit gepubliceerd, gepubliceerd, gewijzigd na publiceren, alleen canvas verschoven, onpubliceerd en opnieuw gepubliceerd (via de API) → in het overzicht de juiste tekst uit contracts/ui.md, met versie en datum waar van toepassing, en dezelfde status in de editor

### Implementation for User Story 5

- [X] T055 [US5] Vervang in `frontend/src/views/CoursesView.vue` het vaste label `<span class="status draft">Concept</span>` door `PublicationStatus` (`compact`) met `status`, `publication` en `lastPublishedVersionNumber` uit de lijst; werk het commentaar bovenaan bij ("all drafts" klopt niet meer) en pas de CSS aan zodat de rij op smalle schermen netjes blijft; breid `frontend/tests/courses-view.test.js` uit met de drie statussen (tekst en `data-status`). Laat T054 slagen

**Checkpoint**: alle user stories werken los en samen

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T056 [P] Werk `backend/src/modules/courses/courseRepository.js` en `courseService.js` commentaar bij waar nog "every course is a draft in this feature" of "always NULL in this feature" staat (o.a. `listCourses`, de migratiecommentaren hoeven niet), en het commentaar in `frontend/src/api/courses.js`
- [X] T057 [P] Controleer `backend/scripts/seed-courses.js` en `backend/tests/integration/seedCourses.test.js`: seedcursussen blijven concept versie 1; voeg desgewenst één gepubliceerde seedcursus toe via `publishCourse` zodat de usability-omgeving alle statussen toont
- [ ] T058 [P] Leg in `.specify/memory/constitution.md` een PATCH-verduidelijking van principe V vast **alleen na akkoord van de gebruiker**: "eerst zacht verwijderen; een cursus of video wordt pas echt verwijderd als niemand hem meer gebruikt (alleen live versies en verwijzingen tellen, downloads op een Quest niet)", met Sync Impact Report en versie 3.0.1 (de videoregel van principe V is al aangepast in 3.0.0; zie `docs/backlog.md`, "Cursussen en video's van verwijderde cursussen echt opruimen")
- [ ] T059 Draai `npm run lint` in `backend/` en `frontend/`, de volledige backend- en frontendtests (`docker compose --profile test run --rm --build api-test` en `docker compose --profile test run --rm --build web-build npm test`) en de e2e-tests van 004, 005 en 006; alles groen
- [X] T060 Loop de handmatige scenario's 1–18 van `specs/006-course-publishing/quickstart.md` door en noteer afwijkingen; controleer met de SQL-query uit de quickstart dat versienummers zonder gaten oplopen en dat het concept altijd het hoogste nummer heeft

---

## Verbeterronde na de handmatige test (T060, 2026-11-23)

Resultaten per scenario: [quickstart.md](quickstart.md), "Resultaten handmatige test".

### Opgelost

- [X] T061 [US4] Na onpubliceren neemt de editor ook de videogegevens van het antwoord over (`applyPublication` in `frontend/src/editor/context.js`), zodat een video die niet meer beschikbaar is weer "Kies een andere video: deze is niet meer beschikbaar" geeft (FR-012, FR-013; quickstart 14). Test in `frontend/tests/unpublish-dialog.test.js`

### Uitgewerkt met de gebruiker (2026-11-23, zie spec.md Clarifications)

- [X] T062 [US1] V1: `frontend/src/editor/IssueGroups.vue` (de gegroepeerde lijst van "nog te doen", nu ook gebruikt door `CompletenessStatus.vue`) in de dialoog "Nog niet klaar om te publiceren" (`PublishDialog.vue`)
- [X] T063 [US1] V2/V3/V5: `frontend/src/editor/PublishMenu.vue`, één knop met keuzemenu links naast de status in `CourseEditor.vue`; label "Publiceren" of "Wijzigingen publiceren"; de reden van een uitgegrijsde actie staat alleen in het menu
- [X] T064 [US1] V4: publiceren werkt alleen op het opgeslagen concept (`publish()` in `frontend/src/editor/context.js` slaat niet meer op); bevestiging zonder "eerst opslaan"
- [X] T065 [US4] V6: onder "Concept" staat niets meer (`frontend/src/lib/publication.js`)
- [X] T066 [US2] V7: korte teksten "Video niet meer beschikbaar: kies een andere." (`backend/src/lib/courseCheck.js`, `frontend/src/lib/completeness.js`) en de waarschuwing in `UnpublishDialog.vue`
- [X] T067 Tests bijgewerkt: `publish-dialog.test.js`, `publish-button.test.js`, `unpublish-dialog.test.js`, `publication-status.test.js`, `courses-view.test.js`, `courseCheck.test.js`, `coursePublishVideos.test.js`

### De punten zoals gemeld

- **V1** De dialoog "Nog niet klaar om te publiceren" werkt, maar is visueel niet af.
- **V2** De bovenbalk is te druk: "Canvas ordenen", "Opgeslagen", "Onpubliceren" en "Publiceren" naast elkaar. Idee van de gebruiker: één knop "Publiceren" met een keuzemenu voor publiceren en onpubliceren.
- **V3** "Er is niets nieuws om te publiceren" staat als vaste tekst onder de knop en past niet bij de rest van de balk. Idee: alleen tonen bij hover (let op toegankelijkheid: ook bij focus en voor schermlezers).
- **V4** De werkwijze met concept en gepubliceerde versie voelt omslachtig:
  - Je moet eerst opslaan voordat je ziet of er iets te publiceren is.
  - "Publiceren" bij een cursus die al gepubliceerd is, is vreemd; misschien "Bijwerken" of iets dergelijks.
  - "Publiceren" slaat eerst op en publiceert dan: twee dingen die naast elkaar lopen (concept en gepubliceerde versie). Dit moet duidelijker.
- **V5** De status staat helemaal links in de balk, de publicatieknoppen rechts. Idee: de knoppen naar links, bij de status.
- **V6** De tekst onder "Concept" ("Niet gepubliceerd (was versie 2)") is onhandig.
- **V7** De teksten rond onbeschikbare video's (onpubliceren, opnieuw publiceren) anders verwoorden.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen afhankelijkheden
- **Foundational (Phase 2)**: na Setup (T001 vóór T008/T009 en alles wat `unpublishedAt` leest); blokkeert alle stories
- **US1 (Phase 3)**: na Foundational
- **US2 (Phase 4)**: na US1 (gebruikt `publishCourse`, de dialoog en `publish()`)
- **US3 (Phase 5)**: na US1; los van US2
- **US4 (Phase 6)**: na US1 (gebruikt `setUnpublishedAt` en de terugzet-tak uit T027); los van US2/US3
- **US5 (Phase 7)**: na Foundational (alleen de lijst en `PublicationStatus`); de e2e-test T054 heeft US1 en US4 nodig om de toestanden te maken
- **Polish (Phase 8)**: na alle stories

### Within Each User Story

- Tests eerst, falend; dan repository → service → route → frontend-API → componenten → editor
- T026 vóór T027 vóór T028; T030 vóór T033; T031 vóór T032/T033
- T038 vóór T039 vóór T040
- T050 vóór T051/T052

### Parallel Opportunities

- T002 en T003 met T001
- Foundational-tests T004–T009 allemaal parallel; daarna T010 en T011 parallel, T016, T020 en T021 parallel met de backendtaken
- Binnen US1: T022–T025 parallel; T029 en T030 parallel met T026–T028
- Na US1 kunnen US2, US3 en US4 door verschillende ontwikkelaars parallel, met afstemming op `frontend/src/editor/context.js` en `CourseEditor.vue` (zelfde bestanden: niet tegelijk wijzigen)
- US5 (T055) kan parallel met US2–US4

---

## Parallel Example: User Story 1

```bash
# Tests tegelijk schrijven:
Task: "T022 coursePublish.test.js in backend/tests/integration/"
Task: "T023 courseIsolation.test.js publish/unpublish 404"
Task: "T024 publish-dialog.test.js in frontend/tests/"
Task: "T025 publish.spec.js in e2e/tests/006-course-publishing/"

# Frontend en backend tegelijk bouwen:
Task: "T026–T028 repository, service en route voor publiceren"
Task: "T029 publishCourse in frontend/src/api/courses.js"
Task: "T030 PublishDialog.vue"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Phase 1 (Setup) en Phase 2 (Foundational)
2. Phase 3 (US1): publiceren werkt; de servercontrole zit al in `publishCourse`
3. Phase 4 (US2): begrijpelijke meldingen en de videoregel; samen met US1 de kleinste versie die veilig te gebruiken is (geen halve cursus live)
4. **STOP en VALIDEER**: quickstart 1–3, 8, 9, 12, 14

### Incremental Delivery

1. Setup + Foundational → status zichtbaar ("Concept" overal)
2. US1 + US2 → publiceren (MVP, eerste schakel van de keten maken → publiceren → Quest)
3. US3 → bijwerken en opnieuw publiceren
4. US4 → onpubliceren, terugzetten, verwijderen
5. US5 → overzicht
6. Polish

---

## Notes

- [P] = verschillende bestanden, geen afhankelijkheden
- Een vastgezette versie (en haar onderdelen en antwoorden) wordt nooit gewijzigd; alleen `unpublishedAt` mag nog veranderen (data-model.md)
- "Live" wordt op één plek bepaald (T012); gebruik nergens anders een eigen query
- Commit na elke taak of logische groep; stop bij elk checkpoint om de story los te testen
