# Implementation Plan: Cursus publiceren en onpubliceren, met de basis voor versies

**Branch**: `Development` (feature `006-course-publishing`) | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-course-publishing/spec.md`

## Summary

De docent publiceert een complete cursus vanuit de editor; de inhoud wordt vastgezet als versie
1, 2, 3, … met een publicatiedatum en is daarna beschikbaar voor de Quests van de eigen
organisatie. Het concept blijft bewerkbaar; opnieuw publiceren maakt een nieuwe versie die de vorige
vervangt. Onpubliceren haalt de live versie weg zonder iets te wissen. Overzicht en editor tonen
de status (concept, gepubliceerd, gepubliceerd met wijzigingen) met versie en datum.

Technisch: het versiemodel van het ERD. Het concept is de versie zonder `publishedAt`; publiceren
zet het concept zelf vast en maakt een nieuw concept als kopie met het volgende versienummer (R2,
R3). De live versie is de hoogste vastgezette versie, tenzij die onpubliceerd is: daarvoor komt
één nieuw veld, `CourseVersion.unpublishedAt` (R1). "Inhoudelijk gelijk" wordt op het moment zelf
uitgerekend, zonder opgeslagen hash (R4). Publiceren vergrendelt de conceptrij en voert dezelfde
controle uit als de editor (overgezet naar de backend, bewaakt met een gedeelde testset, R5). Een
editor met een verouderd concept kan na publiceren niet meer opslaan (R14). Een
onbeschikbare video mag alleen mee als hij in de live versie zit (R6). Zie [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22 LTS; Vue 3 (bestaande stack)

**Primary Dependencies**: backend: Express 5, Knex + mysql2; frontend:
Vue 3, Vite, Vue Router, Pinia. Geen nieuwe dependencies.

**Storage**: MariaDB 11.8; één migratie: `CourseVersion.unpublishedAt` (DATETIME NULL). Verder
het bestaande ERD (`publishedAt`, `versionNumber`). ERD wordt bijgewerkt met het nieuwe veld.

**Testing**: Vitest + Supertest tegen een echte MariaDB-testdatabase (backend), Vitest + Vue Test
Utils (frontend), Playwright (e2e, `e2e/tests/006-course-publishing/`)

**Target Platform**: Linux-VPS met Docker Compose; moderne desktopbrowsers

**Project Type**: webapplicatie (frontend + backend)

**Performance Goals**: publiceren en onpubliceren van een cursus met 50 onderdelen binnen 3 s na
bevestigen (SC-003; verwacht ruim onder 1 s: ~50 + ~150 inserts in één transactie); het
cursusoverzicht laadt voor de vergelijking hoogstens twee extra queries, ongeacht het aantal
cursussen (R4)

**Constraints**: alles of niets (FR-010); de server beslist (FR-006); hoogstens één live versie
(FR-009); gepubliceerde versies worden nooit gewijzigd (FR-004); alleen eigen cursussen (FR-002)

**Scale/Scope**: tot enkele tientallen cursussen per organisatie en tientallen onderdelen per
cursus; 2 nieuwe API-routes (`publish`, `unpublish`) en 3 gewijzigde (`GET /courses`,
`GET /courses/:id`, `PUT /courses/:id`; `POST /courses` geeft hetzelfde nieuwe document)
([contracts/api.md](contracts/api.md)); editorbalk, drie dialogen en de statuskolom in het
overzicht ([contracts/ui.md](contracts/ui.md))

Er zijn geen open NEEDS CLARIFICATION-punten; alle keuzes staan in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Toets | Status |
| --- | --- | --- |
| I. Vaste technologiestack | Vue 3, Express 5, MariaDB 11.8; geen nieuwe dependencies | ✅ |
| II. Docker op één VPS | Geen nieuwe services; build-contexten ongewijzigd (R5 kiest bewust geen gedeelde map) | ✅ |
| III. Video's via nginx | Niet geraakt; geen nieuwe videoroutes | ✅ |
| IV. Geen geheimen in git | Geen nieuwe geheimen | ✅ |
| V. Zachte verwijdering | Cursussen blijven zacht verwijderd; verwijderen en onpubliceren wissen geen versies (R1, R10). Gepubliceerde versies houden hun video's, ook verwijderde (R11). De videoregel van principe V (versie 3.0.0) is precies FR-012: een verwijderde video blijft werken in een gepubliceerde cursus, ook in een nieuwe versie; een niet-gepubliceerde cursus moet eerst een andere video kiezen (R6) | ✅ |
| VI. Taalconventies | Routes (`/publish`, `/unpublish`), velden (`unpublishedAt`, `draftVersionNumber`), statuswaarden en meldingcodes Engels; dialogen en meldingen Nederlands | ✅ |
| Bronnen en domeinregels | Volgt het versiemodel van het ERD (concept = `publishedAt` NULL, live = hoogste vastgezette versie). Eén nieuw veld, `CourseVersion.unpublishedAt`, nodig voor onpubliceren met behoud van versies (Clarifications); wordt in `docs/Diagrams.simp` doorgevoerd (taak). Volgt Requirements FR-09, FR-11, FR-13 | ✅ |
| Ontwikkelworkflow | specify → clarify → plan; werk op `Development` | ✅ |

**Na Phase 1 opnieuw getoetst**: geen schendingen. Het datamodel blijft binnen de ERD-tabellen
plus het ene nieuwe veld `CourseVersion.unpublishedAt`; contracten gebruiken het bestaande foutformaat.

## Project Structure

### Documentation (this feature)

```text
specs/006-course-publishing/
├── plan.md              # Dit bestand
├── research.md          # Phase 0
├── data-model.md        # Phase 1: nieuwe velden, status, kopie bij publiceren
├── quickstart.md        # Phase 1: validatiegids
├── contracts/
│   ├── api.md           # Phase 1: publish/unpublish, gewijzigde documenten
│   └── ui.md            # Phase 1: editorbalk, dialogen, overzicht
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Alleen wat nieuw is of verandert ten opzichte van feature 005:

```text
backend/
├── src/
│   ├── db/migrations/
│   │   └── 20261123000001_course_version_unpublished_at.js   # R1
│   ├── lib/
│   │   ├── courseCheck.js                         # nieuw: controle (R5, R6)
│   │   ├── courseContent.js                       # nieuw: canonieke inhoud, sameContent (R4)
│   │   └── courseDraft.js                         # + draftVersionNumber verplicht (R14)
│   └── modules/courses/
│       ├── courseRepository.js   # liveVersions; lijst met status; live-video's; vastzetten + kopie; unpublishedAt
│       ├── courseService.js      # publishCourse, unpublishCourse; status in documenten; 409 draft_replaced (R14)
│       └── courseRoutes.js       # POST /courses/:id/publish, POST /courses/:id/unpublish
└── tests/
    ├── fixtures/course-check-cases.json           # gedeelde testset (R5)
    ├── unit/courseCheck.test.js
    ├── unit/courseContent.test.js
    └── integration/
        ├── courseStatus.test.js                   # status, publication, keptByLiveVersion
        ├── courseDraftReplaced.test.js            # draftVersionNumber, 409, gelijktijdig (R14)
        ├── coursePublish.test.js                  # publiceren, versies, kopie, idempotent, gelijktijdig, SC-003
        ├── courseUnpublish.test.js                # onpubliceren, terugzetten (FR-017), verwijderen, FR-014
        ├── coursePublishVideos.test.js            # R6: live versie beschermt, anders 422
        └── courseIsolation.test.js                # + publish/unpublish van andermans cursus → 404

frontend/
├── src/
│   ├── api/courses.js                 # publishCourse, unpublishCourse
│   ├── lib/
│   │   ├── completeness.js            # videoUnavailable alleen zonder keptByLiveVersion (FR-013)
│   │   ├── courseMapping.js           # keptByLiveVersion, status, publication
│   │   └── publication.js             # nieuw: statuslabel en datumnotatie (R13)
│   ├── components/PublicationStatus.vue   # nieuw: status + versie + datum (overzicht en editor)
│   ├── editor/
│   │   ├── CourseEditor.vue           # knoppen Publiceren/Onpubliceren, status in de balk
│   │   ├── PublishDialog.vue          # nieuw: bevestiging en "Nog niet klaar om te publiceren"
│   │   ├── UnpublishDialog.vue        # nieuw: bevestiging onpubliceren
│   │   └── context.js                 # publish()/unpublish(): eerst opslaan, meldingen rood (R7)
│   └── views/CoursesView.vue          # statuskolom, extra zin bij verwijderen (R10)
└── tests/
    ├── course-check-parity.test.js    # leest backend/tests/fixtures/course-check-cases.json
    ├── completeness.test.js           # + keptByLiveVersion
    ├── publication-status.test.js
    ├── publish-dialog.test.js
    ├── publish-button.test.js
    └── unpublish-dialog.test.js

e2e/tests/006-course-publishing/
├── publish.spec.js            # US1, US2
├── republish.spec.js          # US3
├── unpublish.spec.js          # US4, verwijderen
└── course-list-status.spec.js # US5

frontend/Dockerfile            # hele backend/tests/fixtures/ meekopiëren (gedeelde testset, R5)

docs/Diagrams.simp             # + CourseVersion.unpublishedAt
```

**Structure Decision**: dezelfde opzet als feature 004/005. De controle komt als losse pure
module in de backend (R5) en niet als gedeelde map, omdat de backend-image alleen `./backend` als
build-context heeft. De statusweergave wordt één component, omdat overzicht en editor hetzelfde
moeten tonen (FR-019).

## Complexity Tracking

Geen schendingen.
