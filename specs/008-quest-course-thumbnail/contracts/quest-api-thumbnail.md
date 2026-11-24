# Contract: uitbreiding Quest-API v1 met een cursusafbeelding

Dit is een uitbreiding van [specs/007-quest-api/contracts/quest-api.md](../../007-quest-api/contracts/quest-api.md)
volgens de compatibiliteitsregel van v1: er komen één veld en één endpoint bij; niets wordt
weggehaald, hernoemd of anders van betekenis. Een app die het nieuwe veld niet kent, negeert het.
De uitbreiding is ook in dat contract verwerkt.

## Nieuw veld `thumbnailUrl`

In elke cursus van `GET /courses` en in het antwoord van `GET /courses/:courseId`, direct na
`publishedAt`:

```json
{
  "id": 345,
  "name": "Verdrinkingsherkenning",
  "description": "Herken de signalen van een drenkeling.",
  "versionNumber": 3,
  "publishedAt": "2026-11-20T14:02:11.000Z",
  "thumbnailUrl": "/api/quest/v1/courses/345/thumbnail?v=3",
  "downloadSizeBytes": 1834221984
}
```

- Relatief ten opzichte van de server, of `null` als de cursus geen afbeelding heeft.
- `v` is het `versionNumber` van de live versie. Het adres verandert dus bij elke nieuwe live
  versie; de app kan afbeeldingen per adres bewaren.
- Dezelfde waarde in de lijst en in de inhoud.
- De afbeelding is de thumbnail van de eerste video op de route van de live versie: het
  startonderdeel als dat een video is, anders de dichtstbijzijnde video (minste stappen; bij
  gelijke afstand het eerdere antwoord A–D). Geen video op de route → `null`.
- `downloadSizeBytes` houdt dezelfde definitie: Σ `videos[].fileSizeBytes` + de bytes van het
  antwoord van `GET /courses/:courseId` (dat nu ook `thumbnailUrl` bevat). De afbeelding telt niet
  mee.

## GET /courses/:courseId/thumbnail

De afbeelding van een cursus. Zelfde koppeling als de andere verzoeken
(`Authorization: Bearer <koppelcode>`). De API controleert alleen de toegang; nginx levert de bytes
(`X-Accel-Redirect`, constitutie III).

**Query**: `v` (optioneel). Wordt genegeerd: het antwoord is altijd de afbeelding van de huidige
live versie. Een oud, onjuist of ontbrekend `v` geeft geen fout.

**200**, `Content-Type: image/jpeg`, `Cache-Control: private, max-age=0, must-revalidate`. Het
bestand is een JPEG van 1024×512 (een frame uit een 360°-video).

**401** `relink_required`: geen of een ongeldige koppelcode.

**404** `not_found`: de cursus is niet zichtbaar voor deze Quest (andere organisatie, geen live
versie, onpubliceerd, verwijderd, niet bestaand, id met een verkeerde vorm) of heeft geen
afbeelding. Deze gevallen zijn niet van elkaar te onderscheiden.

De afbeelding blijft beschikbaar als de eigenaar de video intussen zacht heeft verwijderd of heeft
beperkt, zolang hij in de live versie zit.
