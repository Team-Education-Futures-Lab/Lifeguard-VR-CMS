# Data Model: Quest-API in het CMS

Deze feature voegt **geen tabellen of kolommen** toe; het ERD (`docs/Diagrams.simp`) blijft
ongewijzigd (research R1). Hieronder staat welke bestaande gegevens worden gebruikt, het
afgeleide gegeven "koppeling" en de regels.

## Bestaande tabellen

### Organisation (ERD)

| Veld | Gebruik in deze feature |
|---|---|
| `questLinkCode` | 8 tekens, uniek (ook over `loginCode` heen). Wordt gebruikt om te koppelen en is daarna de sleutel die de Quest bij elk verzoek meestuurt. Wordt bij vernieuwen overschreven; de oude waarde wordt niet bewaard. |
| `deletedAt` | Gevuld → koppelen geweigerd en bestaande koppelingen ongeldig. |

**Regels**
- Vernieuwen: `UPDATE Organisation SET questLinkCode = :new WHERE id = :sessionOrg AND deletedAt IS NULL`.
  De nieuwe code komt uit `generateUniqueQuestLinkCode` (feature 001). Bij `ER_DUP_ENTRY` wordt
  het opnieuw geprobeerd, tot 3 keer.
- Een organisatie heeft altijd precies één geldige koppelcode.

### OrganisationCourse, Course, CourseVersion, CourseStep, Answer (ERD, feature 004–006)

Alleen lezen. Wat een Quest ziet (research R3):

```text
questLiveVersions(organisationId) =
  liveVersions( courseIds uit OrganisationCourse
                WHERE organisationId = :org AND isOwner = true )
```

`liveVersions` (specs/006): per cursus de gepubliceerde versie met het hoogste `versionNumber`,
mits `unpublishedAt IS NULL` en `Course.deletedAt IS NULL`.

Voor de download wordt gelezen:
- `CourseVersion`: `id`, `courseId`, `versionNumber`, `name`, `description`, `publishedAt`
- `CourseStep`: `id`, `stepType`, `isStart`, `videoId`, `questionText`, `feedback`,
  `nextCourseStepId` (niet: `positionX`, `positionY`, `description`)
- `Answer`: `id`, `answerText`, `isCorrect`, `sortOrder`, `nextCourseStepId`

### Video (ERD)

| Veld | Gebruik |
|---|---|
| `id` | Vaste aanduiding van de video voor de Quest (gelijk in alle cursussen). |
| `storageKey` | Bestand voor `X-Accel-Redirect`. |
| `fileSizeBytes` | Grootte in de download en in de som van `downloadSizeBytes`. |
| `durationSeconds` | Informatief in de download. |
| `deletedAt`, `visibility`, `VideoAccess` | **Niet** gebruikt voor de toegang van de Quest: alleen "zit in een live versie die de Quest ziet" telt (FR-014, constitutie V). |

## Afgeleide gegevens (niet opgeslagen)

### Koppeling (de bewaarde koppelcode)

De Quest stuurt bij elk verzoek `Authorization: Bearer <koppelcode>`. Er wordt niets opgeslagen
(research R1).

```text
organisatie(verzoek) = Organisation
                       WHERE questLinkCode = upper(trim(<koppelcode uit de header>))
                         AND deletedAt IS NULL
```

Geen treffer → `401 relink_required`.

**Toestanden**

```text
[geen] --POST /link met geldige code, code bewaren--> [gekoppeld]
[gekoppeld] --code vernieuwd / organisatie verwijderd--> [ongeldig: relink_required]
[ongeldig] --POST /link met de huidige code--> [gekoppeld]
```

Er is geen verloopdatum (FR-005).

### Downloadgrootte

```text
downloadSizeBytes = Σ Video.fileSizeBytes over unieke videoId's in de live versie
                  + Buffer.byteLength(JSON.stringify(buildQuestContent(versie)), 'utf8')
```

De lijst en de download gebruiken dezelfde `buildQuestContent`, zodat de grootte altijd klopt
(FR-010, SC-006).

### Videotoegang

```text
mag(org, videoId) = EXISTS CourseStep
                    WHERE courseVersionId IN (ids van questLiveVersions(org))
                      AND videoId = :videoId
```

## Configuratie

Geen nieuwe `.env`-sleutels (Clarifications 2026-11-24).
