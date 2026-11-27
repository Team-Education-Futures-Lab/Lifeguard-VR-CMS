# API-contract: een overgenomen cursus aanpassen als eigen kopie

Wijzigingen op [specs/010 api.md](../../010-course-reference-takeover/contracts/api.md). Wat hier
niet staat, blijft gelijk: sessie, CSRF, foutformaat, `ownCoursesQuery`, `referencesQuery`,
`libraryCoursesQuery` en de Quest-API. De CMS-routes staan onder `/api/organisation`, achter
`requireOrganisation`; de organisatie komt altijd uit de sessie. Een `:courseId` die geen positief
geheel getal is, geeft `404 not_found`.

## Nieuw: `POST /course-references/:courseId/copy`

"Aanpassen". `:courseId` is het id van het origineel (zoals bij alle `/course-references`-routes).
Er wordt geen body gelezen.

**201**

```json
{ "courseId": 87 }
```

`courseId` is het id van de kopie. De browser haalt daarna het conceptdocument op met
`GET /courses/87` en opent de editor.

Gevolgen (één transactie, research R1, R2):
- nieuwe cursus met `parentCourseId` = `:courseId`, `visibility = 'private'`;
- versie 1 gepubliceerd met de inhoud van de gekozen versie, versie 2 als concept;
- de organisatie is eigenaar; haar verwijzing naar `:courseId` is weg;
- aan het origineel en aan andere organisaties verandert niets.

**Fouten**

| Status | `code` | Wanneer |
| --- | --- | --- |
| 409 | `course_already_copied` | geen verwijzing (meer), maar de organisatie heeft al een niet-verwijderde kopie van dit origineel (dubbele klik, tweede tabblad). Body bevat ook `"courseId": <id van de kopie>`. `message`: "Deze cursus is al aangepast. De aangepaste cursus staat bij je cursussen." |
| 404 | `not_found` | geen verwijzing en geen kopie: onbekend id, eigen cursus, cursus van een ander zonder verwijzing, verwijzing intussen verwijderd |

Aanpassen kan ook als de eigenaar het origineel heeft ingetrokken, verwijderd of beperkt, of zelf
verwijderd is (FR-001).

## Gewijzigd: het conceptdocument (`GET/PUT /courses/:id`, `POST …/publish`, `…/unpublish`, `PUT …/availability`)

Twee toevoegingen:

```json
{
  "id": 87,
  "basedOn": { "courseName": "Redden in open water", "ownerName": "Brandweer Academie Noord" },
  "steps": [
    {
      "id": 501,
      "stepType": "video",
      "videoId": 12,
      "video": {
        "id": 12,
        "name": "…",
        "durationSeconds": 74,
        "thumbnailUrl": "/api/organisation/courses/87/steps/501/videos/12/thumbnail",
        "available": false,
        "keptByLiveVersion": true,
        "keptFromOriginal": true
      }
    }
  ]
}
```

- `basedOn`: `null` voor een gewone cursus; voor een kopie de huidige namen (research R6).
- `video.keptFromOriginal`: de video is meegekregen en mag blijven, ook buiten de bibliotheek
  (research R4). Altijd `false` bij een gewone cursus. `available` blijft "staat in de
  bibliotheek".
- `publication.hasUnavailableVideo` telt meegekregen video's niet mee.
- `availability` van een kopie is altijd `{ "visibility": "private", "accessOrganisations": [] }`;
  `receivers` is altijd `[]`.

## Gewijzigd: `GET /courses`

Elk item krijgt `basedOn` (`null` of `{ courseName, ownerName }`). Een kopie staat in deze lijst
als gewone eigen cursus; de overgenomen cursus staat na het aanpassen niet meer in
`GET /course-references`.

## Gewijzigd: `POST /courses/:id/publish` en `PUT /courses/:id/availability`

Bij een kopie:
- `visibility` weglaten of `"private"`: toegestaan.
- Elke andere `visibility`: `400 validation_failed` (het bestaande foutformaat), `fields.visibility` = "Een aangepaste cursus
  kan niet gedeeld worden." Er verandert niets.

Publiceren controleert video's met de bibliotheek, de live versie én de meegekregen video's
(research R4). Een zacht verwijderde video die niet in de live versie zit, geeft zoals altijd
`422 course_incomplete` met "Video niet meer beschikbaar: kies een andere."

## Gewijzigd: `GET /course-library/:id`

```json
{ "id": 31, "takenOver": false, "hasCopy": true }
```

`hasCopy`: de organisatie heeft een niet-verwijderde kopie van deze cursus (research R8). `false`
bij een eigen cursus. De lijst `GET /course-library` verandert niet. `POST /course-references`
(toevoegen) blijft toegestaan als `hasCopy = true`.

## Ongewijzigd: Quest-API

Routes en vorm blijven gelijk (FR-018). Na het aanpassen bevat `GET /courses` van een Quest de
kopie (nieuw id, versie 1) en niet meer het origineel. De kopie en haar meegekregen video's zijn
te downloaden zoals elke eigen cursus.
