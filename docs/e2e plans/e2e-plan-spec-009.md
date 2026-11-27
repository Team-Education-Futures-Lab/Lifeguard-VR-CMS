# E2E-plan spec 009: cursussen delen en de cursusbibliotheek

Bron: `specs/009-course-sharing-library/quickstart.md` (handmatige scenario's 1–16). Dit document zegt
per scenario of het met Playwright wordt geautomatiseerd, hoe, en in welk bestand. Opgebouwd zoals de
plannen voor spec 002 t/m 006; de uitgangspunten en helpers daar gelden ook hier. De tests van deze
spec bestonden al (geschreven bij de bouw); dit plan legt ze naast de quickstart en vult de gaten.

## Legenda

| Label | Betekenis |
|---|---|
| **A** | Automatiseren met Playwright |
| **A+H** | Een deel automatiseren, het uiterlijk blijft handmatig |
| **H** | Handmatig laten |
| **B** | Al gedekt door de backendtests of de frontendtests; niet nog eens in Playwright |

## Uitgangspunten

- Mapnaam: `e2e/tests/009-course-sharing-library/`.
- Lokaal draaien de tests in hun eigen omgeving (`npm run test:local` in `e2e/`, zie `docs/ci.md`).
- Eigen organisaties per test via `createTracker()`, `uniqueName('E2E-009-…')`. Andere tests draaien
  tegelijk, dus een test rekent nooit op "alle organisaties", maar kiest zijn eigen organisaties.
- **Een complete cursus** met `createCompleteCourse` (spec 006): twee eigen video's "Alleen eigen
  organisatie", dus delen geeft altijd de waarschuwing. Delen via de API met `shareCourse`
  (`helpers/sharing.js`), dat de waarschuwing bevestigt.
- Alleen de handeling die het scenario test, gaat via het scherm.

## Teksten en selectors

Uit `specs/009-course-sharing-library/contracts/ui.md`, nagegaan op het scherm.

| Wat | Tekst of locator |
|---|---|
| Keuze in de bevestiging | `visibility-private`, `visibility-public`, `visibility-selective`; zonder organisatie `no-organisation`: "Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’." |
| Zin over de bibliotheek | `library-note`: "De cursus komt ook in de cursusbibliotheek, voor alle organisaties." |
| Waarschuwing | `alertdialog` "Video's die niet algemeen beschikbaar zijn"; video's `warning-video`; `warning-cancel`, `warning-continue` |
| Beschikbaarheid wijzigen | menu-item `change-availability`; dialoog "Beschikbaarheid wijzigen"; `availability-save`; beperken: `restrict-question`, `restrict-confirm`; toast "Beschikbaarheid opgeslagen" |
| Bibliotheek | kaart `library-course`, pil `owner` ("Eigen" of de naam), `search`, `sort` (`name-asc`, …), `owner-filter` ("Organisatie: …"), neutrale afbeelding `placeholder` |
| Venster | `library-details`; geen `open-editor` en geen `details-availability` voor een andere organisatie |
| Onpubliceren | `unpublish-library-note`: "Andere organisaties zien hem dan ook niet meer in de cursusbibliotheek." |
| Verdwenen cursus | toast "Deze cursus is niet meer beschikbaar." |

## Scenario's

| # | Wat | Label | Aanpak in Playwright | Bestand |
|---|---|---|---|---|
| 1 | Een cursus van vóór de migratie is "Alleen eigen organisatie" | A+B | Een cursus gepubliceerd met "Alleen eigen organisatie" staat niet in de bibliotheek van een ander (en geeft `404`). Dat bestaande cursussen `private` worden: B (migratietest in `courseLibrary.test.js`) | `course-library.spec.js` |
| 2 | Bevestiging: "Alleen eigen organisatie" voorgeselecteerd | A | `visibility-private` is aangevinkt | `share-on-publish.spec.js` |
| 3 | Algemeen beschikbaar delen | A | Publiceren met "Algemeen beschikbaar" (na de waarschuwing): een ander ziet de kaart met de pil van de eigenaar; de eigenaar ziet de pil "Eigen" | `share-on-publish.spec.js`, `course-library.spec.js` |
| 4 | Waarschuwing bij een beperkte video; annuleren en doorgaan | A | De waarschuwing noemt precies de video's; "Annuleren" laat de keuze staan en publiceert niets; "Doorgaan" publiceert | `share-on-publish.spec.js` |
| 5 | Alleen tekst wijzigen en opnieuw publiceren | A | Geen waarschuwing | `share-on-publish.spec.js` |
| 6 | Een tweede beperkte video toevoegen en publiceren | A | De waarschuwing noemt alleen de nieuwe video | `restricted-videos.spec.js` (nieuw) |
| 7 | Beschikbaarheid naar "Algemeen beschikbaar" | A | Van "Selectief beschikbaar" naar "Algemeen beschikbaar": waarschuwing met beide video's; na "Doorgaan" ziet een niet gekozen organisatie de cursus; versie en datum ongewijzigd | `restricted-videos.spec.js` (nieuw) |
| 8 | Beschikbaarheid beperken | A | Van twee gekozen organisaties naar één: "1 organisatie kan deze cursus daarna niet meer zien in de cursusbibliotheek."; daarna ziet die organisatie hem niet meer | `change-availability.spec.js` |
| 9 | Zoeken, filteren op de pil en sorteren | A | Zoeken op een deel van de naam, filter "Organisatie: …"; sorteren "Naam (A–Z)" en "Naam (Z–A)" zet twee kaarten van dezelfde eigenaar in de juiste volgorde | `course-library.spec.js` |
| 10 | Het venster van een cursus van een ander | A | Samenvatting, geen beschikbaarheid, geen editor-knop; de afbeelding is neutraal omdat die van een "Alleen eigen organisatie"-video komt | `course-library.spec.js` |
| 11 | Buiten de interface | A | `GET` en `PUT …/availability` op een cursus van een ander en `GET /course-library/<privé cursus>`: `404` | `course-library.spec.js` |
| 12 | Onpubliceren en opnieuw publiceren | A | De bevestiging noemt de bibliotheek; daarna weg bij een ander; opnieuw publiceren: "Algemeen beschikbaar" voorgeselecteerd | `leave-library.spec.js` |
| 13 | Verwijderen terwijl een ander de bibliotheek open heeft | A | Toast "Deze cursus is niet meer beschikbaar." en de kaart verdwijnt | `leave-library.spec.js` |
| 14 | Quest ziet alleen de eigen cursussen | B | `questCourses.test.js` (FR-026); de Quest-tests van spec 010 laten ook zien dat een gedeelde cursus pas na toevoegen op de Quest komt | n.v.t. |
| 15 | De beheerder verwijdert de eigenaar | A | Na het verwijderen van de eigenaar staat zijn cursus niet meer in de bibliotheek van een ander | `owner-deleted.spec.js` (spec 010, samen met 010-18 en spec 011) |
| 16 | "Selectief beschikbaar" zonder organisatie | A | De melding en een uitgeschakelde knop; via de API: B (`coursePublishAvailability.test.js`) | `share-on-publish.spec.js` |

## Samenvatting

| Label | Aantal |
|---|---|
| A | 14 (2 t/m 13, 15, 16) |
| A+B | 1 (1) |
| B | 1 (14) |

## Sabotage-run (2026-11-27)

Zoals bij spec 005 en 006: per test kopieën met telkens één bewust veranderde verwachting (een andere
tekst, een ander aantal, een andere versie of status), in `e2e/tests/zz-sabotage-009/`. Elke kopie
moet falen, en wel op de regel van die verwachting. Uitkomst: 25 van de 25 sabotages (SAB 01–25)
faalden op de bedoelde regel; ze dekken scenario 1–13, 15 en 16 (009-15 in `owner-deleted.spec.js`: SAB 49). De run voor 009, 010 en 011 samen: 78 van de 78.
Daarna zijn de kopieën weer weggehaald. De run draaide in de aparte e2e-omgeving
(`npm run test:local`).
