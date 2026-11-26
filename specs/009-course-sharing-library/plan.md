# Implementation Plan: Cursussen delen en de centrale cursusbibliotheek (FR-12, deel 1)

**Branch**: `Development` (feature `009-course-sharing-library`) | **Date**: 2026-11-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-course-sharing-library/spec.md`

## Summary

Bij het publiceren kiest de docent wie de cursus in de nieuwe centrale cursusbibliotheek ziet:
- Algemeen beschikbaar;
- Selectief beschikbaar (gekozen organisaties);
- Alleen eigen organisatie (de standaard, zoals nu).

Een live cursus kan de docent later breder of minder breed delen met "Beschikbaarheid wijzigen".
Zitten er video's in die niet algemeen beschikbaar zijn, dan waarschuwt het systeem alleen op het
moment dat er meer gedeeld wordt. In de bibliotheek staan de live versies van de originele
gedeelde cursussen, met eigenaar, versie, datum en een samenvatting. De inhoud zelf is daar niet
te zien. Onpubliceren of verwijderen haalt een cursus uit de bibliotheek. Op de Quests en voor
bewerken verandert er niets; overnemen komt in deel 2.

Technisch:
- **Beschikbaarheid**: `Course.visibility` en een nieuwe tabel `CourseAccess`, gelijk aan
  `Video.visibility` en `VideoAccess`. Ze vervangen het ongebruikte `isSharedInLibrary` (R1).
- **Bibliotheek**: één query bepaalt welke cursussen erin staan, op dezelfde manier als
  `visibleVideosQuery` (R2).
- **Waarschuwing**: de server berekent de lijst video's zelf, met een pure functie (R4). Hij
  weigert met `409 shared_videos_warning` tot de eigenaar precies die video's bevestigt (R3).
- **Publiceren**: inhoud en beschikbaarheid worden in één transactie opgeslagen (R8).
- **Wijzigen**: een eigen route `PUT /courses/:id/availability` (R9).
- **Thumbnails**: de bibliotheek toont alleen thumbnails die de kijker al in zijn eigen
  videobibliotheek ziet (R6).

Zie [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22 LTS; Vue 3 (bestaande stack)

**Primary Dependencies**:
- backend: Express 5, Knex + mysql2;
- frontend: Vue 3, Vite, Vue Router, Pinia.

Er komen geen nieuwe dependencies bij.

**Storage**: MariaDB 11.8, met één migratie:
- `Course.visibility` (ENUM) erbij, `Course.isSharedInLibrary` weg;
- nieuwe tabel `CourseAccess`.

Het ERD wordt bijgewerkt (R14).

**Testing**:
- backend: Vitest en Supertest tegen een echte MariaDB-testdatabase;
- frontend: Vitest en Vue Test Utils;
- e2e: Playwright, in `e2e/tests/009-course-sharing-library/`.

**Target Platform**: een Linux-VPS met Docker Compose; moderne desktopbrowsers

**Project Type**: webapplicatie (frontend + backend)

**Performance Goals**:
- 200 cursussen in de bibliotheek binnen 2 s in beeld; zoeken, sorteren en filteren binnen 1 s in
  de browser (SC-006). Het laden kost ongeveer 7 queries, hoeveel cursussen er ook zijn (R7).
- Publiceren blijft binnen de 3 s van specs/006 SC-003. De waarschuwing kost hoogstens twee extra
  queries.

**Constraints**:
- De server beslist over de waarschuwing (FR-012).
- Alles of niets (FR-002, specs/006 FR-010).
- Geen inhoud, concept of oude versies voor anderen (FR-016, FR-018).
- 404 voor alles wat niet beschikbaar is (FR-021).
- Quest en bewerken blijven ongewijzigd (FR-026).

**Scale/Scope**:
- Tientallen organisaties en enkele honderden gedeelde cursussen.
- 4 nieuwe API-routes: `PUT /courses/:id/availability`, `GET /course-library`,
  `GET /course-library/:id` en `GET /course-library/:id/thumbnail`.
- 4 gewijzigde API-routes: `publish`, het conceptdocument, `GET /courses` en `unpublish` (via het
  conceptdocument). Zie [contracts/api.md](contracts/api.md).
- 1 nieuwe pagina en 3 nieuwe dialogen; aanpassingen in de publicatiedialoog, het menu, het
  overzicht en de navigatie. Zie [contracts/ui.md](contracts/ui.md).

Er zijn geen open NEEDS CLARIFICATION-punten. Alle keuzes staan in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Toets | Status |
| --- | --- | --- |
| I. Vaste technologiestack | Vue 3, Express 5 (ES modules), MariaDB 11.8; geen nieuwe dependencies | ✅ |
| II. Docker op één VPS | Geen nieuwe services, volumes of build-contexten | ✅ |
| III. Video's via nginx | Geen videobytes. De thumbnail van de bibliotheek gaat via `sendStoredFile` en `X-Accel-Redirect`; de API controleert alleen de toegang (R6) | ✅ |
| IV. Geen geheimen in git | Geen nieuwe geheimen of instellingen | ✅ |
| V. Zachte verwijdering | Verwijderen blijft zacht. De bibliotheek sluit `Course.deletedAt` en verwijderde eigenaren uit; `visibility` en versies blijven bewaard (R11). Video's in de live versie blijven werken zoals in specs/006. Een zacht verwijderde video telt als beperkt in de waarschuwing (R4) | ✅ |
| VI. Taalconventies | Velden en tabellen (`visibility`, `CourseAccess`), routes (`/course-library`, `/availability`) en foutcodes (`shared_videos_warning`, `course_not_live`) zijn Engels; alle teksten in dialogen en de bibliotheek zijn Nederlands; de documentatie is Nederlands | ✅ |
| Bronnen en domeinregels | Het ERD heeft `Course.isSharedInLibrary` (aan/uit). Dat past niet bij de drie keuzes van FR-12/FR-09 en wordt vervangen door `Course.visibility` plus `CourseAccess`, naar het voorbeeld van `Video`/`VideoAccess`. Dit is een bewuste afwijking die in `docs/Diagrams.simp` wordt doorgevoerd (taak, R14). De ERD-regel "alleen `parentCourseId = NULL` in de bibliotheek" wordt gevolgd. Volgt Requirements FR-09, FR-12 (deel 1) en FR-14 | ✅ |
| Ontwikkelworkflow | specify → clarify → plan; werk op `Development` | ✅ |

**Na Phase 1 opnieuw getoetst**: geen schendingen.
- Het datamodel blijft binnen de ERD-tabellen, met één vervangen veld en één nieuwe tabel. Beide
  worden in het ERD doorgevoerd.
- De contracten gebruiken het bestaande foutformaat. De 409 heeft een extra veld `videos`, zoals
  `issues` bij de 422 van specs/006.

## Project Structure

### Documentation (this feature)

```text
specs/009-course-sharing-library/
├── plan.md              # Dit bestand
├── research.md          # Phase 0
├── data-model.md        # Phase 1: visibility, CourseAccess, afgeleide begrippen, migratie
├── quickstart.md        # Phase 1: validatiegids
├── contracts/
│   ├── api.md           # Phase 1: publish/availability, bibliotheekroutes
│   └── ui.md            # Phase 1: picker, waarschuwing, menu, bibliotheek
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Alleen wat nieuw is of verandert ten opzichte van feature 008:

```text
backend/
├── src/
│   ├── db/migrations/
│   │   └── 20261126000001_course_sharing.js      # R1: Course.visibility, CourseAccess, isSharedInLibrary weg
│   ├── lib/
│   │   ├── courseSharing.js                       # nieuw: audience, isRestrictedVideo, sharedVideosWarning (R4)
│   │   └── errors.js                              # + sharedVideosWarning(videos), courseNotLive()
│   ├── modules/
│   │   ├── courses/
│   │   │   ├── courseRepository.js   # insertCourse zonder isSharedInLibrary; get/setCourseAvailability; restrictedVideoRows
│   │   │   ├── courseService.js      # availability in documenten; publish met beschikbaarheid + waarschuwing; changeAvailability
│   │   │   └── courseRoutes.js       # publish leest body; PUT /courses/:id/availability
│   │   └── courseLibrary/                         # nieuw (R2, R6, R7)
│   │       ├── courseLibraryRepository.js         # libraryCoursesQuery: de enige definitie
│   │       ├── courseLibraryService.js            # lijst, details, thumbnailregel
│   │       └── courseLibraryRoutes.js             # GET /course-library, /:id, /:id/thumbnail
│   └── app.js                                     # courseLibraryRoutes aankoppelen
└── tests/
    ├── unit/courseSharingWarning.test.js          # tabel van gevallen (R4)
    └── integration/
        ├── courseLibrary.test.js                  # FR-014, SC-001, SC-004, onpubliceren/verwijderen/eigenaar weg
        ├── courseLibraryIsolation.test.js         # 404, geen inhoud, thumbnailregel (R6), niet voor de beheerder (FR-028)
        ├── courseLibraryPerformance.test.js       # 200 cursussen binnen 2 s (SC-006)
        ├── coursePublishAvailability.test.js      # FR-002, FR-003, alles of niets, 409 → doorgaan
        ├── courseAvailabilityChange.test.js       # FR-006, FR-007-flow, course_not_live
        ├── courseIsolation.test.js                # + availability van andermans cursus → 404
        └── questCourses.test.js                   # + gedeelde cursus niet op andere Quest (FR-026)

frontend/
├── src/
│   ├── api/
│   │   ├── courses.js                 # publishCourse(id, choices), changeCourseAvailability
│   │   └── courseLibrary.js           # nieuw: listLibraryCourses, getLibraryCourse
│   ├── lib/
│   │   ├── courseLibrary.js           # nieuw: filter/sort (hergebruikt normalizeForSearch)
│   │   └── videoAccess.js             # confirmationText met zelfstandig naamwoord (cursus/video)
│   ├── components/
│   │   ├── AvailabilityPicker.vue     # prop subject: hulpteksten voor cursussen
│   │   ├── SharedVideosWarningDialog.vue          # nieuw
│   │   └── CourseLibraryDetailsDialog.vue         # nieuw
│   ├── editor/
│   │   ├── PublishDialog.vue          # picker + zin over de bibliotheek
│   │   ├── PublishMenu.vue            # "Beschikbaarheid wijzigen"
│   │   ├── CourseAvailabilityDialog.vue           # nieuw
│   │   ├── UnpublishDialog.vue        # extra zin bij gedeelde cursus
│   │   └── context.js                 # publish(choices) met 409-afhandeling; changeAvailability
│   ├── views/
│   │   ├── CourseLibraryView.vue      # nieuw: /course-library
│   │   └── CoursesView.vue            # beschikbaarheid in tekst; extra zin bij verwijderen
│   ├── components/OrganisationLayout.vue          # menu-item "Cursusbibliotheek"
│   └── router.js                      # route /course-library
└── tests/
    ├── course-library.test.js         # filter/sort
    ├── course-library-view.test.js
    ├── course-library-details.test.js
    ├── shared-videos-warning.test.js
    ├── course-availability-dialog.test.js
    ├── publish-dialog.test.js         # + picker, voorselectie, beperken
    ├── unpublish-dialog.test.js       # + extra zin
    └── video-access.test.js           # + confirmationText voor cursussen

e2e/tests/009-course-sharing-library/
├── share-on-publish.spec.js           # US1, US3
├── course-library.spec.js             # US2
├── change-availability.spec.js        # US4
└── leave-library.spec.js              # US5

docs/Diagrams.simp                     # Course.visibility i.p.v. isSharedInLibrary; CourseAccess (R14)
```

**Structure Decision**: dezelfde opzet als de features 003, 006 en 007.
- **Eén plek per regel**: de regel voor de bibliotheek krijgt een eigen module, net als
  `questCatalog`. De lijst, de details en de thumbnail delen zo één query.
- **Testbaar**: de logica van de waarschuwing is een pure functie in `lib/`, testbaar met een
  tabel van gevallen.
- **Code van video's hergebruiken**: `videoChoices.js` voor de controle, `AvailabilityPicker.vue`,
  `OwnerPill.vue` en `normalizeForSearch` in de frontend.

## Complexity Tracking

Geen schendingen. De afwijking van het ERD (`isSharedInLibrary` → `visibility` + `CourseAccess`)
staat in de Constitution Check en wordt in het ERD doorgevoerd.
