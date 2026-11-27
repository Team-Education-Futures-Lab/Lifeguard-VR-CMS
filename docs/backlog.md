# Backlog

Uitgestelde wensen voor het CMS. Een item hier is nog geen afspraak; het gaat via de Spec Kit-flow
zodra het wordt opgepakt.

## Handmatige test van spec 010 (gedeelde cursussen overnemen als verwijzing)

Spec 010 (`specs/010-course-reference-takeover`, FR-12 deel 2) is gebouwd op 2026-11-27. De
geautomatiseerde tests slagen (backend, frontend en de e2e-tests van 003, 006, 009 en 010). Van de
handmatige scenario's 1–18 van `specs/010-course-reference-takeover/quickstart.md` (taak T063) zijn
op 2026-11-27 1–3 en 5–18 goed bevonden (resultaten in de quickstart). Nog open: 4 en het Quest-deel
van 8, 9 en 11 (Quest) en de SQL-controle uit de quickstart (`addedAt`, `courseVersionId`,
`declinedCourseVersionId`). Update: de Quest-scenario's (4, 8, 9, 11) zijn op 2026-11-27 getest; open
is alleen nog de SQL-controle. Ook nog open (taak T060):
de usability-omgeving heeft nog geen overgenomen cursus met een nieuwere versie.

De open punten uit spec 009 (research R13) zijn in spec 010 uitgewerkt:

- Een verwijzing blijft op de gekozen versie werken als de eigenaar de cursus beperkt, onpubliceert of
  verwijdert, of als de eigenaar zelf verwijderd wordt; de ontvanger ziet waarom er geen nieuwe
  versies meer komen (spec 010, User Story 4).
- De toestemming voor beperkte video's volgt uit de gekozen versie van de verwijzing; er is geen
  aparte tabel (spec 010, research R2). In spec 011 zijn de kopie en haar eerste versie het bewijs.
- Spec 011 kan een verwijzing omzetten naar een kopie zonder bestaande gegevens om te zetten (spec
  010, research R13).

## Eigen kopie van een overgenomen cursus bij aanpassen (FR-12, deel 3, spec 011) — gebouwd

Spec 011 (`specs/011-course-reference-copy`) is gebouwd op 2026-11-27: "Aanpassen" in het venster van
een overgenomen cursus geeft een eigen kopie van de gekozen versie (versie 1 gepubliceerd, versie 2 als
concept), met "Gebaseerd op <cursus> van <organisatie>". De kopie is nooit te delen en krijgt geen
nieuwe versies; meegekregen video's blijven werken, ook na beperken. Van de handmatige scenario's van
`specs/011-course-reference-copy/quickstart.md` (taak T049) zijn op 2026-11-27 1–3 en 5–12 goed
bevonden (resultaten in de quickstart). Scenario 4 (Quest) is op 2026-11-27 getest. Nog open: de
SQL-controle uit de quickstart.

## Koppeling tussen oude en nieuwe cursus op de Quest na aanpassen

Besloten bij spec 011 (2026-11-27, research R7): de Quest-API verandert niet. Na "Aanpassen" ziet een
Quest de kopie als nieuwe cursus (opnieuw downloaden) en de oude overgenomen cursus als cursus die niet
meer in het CMS staat. Wens: de Quest herkent dat de nieuwe cursus de oude vervangt (bijvoorbeeld een
veld `replacesCourseId` in de lijst), zodat de docent niet twee keer dezelfde cursus ziet. Vraagt een
afgesproken wijziging van het API-contract (spec 007) en de Quest-app; zie ook
`docs/backlog-quest-app.md`.

## Een aangepaste kopie delen met andere organisaties

Besloten bij spec 011 (2026-11-27, Clarifications): een kopie kan niet gedeeld worden en komt nooit in
de cursusbibliotheek (spec 009, FR-014 d). De toestemming voor meegekregen video's geldt alleen voor de
organisatie die aanpaste. Als dit ooit gewenst is: eerst uitzoeken wat er met meegekregen video's moet
gebeuren (toestemming van de oorspronkelijke eigenaar).

## Nieuwe versies van een overgenomen cursus automatisch gebruiken

Besloten bij spec 010 (2026-11-27): een organisatie met een overgenomen cursus kiest bij elke nieuwe
versie van de eigenaar zelf of zij die gebruikt. Wens: per overgenomen cursus een instelling
"Nieuwe versies automatisch gebruiken" (standaard uit), zodat een organisatie die altijd de nieuwste
versie wil niet steeds dezelfde melding krijgt. Uitzoeken: wat er op de Quests gebeurt als een
nieuwe versie midden in een lesperiode binnenkomt.

## Handmatige test van spec 009 (cursussen delen en de cursusbibliotheek)

Spec 009 is gebouwd en de geautomatiseerde tests slagen (backend, frontend en de e2e-tests van 003, 006
en 009). Van de handmatige scenario's 1–16 van `specs/009-course-sharing-library/quickstart.md` (taak
T062) zijn op 2026-11-27 1–9, 11–13, 15 en 16 goed bevonden (resultaten in de quickstart). Nog
open: 10 (het venster van een cursus in de bibliotheek vóór toevoegen), 14 (Quest; op 2026-11-27 getest en goed)
(Quest) en de SQL-controle uit de quickstart.

Ook nog open uit spec 009 (taak T058): de usability-omgeving heeft nog geen gedeelde cursus van een
tweede organisatie, dus de cursusbibliotheek is daar leeg tot iemand zelf een cursus deelt.

## Een cursus verwijderen vanuit de editor

Uit de handmatige test van spec 010 (2026-11-27, scenario 16). Een cursus verwijderen kan nu alleen
met het prullenbakje in het cursusoverzicht (`frontend/src/views/CoursesView.vue`). Wens: ook in de
editor (bijvoorbeeld in het menu bij de naam of het publicatiemenu), met dezelfde bevestiging als in het
overzicht (ook de zinnen over de VR-brillen, de bibliotheek en de ontvangers). Meenemen in de
UI-refactor van de cursus-editor.

## Teksten nalopen in het CMS

Verzamelplek voor teksten die korter, duidelijker of beter verwoord kunnen (NFR-03). Bij het oppakken
alle punten in één keer nalopen, en de teksten in de contracten (`specs/*/contracts/ui.md`) en de tests
meenemen.

- **Waarschuwing bij delen van beperkte video's** (handmatige test 009, scenario 4): "Video's die niet
  algemeen beschikbaar zijn" (`frontend/src/components/SharedVideosWarningDialog.vue`) heeft veel
  tekst.
- **Bevestiging "Toevoegen aan mijn organisatie"** (handmatige test 010, scenario 1): veel tekst
  (`addConfirmationBody` in `frontend/src/lib/courseReference.js`).
- **Beperk-bevestiging met overgenomen cursussen** (handmatige test 010, scenario 12): de zin "1
  daarvan heeft deze cursus overgenomen en houdt haar huidige versie." kan beter verwoord worden
  (`losingReceiversSentence` in `frontend/src/lib/courseReference.js`).
- **Bevestiging "Aanpassen"** (handmatige test 011, scenario 1): veel tekst (`copyConfirmation` in
  `frontend/src/lib/courseReference.js`).
- **Bevestiging "Cursus verwijderen?" bij een cursus met ontvangers** (handmatige test 010, scenario
  16): veel tekst. De zinnen over de VR-brillen, de cursusbibliotheek en de organisaties die de cursus
  hebben overgenomen worden achter elkaar gezet (`remove` in `frontend/src/views/CoursesView.vue`,
  `receiversSentence` in `frontend/src/lib/courseReference.js`). Hetzelfde geldt waarschijnlijk voor
  onpubliceren (`frontend/src/editor/UnpublishDialog.vue`).

## Iconen voor eigen, overgenomen en aangepaste cursussen

Uit de handmatige test van spec 011 (2026-11-27, scenario 7). Of een cursus een eigen origineel is,
een overgenomen cursus (spec 010) of een eigen kopie van een overgenomen cursus (spec 011), staat nu
overal in tekst ("Eigen", "Overgenomen van …", "Gebaseerd op …"). Wens: één duidelijk icoon per soort,
op dezelfde plek in het cursusoverzicht, de cursusbibliotheek en de editor, met de tekst als tooltip of
toelichting. Samen oppakken met "Cursusoverzicht: eigen en overgenomen cursussen in dezelfde opmaak"
en de UI-refactor van de cursus-editor.

## UI-refactor van de cursus-editor

Uit de handmatige tests van specs 009–011 (2026-11-27). Door de laatste features is de kop van de
editor vol geraakt, en er komt steeds iets bij (spec 011: "Gebaseerd op …"). Bij een refactor eerst
alles op een rij zetten wat er in de editor kan staan, en per onderdeel kiezen of het in de kop, een
menu, een paneel of een venster hoort. Zie ook de bugs "lange videonaam duwt de cursus-editor naar
rechts" en "bovenbalk van de cursus-editor verspringt bij opslaan".

Wat er nu in de editor kan staan (`frontend/src/editor/`):

- **Kop**
  - Terug naar cursussen.
  - Naam van de cursus, die het venster "Naam en beschrijving" opent.
  - "Gebaseerd op <cursus> van <organisatie>" bij een eigen kopie (spec 011).
  - Publicatiestatus: Concept, "Op de Quest: versie N · datum", of gepubliceerd met wijzigingen
    (spec 006).
  - Publicatiemenu (spec 006/009/010):
    - "Publiceren" of "Wijzigingen publiceren", met de reden als het niet kan;
    - "Beschikbaarheid wijzigen" (niet bij een kopie);
    - "Onpubliceren";
  - Weergave: Canvas, Canvas + paneel, Lijst.
  - Ongedaan maken en Opnieuw.
  - Controlestatus ("nog N punten" / klaar om te publiceren, met de lijst van punten).
  - Melding "Concept opgeslagen" / "Opgeslagen, nog N punten open".
  - Opslaan en "Canvas ordenen".
- **Canvas en lijst**
  - Onderdelen (video en vraag) met badges: start, einde, problemen.
  - Video-thumbnails, ook van video's die niet meer beschikbaar zijn, of die een kopie van het
    origineel meekreeg.
  - Verbindingen, het verbindmenu, het paneel of venster om een onderdeel te bewerken, en de
    videokeuze.
- **Vensters**
  - Publiceren, met de keuze voor beschikbaarheid of bij een kopie de uitleg dat hij niet gedeeld
    kan worden.
  - "Nog niet klaar om te publiceren".
  - Waarschuwing over beperkte video's.
  - Beschikbaarheid wijzigen.
  - Onpubliceren.
  - "Cursus is intussen gepubliceerd".
  - Waarschuwing bij het weghalen van een video die niet meer gekozen kan worden.
  - Naam en beschrijving.
- **Elders, maar hoort bij dezelfde vormgeving**
  - De hint "Jullie hebben al een aangepaste kopie van deze cursus" in het venster van de
    bibliotheek (handmatige test 011, scenario 11: kan duidelijker).
  - De vensters van een overgenomen cursus.

## Waarschuwing bij delen: ook de al gedeelde video's tonen

Uit de handmatige test van spec 009 (2026-11-27, scenario 6). Bij een nieuwe versie noemt de
waarschuwing alleen de beperkte video's die nu nieuw gedeeld worden. Wens: onder die lijst ook tonen
welke beperkte video's al eerder met deze organisaties gedeeld waren (bijvoorbeeld "Al gedeeld: …"),
zodat de eigenaar het hele plaatje ziet. Uitzoeken: of de server die lijst meestuurt (nu alleen de
video's die bevestigd moeten worden, specs/009 FR-010).

## Cursusoverzicht: eigen en overgenomen cursussen in dezelfde opmaak

Uit de handmatige test van spec 010 (2026-11-27, scenario 3). Eigen cursussen (tekstregel met tellers
en status) en overgenomen cursussen (met afbeelding en pil) zien er in `frontend/src/views/CoursesView.vue`
heel anders uit. Wens: eigen cursussen ook in de opmaak van de overgenomen cursussen, met afbeelding,
maar beide rijen iets minder dik.

## Kiezen bij een nieuwe versie eenvoudiger

Uit de handmatige test van spec 010 (2026-11-27, scenario 9). Nu kiest een organisatie met een
overgenomen cursus bij een melding "Nieuwe versie gebruiken" of "Huidige versie houden". "Huidige
versie houden" verandert de versie niet (die verandert nooit vanzelf); het laat alleen de melding en
de teller verdwijnen (specs/010 FR-015). Daarna staat "Nieuwe versie gebruiken" er nog, wat dubbel
voelt. Voorstel: alleen een knop "Overstappen naar de nieuwe versie"; zolang je niet klikt, houd je je
versie. Ook bevestigd in de Quest-test (2026-11-27): "Huidige versie houden" voelt nutteloos, houden
hoort de standaard te zijn. Uitzoeken: hoe de melding en de teller dan verdwijnen (bijvoorbeeld zodra je de cursus hebt
geopend, of met een "Melding sluiten"-kruisje), zodat de teller niet blijft staan.

## Inhoud van een gedeelde cursus alleen-lezen bekijken

Besloten bij spec 009 (2026-11-26): in de cursusbibliotheek ziet een andere organisatie nu alleen
een samenvatting van een gedeelde cursus (naam, beschrijving, eigenaar, versie, datum, aantal
onderdelen en video's). Wens: de volledige inhoud van de live versie alleen-lezen bekijken
(onderdelen, vragen, antwoorden, verbindingen, video's met thumbnails), zodat een organisatie beter
kan beslissen of zij de cursus overneemt. Uitzoeken: de thumbnails van video's die niet algemeen
beschikbaar zijn worden dan zichtbaar; de waarschuwing bij delen (spec 009, FR-009 t/m FR-011) moet
dat dan ook zeggen. Past mogelijk bij deel 2 (overnemen).

## Lijnen verplaatsen en lijnstijl

Een pijl in de cursus-editor buigen of verleggen met een sleepbaar tussenpunt, en kiezen tussen
vloeiende of hoekige lijnen. Is al eens gebouwd, maar weer verwijderd omdat het slepen in de browser
niet goed werkte (verbeterronde feature 005).

## Tags en groepen voor video's

Video's die bij elkaar horen in een groep zetten of een tag geven, zodat je in de videobibliotheek
beter kunt filteren. Een hele groep kan dan in één keer gedeeld worden in plaats van elke video los.

## Theorieboek

Verwijzingen naar de echte theorie toevoegen, met standaardvragen uit het theorieboek zodat de
vraagstijl aansluit bij bijvoorbeeld het examen. De stakeholder kijkt hier nog naar.

## Vraag als eindpunt

Een vraag moet ook als eindpunt van een cursus kunnen gelden.

## Cursussen en video's van verwijderde cursussen echt opruimen

Een verwijderde video blijft nu voorgoed op schijf staan als hij in een verwijderde cursus zat,
omdat de onderdelen van die cursus blijven bestaan. Dat moet opgeruimd worden; uitzoeken hoe dit
samengaat met delen en overnemen (FR-12) en versies (FR-11), en de constitution (principe V)
daarbij bijwerken.

Besloten bij feature 006 (2026-11-23): net als bij video's blijft een zacht verwijderde cursus
alleen bestaan zolang een andere organisatie hem via een verwijzing gebruikt (overnemen, FR-12).
Downloads op een Quest worden niet bijgehouden en tellen niet mee (de Quest houdt zijn eigen kopie,
FR-09-VR). Daarna mag een opruimstap de cursus met al zijn versies echt verwijderen, waarna ook de
video's die alleen daarin zaten opgeruimd kunnen worden. Principe V zegt nu nog dat het record
blijft bestaan; dat moet verduidelijkt worden naar "eerst zacht, echt weg als niemand hem meer
gebruikt" (zoals de opruimtaak voor videobestanden al doet).

Aangevuld bij spec 010 (2026-11-27, research R7): een cursus met zijn versies mag pas weg als geen
`OrganisationCourse`-rij van een actieve organisatie (verwijzing, `isOwner = FALSE`) er nog naar
wijst. Een versie die een verwijzing als `courseVersionId` heeft, moet altijd blijven, ook als het
geen live versie meer is.

## Zien waar een verwijderde video nog gebruikt wordt

Een verwijderde video blijft beschikbaar zolang een cursus hem gebruikt (zachte verwijdering,
FR-13). Als zo'n video echt weg moet, bijvoorbeeld omdat hij fout of ongewenst is, moet de eigenaar
nu zelf uitzoeken in welke cursussen hij nog zit. De eigenaar wil bij een verwijderde video kunnen
zien waar hij nog gebruikt wordt (welke cursussen en versies, ook van andere organisaties), zodat
dit zonder zoeken op te lossen is. Uitzoeken hoeveel de eigenaar van andermans cursussen mag zien,
en of de eigenaar het gebruik ook zelf kan beëindigen of alleen een verzoek kan sturen.

## Versiegeschiedenis bekijken en een oude versie opnieuw publiceren (FR-11b)

Afgesplitst van FR-11 op 2026-11-24 en op Could gezet: het belangrijke deel van FR-11 (verder werken
naast de live versie, zien welke versie op de Quest staat) is gebouwd in spec 006; een
geschiedenisscherm is vooral een vangnet en kan snel onhandig worden voor docenten. Het gaat om:
per cursus de gepubliceerde versies zien (nummer, datum, live of offline), een oude versie alleen-lezen
bekijken, en een oude versie opnieuw publiceren. Bij dat laatste moet een video die intussen is
verwijderd eerst vervangen worden (FR-13, constitutie principe V).

Er staat geen gat open: sinds spec 006 blijft elke gepubliceerde versie volledig bewaard (eigen
onderdelen, antwoorden, verbindingen, posities, nummer en datum) en verandert nooit, en de code leest
van de oude versies alleen de hoogste. Een latere feature hoeft alleen het scherm en het terugzetten te
bouwen; `copyVersionAsDraft` in `backend/src/modules/courses/courseRepository.js` kopieert al een versie
naar een nieuw concept.

Kleinere variant als er alleen een vangnet nodig is: in het publicatiemenu "Concept terugzetten naar de
live versie" (het concept verknoeid → terug naar wat er op de Quest staat), zonder versielijst. Een
kant-en-klare Spec Kit-prompt voor de volledige variant is op 2026-11-24 geschreven (Claude-sessie over
spec 006).

## Fingerprint-controle bij de deploy weer aanzetten (deze week)

De deploy-stap in `.github/workflows/ci.yml` gaf een fout dat de fingerprint van de VPS niet
herkend werd. Tijdelijk (2026-11-25) is de regel `fingerprint: ${{ secrets.VPS_HOST_FINGERPRINT }}`
uitgecommentarieerd, zodat de deploy werkt. Zonder die regel controleert de deploy niet of hij met
de echte VPS praat, dus dit moet terug zodra de product owner er weer is.

Te doen: de juiste fingerprint ophalen (alleen het `SHA256:...`-deel, van het sleuteltype dat de
server bij het verbinden gebruikt, meestal ed25519), bijvoorbeeld op de VPS met
`ssh-keygen -l -f /etc/ssh/ssh_host_ed25519_key.pub | cut -d ' ' -f2`. Die waarde opslaan als secret
`VPS_HOST_FINGERPRINT`, de regel weer aanzetten en een deploy draaien om te controleren.

## Bug: lange videonaam duwt de cursus-editor naar rechts

Gevonden op 2026-11-25. Is de naam van een video in de cursus-editor te lang, dan wordt alles rechts
van het paneel te ver naar rechts geschoven. Een lange naam moet binnen het paneel blijven (afkappen
of afbreken) zonder de rest van de layout te verschuiven.

## Bug: bovenbalk van de cursus-editor verspringt bij opslaan

Gevonden op 2026-11-25. Bij het opslaan in de cursus-editor verandert de hele layout van de
bovenbalk. De bovenbalk moet tijdens en na het opslaan dezelfde indeling houden.
