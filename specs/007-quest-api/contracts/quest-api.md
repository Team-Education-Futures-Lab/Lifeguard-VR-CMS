# Contract: Quest-API v1

Basis-URL: `/api/quest/v1`. Alle antwoorden zijn JSON (behalve het videobestand en de cursusafbeelding). Er worden geen
cookies gebruikt en er is geen CSRF-header nodig. Behalve bij `POST /link` vraagt elk verzoek om:

```http
Authorization: Bearer <koppelcode>
```

De app bewaart de koppelcode na een geslaagde `POST /link` en stuurt hem bij elk verzoek mee. De
server trimt hem en zet hem in hoofdletters, net als bij `/link`.

Fouten hebben dezelfde vorm als in de rest van de API: `{ "error": { "code": "<english_code>", "message": "<Nederlandse tekst>" } }`.

| Code | HTTP | Wanneer | Wat moet de app doen |
|---|---|---|---|
| `invalid_link_code` | 401 | `POST /link` met een ongeldige code | Melding tonen en de code opnieuw laten invoeren |
| `relink_required` | 401 | Geen of een onbekende koppelcode in de header (code vernieuwd, organisatie verwijderd) | De bewaarde code op de Quest vergeten en de koppelcode opnieuw vragen |
| `not_found` | 404 | De cursus of video is niet (meer) zichtbaar voor deze Quest of bestaat niet, of de cursus heeft geen afbeelding (spec 008) | De lijst opnieuw ophalen |

Datums zijn ISO 8601 in UTC (`2026-11-24T09:15:00.000Z`). Een id is een positief geheel getal; een
id met een verkeerde vorm in de URL geeft `404 not_found`.

---

## POST /link

Controleert een koppelcode en geeft de organisatie terug. De app bewaart daarna `linkCode` uit het
antwoord (de genormaliseerde code) en gebruikt die als sleutel.

**Request**

```json
{ "linkCode": " qz7k2m9x " }
```

De code wordt getrimd en in hoofdletters gezet. Een ontbrekende code, een code die geen tekst is
of een code met een verkeerde vorm krijgt `401 invalid_link_code`.

**200**

```json
{
  "linkCode": "QZ7K2M9X",
  "organisation": { "id": 12, "name": "Zwembad De Golf" }
}
```

**401** `invalid_link_code`: de code is onbekend, het is een loginCode of de organisatie is verwijderd.

---

## GET /organisation

Laat de app controleren of de koppeling nog geldig is en welke organisatie erbij hoort.

**200** `{ "organisation": { "id": 12, "name": "Zwembad De Golf" } }`

**401** `relink_required`

---

## GET /courses

De cursussen die deze Quest nu kan downloaden (de live versies, research R3).

**200**

```json
{
  "courses": [
    {
      "id": 345,
      "name": "Verdrinkingsherkenning",
      "description": "Herken de signalen van een drenkeling.",
      "versionNumber": 3,
      "publishedAt": "2026-11-20T14:02:11.000Z",
      "thumbnailUrl": "/api/quest/v1/courses/345/thumbnail?v=3",
      "downloadSizeBytes": 1834221984
    }
  ]
}
```

- `id` is `Course.id` en blijft gelijk over versies heen. De app vergelijkt `versionNumber` met de
  gedownloade versie: is het nummer hoger, dan is er een update beschikbaar (FR-06-VR).
- `thumbnailUrl` (toegevoegd in spec 008): het adres van de afbeelding van de cursus, relatief ten
  opzichte van de server, of `null` als de cursus geen afbeelding heeft. `v` is het
  `versionNumber`, dus het adres verandert bij elke nieuwe live versie. Zie
  `GET /courses/:courseId/thumbnail`.
- De volgorde is op `name` (hoofdletterongevoelig) en daarna op `id`.
- Er zijn geen cursussen → `{ "courses": [] }`.

**401** `relink_required`

---

## GET /courses/:courseId

De volledige inhoud van de live versie.

**200**

```json
{
  "id": 345,
  "name": "Verdrinkingsherkenning",
  "description": "Herken de signalen van een drenkeling.",
  "versionNumber": 3,
  "publishedAt": "2026-11-20T14:02:11.000Z",
  "thumbnailUrl": "/api/quest/v1/courses/345/thumbnail?v=3",
  "startStepId": 9001,
  "steps": [
    { "id": 9001, "type": "video", "videoId": 77, "nextStepId": 9002 },
    {
      "id": 9002,
      "type": "question",
      "questionText": "Wat doe je eerst?",
      "feedback": "Eerst alarmeren, dan pas het water in.",
      "answers": [
        { "id": 501, "text": "Alarm slaan", "isCorrect": true, "nextStepId": 9003 },
        { "id": 502, "text": "Meteen erin springen", "isCorrect": false, "nextStepId": 9004 }
      ]
    },
    { "id": 9003, "type": "video", "videoId": 78, "nextStepId": null },
    { "id": 9004, "type": "video", "videoId": 77, "nextStepId": null }
  ],
  "videos": [
    { "id": 77, "fileSizeBytes": 912340112, "durationSeconds": 95, "url": "/api/quest/v1/videos/77" },
    { "id": 78, "fileSizeBytes": 921880000, "durationSeconds": 102, "url": "/api/quest/v1/videos/78" }
  ]
}
```

- `steps` staan in de volgorde van hun id. `answers` staan in de volgorde A–D (`sortOrder`).
- Een video-onderdeel heeft `videoId` en `nextStepId`. `nextStepId: null` betekent dat het een
  einde is.
- Een vraag heeft `questionText`, `feedback` (een tekst of `null`) en `answers`. Een vraag waarvan
  geen enkel antwoord verbonden is, is een einde (feature 005). Dan hebben alle antwoorden
  `nextStepId: null`.
- `videos` noemt elke video uit de live versie één keer. `url` is relatief ten opzichte van de
  server. Ook een video die de eigenaar intussen heeft verwijderd of beperkt, staat erin
  (FR-014).
- Velden die alleen voor de editor zijn (positie op het canvas, concept-id's) zitten er niet in.
- `downloadSizeBytes` uit de lijst = Σ `videos[].fileSizeBytes` + het aantal bytes van dit
  antwoord als UTF-8 JSON zoals de server het stuurt. De cursusafbeelding telt niet mee.
- `thumbnailUrl` (toegevoegd in spec 008) heeft dezelfde waarde als in de lijst.

**401** `relink_required` · **404** `not_found` (een andere organisatie, geen live versie,
verwijderd of niet bestaand)

---

## GET /courses/:courseId/thumbnail

*Toegevoegd in spec 008 (`specs/008-quest-course-thumbnail`).* De afbeelding van een cursus: de
thumbnail van de eerste video op de route van de live versie (het startonderdeel als dat een video
is, anders de dichtstbijzijnde video; bij gelijke afstand het eerdere antwoord A–D). Nooit uit het
concept. De API controleert alleen de toegang; nginx levert de bytes (`X-Accel-Redirect`,
constitutie III).

**Query**: `v` (optioneel) wordt genegeerd; het antwoord is altijd de afbeelding van de huidige live
versie.

**200**, `Content-Type: image/jpeg` (1024×512), `Cache-Control: private, max-age=0, must-revalidate`.
Ook als de eigenaar de video intussen heeft verwijderd of beperkt.

**401** `relink_required` · **404** `not_found` (de cursus is niet zichtbaar voor deze Quest, het id
heeft een verkeerde vorm, of de cursus heeft geen afbeelding)

---

## GET /videos/:videoId

Het videobestand. De API controleert alleen of de Quest de video mag hebben: de video moet in een
live versie zitten die deze Quest ziet. nginx levert de bytes (`X-Accel-Redirect`, constitutie
III).

**Request**: optioneel `Range: bytes=<start>-` om een download te hervatten.

**200** of **206** (bij `Range`), `Content-Type: video/mp4`,
`Cache-Control: private, max-age=0, must-revalidate`, `Accept-Ranges: bytes`.

**401** `relink_required` · **404** `not_found` (de video zit niet in een live versie die de
Quest ziet, of bestaat niet)

---

## Compatibiliteit

- Binnen v1 mogen velden worden **toegevoegd**. De app MUST onbekende velden negeren.
- Een veld weghalen, hernoemen of de betekenis veranderen gebeurt alleen in een nieuwe versie
  (`/api/quest/v2`). v1 blijft dan bestaan totdat de apps zijn bijgewerkt.
