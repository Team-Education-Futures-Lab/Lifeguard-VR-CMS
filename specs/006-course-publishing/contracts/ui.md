# UI-contract: publiceren, onpubliceren en status

Aanvulling op [specs/004 ui.md](../../004-course-steps-draft/contracts/ui.md) en
[specs/005 ui.md](../../005-course-step-branching/contracts/ui.md). Alle teksten Nederlands, in
eenvoudige taal (NFR-03). Kleur is nooit het enige signaal.

## Status (`PublicationStatus`, overzicht en editor)

| Status | Tekst | Extra regel |
| --- | --- | --- |
| `draft`, nooit gepubliceerd | **Concept** | – |
| `draft`, eerder gepubliceerd | **Concept** | – (verbeterronde V6) |
| `published` | **Gepubliceerd** | "Versie 2 · 23 november 2026 om 14:05" |
| `published_changed` | **Gepubliceerd · wijzigingen nog niet gepubliceerd** | "Op de Quest: versie 2 · 23 november 2026 om 14:05" |

`data-test="publication-status"`; de status heeft ook een `data-status` met de API-waarde.

## Editorbalk (verbeterronde V2–V5)

Links, na de naam van de cursus: de status en daarnaast één knop met keuzemenu
(`data-test="publish-menu"`, `aria-haspopup="menu"`). Rechts blijft het bewerken: ongedaan maken,
"nog te doen", "Canvas ordenen", "Opslaan als concept".

- De knop heet **Publiceren** zolang de cursus niet live staat, en **Wijzigingen publiceren** als
  hij live staat. Tijdens een verzoek: "Bezig…", uitgeschakeld.
- Het menu bevat:
  - dezelfde actie (`data-test="publish"`). Uitgegrijsd met de reden eronder
    (`data-test="publish-reason"`): "Sla eerst je wijzigingen op" bij niet-opgeslagen wijzigingen
    (publiceren werkt alleen op het opgeslagen concept, V4), of "Er is niets nieuws om te
    publiceren" bij `published`;
  - **Onpubliceren** (`data-test="unpublish"`), alleen bij een live versie.

## Bevestiging publiceren (`PublishDialog`, `role="alertdialog"`)

- Titel: "Publiceren?" (niet live) of "Wijzigingen publiceren?" (live).
- Tekst niet live: "De cursus wordt beschikbaar voor de VR-brillen van jullie organisatie."
- Tekst live: "De wijzigingen komen op de VR-brillen van jullie organisatie. Ze vervangen wat daar
  nu staat (versie {n})."
- Knoppen: "Publiceren" of "Wijzigingen publiceren" / "Annuleren".

## Nog niet klaar om te publiceren

Als de editor zelf meldingen heeft, of de server `422` geeft:

- Titel: "Nog niet klaar om te publiceren"; tekst "Los deze punten eerst op. Klik op een punt om
  het onderdeel te openen."
- Dezelfde lijst als "nog te doen" (`IssueGroups`, verbeterronde V1): groepen met kopje en aantal,
  per regel het onderdeel en de melding; een regel opent het onderdeel en sluit de dialoog.
- De meldingen worden rood op de blokken en in "nog te doen" (specs/005 FR-022a).
- Knop: "Sluiten".

## Bevestiging onpubliceren

- Titel: "Cursus onpubliceren?"
- Tekst: "De cursus is daarna niet meer te downloaden op de VR-brillen. Brillen die hem al hebben,
  kunnen hem blijven gebruiken. Je concept en eerdere versies blijven bewaard."
- Bij `publication.hasUnavailableVideo` extra: "Let op: een video in deze cursus is niet meer
  beschikbaar. Opnieuw publiceren kan pas met een andere video."
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
