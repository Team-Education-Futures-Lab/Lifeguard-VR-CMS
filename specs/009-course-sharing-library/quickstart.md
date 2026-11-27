# Quickstart: cursussen delen en de cursusbibliotheek valideren

Deze gids toont na de implementatie aan dat de feature werkt.
- Endpoints: [contracts/api.md](contracts/api.md)
- Schermen: [contracts/ui.md](contracts/ui.md)
- Regels: [data-model.md](data-model.md)

De voorbereiding is zoals in [feature 006 quickstart](../006-course-publishing/quickstart.md). De
nieuwe migratie `20261126000001_course_sharing` loopt mee bij het starten van de API. Je hebt drie
organisaties nodig (A, B en C, aan te maken door de beheerder). A heeft video's met elke
beschikbaarheid.

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
| `courseSharingWarning.test.js` (unit) | de tabel van gevallen uit research R4 (SC-003) |
| `courseLibrary.test.js` | FR-014 met drie organisaties, onpubliceerde, verwijderde en conceptcursussen (SC-001, SC-004) |
| `coursePublishAvailability.test.js` | FR-002, FR-003, alles-of-niets, 409 en daarna doorgaan |
| `courseAvailabilityChange.test.js` | FR-006, `course_not_live`, versie en status ongewijzigd |
| `courseLibraryIsolation.test.js` | 404 bij niet-beschikbare cursussen en thumbnails; geen concept of inhoud; niet voor de beheerder (SC-002, FR-018, FR-028) |
| `courseLibraryPerformance.test.js` | 200 cursussen binnen 2 s (SC-006) |
| `questCourses.test.js` | gedeelde cursussen komen niet op een andere Quest (FR-026) |

E2e: `e2e/tests/009-course-sharing-library/`.

## Handmatige scenario's

| # | Stappen | Verwacht |
| --- | --- | --- |
| 1 | Als A: een bestaande gepubliceerde cursus openen (van vóór de migratie) en het menu openen; dan het overzicht bekijken | "Alleen eigen organisatie"; B ziet de cursus niet in de bibliotheek (FR-005, SC-007) |
| 2 | Als A: een nieuwe complete cursus met alleen algemeen beschikbare video's; "Publiceren" | In de bevestiging staat "Alleen eigen organisatie" voorgeselecteerd (FR-002) |
| 3 | "Algemeen beschikbaar" kiezen en bevestigen | Geen waarschuwing; gepubliceerd. B en C zien de cursus in de cursusbibliotheek met de pil "A"; A ziet hem met "Eigen" (US1, US2) |
| 4 | Als A: een cursus met een video "Alleen eigen organisatie" publiceren met "Selectief beschikbaar", alleen B gekozen | Eerst de waarschuwing met precies die video. "Annuleren": terug naar de bevestiging, niets gepubliceerd. Opnieuw en "Doorgaan": gepubliceerd. B ziet de cursus, C niet (US3, SC-003) |
| 5 | Dezelfde cursus wijzigen (alleen tekst), opslaan, "Wijzigingen publiceren" | Geen waarschuwing (geen nieuwe beperkte video) (FR-010 c) |
| 6 | Een tweede beperkte video toevoegen, opslaan, publiceren | Waarschuwing met alleen de nieuwe video (FR-010 c) |
| 7 | "Beschikbaarheid wijzigen" → "Algemeen beschikbaar" | Waarschuwing met beide video's (groter publiek). Na "Doorgaan": C ziet de cursus; versie en datum zijn ongewijzigd (US4, FR-010 b) |
| 8 | "Beschikbaarheid wijzigen" → "Selectief beschikbaar", alleen B | Vraag "1 organisatie kan deze cursus daarna niet meer zien in de cursusbibliotheek." (met alleen A, B en C actief). Na "Wijzigen" ziet C hem niet meer (FR-007) |
| 9 | Als B: in de bibliotheek zoeken op een deel van de naam van A, op de pil van A klikken, sorteren op naam | Filteren en sorteren werken samen; label "Organisatie: A ✕" (FR-019) |
| 10 | Als B: een cursus van A openen | Venster met samenvatting; geen beschikbaarheid, geen knoppen om te bewerken, geen onderdelen of video's (FR-017, FR-018). De thumbnail is neutraal als de afbeelding van een video "Alleen eigen organisatie" van A komt (research R6) |
| 11 | Als B buiten de interface: `GET /api/organisation/courses/<id van A>`, `PUT .../availability`, `GET /api/organisation/course-library/<id van een cursus "Alleen eigen organisatie" van A>` | Alle drie `404` (SC-002) |
| 12 | Als A: de cursus van scenario 3 onpubliceren | De bevestiging noemt de cursusbibliotheek. Als B (na herladen): de cursus is weg. Als A opnieuw publiceren: "Algemeen beschikbaar" is voorgeselecteerd. Waarschuwing alleen bij beperkte video's (geval a) (US5) |
| 13 | Als B de bibliotheek open laten staan; als A de cursus verwijderen; als B de cursus aanklikken | Toast "Deze cursus is niet meer beschikbaar."; de cursus verdwijnt uit de lijst (US5, scenario 4) |
| 14 | Als B koppelen met een Quest en de cursussen ophalen | Alleen de eigen cursussen van B, niet die van A (FR-026) |
| 15 | Als beheerder organisatie A verwijderen | De cursussen van A verdwijnen uit de bibliotheek van B en C (randgeval) |
| 16 | Als A een cursus publiceren met "Selectief beschikbaar" zonder organisatie (ook via de API) | Melding "Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’."; niets gepubliceerd (FR-003) |

## Controle in de database (optioneel)

```sql
SELECT c.id, c.visibility, c.parentCourseId, c.deletedAt,
       GROUP_CONCAT(a.organisationId) AS accessOrganisationIds
FROM Course c LEFT JOIN CourseAccess a ON a.courseId = c.id
GROUP BY c.id;
```

Verwacht:
- `isSharedInLibrary` bestaat niet meer.
- Cursussen van vóór de migratie hebben `private`.
- Er zijn alleen rijen in `CourseAccess` bij `selective`.

## Resultaten handmatige test

Getest op 2026-11-27 in de lokale ontwikkelomgeving, samen met de handmatige tests van 010 en 011.

| # | Resultaat | Opmerking |
| --- | --- | --- |
| 1 | ✅ | Alleen bij Cursussen, niet in de bibliotheek (zo bedoeld) |
| 2 | ✅ | |
| 3 | ✅ | |
| 4 | ✅ | Waarschuwing heeft veel tekst → backlog. Geen thumbnail voor B: zo bedoeld (R6) |
| 5 | ✅ | |
| 6 | ✅ | Wens: ook tonen welke beperkte video's al gedeeld waren → backlog |
| 7 | ✅ | |
| 8 | ✅ | Geen thumbnail voor andere organisaties: zo bedoeld (R6) |
| 9 | ✅ | |
| 10 | open | Getest via het venster van een overgenomen cursus; het venster in de bibliotheek (vóór toevoegen) nog doen |
| 11 | ✅ | |
| 12 | ✅ | |
| 13 | ✅ | |
| 14 | ✅ | Quest van B toont alleen de eigen cursus van B |
| 15 | ✅ | Geen link naar de beheerderslogin op de inlogpagina → backlog |
| 16 | ✅ | |

De SQL-controle uit "Controle in de database" is nog niet gedaan.
