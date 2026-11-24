# Backlog

Uitgestelde wensen voor het CMS. Een item hier is nog geen afspraak; het gaat via de Spec Kit-flow
zodra het wordt opgepakt.

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
