# UI-contract: een overgenomen cursus aanpassen als eigen kopie

Aanvulling op [specs/010 ui.md](../../010-course-reference-takeover/contracts/ui.md) en
[specs/006 ui.md](../../006-course-publishing/contracts/ui.md). Alle teksten zijn Nederlands en in
eenvoudige taal (NFR-03). In de interface staat nooit "verwijzing" (FR-019). Nieuwe teksten staan
in `frontend/src/lib/courseReference.js`.

## Venster van een overgenomen cursus (`TakenOverCourseDialog`)

- Nieuwe knop **Aanpassen** (`data-test="copy-reference"`), naast "Verwijderen uit mijn
  organisatie", altijd zichtbaar, ook bij een melding of bij een uitleg (ingetrokken, verwijderd,
  niet meer gedeeld, eigenaar bestaat niet meer) (FR-001).

## Bevestiging aanpassen (`confirmDialog`)

- **Titel**: "Deze cursus zelf aanpassen?"
- **Tekst** (één alinea; het bevestigingsvenster toont platte tekst):
  "Je krijgt een eigen kopie van versie <N> van “<naam>”. Die kun je zelf aanpassen en
  publiceren. De kopie krijgt geen nieuwe versies meer van <eigenaar>, en de cursus van <eigenaar>
  verandert niet. De VR-brillen krijgen de kopie als nieuwe cursus en downloaden hem de volgende
  keer opnieuw. Tot je publiceert staat dezelfde inhoud erop. Dit kun je niet ongedaan maken."
- **Knoppen**: "Aanpassen" (primair) en "Annuleren". Annuleren verandert niets (FR-002).
- **Bezig**: de knop is uitgeschakeld tot het antwoord er is (geen tweede verzoek uit hetzelfde
  venster).
- **Gelukt (201)**: de overgenomen cursus verdwijnt uit de store `courseReferences` (en een
  eventuele melding uit de teller); de router gaat naar `/courses/<courseId>`; toast "Je eigen
  kopie is klaar. Je kunt hem nu aanpassen." (FR-007).
- **`409 course_already_copied`**: toast met de melding van de server; lijsten opnieuw laden;
  venster sluiten.
- **`404`**: toast "Deze cursus staat niet meer bij jouw cursussen."; lijsten opnieuw laden.

## Cursusoverzicht (`CoursesView`)

- Een kopie staat bij de eigen cursussen, zonder pil "Overgenomen van", met de status zoals elke
  eigen cursus ("Op de Quest: versie 1 · <datum>").
- Onder de naam een rustige regel **Gebaseerd op <courseName> van <ownerName>**
  (`data-test="based-on"`) als `basedOn` gevuld is (FR-012).

## Editor (`CourseEditor`)

- In de kop, onder of naast de naam: dezelfde regel "Gebaseerd op …" (`data-test="editor-based-on"`).
- Een video met `keptFromOriginal = true` geeft geen fout "Video niet meer beschikbaar" in de
  controle (`lib/completeness.js`) en geen rode markering in het canvas.
- Haalt de docent zo'n video uit een onderdeel (andere video kiezen of onderdeel verwijderen), dan
  eerst de bestaande waarschuwing (`confirmLosingVideo`), met deze tekst bij een meegekregen
  video: "Deze video komt uit de cursus waarop jouw kopie gebaseerd is en staat niet in jouw
  videobibliotheek. Haal je hem weg, dan kun je hem daarna niet opnieuw toevoegen."

## Publiceren (`PublishMenu`, `PublishDialog`)

Bij een kopie (`basedOn` gevuld):
- `PublishDialog` toont geen `AvailabilityPicker` en geen bibliotheekzin, maar: "Een aangepaste
  cursus is alleen voor jouw organisatie en kan niet gedeeld worden." (`data-test="copy-not-shared"`).
  Het verzoek stuurt geen `visibility`.
- `PublishMenu` toont het item "Beschikbaarheid wijzigen" niet.
- De rest (publiceren, onpubliceren, status) is zoals bij elke eigen cursus.

## Cursusbibliotheek (`CourseLibraryDetailsDialog`)

- Als `hasCopy = true` en de cursus niet is toegevoegd: naast de knop "Toevoegen aan mijn
  organisatie" de zin **Jullie hebben al een aangepaste kopie van deze cursus.**
  (`data-test="has-copy-hint"`) (FR-021).

## Gewijzigde tekst uit spec 010: bevestiging toevoegen

De zin "De cursus blijft van <eigenaar>: je kunt hem niet zelf aanpassen." wordt "De cursus blijft
van <eigenaar>. Wil je hem aanpassen, dan maak je later een eigen kopie." De rest van de
bevestiging blijft gelijk.
