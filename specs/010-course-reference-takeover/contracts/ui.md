# UI-contract: gedeelde cursussen overnemen als verwijzing

Dit is een aanvulling op [specs/009 ui.md](../../009-course-sharing-library/contracts/ui.md) en
[specs/006 ui.md](../../006-course-publishing/contracts/ui.md). Alle teksten zijn in het Nederlands
en in eenvoudige taal (NFR-03). In de interface staat nooit "verwijzing", maar "overgenomen cursus"
(FR-023). Kleur is nooit het enige signaal. `{n}`-teksten gebruiken de hulpfunctie voor enkelvoud
en meervoud uit specs/009 ("1 organisatie", "2 organisaties").

## Venster in de cursusbibliotheek (`CourseLibraryDetailsDialog`)

Cursus van een andere organisatie:
- `takenOver = false`: de knop **Toevoegen aan mijn organisatie** (`data-test="add-course"`,
  primair), naast "Sluiten".
- `takenOver = true`: de neutrale pil **Toegevoegd** (`data-test="course-added"`) en de link
  "Bekijken bij mijn cursussen" naar `/courses`. Er is geen knop.

Eigen cursus: geen knop. Onder "Beschikbaarheid" staat de rij **Overgenomen door**
(`data-test="details-receivers"`):
- "Nog door geen enkele organisatie." als er geen ontvangers zijn;
- anders "{n} organisaties: <namen, gescheiden door komma's>".

In de lijst van de bibliotheek (`CourseLibraryView`) krijgt een toegevoegde cursus ook de pil
"Toegevoegd".

## Bevestiging toevoegen (`confirmDialog`)

- **Titel**: "Cursus toevoegen aan jouw organisatie?"
- **Tekst**: "“<naam>” van <eigenaar> komt bij jouw cursussen en wordt te downloaden op de
  VR-brillen. De cursus blijft van <eigenaar>: je kunt hem niet zelf aanpassen. Komt er een nieuwe
  versie, dan kies je zelf of je die gebruikt."
- **Knoppen**: "Toevoegen" en "Annuleren".
- **Gelukt**: de toast "Cursus toegevoegd aan jouw cursussen". Het venster toont dan "Toegevoegd",
  en de store `courseReferences` wordt bijgewerkt.
- **`404`**: de toast "Deze cursus is niet meer beschikbaar." De bibliotheek wordt opnieuw geladen
  (US1 scenario 7).
- **`409 course_already_added`**: de melding van de server. Het venster toont "Toegevoegd".

## Cursusoverzicht (`CoursesView`)

- Eigen en overgenomen cursussen staan in één lijst. Eigen cursussen staan in de volgorde van nu.
  Overgenomen cursussen staan daaronder, onder de kop **Overgenomen cursussen**
  (`data-test="taken-over-section"`), op naam. De kop staat er alleen als er overgenomen cursussen
  zijn.
- Een rij van een overgenomen cursus (`data-test="taken-over-row"`) toont:
  - de thumbnail van de gekozen versie, of een neutrale afbeelding;
  - de naam;
  - de pil **Overgenomen van <eigenaar>** (`OwnerPill`, `data-test="taken-over-pill"`);
  - "Op de Quest: versie N · <datum>", met dezelfde opmaak als `PublicationStatus` met status
    `published`;
  - de melding of de uitleg, zie hieronder.
- Er zijn geen knoppen om te bewerken of te verwijderen in de rij. Klikken opent
  `TakenOverCourseDialog`.
- **Melding** (`notice = true`, `data-test="new-version-notice"`): een opvallend label "Nieuwe
  versie beschikbaar (versie N)" met een icoon en tekst, dus niet alleen kleur.
- **Nieuwere versie, maar gehouden** (`newVersion` en `notice = false`): een rustige tekst
  "Nieuwere versie beschikbaar (versie N)".
- **Ingetrokken** (`withdrawn`, `data-test="withdrawn"`): de uitleg uit de tabel hieronder, in
  grijze tekst met een info-icoon.

| `withdrawn` | Tekst (gevolgd door " Jullie houden versie N.") |
| --- | --- |
| `unpublished` | "De eigenaar heeft deze cursus ingetrokken." |
| `course_deleted` | "De eigenaar heeft deze cursus verwijderd." |
| `no_access` | "De eigenaar deelt deze cursus niet meer met jullie." |
| `owner_deleted` | "De eigenaar van deze cursus bestaat niet meer." |

- Bij een lege lijst blijft de tekst van specs/004. Daar komt bij: "Je kunt ook een cursus van een
  andere organisatie toevoegen via de Cursusbibliotheek." met een link.

## Venster van een overgenomen cursus (`TakenOverCourseDialog`)

- **Titel**: de naam van de gekozen versie.
- **Inhoud**: zoals het bibliotheekvenster van specs/009, uit de gekozen versie: thumbnail, pil
  "Overgenomen van <eigenaar>", beschrijving (met behoud van regels), versie, gepubliceerd op,
  onderdelen, video's, en "Toegevoegd op <datum>".
- **Versieblok** (`data-test="version-choice"`), alleen bij `newVersion`:
  - "Jullie VR-brillen gebruiken versie {N} van {datum}. Er is een nieuwe versie: versie {M} van
    {datum}."
  - De knoppen **Nieuwe versie gebruiken** (primair, `data-test="use-new-version"`) en **Huidige
    versie houden** (`data-test="keep-version"`). Die tweede knop staat er alleen als
    `notice = true`. Na "houden" staat alleen nog "Nieuwe versie gebruiken" in het blok.
  - Na "Nieuwe versie gebruiken": de toast "Jullie VR-brillen krijgen versie {M} bij de volgende
    synchronisatie." Het venster toont de nieuwe gekozen versie.
  - Bij `409 no_newer_version`: het venster neemt `reference` uit het antwoord over en toont de
    uitleg. Er is geen foutmelding nodig.
- **Uitleg** bij `withdrawn`: de tekst uit de tabel hierboven. Er is dan geen versieblok.
- **Voet**: **Verwijderen uit mijn organisatie** (`data-test="remove-reference"`, rood, links) en
  "Sluiten".
- Er is nooit een knop naar de editor, en geen publicatiemenu (FR-008).

## Bevestiging verwijderen uit mijn organisatie (`confirmDialog`, `danger`)

- **Titel**: "Cursus verwijderen uit jouw organisatie?"
- **Tekst**: "“<naam>” verdwijnt uit jouw cursussen en is na de volgende synchronisatie niet meer
  te downloaden op de VR-brillen. De cursus van <eigenaar> zelf blijft bestaan."
- Bij `withdrawn` komt er een extra zin bij: "Je kunt hem daarna niet opnieuw toevoegen, omdat hij
  niet meer in de cursusbibliotheek staat." (US2 scenario 7)
- **Knoppen**: "Verwijderen" en "Annuleren".
- **Gelukt**: de toast "Cursus verwijderd uit jouw cursussen". De rij verdwijnt en de teller wordt
  bijgewerkt.

## Teller in de navigatie (`OrganisationLayout`)

- Bij "Cursussen" staat een rond getal (`data-test="notice-count"`) als `noticeCount > 0`, met
  `aria-label="{n} cursussen met een nieuwe versie"` (bij één: "1 cursus met een nieuwe versie").
- De teller wordt geladen bij het openen van het CMS en bijgewerkt na het laden van het
  cursusoverzicht en na elke actie in het venster. Er is geen polling (research R10).

## Bij de eigenaar

- **Publicatiemenu** (`PublishMenu`): onder de status staat, bij ontvangers, de tekst "Overgenomen
  door {n} organisaties: <namen>" (`data-test="menu-receivers"`).
- **Onpubliceren** (`UnpublishDialog`): bij ontvangers komt er de zin "{n} organisaties hebben deze
  cursus overgenomen en houden hun huidige versie." bij (bij één: "1 organisatie heeft deze cursus
  overgenomen en houdt haar huidige versie.").
- **Verwijderen** (`CoursesView`, `receiverCount > 0`): dezelfde zin, na de zinnen van specs/006
  en specs/009.
- **Beschikbaarheid beperken** (de beperk-bevestiging uit specs/009, in `PublishDialog` en
  `CourseAvailabilityDialog`): telt alleen de ontvangers die door de keuze toegang verliezen, dus
  ontvangers die niet in de nieuwe doelgroep zitten. Als dat er minstens één is, komt de zin "{n}
  daarvan hebben deze cursus overgenomen en houden hun huidige versie." erbij (bij één: "1 daarvan
  heeft …").
