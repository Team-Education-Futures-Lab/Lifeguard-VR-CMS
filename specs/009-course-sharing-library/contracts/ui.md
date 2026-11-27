# UI-contract: cursussen delen en de cursusbibliotheek

Dit is een aanvulling op [specs/006 ui.md](../../006-course-publishing/contracts/ui.md) en
[specs/003 ui.md](../../003-central-video-library/contracts/ui.md). Alle teksten zijn in het
Nederlands en in eenvoudige taal (NFR-03). Kleur is nooit het enige signaal.

## Beschikbaarheid kiezen (`AvailabilityPicker`, `subject="course"`)

Hetzelfde onderdeel als bij video's, met de drie keuzes en per keuze een hulptekst:

| Keuze | Hulptekst |
| --- | --- |
| Algemeen beschikbaar | "Alle organisaties zien deze cursus in de cursusbibliotheek." |
| Selectief beschikbaar | "Alleen de organisaties die je kiest." |
| Alleen eigen organisatie | "Alleen jouw organisatie gebruikt deze cursus. Hij staat niet in de cursusbibliotheek." |

Bij "Selectief beschikbaar" verschijnt de lijst met organisaties (specs/003). Zonder gekozen
organisatie verschijnt de melding "Kies minstens één organisatie, of kies ‘Alleen eigen
organisatie’." en is de knop om te bevestigen uitgeschakeld.

## Bevestiging publiceren (`PublishDialog`, modus `confirm`)

- De tekst van specs/006 blijft, met daaronder de picker (`data-test="availability"`).
- **Voorselectie**: de huidige beschikbaarheid uit het conceptdocument. Voor een cursus die nog
  nooit gepubliceerd is, is dat "Alleen eigen organisatie" (FR-002).
- **Zin onder de picker**, afhankelijk van de keuze:
  - bij `public`: "De cursus komt ook in de cursusbibliotheek, voor alle organisaties."
  - bij `selective`: "De cursus komt ook in de cursusbibliotheek, voor de gekozen organisaties."
- **Beperken**: staat de cursus live en verliezen organisaties door de keuze toegang (research R5),
  dan vraagt een tweede venster eerst "{n} organisaties kunnen deze cursus daarna niet meer zien in
  de cursusbibliotheek." (bij één: "1 organisatie kan …"). Daarbij horen de knoppen "Wijzigen" en
  "Annuleren", zoals bij video's (spec FR-007).
- Na bevestigen wordt het verzoek met de keuze verstuurd.

## Waarschuwing bij beperkte video's (`SharedVideosWarningDialog`, `role="alertdialog"`)

Dit venster verschijnt bij `409 shared_videos_warning`.

- **Titel**: "Video's die niet algemeen beschikbaar zijn"
- **Tekst**: "In deze cursus zitten video's die je niet met iedereen hebt gedeeld. Organisaties
  waarmee je de cursus deelt, mogen deze video's binnen de cursus gebruiken als ze de cursus
  overnemen, ook als de video later wordt beperkt."
- **Lijst**: de namen van de video's (`data-test="warning-video"`).
- **Knoppen**: "Annuleren" (`data-test="warning-cancel"`) en "Doorgaan"
  (`data-test="warning-continue"`).
  - Annuleren gaat terug naar de bevestiging, met de keuze nog ingevuld, en verandert niets
    (US3, scenario 2).
  - Doorgaan verstuurt hetzelfde verzoek met `acknowledgedVideoIds`. Komt er opnieuw een 409,
    omdat de inhoud intussen veranderd is, dan verschijnt het venster opnieuw met de nieuwe lijst.

## Publicatiemenu (`PublishMenu`)

Het menu krijgt het item **Beschikbaarheid wijzigen** (`data-test="change-availability"`). Dat
staat er alleen bij een cursus met een live versie (FR-006). Bij niet-opgeslagen wijzigingen werkt
het ook, want het verandert niets aan het concept.

## Beschikbaarheid wijzigen (`CourseAvailabilityDialog`)

- **Titel**: "Beschikbaarheid wijzigen"
- **Inhoud**: de picker, voorgevuld.
- **Knoppen**: "Opslaan" en "Annuleren".
- **Na opslaan**: als organisaties toegang verliezen, eerst de vraag om te beperken (zie hierboven).
  Als er video's in de waarschuwing moeten, eerst de waarschuwing. Daarna de melding
  "Beschikbaarheid opgeslagen".
- Status, versie en datum in de balk veranderen niet.

## Status en overzicht

- **`CoursesView`**: onder de status van een gepubliceerde cursus staat de beschikbaarheid in tekst:
  "Alleen eigen organisatie", "Algemeen beschikbaar" of "Selectief beschikbaar". Het aantal
  organisaties staat niet in het overzicht (de lijst geeft alleen `visibility`); de eigenaar ziet
  de namen in de editor en in de cursusbibliotheek. Bij een concept staat er niets.
- **Bevestiging van verwijderen**: bij een cursus die gedeeld is (`visibility !== 'private'`) komt
  er de extra zin "Andere organisaties zien hem dan ook niet meer in de cursusbibliotheek."
  (FR-025).
- **`UnpublishDialog`**: dezelfde extra zin bij een gedeelde cursus.

## Navigatie

Het menu van de organisatie wordt: Cursussen · **Cursusbibliotheek** (`/course-library`) · Video’s
· Huisstijl · Quest koppelen.

## Cursusbibliotheek (`CourseLibraryView`, `/course-library`)

- **Kop**: "Cursusbibliotheek", met de regel "Cursussen die andere organisaties met jullie delen,
  en jullie eigen gedeelde cursussen."
- **Bovenaan**:
  - een zoekveld ("Zoek op naam, beschrijving of organisatie");
  - filters: "Alle cursussen", "Eigen cursussen", "Van andere organisaties";
  - sorteren: "Nieuwste publicatie eerst" (standaard), "Oudste publicatie eerst", "Naam (A–Z)",
    "Naam (Z–A)";
  - een actief organisatiefilter, als label "Organisatie: <naam> ✕" (zoals specs/003).
- **Per cursus** (`data-test="library-course"`):
  - thumbnail, of een neutrale afbeelding;
  - naam en de beschrijving op twee regels;
  - eigenaar: `OwnerPill`. Klikken op de pil van een andere organisatie zet het organisatiefilter.
    "Eigen" filtert niet;
  - "Versie {n} · {datum}" en "{x} onderdelen · {y} video's".
- **Leeg**:
  - "Er zijn nog geen gedeelde cursussen." (`data-test="library-empty"`);
  - zonder resultaten: "Geen cursussen gevonden", met de knop "Zoekterm en filters wissen".
- **Klik op een cursus**: het venster `CourseLibraryDetailsDialog` opent. Na sluiten blijven
  zoekterm, filters, sortering en scrollpositie gelijk.

## Details van een cursus (`CourseLibraryDetailsDialog`)

- **Inhoud**: thumbnail, naam, volledige beschrijving (met behoud van regels), de pil van de
  eigenaar, "Versie {n}", "Gepubliceerd op {datum en tijd}", "{x} onderdelen", "{y} video's".
- **Alleen voor de eigenaar**: de beschikbaarheid in tekst, met bij "Selectief beschikbaar" de
  namen van de organisaties, en de knop "Openen in de editor" (naar `/courses/:id`).
- **Voor andere organisaties**: geen knoppen behalve "Sluiten". Er is geen inhoud van de cursus
  te zien (FR-018).
- **Cursus intussen weg** (404): toast "Deze cursus is niet meer beschikbaar.", het venster sluit
  en de cursus verdwijnt uit de geladen lijst.
