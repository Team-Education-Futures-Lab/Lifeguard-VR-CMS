# Implementation Plan: Gedeelde cursussen overnemen als verwijzing (FR-12, deel 2)

**Branch**: `Development` (feature `010-course-reference-takeover`) | **Date**: 2026-11-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-course-reference-takeover/spec.md`

## Summary

Een organisatie voegt een cursus uit de cursusbibliotheek toe aan haar eigen organisatie. Ze krijgt
een verwijzing naar het origineel, geen kopie. De verwijzing wijst naar één gepubliceerde versie
van de eigenaar, de gekozen versie, en die staat op haar Quests. Publiceert de eigenaar een nieuwe
versie, dan ziet de ontvanger een melding en kiest zij "Nieuwe versie gebruiken" of "Huidige versie
houden". Onpubliceert, verwijdert of beperkt de eigenaar de cursus, of wordt de eigenaar verwijderd,
dan houdt de ontvanger haar versie, maar krijgt zij geen nieuwe versies meer en ziet zij waarom.
De eigenaar ziet hoeveel en welke organisaties de cursus hebben overgenomen.

Technisch:
- **Verwijzing**: een rij in `OrganisationCourse` met `isOwner = FALSE`, met twee nieuwe velden:
  `courseVersionId` (de gekozen versie) en `declinedCourseVersionId` (de live versie waarvoor de
  ontvanger "Huidige versie houden" koos). Eigenaarsrijen houden beide op NULL (R1).
- **Geen aparte geschiedenis** (Clarifications): wie en wanneer staan in de verwijzing
  (`addedAt`), de versie in `courseVersionId`. Daaruit volgt ook de toestemming voor beperkte
  video's. In spec 011 zijn de kopie en haar eerste versie het bewijs (R2).
- **Eén plek per regel**:
  - `courseReferenceRepository.referencesQuery` is de enige definitie van "de verwijzingen van
    deze organisatie" (R3).
  - Een pure functie `referenceState` bepaalt per verwijzing de melding en de reden waarom er geen
    nieuwe versies meer komen. Ze is met een tabel van gevallen te testen (R4).
  - Of een ontvanger nog toegang heeft tot nieuwe versies, volgt uit dezelfde
    `libraryCoursesQuery` als de bibliotheek (R5).
- **Quests**: alleen `questLiveVersions` verandert. Die geeft voortaan de eigen live versies plus
  de gekozen versie van elke verwijzing. De lijst, de download, de thumbnail en de video's volgen
  vanzelf (R6).
- **Gebruik van video's**: dit werkt al, omdat gepubliceerde versies nooit verwijderd worden en de
  opruimtaak elke video in een onderdeel bewaart. Dit wordt alleen vastgelegd met tests en een
  regel voor het latere opruimen (R7).
- **Gelijktijdigheid**: toevoegen en overstappen vergrendelen de `Course`-rij met een gedeelde
  lock. Zo vallen ze niet midden in onpubliceren, verwijderen of beperken door de eigenaar, en
  wijst een verwijzing nooit naar een versie waarvoor de eigenaar geen toestemming gaf (R8).
- **API**: een nieuwe module `courseReferences` met eigen routes. De routes van eigen cursussen
  blijven alleen eigenaars bedienen (`ownCoursesQuery`), zodat het bewerken van een verwijzing al
  door de bestaande afscherming geweigerd wordt (R9).

Zie [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22 LTS; Vue 3 (bestaande stack)

**Primary Dependencies**:
- backend: Express 5, Knex + mysql2;
- frontend: Vue 3, Vite, Vue Router, Pinia.

Er komen geen nieuwe dependencies bij.

**Storage**: MariaDB 11.8, met één migratie: `OrganisationCourse.courseVersionId` en
`OrganisationCourse.declinedCourseVersionId` erbij (beide NULL, FK → `CourseVersion`). Er komt
geen nieuwe tabel. Bestaande rijen veranderen niet. Het ERD wordt bijgewerkt (R12).

**Testing**:
- backend: Vitest en Supertest tegen een echte MariaDB-testdatabase;
- frontend: Vitest en Vue Test Utils;
- e2e: Playwright, in `e2e/tests/010-course-reference-takeover/`.

**Target Platform**: een Linux-VPS met Docker Compose; moderne desktopbrowsers

**Project Type**: webapplicatie (frontend + backend)

**Performance Goals**:
- Het cursusoverzicht met 200 eigen en 200 overgenomen cursussen binnen 2 s in beeld, zoals de
  bibliotheek in specs/009 SC-006. Het laden van alle verwijzingen kost een vast aantal queries,
  hoeveel verwijzingen er ook zijn (R10).
- De Quest-API blijft binnen de grenzen van specs/007. `questLiveVersions` krijgt twee queries
  extra.

**Constraints**:
- Er wordt niets gekopieerd: geen cursus, versie, onderdeel of video (FR-003).
- Een ontvanger kan nooit bewerken (FR-008). Alle bestaande routes van `/courses/:id` blijven 404
  geven voor een verwijzing.
- De gekozen versie blijft op de Quests, wat de eigenaar ook doet (FR-011).
- 404 voor alles wat niet beschikbaar is, zoals in specs/009 FR-021 (FR-004).
- Geen extra tabel voor geschiedenis; alles wat nodig is, volgt uit de verwijzing (FR-020).
- Geen polling: meldingen verschijnen bij het volgende laden (FR-012).

**Scale/Scope**:
- Tientallen organisaties, enkele honderden gedeelde cursussen, en per organisatie tientallen
  verwijzingen.
- 7 nieuwe API-routes onder `/course-references`.
- 4 gewijzigde API-routes:
  - `GET /course-library` en `/course-library/:id`: `takenOver` en, voor eigen cursussen,
    `receivers`;
  - het conceptdocument: `receivers`;
  - `GET /courses`: `receiverCount`.
- Quest-API: dezelfde routes, met meer cursussen. Zie [contracts/api.md](contracts/api.md).
- 1 nieuw venster en 3 bevestigingen. Aanpassingen in het cursusoverzicht, het bibliotheekvenster,
  de navigatie (teller), het publicatiemenu en de bevestigingen van onpubliceren, verwijderen en
  beperken. Zie [contracts/ui.md](contracts/ui.md).

Er zijn geen open NEEDS CLARIFICATION-punten. Alle keuzes staan in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Toets | Status |
| --- | --- | --- |
| I. Vaste technologiestack | Vue 3, Express 5 (ES modules), MariaDB 11.8; geen nieuwe dependencies | ✅ |
| II. Docker op één VPS | Geen nieuwe services, volumes of build-contexten | ✅ |
| III. Video's via nginx | Geen videobytes via de API. De thumbnail van een overgenomen cursus gaat via `sendStoredFile` en `X-Accel-Redirect` (R11). De video's voor de Quest gaan zoals in specs/007 | ✅ |
| IV. Geen geheimen in git | Geen nieuwe geheimen of instellingen | ✅ |
| V. Zachte verwijdering | Verwijderen blijft zacht. Een verwijderde cursus met verwijzingen blijft met al zijn versies bestaan (FR-018). Versies houden hun verwijzingen naar zacht verwijderde video's, en de gekozen versie van een ontvanger houdt die video's in gebruik (R7). Echt opruimen blijft op de backlog; de regel daarvoor is aangevuld (R7) | ✅ |
| VI. Taalconventies | Velden (`courseVersionId`, `declinedCourseVersionId`), routes (`/course-references`) en foutcodes (`course_already_added`, `no_newer_version`) zijn Engels. Alle teksten die de klant ziet zijn Nederlands; in de interface staat "overgenomen cursus", nooit "verwijzing" (FR-023). De documentatie is Nederlands | ✅ |
| Bronnen en domeinregels | Volgt het ERD: een verwijzing is `OrganisationCourse` met `isOwner = FALSE`, en `addedAt` is het moment van toevoegen. Twee velden komen erbij en worden in `docs/Diagrams.simp` doorgevoerd (R12). `parentCourseId` blijft in deze feature NULL. Volgt Requirements FR-12 (deel 2), FR-13 en FR-14 | ✅ |
| Ontwikkelworkflow | specify → clarify → plan; werk op `Development` | ✅ |

**Na Phase 1 opnieuw getoetst**: geen schendingen.
- Het datamodel breidt alleen een bestaande ERD-tabel uit met twee velden. Bestaande
  gegevens worden niet omgezet, en spec 011 hoeft dat ook niet (R13).
- De contracten gebruiken het bestaande foutformaat en de bestaande regel "niet beschikbaar = 404".

## Project Structure

### Documentation (this feature)

```text
specs/010-course-reference-takeover/
├── plan.md              # Dit bestand
├── research.md          # Phase 0
├── data-model.md        # Phase 1: OrganisationCourse-velden, afgeleide toestand
├── quickstart.md        # Phase 1: validatiegids
├── contracts/
│   ├── api.md           # Phase 1: /course-references, gewijzigde bibliotheek/cursusroutes, Quest
│   └── ui.md            # Phase 1: toevoegen, overzicht, venster, melding, teller, bevestigingen
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Alleen wat nieuw is of verandert ten opzichte van feature 009:

```text
backend/
├── src/
│   ├── db/migrations/
│   │   └── 20261127000001_course_references.js   # R1: twee OrganisationCourse-velden
│   ├── lib/
│   │   ├── courseReference.js                     # nieuw: referenceState (R4), puur
│   │   └── errors.js                              # + courseAlreadyAdded(), noNewerVersion()
│   ├── modules/
│   │   ├── courseReferences/                      # nieuw (R3, R5, R8, R9)
│   │   │   ├── courseReferenceRepository.js       # referencesQuery: de enige definitie; insert/update/delete; receiversOf (de enige definitie van ontvangers)
│   │   │   ├── courseReferenceService.js          # lijst, één, toevoegen, verwijderen, overstappen, houden, thumbnail
│   │   │   └── courseReferenceRoutes.js           # /course-references…
│   │   ├── courseLibrary/
│   │   │   ├── courseLibraryRepository.js         # libraryCoursesQuery ongewijzigd
│   │   │   └── courseLibraryService.js            # takenOver (één query), receivers via courseReferenceRepository.receiversOf
│   │   ├── courses/
│   │   │   ├── courseRepository.js                # + versionsByIds
│   │   │   └── courseService.js                   # receivers in het conceptdocument, receiverCount in de lijst (via receiversOf)
│   │   └── quest/questCatalog.js                  # R6: + gekozen versies van verwijzingen
│   ├── jobs/videoFileCleanup.js                   # alleen commentaar: waarom gekozen versies veilig zijn (R7)
│   └── app.js                                     # courseReferenceRoutes aankoppelen
└── tests/
    ├── unit/courseReferenceState.test.js          # tabel van gevallen (R4)
    └── integration/
        ├── courseReferenceRepository.test.js      # referencesQuery, receiversOf, versionsByIds (R3)
        ├── courseReferenceAdd.test.js             # FR-001 – FR-005, 404's, 409, addedAt/courseVersionId, gelijktijdig beperken
        ├── courseReferenceList.test.js            # FR-006, FR-007, FR-017 (alle redenen), FR-024
        ├── courseReferenceVersions.test.js        # FR-012 – FR-016, overstappen/houden, meldingen
        ├── courseReferenceRemove.test.js          # FR-009, opnieuw toevoegen met nieuwe addedAt
        ├── courseReferenceIsolation.test.js       # FR-008, FR-024: editor/publish/delete → 404, andermans verwijzing
        ├── courseReferenceVideos.test.js          # FR-021: verwijderde/beperkte video blijft te downloaden; opruimtaak laat hem staan
        ├── courseReferencePerformance.test.js     # 200 verwijzingen binnen 2 s (R10)
        ├── courseLibrary.test.js                  # + takenOver, receivers
        ├── courseDelete/Unpublish/Availability    # + receivers/receiverCount in de documenten
        └── questCourses.test.js, questDownload.test.js, questVideos.test.js, questThumbnail.test.js
                                                   # + overgenomen cursus in de gekozen versie (FR-010, FR-011)

frontend/
├── src/
│   ├── api/courseReferences.js                    # nieuw
│   ├── stores/courseReferences.js                 # nieuw: lijst + aantal meldingen voor de teller (R10)
│   ├── lib/courseReference.js                     # nieuw: teksten voor reden en melding
│   ├── components/
│   │   ├── CourseLibraryDetailsDialog.vue         # "Toevoegen aan mijn organisatie" / "Toegevoegd"; ontvangers voor de eigenaar
│   │   ├── TakenOverCourseDialog.vue              # nieuw: samenvatting, versiekeuze, uitleg, verwijderen
│   │   └── OrganisationLayout.vue                 # teller bij "Cursussen"
│   ├── editor/
│   │   ├── PublishMenu.vue                        # "Overgenomen door …"
│   │   ├── UnpublishDialog.vue                    # + zin over ontvangers
│   │   └── CourseAvailabilityDialog.vue           # + zin over ontvangers die toegang verliezen
│   └── views/
│       ├── CoursesView.vue                        # overgenomen cursussen in dezelfde lijst; zin bij verwijderen
│       └── CourseLibraryView.vue                  # pil "Toegevoegd" in de lijst
└── tests/
    ├── course-reference.test.js                   # nieuw: teksten van lib/courseReference.js
    ├── taken-over-course-dialog.test.js           # nieuw
    ├── courses-view.test.js                       # + overgenomen rijen, melding
    ├── course-library-view.test.js                # + toevoegen, toegevoegd, ontvangers (ook het venster)
    ├── organisation-layout.test.js                # nieuw: teller
    ├── course-sharing-editor.test.js              # + ontvangers in menu en beperk-bevestiging
    ├── unpublish-dialog.test.js                   # + zin over ontvangers
    └── course-availability-dialog.test.js         # + zin over ontvangers

e2e/tests/010-course-reference-takeover/
├── take-over.spec.js                              # US1
├── taken-over-course.spec.js                      # US2
├── new-version.spec.js                            # US3
└── owner-withdraws.spec.js                        # US4

docs/Diagrams.simp                                 # twee OrganisationCourse-velden (R12)
docs/backlog.md                                    # opruimregel aangevuld (R7)
```

**Structure Decision**: dezelfde opzet als de features 007 en 009.
- **Eén plek per regel**: de verwijzingen krijgen een eigen module, net als `courseLibrary`.
  `questCatalog` blijft de enige plek voor wat een Quest ziet.
- **Testbaar**: de toestand van een verwijzing is een pure functie in `lib/`, testbaar met een
  tabel van gevallen.
- **Afscherming**: de bestaande eigenaarsroutes blijven op `ownCoursesQuery` (alleen
  `isOwner = TRUE`), dus een verwijzing kan daar nooit bij.

## Complexity Tracking

Geen schendingen. De uitbreidingen van het ERD staan in de Constitution Check en worden in het ERD
doorgevoerd.
