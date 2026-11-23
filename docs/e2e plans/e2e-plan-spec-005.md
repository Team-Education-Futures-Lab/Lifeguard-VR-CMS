# E2E-plan spec 005: volgorde en vertakkingen

Bron: `specs/005-course-step-branching/quickstart.md`. Dit document zegt per scenario of het met Playwright wordt geautomatiseerd, hoe, en in welk bestand. Opgebouwd zoals de plannen voor spec 002 t/m 004; de uitgangspunten en helpers daar gelden ook hier.

## Legenda

| Label | Betekenis |
|---|---|
| **A** | Automatiseren met Playwright |
| **A+H** | Een deel automatiseren, het uiterlijk blijft handmatig |
| **H** | Handmatig laten (seedscript, stopwatch) |
| **B** | Al gedekt door de backendtests of de frontendtests; niet nog eens in Playwright |
| **–** | Vervalt (niet als e2e-test) |

## Uitgangspunten

- Mapnaam: `e2e/tests/005-course-step-branching/`.
- Alle uitgangspunten van spec 002 t/m 004 gelden: eigen organisaties per test via `createTracker()`, ingelogd via `t.pageAs` (het inloggen zelf wordt hier niet getest), `uniqueName('E2E-005-SC<nummer>')`, een directe API-aanroep als een organisatie met `t.login(loginCode)`.
- **Cursus klaarzetten via de API** met `createCourse` (spec 004). Een nieuwe cursus heeft het voorbeeld van FR-028: startvraag "Wat doe je?" met antwoord A en B, elk naar een videoblok zonder video. Bijna elk scenario begint daar.
- **Een andere route klaarzetten via de API** (scenario 9, 10, 13 en 20): een `PUT` met `key` en `nextStepKey` (contracts/api.md van spec 005). Alleen de handeling die het scenario test, gaat via het scherm.
- **Verbinden via het menu, niet door te slepen.** Eén klik op een verbindingspunt ("+" onder een video, de letter onder een antwoord) opent het menu met "Nieuw video-onderdeel", "Nieuwe vraag", "Bestaand onderdeel" en "Verbinding weghalen". Slepen op het canvas (Vue Flow) is kwetsbaar en geeft hetzelfde resultaat (ook scenario 6, de lus).
- **Video's klaarzetten** via `uploadVideos` uit `helpers/video-upload.js`, alleen waar een gekozen video nodig is (scenario 2 en 17). Eigen video's, "Alleen eigen organisatie".
- De editor opent met `openCourse`, die de weergave "Canvas" kiest. Een nieuw onderdeel opent meteen zijn venster; sluit het met "Klaar".
- Kleuren (oranje, rood, groen) en de vorm van pijlen zijn handmatig. De tests controleren teksten, aantallen en wat er na herladen staat.

## Nieuwe helper (`e2e/helpers/course.js`)

- `saveCourse(api, course, steps)`: `PUT /api/organisation/courses/<id>` met de naam en beschrijving van `course` en deze `steps` (met `key` en `nextStepKey`); geeft het opgeslagen concept terug. Gooit een fout bij een andere status dan 200.

Verder geen nieuwe helpers; wat een paar keer terugkomt (een verbindingspunt aanklikken, een menu-item kiezen), staat in het testbestand zelf.

## Teksten en selectors

De teksten komen uit `specs/005-course-step-branching/contracts/ui.md` en de quickstart. De locators (`data-test` en rollen) worden bij het schrijven van de eerste test nagegaan en hier aangevuld.

| Wat | Tekst of locator |
|---|---|
| Blok op het canvas | `[data-test="block"]`; badges "Start" en "Einde" in `[data-test="badges"]` |
| Pijl | een `group` met de naam "Edge from <bron> to <doel>"; de letter van het antwoord op de pijl; "B ↺" bij een lus |
| Verbindingspunt | "+" onder een video-onderdeel; de letter (A–D) onder een vraag ("Klik of sleep om antwoord A te verbinden") |
| Menu bij een punt | "Nieuw video-onderdeel", "Nieuwe vraag", "Bestaand onderdeel" (lijst, met zoekveld bij meer dan 8), "Verbinding weghalen" |
| Tooltip op een blok | "Wordt bereikt vanuit 1 verbinding" / "Wordt bereikt vanuit 2 verbindingen"; nooit een vaste "← n" |
| Balk | "n nog te doen" (opent de lijst met meldingen); "Cursus is compleet" |
| Opslaan | `[data-test="save"]`; korte melding "Concept opgeslagen" of "Opgeslagen, nog n punten open" |
| Meldingen | "Kies een video", "Antwoord B is nog niet verbonden", "Niet bereikbaar vanaf de start", "De route heeft geen einde", "Vanaf hier eindigt de route nooit", "Kies een startonderdeel" |
| Lijst "nog te doen" | groep "Cursus" bovenaan; "Antwoorden zonder vervolg"; "Video-onderdelen zonder video" |
| Bewerkformulier | video: "Daarna"; vraag: per antwoord "Gaat naar…"; `[data-test="start"]` |
| Weergave "Lijst" | "Einde", "Verder bij “…”", "Nog niet verbonden", "Niet bereikbaar", "Nog geen startonderdeel" |
| Canvas ordenen | knop "Canvas ordenen"; melding "Canvas geordend" met "Ongedaan maken" |

## Scenario's

| # | Wat | Label | Aanpak in Playwright | Bestand |
|---|---|---|---|---|
| 1 | Nieuwe cursus: het voorbeeld en "2 nog te doen" | A+H | `createCourse`, `openCourse`: vraag "Wat doe je?" met "Start", pijlen A en B naar twee videoblokken met "Einde"; balk "2 nog te doen"; in de lijst twee keer "Kies een video". De oranje kleur is handmatig | `route-new-course.spec.js` |
| 2 | In beide videoblokken een video: compleet | A | Twee eigen video's uploaden, in elk videoblok een kiezen: balk "Cursus is compleet" | `route-new-course.spec.js` |
| 3 | "+" onder video A → "Nieuwe vraag" | A | Het venster van de nieuwe vraag is open; pijl van video A naar de vraag; video A geen "Einde" meer, de nieuwe vraag wel | `route-connect.spec.js` |
| 4 | Antwoord A van die vraag → "Nieuw video-onderdeel" | A+H | Zoals 3, dan antwoord A verbinden: melding "Antwoord B is nog niet verbonden". Oranje is handmatig | `route-connect.spec.js` |
| 5 | Opslaan met een open antwoord | A+H | Zoals 4, opslaan: `save` "Opgeslagen"; de melding staat er nog. Rood is handmatig | `route-save.spec.js` |
| 6 | Antwoord B terug naar video A (lus) | A | Via het menu "Bestaand onderdeel" (niet slepen): pijl met "B ↺"; melding weg; tooltip op video A "Wordt bereikt vanuit 2 verbindingen"; geen "← 2" op het blok | `route-connect.spec.js` |
| 7 | Herladen: alle pijlen gelijk (SC-002) | A | Route uit 6 opslaan; de pijlen (bron, doel, letter) voor en na herladen vergelijken | `route-save.spec.js` |
| 8 | Pijl van A aanklikken, Delete | A | Pijl weg; "Antwoord A is nog niet verbonden"; de losse video "Niet bereikbaar vanaf de start" | `route-issues.spec.js` |
| 9 | Twee video's naar elkaar, één als start | A | Route via de API; meldingen "De route heeft geen einde" en bij beide blokken "Vanaf hier eindigt de route nooit" | `route-issues.spec.js` |
| 10 | Onderdeel met twee binnenkomende pijlen verwijderen, Ctrl+Z (SC-007) | A | Route via de API; na verwijderen staan de bronnen zonder vervolg en gemeld; na Ctrl+Z zijn het onderdeel en beide pijlen terug | `route-issues.spec.js` |
| 11 | Het startvakje uitzetten | A | Alleen "Kies een startonderdeel"; geen meldingen over bereikbaarheid | `route-issues.spec.js` |
| 12 | Klik op een melding in "nog te doen" | A+H | Het venster van dat onderdeel opent. Of het in beeld schuift, is handmatig | `route-issues.spec.js` |
| 13 | Weergave "Lijst" | A | Route via de API met een vertakking, een lus en een los onderdeel: A/B-vertakkingen, "Einde", "Verder bij “…”", het losse onderdeel onder "Niet bereikbaar" | `route-views.spec.js` |
| 14 | "Canvas ordenen" | A+H | Geen `alertdialog`; melding "Canvas geordend" met "Ongedaan maken". De nieuwe indeling zelf is handmatig | `route-views.spec.js` |
| 15 | Een video-onderdeel kan zichzelf niet kiezen (FR-003) | A | In het menu "Bestaand onderdeel" van het "+" en in "Daarna" staat het eigen onderdeel niet | `route-connect.spec.js` |
| 16 | Een "+" dat al verbonden is → "Nieuwe vraag" | A | De vraag komt ertussen: antwoord A naar het oude vervolg; "Antwoord B is nog niet verbonden" | `route-connect.spec.js` |
| 17 | Opslaan zonder meldingen | A+H | Cursus compleet maken (zoals 2), iets wijzigen, opslaan: kort "Concept opgeslagen", daarna `save` "Opgeslagen". Groen is handmatig | `route-save.spec.js` |
| 18 | Opslaan met 3 meldingen open | A | Iets wijzigen in een cursus met 3 meldingen, opslaan: "Opgeslagen, nog 3 punten open" | `route-save.spec.js` |
| 19 | Tooltip bij geen of één binnenkomende pijl | A | Op de startvraag: geen tooltip; op een videoblok: "Wordt bereikt vanuit 1 verbinding"; nergens een vaste "← n" | `route-views.spec.js` |
| 20 | Groepen in "n nog te doen" | A | Route via de API met een start-probleem, twee video's zonder video en een open antwoord: groep "Cursus" bovenaan, "Antwoorden zonder vervolg" (1), "Video-onderdelen zonder video" (2); bij minder dan 5 punten open, bij 5 of meer dicht; klik op een kop klapt hem, klik op een regel opent het blok | `route-issues.spec.js` |
| 21 | "Canvas ordenen", "Ongedaan maken", Ctrl+Y | A | Posities op het canvas (de `transform` van het Vue Flow-blok, zoals in spec 004 scenario 14e) voor ordenen, na "Ongedaan maken" gelijk aan ervoor, na Ctrl+Y weer geordend | `route-views.spec.js` |
| SC-006 | Ongeldige `PUT`-verzoeken (4 gevallen) | B | `courseConnections.test.js` | n.v.t. |
| SC-003, FR-022a | Regels voor volledigheid en de kleuren van meldingen | B | `completeness.test.js`, `issue-colours.test.js` | n.v.t. |
| SC-004 | Meldingen direct bijgewerkt bij 50 onderdelen | H | Vraagt `seed-courses.js` met `NODE_ENV=development`; niet voor CI | n.v.t. |

> **Let op:** de quickstart is aangepast. Vervallen en weggehaald: "minder beweging" (geen betrouwbare controle op het ontbreken van een animatie), tussenpunten slepen en lijnstijl (uitgesteld, zie `docs/backlog.md`), twee pijlen naast elkaar en een pijl dikker bij aanwijzen (alleen uiterlijk). De scenario's daarna zijn opgeschoven: 19 t/m 21 waren 24 t/m 26.

## Samenvatting

| Label | Aantal |
|---|---|
| A (automatiseren) | 15 (2, 3, 6 t/m 11, 13, 15, 16, 18 t/m 21) |
| A+H | 6 (1, 4, 5, 12, 14, 17) |
| B | 2 (SC-006; SC-003 en FR-022a) |
| H | 1 (SC-004) |

Dat zijn 21 tests in 5 bestanden.

## Risico's en aandachtspunten

- **Opbouw van 3 t/m 7:** in de quickstart bouwen ze op elkaar voort. Hier zet elke test zijn beginsituatie zelf klaar (via de API of met de stappen van het vorige scenario in de test), zodat hij los kan draaien.
- **Pijlen herkennen:** de naam "Edge from s74 to s75" gebruikt interne sleutels, die na herladen anders kunnen zijn. Vergelijk in scenario 7 op bron- en doelblok (tekst in het blok) en de letter, niet op de sleutel.
- **Tooltip (6, 19):** verschijnt bij `hover`; controleer de tekst met `toBeVisible`, niet met een vaste wachttijd.
- **Korte meldingen (17, 18):** "Concept opgeslagen" staat er maar even. Controleer direct na het klikken; daarna `save` "Opgeslagen".
- **Delete op een pijl (8):** de focus moet op het canvas staan, niet in een tekstveld.
- **Canvas ordenen (21):** de posities komen uit de `transform` van het Vue Flow-blok; pixels op het scherm hangen af van zoom en verschuiving.

## Open punten

- De naam van een vraag-onderdeel in het menu "Bestaand onderdeel" en in "Daarna" (bijvoorbeeld "Vraag: Wat doe je?", zoals in het "Daarna"-menu van spec 004) bij het schrijven nagaan.
- Hoe het menu van een verbindingspunt heet (rol `menu` of een lijst met knoppen) bij de eerste test nagaan.
