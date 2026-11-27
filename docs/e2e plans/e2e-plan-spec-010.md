# E2E-plan spec 010: gedeelde cursussen overnemen

Bron: `specs/010-course-reference-takeover/quickstart.md` (handmatige scenario's 1–18). Opgebouwd zoals
de plannen voor spec 002 t/m 006 en 009; de uitgangspunten daar gelden ook hier. De tests van deze spec
bestonden al; dit plan legt ze naast de quickstart en vult de gaten.

## Legenda

Zoals in `e2e-plan-spec-009.md`: **A** automatiseren, **A+B** deels in Playwright en deels al in de
backend- of frontendtests, **B** alleen backend- of frontendtests.

## Uitgangspunten

- Mapnaam: `e2e/tests/010-course-reference-takeover/`.
- De eigenaar maakt een complete cursus met `createCompleteCourse` en deelt hem met `shareCourse`. Een
  organisatie neemt hem over via het scherm (scenario 1–2) of via de API met `addReference`
  (`helpers/references.js`) als het overnemen zelf niet het onderwerp is.
- Wat de Quest ziet, leest een test met `questVersions` (de Quest-API met de koppelcode). Het
  downloaden van video's door een Quest is backendwerk (`questCourseReferences.test.js`).
- Nieuwe versies via de API met `publishNewVersion`.

## Teksten en selectors

Uit `specs/010-course-reference-takeover/contracts/ui.md`, nagegaan op het scherm.

| Wat | Tekst of locator |
|---|---|
| Venster in de bibliotheek | `add-course` "Toevoegen aan mijn organisatie"; `course-added` "Toegevoegd"; bij de eigenaar `details-receivers` ("1 organisatie: <naam>") |
| Bevestiging toevoegen | "Cursus toevoegen aan jouw organisatie?"; knoppen "Toevoegen" en "Annuleren"; toast "Cursus toegevoegd aan jouw cursussen" |
| Cursusoverzicht | `taken-over-section` "Overgenomen cursussen"; rij `taken-over-row`; pil `taken-over-pill` "Overgenomen van <naam>"; teller `notice-count`; `new-version-notice`, `newer-version`, `withdrawn` |
| Venster van een overgenomen cursus | `taken-over-details`; `use-new-version`, `keep-version`, `remove-reference`, `copy-reference` |
| Bij de eigenaar | beperken: `restrict-receivers`; onpubliceren: `unpublish-receivers`; verwijderen: de zin in de bevestiging (`.confirm-backdrop`) |
| Uitleg bij intrekken | "De eigenaar deelt deze cursus niet meer met jullie.", "… heeft deze cursus ingetrokken.", "… heeft deze cursus verwijderd.", "De eigenaar van deze cursus bestaat niet meer.", telkens + " Jullie houden versie N." |

## Scenario's

| # | Wat | Label | Aanpak in Playwright | Bestand |
|---|---|---|---|---|
| 1 | Knop "Toevoegen aan mijn organisatie" | A | In het venster in de bibliotheek | `take-over.spec.js` |
| 2 | Annuleren en toevoegen | A | Na annuleren niets op de Quest; na toevoegen toast en "Toegevoegd" in venster en lijst | `take-over.spec.js` |
| 3 | In het cursusoverzicht | A | "Overgenomen cursussen", pil "Overgenomen van <eigenaar>", "Op de Quest: versie 1" | `taken-over-course.spec.js` |
| 4 | Op de Quest, ook een beperkte video | A+B | De Quest van de ontvanger ziet versie 1, die van een ander niet. Video downloaden: B (`questCourseReferences.test.js`) | `take-over.spec.js` |
| 5 | Het venster van een overgenomen cursus | A | Samenvatting, geen link naar de editor, wel "Verwijderen uit mijn organisatie" en "Aanpassen" | `taken-over-course.spec.js` |
| 6 | Bewerken buiten de interface | A | `GET`/`PUT /courses/<id>` en `POST …/publish`: `404` | `taken-over-course.spec.js` |
| 7 | De eigenaar ziet wie de cursus overnam | A | Het venster van de eigen cursus in de bibliotheek: "1 organisatie: <naam>" (sinds de handmatige test niet meer in het publicatiemenu) | `take-over.spec.js` |
| 8 | Nieuwe versie: teller en melding | A | Teller `1`, "Nieuwe versie beschikbaar (versie 2)"; Quest houdt versie 1 | `new-version.spec.js` |
| 9 | Huidige versie houden | A | Teller weg; "Nieuwere versie beschikbaar (versie 2)" | `new-version.spec.js` |
| 10 | Nog een nieuwere versie | A | De melding komt terug met versie 3 | `new-version.spec.js` |
| 11 | Nieuwe versie gebruiken | A+B | Toast, Quest op versie 3. Video uit een niet-gekozen versie `404`: B (`questCourseReferences.test.js`) | `new-version.spec.js` |
| 12 | Beperken met ontvangers | A | Via het scherm beperken tot alleen B: de bevestiging noemt "1 daarvan heeft deze cursus overgenomen en houdt haar huidige versie." | `owner-withdraws.spec.js` |
| 13 | Na beperken een nieuwe versie | A | C: "De eigenaar deelt deze cursus niet meer met jullie. Jullie houden versie 1.", Quest van C op 1; B heeft een melding | `owner-withdraws.spec.js` |
| 14 | Onpubliceren | A | Via het scherm: de bevestiging noemt de 2 organisaties; B ziet "ingetrokken" | `owner-withdraws.spec.js` |
| 15 | Opnieuw publiceren | A | Bij B verdwijnt de uitleg en staat er een melding; bij C blijft "deelt niet meer" | `owner-withdraws.spec.js` |
| 16 | Verwijderen | A | Via het cursusoverzicht: de bevestiging noemt de ontvangers; B en C zien "verwijderd" en hun Quests houden de cursus | `owner-withdraws.spec.js` |
| 17 | Een ingetrokken cursus verwijderen uit de eigen organisatie | A | De bevestiging zegt dat C hem niet opnieuw kan toevoegen; daarna weg bij C en van de Quest van C; bij B niets veranderd | `owner-withdraws.spec.js` |
| 18 | De beheerder verwijdert de eigenaar | A | B: "De eigenaar van deze cursus bestaat niet meer. Jullie houden versie 1."; Quest van B houdt de cursus | `owner-deleted.spec.js` (nieuw, ook 009-15 en spec 011) |

## Samenvatting

| Label | Aantal |
|---|---|
| A | 16 |
| A+B | 2 (4, 11) |

## Sabotage-run (2026-11-27)

Zoals bij spec 005 en 006: per test kopieën met telkens één bewust veranderde verwachting (een andere
tekst, een ander aantal, een andere versie of status), in `e2e/tests/zz-sabotage-010/`. Elke kopie
moet falen, en wel op de regel van die verwachting. Uitkomst: 28 van de 28 sabotages (SAB 26–53)
faalden op de bedoelde regel; ze dekken scenario 2–18, met 18 en 009-15 en de kopie van spec 011 in `owner-deleted.spec.js`. De run voor 009, 010 en 011 samen: 78 van de 78.
Daarna zijn de kopieën weer weggehaald. De run draaide in de aparte e2e-omgeving
(`npm run test:local`).
