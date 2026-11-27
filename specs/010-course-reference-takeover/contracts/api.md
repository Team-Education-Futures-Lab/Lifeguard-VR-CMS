# API-contract: gedeelde cursussen overnemen als verwijzing

Dit zijn de wijzigingen op [specs/009 api.md](../../009-course-sharing-library/contracts/api.md).
Wat hier niet staat, blijft gelijk: sessie, CSRF, foutformaat, `ownCoursesQuery`,
`libraryCoursesQuery` en de Quest-authenticatie. De CMS-routes staan onder `/api/organisation`,
achter `requireOrganisation`. De organisatie komt altijd uit de sessie (`getOrganisationId(req)`).
Een `:courseId` die geen positief geheel getal is, geeft `404 not_found`.

## Gedeeld: het verwijzingsobject

```json
{
  "courseId": 31,
  "name": "Redden in open water",
  "description": "…",
  "owner": { "id": 4, "name": "Brandweer Academie Noord" },
  "addedAt": "2026-11-27T10:02:00.000Z",
  "version": {
    "versionNumber": 2,
    "publishedAt": "2026-11-20T09:12:00.000Z",
    "stepCount": 14,
    "videoCount": 6
  },
  "thumbnailUrl": "/api/organisation/course-references/31/thumbnail?v=2",
  "newVersion": { "versionNumber": 3, "publishedAt": "2026-11-27T08:00:00.000Z" },
  "notice": true,
  "withdrawn": null
}
```

- `name`, `description`, `version` en `thumbnailUrl` komen uit de **gekozen** versie (FR-006,
  FR-007). Er zijn nooit onderdelen, vragen, antwoorden, video-id's of het concept.
- `owner.name` is ook de naam van een verwijderde eigenaar (spec, Edge Cases).
- `thumbnailUrl` is `null` als de gekozen versie geen afbeelding heeft (research R11).
- `newVersion`, `notice` en `withdrawn` komen uit `referenceState` (research R4, data-model):
  - `withdrawn`: `null` | `"owner_deleted"` | `"course_deleted"` | `"unpublished"` | `"no_access"`;
  - `newVersion`: alleen als `withdrawn = null` en de live versie nieuwer is; anders `null`;
  - `notice`: de melding (FR-012). `false` als de ontvanger voor deze live versie "Huidige versie
    houden" koos.

## Nieuw: `GET /course-references`

```json
{ "references": [ /* verwijzingsobjecten */ ], "noticeCount": 1 }
```

- Alle verwijzingen van de organisatie (`referencesQuery`), ook naar verwijderde cursussen of van
  verwijderde eigenaren.
- De volgorde is op naam (`nl`, hoofdletters maken niet uit). De browser voegt ze samen met de
  eigen cursussen.
- `noticeCount` is het aantal met `notice = true`, voor de teller in de navigatie.

## Nieuw: `GET /course-references/:courseId`

Eén verwijzingsobject. Heeft de organisatie geen verwijzing naar die cursus, dan
`404 not_found`.

## Nieuw: `POST /course-references`

Body: `{ "courseId": 31 }`. Alleen dit veld wordt gelezen.

Antwoorden, in deze volgorde gecontroleerd. Bij elke fout verandert er niets.

| Status | `code` | Wanneer |
| --- | --- | --- |
| 400 | `validation_failed` | `courseId` ontbreekt of is geen positief geheel getal: `fields.courseId` = "Laad de pagina opnieuw en probeer het nog eens." |
| 404 | `not_found` | De cursus bestaat niet, is verwijderd, heeft geen live versie, staat niet in de bibliotheek van de organisatie, **of is van de organisatie zelf** (FR-004). Dezelfde reactie in alle gevallen |
| 409 | `course_already_added` | "Deze cursus staat al bij jullie cursussen." De organisatie heeft al een verwijzing (FR-005) |
| 201 | – | Het nieuwe verwijzingsobject, met de live versie als gekozen versie |

Bijwerking bij 201, in één transactie (research R8): een `OrganisationCourse`-rij met
`isOwner = FALSE`, `addedAt` = nu en `courseVersionId` = de live versie.

## Nieuw: `DELETE /course-references/:courseId`

"Verwijderen uit mijn organisatie" (FR-009). Verwijdert alleen de verwijzingsrij van deze
organisatie. Het antwoord is `204`. Heeft de organisatie geen verwijzing naar die cursus, dan
`404 not_found`. Een eigen cursus kan hier nooit verwijderd worden, want de query leest alleen
`isOwner = FALSE`.

## Nieuw: `POST /course-references/:courseId/update`

"Nieuwe versie gebruiken" (FR-014). Er is geen body.

| Status | `code` | Wanneer |
| --- | --- | --- |
| 404 | `not_found` | Geen verwijzing van deze organisatie naar die cursus |
| 409 | `no_newer_version` | "Er is geen nieuwere versie om te gebruiken." De toestand heeft geen `newVersion`: de verwijzing heeft al de live versie, of `withdrawn` is niet `null`. Het antwoord bevat `reference` met de huidige toestand |
| 200 | – | Het verwijzingsobject met de live versie van dat moment als gekozen versie |

Bijwerking bij 200, in één transactie met `FOR SHARE` op de `Course`-rij (research R8):
`courseVersionId` = de live versie en `declinedCourseVersionId` = NULL.

## Nieuw: `POST /course-references/:courseId/keep`

"Huidige versie houden" (FR-015). Er is geen body.

| Status | `code` | Wanneer |
| --- | --- | --- |
| 404 | `not_found` | Geen verwijzing van deze organisatie naar die cursus |
| 200 | – | Het verwijzingsobject. Is er een `newVersion`, dan is `declinedCourseVersionId` gezet op die live versie en is `notice` nu `false`. Is er geen `newVersion`, dan verandert er niets |

## Nieuw: `GET /course-references/:courseId/thumbnail`

Alleen een toegangscontrole. Daarna levert nginx de afbeelding van de gekozen versie via
`X-Accel-Redirect` (`sendStoredFile`, `private, max-age=3600`). Zonder verwijzing of zonder
afbeelding: `404 not_found`. De query-parameter `v` wordt genegeerd (research R11).

## Gewijzigd: `GET /course-library` en `GET /course-library/:id`

- Een cursus van een andere organisatie krijgt `"takenOver": true | false`: of deze organisatie al
  een verwijzing naar de cursus heeft (FR-001).
- Een eigen cursus (`owner.isOwn = true`) krijgt
  `"receivers": [{ "id": 7, "name": "Zwemschool De Ster" }]`: de actieve ontvangers, alfabetisch
  (FR-019, Clarifications). Andere organisaties krijgen dit veld nooit.
- Welke cursussen erin staan, verandert niet.

## Gewijzigd: het conceptdocument (`GET`/`PUT /courses/:id`, `POST /courses`, `publish`, `unpublish`, `availability`)

Het document krijgt `"receivers": [{ "id": 7, "name": "…" }]`: de actieve ontvangers, alfabetisch.
Zo kan het publicatiemenu ze tonen, en kunnen de bevestigingen van onpubliceren en beperken het
aantal noemen. Bij beperken telt alleen het aantal ontvangers dat toegang verliest (FR-019). Dit
zijn alleen eigen cursussen.

## Gewijzigd: `GET /courses`

Elke rij krijgt `"receiverCount": 0`, voor de bevestiging van verwijderen (FR-019).

## Gewijzigd: Quest-API (`/api/quest/v1/…`)

De vorm blijft gelijk (specs/007). Alleen de verzameling verandert, via `questLiveVersions`
(research R6):
- `GET /courses` toont ook elke overgenomen cursus, met `id` = het id van de originele cursus en
  `versionNumber`, `name` en de rest uit de gekozen versie;
- `GET /courses/:id`, `/courses/:id/thumbnail` en `/videos/:id` werken voor de gekozen versie, ook
  als de eigenaar de cursus onpubliceerde, verwijderde of beperkte, of zelf verwijderd is, en ook
  als een video in die versie verwijderd of beperkt is (FR-011, FR-021);
- een video die alleen in een andere versie van een overgenomen cursus zit (bijvoorbeeld de nieuwe
  live versie die de ontvanger niet koos), geeft `404` (US5 scenario 4).

## Ongewijzigd, met extra tests

Voor een overgenomen cursus geven deze routes `404`, alsof de cursus niet bestaat (FR-008):
- `GET/PUT/DELETE /courses/:id`;
- `publish`, `unpublish` en `availability`;
- de thumbnail van een onderdeel.

Een organisatie kan de verwijzingen van een andere organisatie niet lezen of wijzigen, want elke
route gaat via `referencesQuery` met de organisatie uit de sessie (FR-024). De beheerder heeft
geen toegang tot deze routes (`requireOrganisation`).
