# E2E-plan spec 006: publiceren en onpubliceren

Bron: `specs/006-course-publishing/quickstart.md`, aangevuld met SC-007 uit `tasks.md` (T054). Dit document zegt per scenario of het met Playwright wordt geautomatiseerd, hoe, en in welk bestand. Opgebouwd zoals de plannen voor spec 002 t/m 005; de uitgangspunten en helpers daar gelden ook hier.

## Legenda

| Label | Betekenis |
|---|---|
| **A** | Automatiseren met Playwright |
| **A+H** | Een deel automatiseren, het uiterlijk blijft handmatig |
| **H** | Handmatig laten |
| **B** | Al gedekt door de backendtests of de frontendtests; niet nog eens in Playwright |
| **–** | Vervalt (niet als e2e-test) |

## Uitgangspunten

- Mapnaam: `e2e/tests/006-course-publishing/` (zoals `tasks.md` T025, T037, T043, T049 en T054 noemen).
- Alle uitgangspunten van spec 002 t/m 005 gelden: eigen organisaties per test via `createTracker()`, ingelogd via `t.pageAs`, `uniqueName('E2E-006-SC<nummer>')`, een directe API-aanroep als een organisatie met `t.login(loginCode)`.
- **Een complete cursus** heeft in beide videoblokken van het voorbeeld een video. De video's worden geüpload met `uploadVideos` (eigen video's, "Alleen eigen organisatie"); hun id's komen uit `GET /api/organisation/videos`. De route gaat daarna via de API (`saveCourse` met `videoId`).
- **Toestanden klaarzetten via de API** (gepubliceerd, gewijzigd, onpubliceerd): `publishCourse` (zie hieronder), `saveCourse` en `POST /api/organisation/courses/<id>/unpublish`. Alleen de handeling die het scenario test, gaat via het scherm.
- De editor opent met `openCourse(page, id, { view: 'Canvas + paneel' })`, zoals in spec 005.
- Publiceren werkt alleen op het opgeslagen concept (verbeterronde V4). Een test die publiceert na een wijziging, slaat eerst op.
- **Let op, verouderde taakteksten:** T025 verwacht nog "Je wijzigingen worden eerst opgeslagen." (vervallen door V4, T064) en T049 nog "Niet gepubliceerd (was versie 2)" (vervallen door V6, T065). Dit plan volgt de quickstart en `contracts/ui.md`.

## Nieuwe helpers (`e2e/helpers/course.js`)

Zo weinig mogelijk; alle drie worden in meerdere bestanden gebruikt.

- `publishCourse(api, id)`: `POST /api/organisation/courses/<id>/publish`; geeft het concept-document terug (met de nieuwe id's na een nieuwe versie). Gooit een fout bij een andere status dan 200 (een `422` verwacht een test zelf, met `api.post`).
- `draftSteps(doc)`: zet een opgeslagen document om naar de onderdelen van een `PUT` (sleutels `s<id>`, `nextStepKey` uit `nextStepId`). Een test past er één ding in aan (`map`) en geeft het aan `saveCourse`. Ook om de inhoud van twee documenten te vergelijken zonder afgeleide velden.
- `createCompleteCourse(t, browser, tag)`: nieuwe organisatie, twee eigen video's geüpload, en het voorbeeld met in elk videoblok een video (video A bij antwoord A). Geeft `org`, `api`, `page`, `course` en `videoNames`.

De opzet van scenario 12 t/m 14 (`setupDeletedVideo`) en die van scenario 10 en 11 (`publishedTwice`) staan als functie in het testbestand zelf.

## Teksten en selectors

Uit `specs/006-course-publishing/contracts/ui.md`. Wat daar niet staat, wordt bij het schrijven van de eerste test op het scherm nagegaan en hier aangevuld.

| Wat | Tekst of locator |
|---|---|
| Status (editor en overzicht) | `[data-test="publication-status"]` met `data-status` (`draft`, `published`, `published_changed`); tekst "Concept", "Gepubliceerd" of "Gepubliceerd · wijzigingen nog niet gepubliceerd"; extra regel "Versie 2 · 23 november 2026 om 14:05" of "Op de Quest: versie 2 · …" |
| Publicatieknop | `[data-test="publish-menu"]` ("Publiceren" of "Wijzigingen publiceren"; "Bezig…" tijdens een verzoek) |
| Menu | `[data-test="publish"]` (de actie), `[data-test="publish-reason"]` ("Sla eerst je wijzigingen op" of "Er is niets nieuws om te publiceren"), `[data-test="unpublish"]` ("Onpubliceren") |
| Bevestiging publiceren | `alertdialog` "Publiceren?" of "Wijzigingen publiceren?"; knoppen "Publiceren" / "Wijzigingen publiceren" en "Annuleren" |
| Niet klaar | dialoog "Nog niet klaar om te publiceren" met de groepen van "nog te doen"; een regel opent het onderdeel; knop "Sluiten" |
| Bevestiging onpubliceren | "Cursus onpubliceren?"; bij een onbeschikbare video ook "Let op: een video in deze cursus is niet meer beschikbaar."; knoppen "Onpubliceren" / "Annuleren" |
| Meldingen na afloop | "Gepubliceerd als versie {n}", "Versie {n} staat weer op de VR-brillen", "Cursus is niet meer gepubliceerd" |
| Twee tabbladen | dialoog "Cursus is intussen gepubliceerd" met "Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw om verder te werken." en "Pagina opnieuw laden" |
| Onbeschikbare video | melding "Video niet meer beschikbaar: kies een andere." |
| Verwijderen in het overzicht | extra zin "Deze cursus is gepubliceerd. Na verwijderen is hij niet meer te downloaden op de VR-brillen." |

## Scenario's

| # | Wat | Label | Aanpak in Playwright | Bestand |
|---|---|---|---|---|
| 1 | Onvolledige cursus publiceren | A | Nieuwe cursus (voorbeeld zonder video's), menu, "Publiceren": dialoog "Nog niet klaar om te publiceren" met twee keer "Kies een video"; een regel aanklikken opent het onderdeel; via de API is de status nog `draft` | `publish.spec.js` |
| 2 | Complete cursus publiceren | A+H | Twee video's kiezen (via de API), "Publiceren", bevestigen: melding "Gepubliceerd als versie 1"; status "Gepubliceerd" met "Versie 1 · <datum> om <tijd>" in de editor en in het overzicht. Handmatig: de opmaak van de balk | `publish.spec.js` |
| 3 | Het menu na publiceren | A | Knop heet "Wijzigingen publiceren"; `publish` uitgeschakeld met "Er is niets nieuws om te publiceren"; `unpublish` staat erin | `republish.spec.js` |
| 4 | Alleen het canvas gewijzigd | A | "Canvas ordenen" en opslaan (geen slepen): status blijft "Gepubliceerd" | `republish.spec.js` |
| 5 | Inhoud gewijzigd en opgeslagen | A | Vraagtekst wijzigen, opslaan: "Gepubliceerd · wijzigingen nog niet gepubliceerd" met "Op de Quest: versie 1" | `republish.spec.js` |
| 6 | Wijziging teruggedraaid en opgeslagen | A | De oude vraagtekst terug, opslaan: weer "Gepubliceerd" | `republish.spec.js` |
| 7 | Niet opgeslagen, daarna wel en publiceren | A | Wijzigen zonder opslaan: `publish` uitgeschakeld met "Sla eerst je wijzigingen op"; opslaan, "Wijzigingen publiceren", bevestigen: "Gepubliceerd als versie 2" | `publish.spec.js` |
| 8 | Onvolledig na publiceren | A | Een antwoord loskoppelen, opslaan, publiceren: dialoog met "Antwoord B is nog niet verbonden"; via de API staat versie 2 nog live | `publish.spec.js` |
| 9 | `POST /publish` buiten de interface | B | `coursePublish.test.js` (`422 course_incomplete`) | n.v.t. |
| 10 | Onpubliceren | A | "Onpubliceren", bevestigen: status alleen "Concept", zonder extra regel; melding "Cursus is niet meer gepubliceerd"; het concept is ongewijzigd | `unpublish.spec.js` |
| 11 | Direct weer publiceren | A | "Publiceren", bevestigen: melding "Versie 2 staat weer op de VR-brillen"; status "Gepubliceerd" met versie 2 en de datum van versie 2 | `unpublish.spec.js` |
| 12 | De eigenaar verwijdert een video uit de live versie | A | Opzet in het bestand: B uploadt een algemene video, A gebruikt hem in een cursus en publiceert, B verwijdert de video. A wijzigt de cursus en publiceert: lukt; geen melding over die video in "nog te doen" | `publish-unavailable-video.spec.js` |
| 13 | Die cursus onpubliceren | A | Zelfde opzet; de bevestiging bevat "Let op: een video in deze cursus is niet meer beschikbaar."; na bevestigen "Concept" | `publish-unavailable-video.spec.js` |
| 14 | Die cursus opnieuw publiceren | A | Zelfde opzet, eerst onpubliceren; publiceren: "Nog niet klaar om te publiceren" met "Video niet meer beschikbaar: kies een andere."; dezelfde melding in "nog te doen" | `publish-unavailable-video.spec.js` |
| 15 | Publiceren of onpubliceren voor een andere organisatie | B | `courseIsolation.test.js` (`404`) | n.v.t. |
| 16 | Een gepubliceerde cursus verwijderen in het overzicht | A | De bevestiging bevat "Na verwijderen is hij niet meer te downloaden op de VR-brillen."; daarna weg uit het overzicht. `deletedAt`, de bewaarde versies en geen live versie: B (`courseUnpublish.test.js`) | `unpublish.spec.js` |
| 17 | Twee keer snel op "Publiceren" | A | Dubbelklik op de knop in de bevestiging; via de API één nieuwe versie (`publication.versionNumber` 1). Twintig gelijktijdige verzoeken: B (`coursePublish.test.js`, SC-006) | `publish.spec.js` |
| 18 | Twee tabbladen: publiceren in 1, opslaan in 2 | A | Twee pagina's in één context; tab 1 publiceert, tab 2 wijzigt en slaat op: dialoog "Cursus is intussen gepubliceerd"; via de API is de wijziging van tab 2 er niet; tab 1 kan daarna nog opslaan | `republish.spec.js` |
| SC-007 | Status in het overzicht in elke toestand | A | Zes cursussen via de API: nooit gepubliceerd, gepubliceerd, gewijzigd na publiceren, alleen canvas verschoven, onpubliceerd, opnieuw gepubliceerd. In het overzicht per regel de juiste `data-status`, tekst en (waar van toepassing) versie en datum; dezelfde status in de editor | `course-list-status.spec.js` |

> **Let op:** in de quickstart staat 18 vóór 17; de nummers hier volgen de quickstart.

## Samenvatting

| Label | Aantal |
|---|---|
| A (automatiseren) | 16 (1, 3 t/m 8, 10 t/m 14, 16 t/m 18, SC-007) |
| A+H | 1 (2) |
| B | 2 (9, 15); daarnaast de databasecontrole van 16 en de twintig gelijktijdige verzoeken van 17 |

Dat zijn 17 tests in 5 bestanden.

## Risico's en aandachtspunten

- **Video's:** scenario 2 t/m 8, 10, 11, 16 t/m 18 en SC-007 hebben een complete cursus nodig, dus twee geüploade video's per test. Upload ze in één `uploadVideos`-aanroep; het kost een paar seconden per test.
- **Datum en tijd:** controleer de vorm ("<dag> <maand> <jaar> om <uu:mm>") en het versienummer, niet de exacte minuut.
- **Nieuwe id's na publiceren (R14):** na een nieuwe versie heeft het concept nieuwe id's. Een test die daarna blokken op id zoekt, leest het concept opnieuw uit de API.
- **Korte meldingen:** "Gepubliceerd als versie {n}" staat er maar even; controleer direct na het bevestigen.
- **Gelijktijdig opslaan:** de deadlock bij gelijktijdige saves is opgelost (`backend/src/lib/deadlockRetry.js`); geldt dat ook voor publiceren, dan ziet een parallelle run het.

## Open punten

- Geen. Nagegaan op het scherm: "Nog niet klaar om te publiceren" is een `alertdialog` met dezelfde groepen als "nog te doen" (een knop per groep en per melding, zoals "Kies een video Kies een video"); het menu is `role="menu"` (`data-test="publish-menu-list"`); de status leest "Gepubliceerd" plus "Versie 1 · 23 november 2026 om 15:02".

## Opgemerkt bij het schrijven

- Na onpubliceren verandert `video.keptByLiveVersion` in het document van `true` naar `false`. Dat is een afgeleid veld en klopt; scenario 10 vergelijkt daarom de inhoud via `draftSteps`, niet het hele document.
