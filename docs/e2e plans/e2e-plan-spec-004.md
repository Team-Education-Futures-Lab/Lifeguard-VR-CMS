# E2E-plan spec 004: cursussen en onderdelen (concept)

Bron: `specs/004-course-steps-draft/quickstart.md`. Dit document zegt per scenario of het met Playwright wordt geautomatiseerd, hoe, en in welk bestand. Opgebouwd zoals de plannen voor spec 002 en 003; de uitgangspunten en helpers daar gelden ook hier.

## Legenda

| Label | Betekenis |
|---|---|
| **A** | Automatiseren met Playwright |
| **A+H** | Een deel automatiseren, het uiterlijk blijft handmatig |
| **H** | Handmatig laten (seedscript, stopwatch) |
| **B** | Al gedekt door de backendtests of de frontendtests; niet nog eens in Playwright |
| **–** | Vervalt (niet als e2e-test) |

## Uitgangspunten

- Mapnaam: `e2e/tests/004-course-steps-draft/`.
- Alle uitgangspunten van spec 002 en 003 gelden: eigen organisaties per test via `createTracker()`, inloggen via het scherm met `loginViaScreen` in een eigen `t.browserContext(browser)`, `uniqueName('E2E-004-SC<nummer>')`, een directe API-aanroep als een organisatie met `t.login(loginCode)`.
- **Cursus klaarzetten via de API**, niet via het scherm, behalve in scenario 2 en 3 (die testen juist het aanmaken). Een nieuwe cursus krijgt sinds spec 005 al het voorbeeld: startvraag "Wat doe je?" met twee antwoorden, elk naar een videoblok zonder video.
- **Video's klaarzetten** via het uploadvenster met `uploadVideos(page, [{ file, name, visibility, organisation? }])` uit `helpers/video-upload.js`. Kies altijd expliciet een beschikbaarheid; geef video's unieke namen.
- Scenario's met een video van een andere organisatie (4, 14, 23) hebben twee of drie organisaties nodig. Houd dat aantal laag.
- De editor opent standaard in de weergave "Canvas". Een blok aanklikken opent het onderdeel in een venster ("Video-onderdeel" of "Vraag") met de knop "Klaar". Gebruik die weergave, tenzij een scenario iets anders vraagt.

## Nieuwe helper (`e2e/helpers/course.js`)

- `createCourse(api, { name, description })`: `POST /api/organisation/courses` met de CSRF-header (`CSRF` uit `org-api.js`); geeft de cursus terug (met `id`). `api` komt van `t.login(loginCode)`.
- `openCourse(page, id)`: `page.goto('/courses/<id>')` en wachten tot de knop `[data-test="save"]` er staat.
- `openStep(page, index)`: het blok `[data-test="block"]` met deze index aanklikken en wachten op het venster.

## Selectors uit de app

| Wat | Locator |
|---|---|
| Lege lijst | tekst "Er zijn nog geen cursussen." |
| Nieuwe cursus | knop "Nieuwe cursus"; velden `[data-test="course-name"]` en `[data-test="course-description"]`; knop "Aanmaken"; melding `[data-test="create-error"]` |
| Regel in de lijst | `li` met de cursusnaam; tekst "2 video's · 1 vraag"; label "Concept"; verwijderknop `title="Verwijderen"` |
| Opslaan | `[data-test="save"]`: "Opslaan als concept", "Opslaan…" of "Opgeslagen"; na opslaan `[data-test="saved-flash"]` |
| Ongedaan maken / opnieuw | knoppen met `title` "Ongedaan maken (Ctrl+Z)" en "Opnieuw (Ctrl+Y)", of de toetsen |
| Onderdeel toevoegen | knoppen "Video" en "Vraag" op het canvas |
| Blok op het canvas | `[data-test="block"]`; daarin `[data-test="badges"]` met "Start"/"Einde" |
| Video kiezen | `[data-test="video-option"]` (met de naam en het label "Eigen" of de organisatie); knop "Wijzig"; `[data-test="remove-video"]` ("Video weghalen") |
| Melding verloren video | `[data-test="lost-video"]` ("Deze video is niet meer beschikbaar en kan niet worden teruggezet.") |
| Vraag | veld `[data-test="question"]`; antwoorden `[data-test="answer"]`; goed antwoord: radio met label "Antwoord C is goed"; verwijderen: "Antwoord C verwijderen"; `[data-test="add-answer"]`; `[data-test="feedback"]` |
| Start en verwijderen | `[data-test="start"]` (checkbox "Startonderdeel"); `[data-test="remove-step"]` |
| Bevestigingen | `alertdialog` met titel "Cursus verwijderen?", "Wijzigingen niet opgeslagen" (knop "Verlaten") of "Video niet meer beschikbaar" (knop "Doorgaan"); "Annuleren" in alle drie |
| Fout bij opslaan | toast "De cursus is niet opgeslagen. Probeer het opnieuw." |
| Niet gevonden | kop "Cursus niet gevonden" |

## Scenario's

| # | Wat | Label | Aanpak in Playwright | Bestand |
|---|---|---|---|---|
| 1 | Geen cursussen | A | Nieuwe organisatie, `/courses`: "Er zijn nog geen cursussen." | `course-list.spec.js` |
| 2 | Nieuwe cursus met lege naam | A | "Nieuwe cursus", alleen beschrijving, "Aanmaken": `create-error` "Vul een naam en een beschrijving in.", venster blijft open; via de API (`GET /api/organisation/courses`) is er geen cursus | `course-list.spec.js` |
| 3 | Nieuwe cursus met naam en beschrijving | A | Aanmaken via het scherm: de editor opent met "Concept", een blok "Wat doe je?" met "Start" en twee videoblokken "Kies een video"; terug naar `/courses`: de regel toont "2 video's · 1 vraag" | `course-list.spec.js` |
| 4 | De videokiezer toont alleen beschikbare video's | A | A met een eigen video; B met "Algemeen", "Selectief" voor A en "Alleen eigen"; C met "Selectief" voor B. Als A een videoblok openen: precies drie `video-option` (eigen, B-algemeen, B-selectief) | `course-video-picker.spec.js` |
| 5 | Video-onderdeel zonder video opslaan | A | Knop "Video" op het canvas, niets kiezen, opslaan: "Opgeslagen"; na herladen staat het blok er met "Kies een video" | `course-steps.spec.js` |
| 6a | Antwoorden toevoegen tot 4 | A | Een vraag openen, twee keer `add-answer`: 4 `answer`-velden; `add-answer` is weg | `course-steps.spec.js` |
| 6b | Vraag met 4 antwoorden blijft na opslaan en herladen gelijk | A | 4 antwoorden, het derde goed, feedback ingevuld, één antwoord leeg; opslaan en herladen: teksten, het goede antwoord, de feedback en het lege antwoord zijn ongewijzigd | `course-steps.spec.js` |
| 7 | Antwoorden verwijderen tot 2 | A | Vanaf 4 antwoorden het goede antwoord verwijderen: het eerste antwoord is nu goed; verder tot 2: geen verwijderknop meer | `course-steps.spec.js` |
| 8 | Ander onderdeel als start | A | Een videoblok openen, `start` aanvinken, opslaan, herladen: alleen dat blok heeft "Start" | `course-steps.spec.js` |
| 9 | Verwijderen en Ctrl+Z | A | Onderdeel verwijderen (`remove-step`): geen bevestiging; Ctrl+Z: blok terug en `save` toont "Opgeslagen" | `course-editing.spec.js` |
| 10 | Weggaan met niet-opgeslagen wijzigingen | A | Iets wijzigen, terugknop naar `/courses`: `alertdialog` "Wijzigingen niet opgeslagen"; "Annuleren": de editor blijft open | `course-editing.spec.js` |
| 11 | Herladen met niet-opgeslagen wijzigingen | A | Iets wijzigen, `page.on('dialog')` en `page.reload()`: een dialoog van het type `beforeunload`. Test iets anders dan 10 (de browser, niet de app); in hetzelfde bestand | `course-editing.spec.js` |
| 12 | Opslaan zonder netwerk | A | Iets toevoegen, `context.setOffline(true)`, opslaan: de toast "De cursus is niet opgeslagen. Probeer het opnieuw." en de wijziging staat er nog; `setOffline(false)`, opnieuw opslaan, herladen: het onderdeel staat er één keer | `course-editing.spec.js` |
| 13 | Dezelfde video in twee cursussen | A | Twee cursussen via de API; in beide dezelfde eigen video kiezen en opslaan; na herladen staat hij in beide | `course-video-picker.spec.js` |
| 14 | Video wordt onbeschikbaar terwijl A hem gebruikt | A | B maakt een video "Selectief" voor A. A kiest hem in een blok en slaat op. B zet hem op "Alleen eigen organisatie". A opent de cursus: het blok toont nog naam en duur, opslaan lukt; in `/videos` en in de kiezer staat de video niet meer | `course-unavailable-video.spec.js` |
| 14a | Na 14: het onderdeel verwijderen | A | `remove-step`: `alertdialog` "Video niet meer beschikbaar"; "Annuleren": het onderdeel blijft | `course-unavailable-video.spec.js` |
| 14b | Na 14: "Wijzig" en "Video weghalen" | A | Beide geven eerst dezelfde waarschuwing; "Annuleren" laat de video staan; "Doorgaan" voert het uit | `course-unavailable-video.spec.js` |
| 14c | Na 14a met Doorgaan: Ctrl+Z, opslaan | A | Onderdeel en video zijn terug; opslaan lukt | `course-unavailable-video.spec.js` |
| 14d | Na 14a met Doorgaan: opslaan, Ctrl+Z, opslaan | A | Het blok komt terug zonder video, met `lost-video`; opslaan lukt; na herladen is het een video-onderdeel zonder video | `course-unavailable-video.spec.js` |
| 14e | Na 14b met andere video: opslaan, Ctrl+Z, Ctrl+Y | A | Na Ctrl+Z: het blok staat op dezelfde plek zonder video, met `lost-video`; na Ctrl+Y staat de gekozen video er weer | `course-unavailable-video.spec.js` |
| 15 | B opent het adres van A's cursus | A | Als B `/courses/<id van A>`: "Cursus niet gevonden" | `course-list.spec.js` |
| 16 | Cursus verwijderen | A | Verwijderknop in de lijst: `alertdialog` "Cursus verwijderen?"; "Verwijderen": weg uit de lijst; het adres geeft "Cursus niet gevonden". Dat `deletedAt` gevuld is, is B | `course-list.spec.js` |
| 17 | Twee tabbladen, de laatste opslag wint | A | Twee pagina's in één context met dezelfde cursus; in elk iets anders wijzigen en opslaan, eerst 1 dan 2; herladen: de wijziging van 2 staat er, geen waarschuwing | `course-editing.spec.js` |
| 23 | B verwijdert een algemene video die A gebruikt | A | Zoals 14, maar B verwijdert de video "Algemeen" (zacht). A ziet nog naam en duur; niet meer in `/videos` of de kiezer | `course-unavailable-video.spec.js` |
| SC-004 | Ongeldige `PUT`-verzoeken (6 gevallen) | B | `courseSave.test.js` | n.v.t. |
| SC-006 | Cursus zacht verwijderd (`deletedAt`) | B | `courseCrud.test.js` | n.v.t. |
| FR-016a | Thumbnailroute van een onbeschikbare video (8 controles) | B | `courseUnavailableVideo.test.js` | n.v.t. |
| SC-007 | 50 cursussen van 50 onderdelen binnen 2 s | H | Vraagt `seed-courses.js` met `NODE_ENV=development`; niet voor CI | n.v.t. |

> **Let op:** de nummers wijken af van de quickstart. Scenario 18, 19, 20, 21 en 21a uit de quickstart staan hier als 14a t/m 14e, omdat ze op 14 voortbouwen. Scenario 6 is gesplitst in 6a en 6b. Vervallen: **13a** (controle op één bugfix: de thumbnail na het vervangen van een video) en **22** (geen waarschuwing bij een gewone video; gedekt zodra 14a en 14b werken, en een controle op "er gebeurt niets" is zwak).

## Samenvatting

| Label | Aantal |
|---|---|
| A (automatiseren) | 24 (1 t/m 5, 6a, 6b, 7 t/m 17, 14a t/m 14e, 23) |
| B | 3 (SC-004, SC-006, FR-016a) |
| H | 1 (SC-007) |
| – (vervallen) | 2 (13a, 22) |

10 en 11 staan in hetzelfde bestand. 14a t/m 14e beginnen elk met de situatie van 14; zet die klaar in een functie in het testbestand, zodat elke test los kan draaien. Dan zijn er ongeveer 24 tests in 5 bestanden.

## Risico's en aandachtspunten

- **Opzet van 14 kost tijd:** twee organisaties, een upload, inloggen als beide. Bij 6 tests (14 t/m 14e) is dat merkbaar; overweeg `test.describe.configure({ mode: 'serial' })` met één opzet, als de tests daarna los genoeg blijven.
- **Ctrl+Z en Ctrl+Y:** gebruik `page.keyboard.press('Control+z')` terwijl de focus niet in een tekstveld staat; anders maakt de browser de tekst ongedaan in plaats van de editor. Of klik op de knoppen met de titels "Ongedaan maken (Ctrl+Z)" en "Opnieuw (Ctrl+Y)".
- **Canvas:** blokken staan op een canvas (Vue Flow). Klik op het blok via `[data-test="block"]` met de tekst erin, niet op coördinaten. Een nieuw blok komt in het midden van het canvas; mogelijk moet de test eerst "Alles in beeld" klikken.
- **Offline (12):** `context.setOffline(true)` geldt voor de hele context. Zet het na de test terug, of gebruik een eigen context.
- **Twee tabbladen (17):** de laatste opslag wint zonder waarschuwing. Zet de wijzigingen zo neer dat duidelijk is welke er na herladen staat (bijvoorbeeld een andere cursusnaam in tabblad 1 en 2).
- **Afhankelijkheid van spec 005:** het voorbeeld in een nieuwe cursus (scenario 3) en de knoppen "Daarna"/"Gaat naar…" komen uit spec 005. Wijzigt dat voorbeeld, dan moet scenario 3 mee.

## Open punten

- Of een blok aanklikken in "Canvas" altijd het venster opent (en niet alleen selecteert), moet bij het schrijven van de eerste test worden nagegaan.
