# Data Model: Thumbnail per cursus in de Quest-API

Er komt geen tabel, kolom of migratie bij en het ERD (`docs/Diagrams.simp`) verandert niet
(Clarifications, research R1). De cursusafbeelding wordt bij elk verzoek afgeleid uit bestaande
gegevens.

## Bestaande tabellen die gelezen worden

| Tabel (ERD) | Velden | Gebruik |
|---|---|---|
| `CourseVersion` | `id`, `courseId`, `versionNumber`, `publishedAt`, `unpublishedAt` | De live versie via `questLiveVersions` (specs/007 research R3); `versionNumber` komt in `?v=`. |
| `CourseStep` | `id`, `courseVersionId`, `stepType`, `isStart`, `videoId`, `nextCourseStepId` | Startonderdeel en route van de live versie. |
| `Answer` | `courseStepId`, `sortOrder`, `nextCourseStepId` | Route vanaf een vraag, in volgorde A–D. |
| `Video` | `id`, `thumbnailStorageKey` (nieuw in de select van `videoFiles`) | De thumbnail van de gekozen video. Niet gefilterd op `deletedAt`, `visibility` of `VideoAccess` (FR-005). |

## Afgeleide gegevens (niet opgeslagen)

### Cursusafbeelding

- **Bron**: `thumbnailVideoId(steps, answers, videosById)` op de inhoud van de live versie
  (research R1).
- **Regel**: breedte-eerst vanaf de stap met `isStart`; video-onderdeel met een video met
  `thumbnailStorageKey` → gekozen; anders verder via `nextCourseStepId` (video) of de antwoorden op
  `sortOrder` (vraag); elke stap één keer. Niets gevonden → geen afbeelding.
- **Uitkomst**: een `Video.id` of `null`. Het bestand is `Video.thumbnailStorageKey`
  (`thumbnails/<organisationId>/<uuid>.jpg`, JPEG 1024×512).
- **Levensduur**: hoort bij één live versie. Verandert alleen als een andere versie live gaat;
  wijzigingen in het concept doen niets (FR-001). Zacht verwijderen of beperken van de video doet
  niets (FR-005).

### `thumbnailUrl`

- `"/api/quest/v1/courses/<courseId>/thumbnail?v=<versionNumber>"` als er een afbeelding is, anders
  `null`.
- Staat in de cursusinhoud (direct na `publishedAt`) en wordt door de lijst overgenomen; dus altijd
  gelijk in beide (FR-007).

### Downloadgrootte (ongewijzigde definitie)

`downloadSizeBytes = Σ videos[].fileSizeBytes + bytes van de inhoud als UTF-8 JSON`. De inhoud
bevat nu ook `thumbnailUrl`; de afbeelding zelf telt niet mee (FR-009).

### Toegang tot de afbeelding

Een Quest krijgt de afbeelding van cursus X alleen als `questLiveVersions(organisationId)` cursus X
bevat en de regel hierboven een video oplevert. Anders `404 not_found`. Geen geldige koppeling →
`401 relink_required`. De parameter `v` speelt geen rol (FR-010).

## Configuratie

Geen nieuwe `.env`-instellingen. `VIDEOS_DIR` en de nginx-location `/internal/videos/` bestaan al
(research R5).
