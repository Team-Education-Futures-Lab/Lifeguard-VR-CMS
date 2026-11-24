# Implementation Plan: Thumbnail per cursus in de Quest-API

**Branch**: `Development` (spec-map `specs/008-quest-course-thumbnail`) | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-quest-course-thumbnail/spec.md`

## Summary

De Quest-API van feature 007 krijgt per cursus een afbeelding. De afbeelding wordt niet opgeslagen
maar afgeleid uit de live versie: een pure functie `thumbnailVideoId` zoekt breedte-eerst vanaf het
startonderdeel (antwoorden in volgorde A–D) naar het eerste video-onderdeel met een thumbnail
(research R1). `buildQuestContent` voegt `thumbnailUrl` toe
(`/api/quest/v1/courses/<id>/thumbnail?v=<versionNumber>` of `null`), en de lijst neemt het over,
zodat lijst, inhoud en `downloadSizeBytes` altijd kloppen (R2, R3).

Een nieuwe route `GET /api/quest/v1/courses/:courseId/thumbnail` achter `requireQuest` controleert
via `questLiveVersions` of de Quest de cursus ziet, kiest de thumbnail en laat nginx de bytes leveren
met `X-Accel-Redirect` via de bestaande `sendStoredFile` en `/internal/videos/` (R4, R5). Er komt
geen migratie, geen ERD-wijziging, geen nginx-wijziging en geen frontendwerk. Het contract van
feature 007 wordt alleen uitgebreid.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22

**Primary Dependencies**: Express 5, Knex 3 (mysql2); geen nieuwe pakketten

**Storage**: MariaDB 11.8, geen schemawijziging (`Video.thumbnailStorageKey` en de live versie bestaan al); thumbnails als JPEG op schijf onder `VIDEOS_DIR`

**Testing**: Vitest + Supertest (backend unit en integratie, tegen een testdatabase). E2e-tests (Playwright) maakt het team zelf.

**Target Platform**: Linux-VPS met Docker Compose (nginx, api, frontend); MariaDB op de host

**Project Type**: Webapplicatie (Express-API + Vue-SPA); deze feature raakt alleen de machine-API voor de Quest-app

**Performance Goals**: lijst van 100 cursussen nog steeds < 2 s (SC-004); één afbeelding < 1 s (SC-005)

**Constraints**: API stuurt geen bytes (constitutie III); contract v1 alleen uitbreiden (FR-008); afbeelding alleen uit de live versie (FR-001); `?v=` heeft geen invloed (FR-010)

**Scale/Scope**: tientallen organisaties, tot ~100 live cursussen per organisatie van tot 200 onderdelen; thumbnails 1024×512 JPEG (specs/002)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Toetsing | Status |
|---|---|---|
| I. Vaste stack | Alleen Express/Knex-code in de bestaande API; geen nieuwe pakketten. | ✅ |
| II. Docker op één VPS | Geen nieuwe dienst, container of volume; thumbnails staan al in het videos-volume. | ✅ |
| III. Video's via nginx | De route controleert alleen de toegang en zet `X-Accel-Redirect` via `sendStoredFile`; nginx levert de afbeelding uit de bestaande `internal` location. De afwijking zonder nginx (ontwikkeling en tests) is al vastgelegd in specs/002 plan.md (Complexity Tracking) en wordt hergebruikt. | ✅ |
| IV. Geen geheimen in git | Geen nieuwe geheimen of `.env`-sleutels. | ✅ |
| V. Zachte verwijdering | De afbeelding komt alleen uit de live versie van een niet-verwijderde cursus (`questLiveVersions`). Een zacht verwijderde of beperkte video in die versie blijft zijn thumbnail leveren (FR-005); `videoFiles` filtert bewust niet op `deletedAt`. De opruimtaak wist een thumbnail pas als geen onderdeel er meer naar verwijst. | ✅ |
| VI. Taal | Veld, route, functies en code in het Engels; geen nieuwe foutcodes of meldingen (FR-017). Documentatie in het Nederlands. | ✅ |
| Bronnen: ERD volgen | Geen nieuwe tabel of kolom; ERD ongewijzigd (research R1, Clarifications). | ✅ |
| Werkwijze | Spec Kit-flow, branch `Development`. | ✅ |

Geen schendingen; Complexity Tracking blijft leeg.

**Herbeoordeling na Phase 1**: data-model.md beschrijft alleen afgeleide gegevens; het contract
(contracts/quest-api-thumbnail.md, verwerkt in specs/007-quest-api/contracts/quest-api.md) voegt één
veld en één endpoint toe zonder iets weg te halen; de bytes blijven bij nginx. Uitkomst ongewijzigd:
✅.

## Project Structure

### Documentation (this feature)

```text
specs/008-quest-course-thumbnail/
├── plan.md              # Dit bestand
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── quest-api-thumbnail.md   # De uitbreiding van het Quest-contract v1
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

Het volledige contract blijft `specs/007-quest-api/contracts/quest-api.md`; de uitbreiding is
daarin verwerkt (gemarkeerd met "spec 008").

### Source Code (repository root)

```text
backend/
├── src/modules/
│   ├── courses/courseRepository.js      # videoFiles: ook thumbnailStorageKey selecteren
│   └── quest/
│       ├── questThumbnail.js            # NIEUW: thumbnailVideoId (pure functie, research R1)
│       ├── questContent.js              # thumbnailUrl(courseId, versionNumber); veld in buildQuestContent
│       ├── questService.js              # listCourses neemt thumbnailUrl over; getCourseThumbnailKey
│       └── questRoutes.js               # GET /courses/:courseId/thumbnail
└── tests/
    ├── unit/questThumbnail.test.js      # NIEUW
    ├── unit/questContent.test.js        # thumbnailUrl
    └── integration/questThumbnail.test.js  # NIEUW
        questCourses.test.js, questDownload.test.js  # verwachte vorm met thumbnailUrl
```

**Structure Decision**: alles blijft in de module `backend/src/modules/quest/` van feature 007. De
zoekregel krijgt een eigen bestand omdat hij los te testen is en zowel door de inhoud als door de
route wordt gebruikt. Geen wijzigingen in `frontend/`, `nginx/` of `docker-compose*.yml`.

## Complexity Tracking

Geen schendingen van de constitutie.
