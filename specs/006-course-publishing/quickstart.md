# Quickstart: valideren van publiceren en onpubliceren

Gids om na de implementatie aan te tonen dat de feature werkt. Endpoints staan in
[contracts/api.md](contracts/api.md), schermen in [contracts/ui.md](contracts/ui.md), regels in
[data-model.md](data-model.md). Voorbereiding zoals in
[feature 004 quickstart](../004-course-steps-draft/quickstart.md); deze feature heeft één nieuwe
migratie (`20261123000001_course_version_unpublished_at`), die bij het starten van de API
meeloopt.

## Geautomatiseerde tests

```bash
docker compose --profile test run --rm --build api-test
```

```bash
docker compose --profile test run --rm --build web-build npm test
```

Verwacht: alles groen, inclusief `coursePublish.test.js` (SC-002, SC-004, SC-006),
`courseUnpublish.test.js` (FR-016, FR-017, FR-021), `coursePublishVideos.test.js` (SC-008),
`courseIsolation.test.js` (SC-005), en aan beide kanten de gedeelde testset
`course-check-cases.json` (`courseCheck.test.js` en `course-check-parity.test.js`, SC-002).

E2e: `e2e/tests/006-course-publishing/` zoals de bestaande e2e-tests (zie `docs/ci.md`).

## Handmatige scenario's (als docent van een organisatie met een paar video's)

| # | Stappen | Verwacht |
| --- | --- | --- |
| 1 | Nieuwe cursus, nog zonder video's; "Publiceren" | Dialoog "Nog niet klaar om te publiceren" met twee keer "Kies een video"; klik op een melding opent het onderdeel; niets gepubliceerd (US2) |
| 2 | Beide video's kiezen, "Publiceren", bevestigen | Melding "Gepubliceerd als versie 1"; balk en overzicht "Gepubliceerd · Versie 1 · <datum en tijd>" (US1, SC-001) |
| 3 | Kijken naar de knop "Publiceren" | Uitgeschakeld, "Er is niets nieuws om te publiceren" (FR-020) |
| 4 | Een blok verschuiven en opslaan | Status blijft "Gepubliceerd" (canvas telt niet) |
| 5 | Vraagtekst wijzigen en opslaan | "Gepubliceerd · wijzigingen nog niet gepubliceerd", "Op de Quest: versie 1" (US3) |
| 6 | Wijziging ongedaan maken en opslaan | Weer "Gepubliceerd" (inhoud gelijk aan versie 1) |
| 7 | Opnieuw wijzigen, zonder op te slaan "Publiceren" | Dialoog noemt "Je wijzigingen worden eerst opgeslagen"; na bevestigen "Gepubliceerd als versie 2" |
| 8 | Een antwoord loskoppelen, opslaan, "Publiceren" | Niet gepubliceerd; "Antwoord B is nog niet verbonden"; versie 2 blijft live |
| 9 | Zelfde verzoek buiten de interface: `POST /api/organisation/courses/<id>/publish` | `422 course_incomplete` met dezelfde melding; niets veranderd (FR-006) |
| 10 | Antwoord weer verbinden, opslaan; "Onpubliceren", bevestigen | Status "Concept", "Niet gepubliceerd (was versie 2)"; concept ongewijzigd (US4) |
| 11 | Direct weer "Publiceren" | "Versie 2 staat weer op de VR-brillen"; versie en datum van versie 2 (FR-017) |
| 12 | Tweede organisatie: als eigenaar een video verwijderen die in de live versie van cursus X zit (van organisatie 1); dan als organisatie 1 cursus X wijzigen en publiceren | Lukt; geen melding over die video in "nog te doen" (FR-012, FR-013) |
| 13 | Cursus X onpubliceren | Bevestiging noemt dat de video niet meer beschikbaar is; na bevestigen "Concept" |
| 14 | Cursus X opnieuw publiceren | "Nog niet klaar om te publiceren": "Kies een andere video: deze is niet meer beschikbaar"; ook in "nog te doen" (FR-012) |
| 15 | In een andere sessie als organisatie 2: `POST /api/organisation/courses/<id van X>/publish` en `/unpublish` | `404` (FR-002, SC-005) |
| 16 | In het overzicht een gepubliceerde cursus verwijderen | Bevestiging noemt dat hij van de VR-brillen verdwijnt; daarna weg uit het overzicht; in de database `Course.deletedAt` gevuld, versies nog aanwezig, en geen live versie meer (FR-021) |
| 18 | Cursus open in twee tabbladen; in tab 1 publiceren, in tab 2 iets wijzigen en opslaan | Tab 2: "Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw om verder te werken."; niets opgeslagen (R14). Tab 1 werkt gewoon verder op het nieuwe concept |
| 17 | Snel twee keer op "Publiceren" in de dialoog klikken (of 20 gelijktijdige verzoeken met een script) | Eén nieuwe versie, geen dubbele nummers (SC-006) |

## Controle in de database (optioneel)

```sql
SELECT v.id, v.versionNumber, v.publishedAt, v.unpublishedAt, c.deletedAt
FROM Course c JOIN CourseVersion v ON v.courseId = c.id
WHERE c.id = <id> ORDER BY v.versionNumber;
```

Verwacht: vastgezette versies 1, 2, … zonder gaten, en als hoogste nummer het concept
(`publishedAt` NULL). De live versie is de hoogste rij met `publishedAt` gevuld, zolang haar
`unpublishedAt` en `c.deletedAt` leeg zijn.
