# API-contract: cursussen delen en de cursusbibliotheek

Dit zijn de wijzigingen op [specs/006 api.md](../../006-course-publishing/contracts/api.md). Wat
hier niet staat, blijft gelijk: sessie, CSRF, foutformaat, `ownCoursesQuery` en opslaan. Alle
routes staan onder `/api/organisation`, achter `requireOrganisation`. De organisatie komt altijd
uit de sessie (`getOrganisationId(req)`).

## Gedeeld: beschikbaarheid

```json
"availability": {
  "visibility": "selective",
  "accessOrganisations": [{ "id": 4, "name": "Brandweer Academie Noord" }]
}
```

- `visibility`: `public` | `selective` | `private` (data-model).
- `accessOrganisations`: alleen bij `selective`; actieve organisaties, alfabetisch. Anders `[]`.

## Gewijzigd: het conceptdocument (`GET`/`PUT /courses/:id`, `POST /courses`, `publish`, `unpublish`)

Het conceptdocument krijgt `availability` (zie hierboven). Dit zijn alleen eigen cursussen.

## Gewijzigd: `GET /courses`

Elke rij krijgt `visibility` (research R10).

## Gewijzigd: `POST /courses/:id/publish`

De body is nu optioneel:

```json
{ "visibility": "public", "accessOrganisationIds": [], "acknowledgedVideoIds": [7, 9] }
```

- Zonder `visibility` blijft de huidige beschikbaarheid staan (research R8).
- `accessOrganisationIds`: verplicht bij `selective`, verder genegeerd.
- `acknowledgedVideoIds`: de video's uit een eerdere `409 shared_videos_warning` waarvoor de
  eigenaar "Doorgaan" koos. Mag ontbreken.

Antwoorden, in deze volgorde gecontroleerd. Bij elke fout verandert er niets.

| Status | `code` | Wanneer |
| --- | --- | --- |
| 404 | `not_found` | De cursus bestaat niet, is verwijderd, of is van een andere organisatie. |
| 400 | `validation_failed` | Velden kloppen niet. Bijvoorbeeld `fields.visibility` = "Kies een beschikbaarheid.", of `fields.accessOrganisationIds` = "Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’." of "Kies alleen organisaties uit de lijst." |
| 422 | `course_incomplete` | Zoals in specs/006. |
| 409 | `shared_videos_warning` | De waarschuwing is nodig en niet (volledig) bevestigd. Zie hieronder. |
| 200 | – | Het (nieuwe) conceptdocument met de opgeslagen `availability`. |

```json
{
  "error": {
    "code": "shared_videos_warning",
    "message": "Deze cursus bevat video's die niet algemeen beschikbaar zijn.",
    "videos": [{ "id": 7, "name": "Redding diep water" }, { "id": 9, "name": "Uitleg EHBO" }]
  }
}
```

- `videos` staan in de volgorde van de onderdelen; elke video één keer (research R4).

## Nieuw: `PUT /courses/:id/availability`

Wijzigt de beschikbaarheid van een cursus met een live versie zonder opnieuw te publiceren
(FR-006). Body: zoals bij publish, maar `visibility` is verplicht.

| Status | `code` | Wanneer |
| --- | --- | --- |
| 404 | `not_found` | Zoals bij publish. |
| 400 | `validation_failed` | Zoals bij publish. |
| 409 | `course_not_live` | "Publiceer de cursus eerst." De cursus heeft geen live versie. |
| 409 | `shared_videos_warning` | Zoals bij publish, berekend op de live versie. |
| 200 | – | Het conceptdocument. `status`, `publication` en `updatedAt` zijn ongewijzigd. |

## Nieuw: `GET /course-library`

De cursusbibliotheek van de organisatie in de sessie (research R2, R7). Dit is één lijst, zonder
pagina's.

```json
{
  "courses": [
    {
      "id": 31,
      "name": "Redden in open water",
      "description": "…",
      "owner": { "id": 4, "name": "Brandweer Academie Noord", "isOwn": false },
      "versionNumber": 3,
      "publishedAt": "2026-11-20T09:12:00.000Z",
      "stepCount": 14,
      "videoCount": 6,
      "thumbnailUrl": "/api/organisation/course-library/31/thumbnail"
    }
  ]
}
```

- Alles in het object komt uit de live versie (FR-016).
- `thumbnailUrl` is `null` als er geen afbeelding is, of als de kijkende organisatie die video
  niet in haar eigen videobibliotheek ziet en geen eigenaar is (research R6).
- Bij `owner.isOwn = true` komen er ook `visibility` en `accessOrganisations` bij
  (zie "Gedeeld: beschikbaarheid").
- De volgorde is de nieuwste `publishedAt` eerst. De browser sorteert en filtert verder zelf.
- Er zijn nooit onderdelen, vragen, antwoorden, video-id's, het concept of oude versies (FR-018).

## Nieuw: `GET /course-library/:id`

Eén cursus uit de bibliotheek, als object zoals in de lijst. Staat de cursus niet in de
bibliotheek van de organisatie, dan `404 not_found`, met dezelfde reactie als voor een cursus die
niet bestaat (FR-021).

## Nieuw: `GET /course-library/:id/thumbnail`

Alleen een toegangscontrole met dezelfde regel als `thumbnailUrl`. Daarna levert nginx de
afbeelding via `X-Accel-Redirect` (`sendStoredFile`, `private, max-age=3600`). Anders
`404 not_found`.

## Ongewijzigd, met extra tests

- `GET/PUT/DELETE /courses/:id`, `publish`, `unpublish` en `availability` voor een cursus van een
  andere organisatie (ook een gedeelde): `404` (FR-008, FR-022).
- Quest-API `/api/quest/v1/courses`: alleen eigen cursussen, ook als andere organisaties hun
  cursussen algemeen delen (FR-026).
