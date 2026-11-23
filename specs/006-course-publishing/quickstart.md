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
| 1 | Nieuwe cursus, nog zonder video's; menu "Publiceren" → "Publiceren" | Dialoog "Nog niet klaar om te publiceren" (opgemaakt als "nog te doen") met twee keer "Kies een video"; klik op een melding opent het onderdeel; niets gepubliceerd (US2) |
| 2 | Beide video's kiezen, "Publiceren", bevestigen | Melding "Gepubliceerd als versie 1"; balk en overzicht "Gepubliceerd · Versie 1 · <datum en tijd>" (US1, SC-001) |
| 3 | Het menu openen (de knop heet nu "Wijzigingen publiceren") | "Wijzigingen publiceren" is uitgegrijsd met "Er is niets nieuws om te publiceren"; ook "Onpubliceren" staat erin (FR-020) |
| 4 | Een blok verschuiven en opslaan | Status blijft "Gepubliceerd" (canvas telt niet) |
| 5 | Vraagtekst wijzigen en opslaan | "Gepubliceerd · wijzigingen nog niet gepubliceerd", "Op de Quest: versie 1" (US3) |
| 6 | Wijziging ongedaan maken en opslaan | Weer "Gepubliceerd" (inhoud gelijk aan versie 1) |
| 7 | Opnieuw wijzigen, zonder op te slaan het menu openen; dan opslaan en "Wijzigingen publiceren" | Zonder opslaan uitgegrijsd met "Sla eerst je wijzigingen op"; na opslaan en bevestigen "Gepubliceerd als versie 2" |
| 8 | Een antwoord loskoppelen, opslaan, "Publiceren" | Niet gepubliceerd; "Antwoord B is nog niet verbonden"; versie 2 blijft live |
| 9 | Zelfde verzoek buiten de interface: `POST /api/organisation/courses/<id>/publish` | `422 course_incomplete` met dezelfde melding; niets veranderd (FR-006) |
| 10 | Antwoord weer verbinden, opslaan; "Onpubliceren", bevestigen | Status alleen "Concept"; concept ongewijzigd (US4) |
| 11 | Direct weer "Publiceren" | "Versie 2 staat weer op de VR-brillen"; versie en datum van versie 2 (FR-017) |
| 12 | Tweede organisatie: als eigenaar een video verwijderen die in de live versie van cursus X zit (van organisatie 1); dan als organisatie 1 cursus X wijzigen en publiceren | Lukt; geen melding over die video in "nog te doen" (FR-012, FR-013) |
| 13 | Cursus X onpubliceren | Bevestiging noemt dat de video niet meer beschikbaar is; na bevestigen "Concept" |
| 14 | Cursus X opnieuw publiceren | "Nog niet klaar om te publiceren": "Video niet meer beschikbaar: kies een andere."; ook in "nog te doen" (FR-012) |
| 15 | In een andere sessie als organisatie 2: `POST /api/organisation/courses/<id van X>/publish` en `/unpublish` | `404` (FR-002, SC-005) |
| 16 | In het overzicht een gepubliceerde cursus verwijderen | Bevestiging noemt dat hij van de VR-brillen verdwijnt; daarna weg uit het overzicht; in de database `Course.deletedAt` gevuld, versies nog aanwezig, en geen live versie meer (FR-021) |
| 18 | Cursus open in twee tabbladen; in tab 1 publiceren, in tab 2 iets wijzigen en opslaan | Tab 2: "Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw om verder te werken."; niets opgeslagen (R14). Tab 1 werkt gewoon verder op het nieuwe concept |
| 17 | Snel twee keer op "Publiceren" in de dialoog klikken (of 20 gelijktijdige verzoeken met een script) | Eén nieuwe versie, geen dubbele nummers (SC-006) |

## Resultaten handmatige test (T060, 2026-11-23)

| # | Resultaat | Opmerking |
| --- | --- | --- |
| 1 | ✅ | Werkt; de dialoog "Nog niet klaar om te publiceren" ziet er nog niet mooi uit (V1) |
| 2 | ✅ | De bovenbalk is te druk (V2) |
| 3 | ✅ | De vaste tekst "Er is niets nieuws om te publiceren" past niet in de balk (V3) |
| 4 | ✅ | Status blijft "Gepubliceerd"; de werkwijze voelt omslachtig (V4) |
| 5 | ✅ | De status staat links, de knoppen rechts (V5) |
| 6 | ✅ | |
| 7 | ✅ | Opslaan en publiceren in één klik voelt vreemd (V4) |
| 8 | ✅ | |
| 9 | – | Niet handmatig gecontroleerd; gedekt door `coursePublish.test.js` (422 zonder interface) |
| 10 | ✅ | De tekst onder "Concept" is onhandig (V6) |
| 11 | ✅ | Blijft versie 2 |
| 12 | ✅ | Teksten anders verwoorden (V7) |
| 13 | ✅ | Idem (V7) |
| 14 | ✅ | Na onpubliceren stond de melding "Kies een andere video" niet bij het onderdeel; opgelost (T061) |
| 15 | – | Niet handmatig gecontroleerd; gedekt door `courseIsolation.test.js` |
| 16 | ✅ | |
| 17 | ✅ | |
| 18 | ✅ | |

De punten V1–V7 staan in [tasks.md](tasks.md) onder "Verbeterronde na de handmatige test".

## Controle in de database (optioneel)

```sql
SELECT v.id, v.versionNumber, v.publishedAt, v.unpublishedAt, c.deletedAt
FROM Course c JOIN CourseVersion v ON v.courseId = c.id
WHERE c.id = <id> ORDER BY v.versionNumber;
```

Verwacht: vastgezette versies 1, 2, … zonder gaten, en als hoogste nummer het concept
(`publishedAt` NULL). De live versie is de hoogste rij met `publishedAt` gevuld, zolang haar
`unpublishedAt` en `c.deletedAt` leeg zijn.
