# API-contract: publiceren en onpubliceren

Wijzigingen op de contracten van [feature 004](../../004-course-steps-draft/contracts/api.md) en
[feature 005](../../005-course-step-branching/contracts/api.md). Alles wat hier niet staat, blijft
gelijk (sessie, CSRF, foutformaat, isolatie via `ownCoursesQuery`, thumbnailroute, opslaan).

## Gedeeld: status en publicatie

```json
"status": "published_changed",
"publication": {
  "versionNumber": 2,
  "publishedAt": "2026-11-23T13:05:00.000Z",
  "hasUnavailableVideo": false
}
```

- `status`: `draft` | `published` | `published_changed` (data-model, status).
- `publication`: `null` zonder live versie; anders de live versie. `hasUnavailableVideo`: de live
  versie bevat een video die niet meer in de bibliotheek van de organisatie staat (voor de
  bevestiging bij onpubliceren, FR-015).

## Gewijzigd: `GET /api/organisation/courses`

Elke rij krijgt `status` (niet langer altijd `draft`) en `publication`.

## Gewijzigd: het concept-document (`GET`/`PUT /courses/:id`, `POST /courses`)

- `status` en `publication` zoals hierboven.
- `lastPublishedVersionNumber`: `null` of het hoogste versienummer ooit gepubliceerd (ook als de
  cursus nu onpubliceerd is).
- Bij `video` van een video-onderdeel komt `keptByLiveVersion` (boolean): de video zit in de live
  versie (R6). `available` blijft zoals in feature 004.

```json
{ "id": 12, "name": "…", "description": "…", "updatedAt": "…",
  "status": "published", "publication": { "versionNumber": 1, "publishedAt": "…", "hasUnavailableVideo": false },
  "lastPublishedVersionNumber": 1,
  "steps": [
    { "id": 104, "stepType": "video", "videoId": 7,
      "video": { "id": 7, "name": "…", "durationSeconds": 42, "thumbnailUrl": "…", "available": false, "keptByLiveVersion": true },
      "nextStepId": null, "isStart": false, "positionX": 0, "positionY": 260 }
  ] }
```

- `draftVersionNumber`: het versienummer van het concept (R14). De editor stuurt het mee bij
  opslaan.

## Gewijzigd: `PUT /api/organisation/courses/:id` (opslaan)

- Body krijgt het verplichte veld `draftVersionNumber` (geheel getal). Ontbreekt het of is het
  geen geheel getal: `400 validation_failed` zoals andere velden.
- `409` `draft_replaced`, `message`: "Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw
  om verder te werken." als het niet gelijk is aan het nummer van het huidige concept. Er
  verandert niets.
- `200`: het concept-document met de nieuwe `status`.

## Nieuw: `POST /api/organisation/courses/:id/publish`

Publiceert het **opgeslagen** concept. Geen body.

- `200`: het concept-document (met nieuwe `status` en `publication`). Ook als er niets te doen
  was (concept gelijk aan de live versie, R9), of als de laatst gepubliceerde versie weer live is
  gezet (FR-017).
- `422` `course_incomplete`, `message`: "De cursus is nog niet klaar om te publiceren." en
  `issues`:

  ```json
  { "code": "course_incomplete",
    "message": "De cursus is nog niet klaar om te publiceren.",
    "issues": [
      { "code": "answerOpen", "message": "Antwoord B is nog niet verbonden", "stepId": 103, "answerId": 502 },
      { "code": "videoUnavailable", "message": "Video niet meer beschikbaar: kies een andere.", "stepId": 104 }
    ] }
  ```

  Er verandert niets.
- `404` `not_found`: onbekend, verwijderd of van een andere organisatie (FR-002).

## Nieuw: `POST /api/organisation/courses/:id/unpublish`

Haalt de live versie weg (FR-016). Geen body.

- `200`: het concept-document met `status: "draft"` en `publication: null`. Ook als de cursus al
  niet gepubliceerd was (idempotent).
- `404` `not_found`: zoals hierboven.

## Ongewijzigd: `DELETE /api/organisation/courses/:id`

Zet zoals nu alleen `Course.deletedAt` (`204`). Een verwijderde cursus heeft daardoor geen live
versie meer (data-model, live versie; FR-021).
