# Implementation Plan: Quest-API in het CMS

**Branch**: `Development` (spec-map `specs/007-quest-api`) | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-quest-api/spec.md`

## Summary

Het CMS krijgt een aparte API voor de Quest-app onder `/api/quest/v1`, los van de cookiesessie
en de CSRF-controle van het CMS. Een Quest controleert de koppelcode van een organisatie met
`POST /link`, bewaart hem en stuurt hem daarna bij elk verzoek mee als
`Authorization: Bearer <koppelcode>` (research R1). Na het vernieuwen van de code klopt de
bewaarde code niet meer en volgt `401 relink_required`. Er komt geen token, geen nieuw geheim in
`.env`, geen nieuwe tabel en geen ERD-wijziging.

Welke cursussen een Quest ziet, staat in één functie, `questLiveVersions(organisationId)`
(research R3). Die bouwt voort op `liveVersions` uit feature 006 en wordt gebruikt door de lijst,
het downloaden en de toegangscontrole van video's. Video's gaan net als in feature 002 via
`X-Accel-Redirect`: de API controleert alleen of de video in een live versie zit die de Quest ziet,
en nginx levert de bytes, met ondersteuning voor delen (range requests).

In het CMS komt een pagina "Quest koppelen" met de koppelcode en een knop om een nieuwe code te
maken, met bevestiging.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22; Vue 3 voor de frontend

**Primary Dependencies**: Express 5, Knex 3 (mysql2), Vue 3 + Vue Router (geen nieuwe pakketten)

**Storage**: MariaDB 11.8 (geen schemawijziging; `Organisation.questLinkCode` wordt bijgewerkt bij vernieuwen); videobestanden op schijf onder `VIDEOS_DIR`

**Testing**: Vitest + Supertest (backend unit en integratie, tegen een testdatabase). De e2e-tests (Playwright) schrijft het team zelf; ze vallen buiten de taken van deze feature (Clarifications).

**Target Platform**: Linux-VPS met Docker Compose (nginx, api, frontend); MariaDB op de host

**Project Type**: Webapplicatie (Express-API + Vue-SPA) die nu ook een machine-API voor de Quest-app aanbiedt

**Performance Goals**: lijst van 100 cursussen < 2 s (SC-002); inhoud van een cursus met 50 onderdelen < 2 s (SC-003)

**Constraints**: API stuurt geen videobytes (constitutie III); geen cookies of CSRF-header voor de Quest; vaste, geversioneerde antwoordvorm (FR-020); afremming van koppelpogingen bewust niet (Clarifications)

**Scale/Scope**: tientallen organisaties, per organisatie tot ~100 gepubliceerde cursussen van tot 200 onderdelen; video's tot enkele GB

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Toetsing | Status |
|---|---|---|
| I. Vaste stack | Express (ES modules), Vue, MariaDB; geen nieuwe pakketten. | ✅ |
| II. Docker op één VPS | Geen nieuwe dienst of container; alleen een route in de bestaande API. Geen extern authenticatieplatform. | ✅ |
| III. Video's via nginx | Videoroute van de Quest doet alleen de toegangscontrole en zet `X-Accel-Redirect` via de bestaande `sendStoredFile`; nginx levert de bytes en de range requests. De afwijking zonder nginx (ontwikkeling en tests) is al vastgelegd in specs/002 plan.md (Complexity Tracking) en wordt hergebruikt. | ✅ |
| IV. Geen geheimen in git | Er komen geen nieuwe geheimen of `.env`-sleutels bij. Koppelcodes staan alleen in de database; tests maken ze zelf aan. De `Authorization`-header wordt nooit gelogd. | ✅ |
| V. Zachte verwijdering | Verwijderde cursussen en organisaties zijn uitgesloten (via `liveVersions` en de controle van de organisatie). Een zacht verwijderde of beperkte video in een live versie blijft op te halen (FR-014), zoals principe V voorschrijft. | ✅ |
| VI. Taal | Routes, velden, foutcodes en code in het Engels; `message` in foutantwoorden en de CMS-pagina in het Nederlands. | ✅ |
| Bronnen: ERD volgen | Geen nieuwe tabel of kolom; het ERD verandert niet (research R1). | ✅ |
| Werkwijze | Spec Kit-flow, branch `Development`. | ✅ |

Geen schendingen; Complexity Tracking blijft leeg.

**Herbeoordeling na Phase 1**: het ontwerp (data-model.md, contracts/quest-api.md,
contracts/organisation-api.md) voegt geen tabellen, diensten of geheimen in git toe en laat de
videobytes bij nginx. Na de verduidelijking van 2026-11-24 komt er ook geen nieuw geheim in `.env`
(research R1). Uitkomst ongewijzigd: ✅.

## Project Structure

### Documentation (this feature)

```text
specs/007-quest-api/
├── plan.md              # Dit bestand
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── quest-api.md         # API voor de Quest-app (/api/quest/v1)
│   └── organisation-api.md  # CMS-routes voor de koppelcode
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── app.js                                   # /api/quest/v1 mounten vóór csrf en session
│   ├── lib/
│   │   ├── codes.js                             # normalizeQuestLinkCode
│   │   └── errors.js                            # invalidLinkCode, relinkRequired
│   ├── middleware/
│   │   └── requireQuest.js                      # NIEUW: Bearer-koppelcode → req.quest, getQuestOrganisationId
│   └── modules/
│       ├── courses/courseRepository.js          # liveVersions/versionContents hergebruikt; videoSizes
│       ├── organisations/organisationService.js # generateUniqueQuestLinkCode exporteren; renewQuestLinkCode
│       ├── organisations/organisationRepository.js # findActiveByQuestLinkCode, updateQuestLinkCode
│       ├── organisationSelf/organisationSelfRoutes.js # GET/POST quest-link
│       └── quest/                               # NIEUW
│           ├── questCatalog.js                  # DE plek: questLiveVersions(organisationId)
│           ├── questContent.js                  # inhoud en downloadgrootte opbouwen
│           ├── questService.js                  # link, listCourses, getCourse, getVideoKey
│           └── questRoutes.js                   # /link, /organisation, /courses, /courses/:id, /videos/:id
└── tests/
    ├── unit/codes.test.js (uitbreiden), questContent.test.js
    └── integration/questLink.test.js, questCourses.test.js, questDownload.test.js,
        questVideos.test.js, questLinkRenew.test.js, questIsolation.test.js

frontend/
└── src/
    ├── api/questLink.js                         # NIEUW
    ├── views/QuestLinkView.vue                  # NIEUW: pagina "Quest koppelen"
    ├── components/OrganisationLayout.vue        # menu-item "Quest koppelen"
    └── router.js                                # route /quest
```

**Structure Decision**: de bestaande webapplicatie-indeling (`backend/` + `frontend/`) met
modules per domein. De Quest-API krijgt een eigen module `backend/src/modules/quest/`, net als
`courses` en `videos`, met een eigen middleware die nooit de CMS-sessie leest. nginx hoeft niet te
veranderen: `/api/` wordt al doorgestuurd en `/internal/videos/` bestaat al (research R6).

## Complexity Tracking

Geen schendingen van de constitutie.
