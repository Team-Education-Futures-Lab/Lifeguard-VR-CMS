# Implementation Plan: Een overgenomen cursus aanpassen als eigen kopie (FR-12, deel 3, en FR-14)

**Branch**: `Development` (feature `011-course-reference-copy`) | **Date**: 2026-11-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-course-reference-copy/spec.md`

## Summary

Een organisatie met een overgenomen cursus klikt "Aanpassen" en krijgt na een bevestiging een eigen
kopie van de gekozen versie. De editor opent meteen. De kopie is vanaf dan een gewone eigen cursus
(bewerken, publiceren, onpubliceren, verwijderen), staat nooit in de bibliotheek en kan niet
gedeeld worden. Bij de kopie staat "Gebaseerd op <cursus> van <organisatie>". Het origineel en de
andere ontvangers merken niets. Video's uit de gekozen versie mogen in de kopie blijven, ook buiten
de eigen videobibliotheek en ook als de eigenaar ze later beperkt (FR-14).

Technisch:
- **Aanpassen**: `POST /course-references/:courseId/copy`, één transactie in de module
  `courseReferences`: verwijzingsrij `FOR UPDATE`, nieuwe `Course` met `parentCourseId` en
  `visibility = 'private'`, eigenaarsrij, versies, verwijzingsrij weg (R1, R3). Dit is precies
  wat spec 010 (R13, FR-022) voorbereidde: geen migratie.
- **Versies**: met de bestaande publiceerfuncties: `copyVersionAsDraft` → `freezeDraft` (versie 1
  live) → `copyVersionAsDraft` (versie 2 concept). De Quests houden zo ononderbroken dezelfde
  inhoud (R2).
- **Meegekregen video's**: één definitie `grantedVideoIds` = de niet-verwijderde video's in versie
  1 van een kopie. Publiceren, het conceptdocument (`keptFromOriginal`) en de status gebruiken die.
  Opslaan, de videobibliotheek en de Quest-API veranderen niet (R4). Verwijderde video's volgen
  constitutie V (Clarifications Q1).
- **Niet delen**: de server weigert bij een kopie elke `visibility` behalve `private`; de editor
  toont geen deelkeuzes (R5).
- **Gebaseerd op**: afgeleid via `parentCourseId` (`basedOnOf`), de huidige namen; geen nieuwe
  velden (R6).
- **Quests**: niets verandert; de kopie is een eigen cursus met een live versie, de verwijzing is
  weg (R7).
- **Bibliotheek**: `hasCopy` in het venster voor de hint (R8).

Zie [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22 LTS; Vue 3 (bestaande stack)

**Primary Dependencies**:
- backend: Express 5, Knex + mysql2;
- frontend: Vue 3, Vite, Vue Router, Pinia.

Er komen geen nieuwe dependencies bij.

**Storage**: MariaDB 11.8. Geen migratie: `Course.parentCourseId` bestaat al (R10). Het ERD krijgt
alleen een aangevulde notitie bij `parentCourseId`.

**Testing**:
- backend: Vitest en Supertest tegen een echte MariaDB-testdatabase;
- frontend: Vitest en Vue Test Utils;
- e2e: Playwright, in `e2e/tests/011-course-reference-copy/`.

**Target Platform**: een Linux-VPS met Docker Compose; moderne desktopbrowsers

**Project Type**: webapplicatie (frontend + backend)

**Performance Goals**:
- Aanpassen tot de editor open is binnen 2 s bij een cursus van 100 onderdelen (SC-001, R12).
- Het cursusoverzicht blijft binnen de grens van spec 010 (200 + 200 cursussen binnen 2 s);
  `basedOnOf` en `grantedVideoIds` zijn een vast aantal queries.

**Constraints**:
- Alles of niets; hoogstens één kopie per klik/tabblad (FR-005, FR-006).
- Het origineel en andere organisaties worden niet aangeraakt (FR-008).
- Een kopie kan nooit gedeeld worden of in de bibliotheek komen (FR-013).
- Meegekregen video's nooit in de videobibliotheek of een ander onderdeel (FR-016).
- Quest-API ongewijzigd van vorm (FR-018).

**Scale/Scope**:
- 1 nieuwe API-route (`POST /course-references/:courseId/copy`).
- Gewijzigde antwoorden: conceptdocument (`basedOn`, `keptFromOriginal`), `GET /courses`
  (`basedOn`), `GET /course-library/:id` (`hasCopy`); publiceren en beschikbaarheid weigeren delen
  van een kopie. Zie [contracts/api.md](contracts/api.md).
- 1 nieuwe bevestiging; aanpassingen in het venster van een overgenomen cursus, het
  cursusoverzicht, de editorkop, de controle, het publiceervenster en -menu, het bibliotheekvenster
  en één tekst van spec 010. Zie [contracts/ui.md](contracts/ui.md).

Er zijn geen open NEEDS CLARIFICATION-punten.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Toets | Status |
| --- | --- | --- |
| I. Vaste technologiestack | Vue 3, Express 5 (ES modules), MariaDB 11.8; geen nieuwe dependencies | ✅ |
| II. Docker op één VPS | Geen nieuwe services, volumes of build-contexten | ✅ |
| III. Video's via nginx | Geen videobytes via de API. Thumbnails van onderdelen van de kopie gaan via de bestaande route met `X-Accel-Redirect`; Quest-video's zoals in specs/007 | ✅ |
| IV. Geen geheimen in git | Geen nieuwe geheimen of instellingen | ✅ |
| V. Zachte verwijdering | Kopie verwijderen is zacht. Versies van de kopie verwijzen naar dezelfde video's; de opruimtaak bewaart ze (R11). Een zacht verwijderde meegekregen video blijft alleen werken via de live versie; na onpubliceren moet een andere video gekozen worden (FR-015, Clarifications Q1): `grantedVideoIds` sluit verwijderde video's uit (R4) | ✅ |
| VI. Taalconventies | Route (`/copy`), velden (`basedOn`, `keptFromOriginal`, `hasCopy`), functies (`grantedVideoIds`, `basedOnOf`) en foutcode (`course_already_copied`) zijn Engels; teksten voor de klant Nederlands; nooit "verwijzing" in de interface (FR-019); documentatie Nederlands | ✅ |
| Bronnen en domeinregels | Volgt het ERD: kopie via `Course.parentCourseId`, eigendom via `OrganisationCourse.isOwner`; geen schemawijziging; notitie bij `parentCourseId` wordt in `docs/Diagrams.simp` aangevuld (R10). Volgt Requirements FR-12 (deel 3), FR-13, FR-14 | ✅ |
| Ontwikkelworkflow | specify → clarify → plan; werk op `Development` | ✅ |

**Na Phase 1 opnieuw getoetst**: geen schendingen.
- Geen nieuwe tabellen of velden; de regels zijn afgeleid uit bestaande rijen (data-model).
- De contracten gebruiken het bestaande foutformaat; "niet beschikbaar = 404" blijft gelden, de
  enige nieuwe foutcode is `409 course_already_copied` voor de dubbele klik.
- Constitutie V blijft ongewijzigd; FR-14 is een uitbreiding voor beperkte video's, niet voor
  verwijderde.

## Project Structure

### Documentation (this feature)

```text
specs/011-course-reference-copy/
├── plan.md              # Dit bestand
├── research.md          # Phase 0
├── data-model.md        # Phase 1: velden die gevuld worden, afgeleide regels
├── quickstart.md        # Phase 1: validatiegids
├── contracts/
│   ├── api.md           # Phase 1: /copy, conceptdocument, lijst, bibliotheek, delen
│   └── ui.md            # Phase 1: Aanpassen, bevestiging, Gebaseerd op, editor, publiceren, hint
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Alleen wat nieuw is of verandert ten opzichte van feature 010:

```text
backend/
├── src/
│   ├── lib/
│   │   ├── courseCheck.js                         # + grantedVideoIds als derde toegestane set (R4)
│   │   └── errors.js                              # + courseAlreadyCopied(copyId)
│   ├── modules/
│   │   ├── courseReferences/
│   │   │   ├── courseReferenceRepository.js       # + lockReference (FOR UPDATE), deleteReference in trx
│   │   │   ├── courseReferenceService.js          # + copyReference (R1 – R3)
│   │   │   └── courseReferenceRoutes.js           # + POST /course-references/:courseId/copy
│   │   ├── courses/
│   │   │   ├── courseRepository.js                # + insertCopyCourse, grantedVideoIds, basedOnOf, findOwnCopyOf; findOwnCourse + parentCourseId
│   │   │   └── courseService.js                   # keptFromOriginal, hasUnavailableVideo, basedOn in document en lijst, delen weigeren (R4 – R6)
│   │   └── courseLibrary/courseLibraryService.js  # + hasCopy in het venster (R8)
└── tests/integration/
    ├── courseReferenceCopy.test.js                # FR-001, FR-003 – FR-007
    ├── courseReferenceCopyConcurrency.test.js     # FR-006
    ├── courseReferenceCopyIsolation.test.js       # FR-008 – FR-010, FR-020
    ├── courseCopyRepository.test.js               # grantedVideoIds, basedOnOf (FR-012), findOwnCopyOf
    ├── courseCopyOwnCourse.test.js                # FR-011
    ├── courseCopyVideos.test.js                   # FR-014 – FR-017
    ├── courseCopySharing.test.js                  # FR-013
    ├── courseLibrary.test.js                      # + hasCopy (FR-021)
    └── questCourseReferences.test.js              # + na aanpassen (FR-018)

frontend/
├── src/
│   ├── api/courseReferences.js                    # + copyReference
│   ├── lib/
│   │   ├── courseReference.js                     # + teksten bevestiging, Gebaseerd op, hint
│   │   ├── courseMapping.js                       # + keptFromOriginal
│   │   └── completeness.js                        # meegekregen video niet als fout
│   ├── components/
│   │   ├── TakenOverCourseDialog.vue              # + Aanpassen, bevestiging, navigatie
│   │   └── CourseLibraryDetailsDialog.vue         # + hint hasCopy; tekst toevoegen-bevestiging
│   ├── editor/
│   │   ├── context.js                             # waarschuwingstekst bij weghalen meegekregen video
│   │   ├── CourseEditor.vue                       # Gebaseerd op in de kop
│   │   ├── PublishDialog.vue                      # geen deelkeuze bij een kopie
│   │   └── PublishMenu.vue                        # geen "Beschikbaarheid wijzigen" bij een kopie
│   └── views/CoursesView.vue                      # Gebaseerd op bij eigen cursussen
└── tests/                                         # zie quickstart.md

e2e/tests/011-course-reference-copy/
├── copy-course.spec.js                            # US1
├── copy-is-own-course.spec.js                     # US2
├── copy-videos.spec.js                            # US3
└── original-unchanged.spec.js                     # US4

docs/Diagrams.simp                                 # notitie bij Course.parentCourseId (R10)
docs/backlog.md, docs/backlog-quest-app.md         # koppeling oude/nieuwe cursus op de Quest (R7); spec 011-item afgerond
```

**Structure Decision**: dezelfde opzet als features 009 en 010.
- **Eén plek per regel**: aanpassen hoort bij de module `courseReferences` (het begint bij een
  verwijzing); `grantedVideoIds` en `basedOnOf` staan naast `liveVersions` in `courseRepository`,
  omdat de eigenaarsroutes ze gebruiken.
- **Afscherming blijft**: alle bewerkroutes blijven op `ownCoursesQuery`; de kopie valt daar
  vanzelf onder omdat de organisatie eigenaar is. Er komt geen uitzondering voor "kopieën" in de
  eigenaarsroutes, behalve de deelregel (R5) en de video-uitzondering (R4).

## Complexity Tracking

Geen schendingen.
