# Quickstart: gedeelde cursussen overnemen als verwijzing valideren

Deze gids toont na de implementatie aan dat de feature werkt.
- Endpoints: [contracts/api.md](contracts/api.md)
- Schermen: [contracts/ui.md](contracts/ui.md)
- Regels: [data-model.md](data-model.md)

De voorbereiding is zoals in [feature 009 quickstart](../009-course-sharing-library/quickstart.md).
De nieuwe migratie `20261127000001_course_references` loopt mee bij het starten van de API. Je hebt
drie organisaties nodig: A, B en C, aan te maken door de beheerder.
- A heeft een complete cursus "Redden" met één video "Alleen eigen organisatie" (video X) en één
  algemeen beschikbare video (video Y).
- A publiceert "Redden" als versie 1 met "Algemeen beschikbaar" en kiest "Doorgaan" bij de
  waarschuwing.
- B en C hebben elk een Quest gekoppeld (specs/007), of je gebruikt de Quest-API met hun koppelcode.

## Geautomatiseerde tests

```bash
docker compose --profile test run --rm --build api-test
```

```bash
docker compose --profile test run --rm --build web-build npm test
```

Verwacht: alles groen, in het bijzonder:

| Test | Dekt |
| --- | --- |
| `courseReferenceState.test.js` (unit) | de tabel van gevallen uit data-model (research R4) |
| `courseReferenceAdd.test.js` | FR-001 – FR-005; 404 bij een eigen, niet-beschikbare of verwijderde cursus; `course_already_added`; `addedAt` en `courseVersionId` gevuld (SC-007); gelijktijdig beperken (R8) |
| `courseReferenceList.test.js` | FR-006, FR-007; alle `withdrawn`-redenen (FR-017); `noticeCount` |
| `courseReferenceVersions.test.js` | FR-012 – FR-016: melding, overstappen, houden, een nog nieuwere versie, `no_newer_version` |
| `courseReferenceRemove.test.js` | FR-009; opnieuw toevoegen met een nieuwe `addedAt` en de live versie van dat moment |
| `courseReferenceIsolation.test.js` | FR-008, FR-024: eigenaarsroutes geven 404 voor een verwijzing; andermans verwijzing is niet te zien (SC-003) |
| `courseReferenceVideos.test.js` | FR-021: een verwijderde of beperkte video in de gekozen versie blijft te downloaden, en de opruimtaak laat het bestand staan (SC-005) |
| `courseReferencePerformance.test.js` | 200 eigen en 200 overgenomen cursussen binnen 2 s |
| `questCourses.test.js` e.a. | de gekozen versie op de Quest; geen video's uit een niet-gekozen versie (FR-010, FR-011, SC-002) |

E2e: `e2e/tests/010-course-reference-takeover/`.

## Handmatige scenario's

| # | Stappen | Verwacht |
| --- | --- | --- |
| 1 | Als B: de cursusbibliotheek openen en "Redden" aanklikken | Knop "Toevoegen aan mijn organisatie" (FR-001) |
| 2 | Op de knop klikken en "Annuleren" kiezen; daarna opnieuw klikken en "Toevoegen" kiezen | Na annuleren is er niets veranderd. Na toevoegen de toast, en "Toegevoegd" in het venster en in de lijst (US1) |
| 3 | Als B: "Cursussen" openen | Onder "Overgenomen cursussen" staat "Redden" met de pil "Overgenomen van A" en "Op de Quest: versie 1" (US2, FR-006) |
| 4 | De Quest van B de cursussen laten ophalen en "Redden" downloaden, inclusief video X | De cursus staat erin. Video X is te downloaden, ook al is hij "Alleen eigen organisatie" (FR-010, FR-021). De Quest van C krijgt "Redden" niet |
| 5 | Als B: de overgenomen cursus aanklikken | Samenvatting zonder knop naar de editor, met "Verwijderen uit mijn organisatie" (FR-007, FR-008) |
| 6 | Als B buiten de interface: `GET`/`PUT /api/organisation/courses/<id van Redden>` en `POST …/publish` | Alle `404` (FR-008, SC-003) |
| 7 | Als A: "Redden" openen | Het publicatiemenu en het bibliotheekvenster tonen "Overgenomen door 1 organisatie: B" (FR-019) |
| 8 | Als A: video X vervangen door video Y, opslaan en publiceren (versie 2) | B ziet na herladen een teller bij "Cursussen" en "Nieuwe versie beschikbaar (versie 2)". De Quest van B krijgt nog versie 1 (US3) |
| 9 | Als B: de cursus openen en "Huidige versie houden" kiezen | De teller verdwijnt. Bij de cursus staat "Nieuwere versie beschikbaar (versie 2)". De Quest houdt versie 1, en video X blijft te downloaden (FR-015, US5) |
| 10 | Als A: versie 3 publiceren | De teller van B komt terug, nu met "versie 3" (FR-015) |
| 11 | Als B: "Nieuwe versie gebruiken" kiezen | De toast. De Quest van B krijgt versie 3. Video X geeft nu `404` voor de Quest van B, als hij niet in versie 3 zit (US5 scenario 4) |
| 12 | Als C: "Redden" toevoegen. Als A: de beschikbaarheid wijzigen naar "Selectief beschikbaar", alleen B | De beperk-bevestiging noemt "1 daarvan heeft deze cursus overgenomen en houdt haar huidige versie." (C) |
| 13 | Als A: versie 4 publiceren; daarna als C het overzicht openen | C heeft geen melding en ziet "De eigenaar deelt deze cursus niet meer met jullie. Jullie houden versie 3." De Quest van C houdt versie 3. B heeft wel een melding (FR-017, US4) |
| 14 | Als A: "Redden" onpubliceren | De bevestiging noemt 2 organisaties. B en C zien "De eigenaar heeft deze cursus ingetrokken.", en de Quests houden hun versie (US4) |
| 15 | Als A: opnieuw publiceren (zelfde inhoud) | Bij B verdwijnt de uitleg en komt er een melding als de live versie nieuwer is dan haar versie. Bij C blijft "deelt niet meer" staan (US4 scenario 2 en 5) |
| 16 | Als A: "Redden" verwijderen | De bevestiging noemt de ontvangers. Bij A is de cursus weg en in de bibliotheek ook. B en C zien "De eigenaar heeft deze cursus verwijderd.", en hun Quests hebben de cursus nog (FR-018) |
| 17 | Als C: "Verwijderen uit mijn organisatie" | De bevestiging zegt dat C hem niet opnieuw kan toevoegen. Daarna is de cursus weg bij C en van de Quest van C. Bij B is niets veranderd (FR-009) |
| 18 | Als beheerder A verwijderen; daarna als B het overzicht openen | "De eigenaar van deze cursus bestaat niet meer. Jullie houden versie N." De Quest van B heeft de cursus nog (Clarifications) |

## Controle in de database (optioneel)

```sql
SELECT oc.organisationId, oc.courseId, oc.isOwner, oc.addedAt,
       cv.versionNumber AS chosenVersion, oc.declinedCourseVersionId
FROM OrganisationCourse oc LEFT JOIN CourseVersion cv ON cv.id = oc.courseVersionId
ORDER BY oc.courseId, oc.isOwner DESC;
```

Verwacht:
- Eigenaarsrijen hebben beide nieuwe velden NULL.
- Elke verwijzing heeft een `addedAt` en een `courseVersionId` van een vastgezette versie van
  dezelfde cursus (SC-007).
- Na scenario 17 is er geen rij meer voor C.
- Er bestaat geen tabel voor een overnamegeschiedenis.
