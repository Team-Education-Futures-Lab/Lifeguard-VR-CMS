# Data Model: Cursus publiceren en onpubliceren

Wijzigingen op het datamodel van [feature 004](../004-course-steps-draft/data-model.md) en
[feature 005](../005-course-step-branching/data-model.md). Het versiemodel volgt het ERD
(Clarifications 2026-11-23); er komt één nieuw veld, `CourseVersion.unpublishedAt`, dat ook in het
ERD (`docs/Diagrams.simp`) wordt doorgevoerd.

## CourseVersion (gewijzigd)

| Veld | Type | Null | Gebruik |
| --- | --- | --- | --- |
| `versionNumber` | INT | nee | Het concept draagt het nummer van de volgende publicatie (een nieuwe cursus: 1). Vastgezette versies: 1, 2, 3, … (R2) |
| `publishedAt` | DATETIME | ja | NULL = het concept; gevuld = vastgezette versie (UTC, gezet bij publiceren) |
| `unpublishedAt` | DATETIME | ja | **nieuw**. Alleen bij een vastgezette versie: gevuld = onpubliceerd (UTC). Wordt weer NULL bij opnieuw publiceren zonder wijzigingen (FR-017) |

Uniek (`courseId`, `versionNumber`) blijft. Per cursus: precies één concept en nul of meer
vastgezette versies.

Regels:
- Een vastgezette versie (`publishedAt IS NOT NULL`) en haar `CourseStep`- en `Answer`-rijen worden
  inhoudelijk **nooit** gewijzigd of verwijderd (FR-004); alleen `unpublishedAt` kan nog veranderen.
- Alle bestaande schrijfroutes (`saveDraft`) gaan via het concept (`ownCoursesQuery` koppelt alleen
  `publishedAt IS NULL`), en controleren `draftVersionNumber` (R14).

## Course (ongewijzigd)

Geen nieuw veld. `deletedAt` blijft de zachte verwijdering (constitutie V); een verwijderde cursus
heeft geen live versie (zie hieronder).

## Afgeleid: de live versie (R1)

```text
live(course) = de CourseVersion v van course met
                 v.publishedAt IS NOT NULL
                 en v.versionNumber = MAX(versionNumber) onder de vastgezette versies van course
               mits v.unpublishedAt IS NULL en course.deletedAt IS NULL
               anders: geen live versie
```

Alleen de hoogste vastgezette versie kan live zijn, dus er is altijd hoogstens één live versie.
Alles wat "beschikbaar voor de Quest" nodig heeft, gebruikt één repository-helper
(`liveVersions`).

## Afgeleid: status van een cursus (FR-018)

| Status (API) | Tekst | Voorwaarde |
| --- | --- | --- |
| `draft` | Concept | geen live versie |
| `published` | Gepubliceerd | live versie, en het concept is inhoudelijk gelijk (R4) |
| `published_changed` | Gepubliceerd, met wijzigingen | live versie, en het concept wijkt inhoudelijk af |

### Canonieke inhoud (R4)

```text
{ name, description,
  steps: [ in volgorde van CourseStep.id:
    { stepType, isStart, videoId | null, questionText | null, feedback | null,
      next: <index van het vervolg in deze lijst> | null,
      answers: [ in sortOrder: { answerText, isCorrect, next: <index> | null } ] } ] }
```

Geen id's en geen `positionX/Y`. Wordt niet opgeslagen; `sameContent(a, b)` rekent het uit wanneer
nodig.

## Publiceren (R3)

Voor concept C (nummer n) en de laatst vastgezette versie L (hoogste `versionNumber` met
`publishedAt`, als die er is):

| Situatie | Effect |
| --- | --- |
| controle faalt | niets (422) |
| L live en `sameContent(C, L)` | niets (200, idempotent) |
| L onpubliceerd en `sameContent(C, L)` | `L.unpublishedAt = NULL`; C blijft het concept (FR-017) |
| anders | `C.publishedAt = nu` (C wordt versie n, live); nieuw concept n+1 = kopie van C |

De kopie: nieuwe `CourseVersion` (naam, beschrijving, `versionNumber = n+1`, `publishedAt` en
`unpublishedAt` NULL); de onderdelen in id-volgorde gekopieerd met een map oud-id → nieuw-id; de
antwoorden gekopieerd; `nextCourseStepId` van onderdelen en antwoorden via de map; `videoId`,
`isStart`, `questionText`, `feedback`, `positionX/Y` overgenomen.

## Onpubliceren (FR-016)

Heeft de cursus een live versie V: `V.unpublishedAt = nu`. Anders niets (idempotent).

## Toestandsovergangen

```text
                publish (controle OK)                    save (andere inhoud)
   [draft] ───────────────────────────▶ [published] ─────────────────────────▶ [published_changed]
      ▲                                   │    ▲                                     │
      │          unpublish / delete       │    │  save (inhoud weer gelijk)          │
      ├───────────────────────────────────┘    └─────────────────────────────────────┤
      │                       unpublish / delete                                     │
      └──────────────────────────────────────────────────────────────────────────────┘
   [published_changed] ── publish ──▶ [published]  (C vastgezet als versie n, nieuw concept n+1)
   [draft, eerder gepubliceerd] ── publish, inhoud = L ──▶ [published]  (L weer live, FR-017)
   [draft, eerder gepubliceerd] ── publish, inhoud anders ──▶ [published] (C vastgezet als versie n)
   [published] ── publish ──▶ [published]  (niets te doen, R9)
```

## Afgeleid: video beschermd door de live versie (R6)

`keptByLiveVersion(videoId)` = er is een `CourseStep` met dat `videoId` in de live versie. Een
video-onderdeel van het concept geeft `videoUnavailable` als de video niet in de bibliotheek staat
**en** niet beschermd is.

## Meldingen van de servercontrole (R5)

Zelfde codes en teksten als de editor ([specs/005 data-model](../005-course-step-branching/data-model.md)),
met de server-id's:

| Code | Tekst | `stepId` | `answerId` |
| --- | --- | --- | --- |
| `empty` | Voeg een onderdeel toe | – | – |
| `noStart` | Kies een startonderdeel | – | – |
| `noEnd` | De route heeft geen einde | – | – |
| `unreachable` | Niet bereikbaar vanaf de start | ✓ | – |
| `answerOpen` | Antwoord B is nog niet verbonden | ✓ | ✓ |
| `neverEnds` | Vanaf hier eindigt de route nooit | ✓ | – |
| `noVideo` | Kies een video | ✓ | – |
| `videoUnavailable` | Video niet meer beschikbaar: kies een andere. | ✓ | – |
| `noQuestion` | Vul de vraag in | ✓ | – |
| `emptyAnswer` | Antwoord A is leeg | ✓ | ✓ |

## Migratie `20261123000001_course_version_unpublished_at`

1. `CourseVersion`: kolom `unpublishedAt` DATETIME NULL.

`down` verwijdert de kolom. Bestaande concepten (versie 1, `publishedAt` NULL) blijven zoals ze zijn.
