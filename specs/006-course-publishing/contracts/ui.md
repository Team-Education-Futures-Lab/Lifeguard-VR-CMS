# UI-contract: publiceren, onpubliceren en status

Aanvulling op [specs/004 ui.md](../../004-course-steps-draft/contracts/ui.md) en
[specs/005 ui.md](../../005-course-step-branching/contracts/ui.md). Alle teksten Nederlands, in
eenvoudige taal (NFR-03). Kleur is nooit het enige signaal.

## Status (`PublicationStatus`, overzicht en editor)

| Status | Tekst | Extra regel |
| --- | --- | --- |
| `draft`, nooit gepubliceerd | **Concept** | – |
| `draft`, eerder gepubliceerd | **Concept** | "Niet gepubliceerd (was versie 2)" |
| `published` | **Gepubliceerd** | "Versie 2 · 23 november 2026 om 14:05" |
| `published_changed` | **Gepubliceerd · wijzigingen nog niet gepubliceerd** | "Op de Quest: versie 2 · 23 november 2026 om 14:05" |

`data-test="publication-status"`; de status heeft ook een `data-status` met de API-waarde.

## Editorbalk

Naast "Opslaan als concept":

- **Publiceren** (`data-test="publish"`): bij `draft` en `published_changed`. Bij `published`
  uitgeschakeld met de tooltip/hulptekst "Er is niets nieuws om te publiceren".
- **Onpubliceren** (`data-test="unpublish"`): alleen bij een live versie (secundaire knop).
- Beide uitgeschakeld tijdens een lopend verzoek.

## Bevestiging publiceren (`PublishDialog`, `role="alertdialog"`)

- Titel: "Cursus publiceren?" (eerste keer) of "Nieuwe versie publiceren?" (er is een live versie).
- Tekst eerste keer: "De cursus wordt beschikbaar voor de VR-brillen van jullie organisatie."
- Tekst opnieuw: "De nieuwe versie vervangt versie {n}. Daarna kunnen de VR-brillen van jullie
  organisatie de nieuwe versie downloaden." (Het nummer van de nieuwe versie staat pas vast na
  publiceren; bij terugzetten na onpubliceren kan het hetzelfde nummer zijn, FR-017.)
- Bij niet-opgeslagen wijzigingen extra: "Je wijzigingen worden eerst opgeslagen."
- Knoppen: "Publiceren" / "Annuleren".

## Nog niet klaar om te publiceren

Als de editor zelf meldingen heeft, of de server `422` geeft:

- Titel: "Nog niet klaar om te publiceren"; tekst "Los deze punten eerst op:".
- Lijst van meldingen, gegroepeerd zoals de lijst "nog te doen" (specs/005); elke melding met het
  onderdeel waar ze over gaat is een knop die het onderdeel opent en de dialoog sluit.
- De meldingen worden rood op de blokken en in "nog te doen" (specs/005 FR-022a).
- Knop: "Sluiten".

## Bevestiging onpubliceren

- Titel: "Cursus onpubliceren?"
- Tekst: "De cursus is daarna niet meer te downloaden op de VR-brillen. Brillen die hem al hebben,
  kunnen hem blijven gebruiken. Je concept en eerdere versies blijven bewaard."
- Bij `publication.hasUnavailableVideo` extra: "Let op: er zit een video in die niet meer
  beschikbaar is. Wil je later opnieuw publiceren, dan moet je eerst een andere video kiezen."
- Knoppen: "Onpubliceren" / "Annuleren".

## Na afloop

- Publiceren gelukt: korte melding (zoals "Concept opgeslagen") "Gepubliceerd als versie {n}";
  bij terugzetten van dezelfde versie "Versie {n} staat weer op de VR-brillen".
- Onpubliceren gelukt: "Cursus is niet meer gepubliceerd".
- Netwerk- of serverfout: "Publiceren is niet gelukt. Probeer het opnieuw." (niets veranderd).
- Na een publicatie met een nieuwe versie vervangt de editor zijn inhoud door het teruggegeven
  concept (nieuwe id's); "Ongedaan maken" en "Opnieuw" beginnen leeg (R14). De weergave
  (canvas of lijst) en de canvaspositie blijven waar ze waren; een geselecteerd of geopend
  onderdeel wordt gesloten (het oude id bestaat in het concept niet meer).
- Opslaan geeft `409 draft_replaced` (een collega heeft intussen gepubliceerd): dialoog
  "Cursus is intussen gepubliceerd" met de tekst van de server en de knop "Pagina opnieuw laden".

## Cursusoverzicht

- Kolom "Status" met `PublicationStatus` (vervangt het vaste label "Concept").
- Verwijderen van een cursus met een live versie: de bestaande bevestiging krijgt de zin "Deze
  cursus is gepubliceerd. Na verwijderen is hij niet meer te downloaden op de VR-brillen."
