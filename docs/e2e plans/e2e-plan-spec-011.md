# E2E-plan spec 011: een overgenomen cursus aanpassen als eigen kopie

Bron: `specs/011-course-reference-copy/quickstart.md` (handmatige scenario's 1–12). Opgebouwd zoals de
plannen voor spec 009 en 010; de uitgangspunten daar gelden ook hier. De tests bestonden al (geschreven
bij de bouw); dit plan legt ze naast de quickstart en vult de gaten.

## Uitgangspunten

- Mapnaam: `e2e/tests/011-course-reference-copy/`.
- De eigenaar maakt een complete cursus met `createCompleteCourse` (twee video's "Alleen eigen
  organisatie": die zijn precies de meegekregen video's van FR-14) en deelt hem met `shareCourse`.
- Overnemen via de API (`addReference`); "Aanpassen" via het scherm met `copyTakenOverCourse`
  (`helpers/references.js`), behalve waar het om de bevestiging zelf gaat.

## Teksten en selectors

Uit `specs/011-course-reference-copy/contracts/ui.md`, nagegaan op het scherm.

| Wat | Tekst of locator |
|---|---|
| Knop | `copy-reference` "Aanpassen" in het venster van een overgenomen cursus |
| Bevestiging | `.confirm-backdrop` met "Je krijgt een eigen kopie van versie N van …"; knoppen "Aanpassen" en "Annuleren" |
| Gebaseerd op | `editor-based-on` (editor) en `based-on` (cursusoverzicht): "Gebaseerd op <cursus> van <organisatie>" |
| Publiceren van een kopie | `copy-not-shared`: "Een aangepaste cursus is alleen voor jouw organisatie en kan niet gedeeld worden."; geen `change-availability` |
| Hint in de bibliotheek | `has-copy-hint`: "Jullie hebben al een aangepaste kopie van deze cursus." |
| Twee tabbladen | "Deze cursus is al aangepast. De aangepaste cursus staat bij je cursussen." |
| Verwijderde video | "Video niet meer beschikbaar: kies een andere." (`course_incomplete`) |

## Scenario's

| # | Wat | Label | Aanpak in Playwright | Bestand |
|---|---|---|---|---|
| 1 | Aanpassen → Annuleren | A | De bevestiging noemt versie 1; daarna is de overgenomen cursus er nog | `copy-course.spec.js` |
| 2 | Aanpassen → bevestigen | A | De editor opent met de gekozen versie (niet de nieuwere van de eigenaar) en "Gebaseerd op …" | `copy-course.spec.js` |
| 3 | Het cursusoverzicht na aanpassen | A | De kopie bij de eigen cursussen met "Gebaseerd op …"; de overgenomen cursus is weg en de teller telt hem niet meer | `copy-course.spec.js` |
| 4 | De Quest | A | De Quest-API toont de kopie (versie 1) en niet meer het origineel | `copy-course.spec.js` |
| 5 | Het origineel bij de eigenaar | A | Publicatie, conceptnummer en beschikbaarheid gelijk; alleen C nog als ontvanger | `original-unchanged.spec.js` |
| 6 | Een andere ontvanger | A | De Quest van C houdt versie 1 | `original-unchanged.spec.js` |
| 7 | De kopie publiceren | A | Geen deelkeuze (`copy-not-shared`), versie 2 op de Quest, geen "Beschikbaarheid wijzigen"; niet in de bibliotheek | `copy-is-own-course.spec.js` |
| 8 | Meegekregen video na onpubliceren | A | Onpubliceren, wijzigen en opnieuw publiceren lukt met de video's "Alleen eigen organisatie" van de eigenaar; ze zijn `keptFromOriginal` | `copy-videos.spec.js` |
| 9 | Meegekregen video verwijderd door de eigenaar | A | De eigenaar verwijdert een video; de kopie onpubliceren en opnieuw publiceren geeft `422` met "Video niet meer beschikbaar: kies een andere." | `copy-videos.spec.js` |
| 10 | Niet in de eigen videobibliotheek | A | De videonamen staan niet op de pagina Video's | `copy-videos.spec.js` |
| 11 | Hint in de bibliotheek | A | `has-copy-hint` naast "Toevoegen aan mijn organisatie" | `original-unchanged.spec.js` |
| 12 | Twee tabbladen tegelijk | A | Eén kopie; het andere tabblad toont de melding | `original-unchanged.spec.js` |
| (US4) | De eigenaar wordt verwijderd | A | De kopie werkt door en toont nog "Gebaseerd op …" | `owner-deleted.spec.js` (spec 010) |

## Sabotage-run (2026-11-27)

Zoals bij spec 005 en 006: per test kopieën met telkens één bewust veranderde verwachting (een andere
tekst, een ander aantal, een andere versie of status), in `e2e/tests/zz-sabotage-011/`. Elke kopie
moet falen, en wel op de regel van die verwachting. Uitkomst: 25 van de 25 sabotages (SAB 54–78)
faalden op de bedoelde regel; ze dekken scenario 1–12 (de verwijderde eigenaar: SAB 52–53 in `owner-deleted.spec.js`). De run voor 009, 010 en 011 samen: 78 van de 78.
Daarna zijn de kopieën weer weggehaald. De run draaide in de aparte e2e-omgeving
(`npm run test:local`).
