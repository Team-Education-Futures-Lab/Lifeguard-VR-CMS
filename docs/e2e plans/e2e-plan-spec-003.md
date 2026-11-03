# E2E-plan spec 003: centrale videobibliotheek

Bron: `specs/003-central-video-library/quickstart.md`. Dit document zegt per scenario of het met Playwright wordt geautomatiseerd, hoe, en in welk bestand. Opgebouwd zoals het plan voor spec 002 (`e2e-plan-spec-002.md`); de uitgangspunten en helpers daar gelden ook hier.

## Legenda

| Label | Betekenis |
|---|---|
| **A** | Automatiseren met Playwright |
| **A+H** | Een deel automatiseren, het uiterlijk (kleur van pillen of tellers) blijft handmatig |
| **H** | Handmatig laten (omgevingsvariabele wijzigen, scrollpositie, "er gebeurt niets") |
| **B** | Al gedekt door de backendtests of de frontendtests; niet nog eens in Playwright |

## Uitgangspunten

- Mapnaam: `e2e/tests/003-central-video-library/`.
- Alle uitgangspunten van spec 002 gelden: eigen organisaties per test via `createTracker()`, inloggen via het scherm met `loginViaScreen` in een eigen `t.browserContext(browser)`, expliciete lege `storageState`, `uniqueName('E2E-003-SC<nummer>')`, testvideo's via `videoFixture(...)`, uploadtimeouts van 30 s.
- De meeste tests hebben **twee of drie organisaties** nodig (A, B en C), elk met een eigen `t.browserContext(browser)` en een eigen pagina. Een directe API-aanroep als B of C gaat met `t.login(loginCode)`.
- Video's klaarzetten gaat via het uploadvenster, zoals in spec 002: bestand kiezen, beschikbaarheid kiezen, "Uploaden" klikken en wachten tot de naam in `main` staat.
- Zonder `VIDEO_DEFAULT_VISIBILITY` in `.env` is de standaard "Alleen eigen organisatie" (zo ook in CI).
- In een test met een zoekterm op de organisatienaam (scenario 12) moet de naam van de organisatie de zoekterm bevatten, bijvoorbeeld `uniqueName('E2E-Zwembad A')`.

## Selectors uit de app

| Wat | Locator |
|---|---|
| Beschikbaarheid in het uploadvenster en in het videovenster | `[data-test="visibility-public"]`, `[data-test="visibility-selective"]`, `[data-test="visibility-private"]` (radioknoppen) |
| Organisatie kiezen bij "Selectief" | `[data-test="organisation-<id>"]` (id uit `t.organisation`) |
| Melding bij "Selectief" zonder organisatie | `[data-test="no-organisation"]` |
| Beschikbaarheid in het videovenster | `[data-test="availability-text"]` |
| Naam in het wijzigformulier | `[data-test="edit-name"]` |
| Zoekveld, sortering, eigen/andere | `[data-test="search"]`, `[data-test="sort"]`, `[data-test="ownership-<sleutel>"]` |
| Label "Organisatie: … ✕" | `[data-test="owner-filter"]` |
| "Geen video's gevonden" | `[data-test="no-results"]` |
| Eén video in de lijst | `[data-test="video"]`; daarin `[data-test="visibility"]` (alleen bij eigen video's) en `[data-test="description"]` |

De knop "Wijzigen" en "Opslaan" in het videovenster zijn gewone knoppen; de bevestiging bij beperken is een `alertdialog` met de titel "Beschikbaarheid beperken?" en de knop "Wijzigen".

## Scenario's

| # | Wat | Label | Aanpak in Playwright | Bestand |
|---|---|---|---|---|
| 1 | Uploadvenster: standaard "Alleen eigen organisatie", velden per bestand | A | Eigen organisatie; bestand kiezen; `visibility-private` is geselecteerd; het veld Beschrijving en de groep Beschikbaarheid staan bij het bestand. Mag in één test met scenario 3 | `video-upload-availability.spec.js` |
| 2 | Drie video's met drie beschikbaarheden uploaden | A | Organisaties A en B; drie bestanden in het uploadvenster: "Algemeen" met beschrijving, "Selectief" voor B, "Alleen eigen"; alle drie in de lijst van A met de pil "Eigen" en de beschikbaarheid in `visibility` | `video-upload-availability.spec.js` |
| 3 | "Selectief" zonder organisatie | A | `visibility-selective` kiezen zonder organisatie: melding "Kies minstens één organisatie" en "Uploaden" uit; daarna een organisatie kiezen en "Uploaden" aan | `video-upload-availability.spec.js` |
| 4 | B ziet de algemene en selectieve video's van A, niet de privé; eigen video's van B met pil "Eigen"; geen Wijzigen en Verwijderen bij andermans video's | A+H | Samen met 5 in één test. Wat wie ziet en de aanwezigheid van "Wijzigen"/"Verwijderen" is A. De kleur van de pillen (paars of grijs) is handmatig | `video-visibility.spec.js` |
| 5 | C ziet alleen de algemene video | A | Zelfde test als 4 (A, B en C) | `video-visibility.spec.js` |
| 6 | C vraagt de selectieve video en de miniatuur op: `404` | B | `videoVisibility.test.js`, de test "answers 200 for visible and 404 for every other video" | n.v.t. |
| 7 | B stuurt `PATCH` en `DELETE` naar A's video: `403 not_owner` | B | `videoEdit.test.js` (PATCH) en `videoDelete.test.js` (DELETE) | n.v.t. |
| 8 | A beperkt een algemene video tot B | A | A opent de video, Wijzigen, kiest `visibility-selective` met B; bevestiging "1 organisatie kan deze video daarna niet meer zien."; "Wijzigen"; na herladen ziet C hem niet meer en B wel | `video-visibility.spec.js` |
| 9 | A maakt dezelfde video weer algemeen | A | Geen bevestiging; na herladen ziet C hem weer. Mag in dezelfde test als 8 | `video-visibility.spec.js` |
| 10 | Naam en beschrijving wijzigen, met een tweede regel | A | A wijzigt via het videovenster (`edit-name`, beschrijving met een nieuwe regel, "Opslaan"); B ziet na herladen de nieuwe naam en beide regels | `video-edit.spec.js` |
| 11 | Beschrijving van 1001 tekens | A+H | In het uploadvenster en bij Wijzigen: 1001 tekens plakken, de tekst is afgekapt op 1000 en de melding "De beschrijving mag maximaal 1000 tekens zijn; de rest is niet overgenomen." staat er; één teken weg en de melding is weg; de API geeft `400` met "De beschrijving mag maximaal 1000 tekens zijn." (via `t.login` en `request`). De rode kleur van de teller is handmatig | `video-edit.spec.js` |
| 12 | Zoeken op beschrijving, op "zwembad a" en op "cafe" bij "Café" | A | B met video's van A en van zichzelf; zoekterm ingeven en de juiste video's controleren; hoofdletters en accenten maken niet uit | `video-library-search.spec.js` |
| 13 | Sorteren op grootte, filter "Van andere organisaties" en zoekterm tegelijk | A | Drie video's van verschillende grootte (twee van A, één van B zelf); zoekterm, filter en sortering gelden samen. Sorteren op duur vervalt: alle testvideo's duren 2 s en het sorteren zelf wordt al getest in `frontend/tests/video-library.test.js` | `video-library-search.spec.js` |
| 14 | Zoeken zonder resultaat | A | `no-results` met de knop "Zoekterm en filter wissen"; die wist ook het organisatiefilter | `video-library-search.spec.js` |
| 15 | Zoekterm, filter, sortering en scrollpositie blijven na sluiten van het venster | H | De scrollpositie is lastig te testen en vraagt veel video's | n.v.t. |
| 16 | Beheerder verwijdert A | A | A heeft een algemene video; admin verwijdert A via `t.admin()`; B en C zien de video niet meer | `video-visibility.spec.js` |
| 17 | Geen videofuncties in de beheeromgeving | H | Een controle op iets wat niet bestaat is zwak | n.v.t. |
| 18 | `VIDEO_DEFAULT_VISIBILITY` wijzigen en API herstarten | H | Omgevingsvariabele wijzigen en herstarten kan Playwright niet | n.v.t. |
| 19 | Pil "Zwembad A" aanklikken | A | C met algemene video's van A en B; klik op de pil van A: alleen A's video's, het label `owner-filter` staat naast het zoekveld en het videovenster opent niet | `video-library-search.spec.js` |
| 20 | Dat filter samen met zoekterm, sortering en "Eigen video's" | B | `frontend/tests/video-library.test.js` test `filterVideos` en `libraryView` met `ownerId`, `query` en `ownership` samen | n.v.t. |
| 21 | Label "Organisatie: … ✕" wegklikken | A | Na een filter, zoekterm en sortering: alleen het organisatiefilter vervalt; de rest blijft staan. Mag in dezelfde test als 19 | `video-library-search.spec.js` |
| 22 | In het videovenster op de pil klikken | A | Een video van B openen en op de pil "Zwembad B" klikken: het venster sluit en de bibliotheek is gefilterd op B | `video-library-search.spec.js` |
| 23 | Pil "Eigen" aanklikken: er gebeurt niets | H | Een controle op "er gebeurt niets" is zwak | n.v.t. |
| P | 500 video's binnen 2 s zichtbaar | H | Vraagt het script `seed-videos.js` met `NODE_ENV=development`; niet voor CI. Eventueel B als er al een test is | n.v.t. |

> **Let op:** Scenario 19 uit de quickstart (B wordt verwijderd tijdens de upload) is geen e2e-test meer: het is een race tussen verwijderen en afronden en dus backend-logica (bij het afronden vallen verwijderde organisaties uit de keuze; blijft er niemand over, dan wordt de video "Alleen eigen organisatie"). Dat hoort in een backendtest. De scenario's 20 t/m 24 uit de quickstart staan hier als 19 t/m 23.

## Samenvatting

| Label | Aantal |
|---|---|
| A (automatiseren) | 14 (1, 2, 3, 5, 8, 9, 10, 12, 13, 14, 16, 19, 21, 22) |
| A+H | 2 (4, 11) |
| B | 3 (6, 7, 20) |
| H | 5 (15, 17, 18, 23, P) |

Scenario 4 en 5 zijn één test; 8 en 9, 19 en 21, en 1 en 3 mogen elk in één test. Dan zijn er ongeveer 12 tests.

## Risico's en aandachtspunten

- **Meerdere organisaties per test:** elke extra organisatie is een extra login via het scherm. Houd de aantallen laag; hergebruik waar mogelijk één organisatie per test voor twee scenario's.
- **Naam van de organisatie in de pil:** de pil toont de naam van de organisatie. Scenario 12 en 19 gebruiken die naam. Geef de organisaties een herkenbare naam via `uniqueName(...)` zodat de tests ze uit elkaar kunnen houden.
- **Verwijderde organisatie:** `t.cleanup()` verwijdert organisaties die de test al verwijderde zonder fout (404 wordt genegeerd). Bij scenario 16 is dat bedoeld.
- **Afhankelijkheid van spec 002:** de uploadhelpers (`holdUploads`, `startHalfUpload`) zijn gemaakt voor spec 002. Wijzigt het uploadvenster, dan kunnen ze meebewegen.
- **Grootte van de fixtures:** scenario 13 sorteert op grootte met `valid-max-5760x2880.mp4` (168 KB) tegenover `valid-opus-audio-512x256.mp4` (19 KB). Alle testvideo's duren 2 s, dus sorteren op duur is niet te testen met deze fixtures.

## Open punten

- Scenario 11: de rode kleur van de teller blijft handmatig.
