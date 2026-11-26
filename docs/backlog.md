# Backlog

Uitgestelde wensen voor het CMS. Een item hier is nog geen afspraak; het gaat via de Spec Kit-flow
zodra het wordt opgepakt.

## Gedeelde cursussen overnemen (FR-12, deel 2) — hoge prioriteit, volgende spec

FR-12 is op 2026-11-26 opgedeeld in twee specs. Deel 1 (delen bij publiceren en de centrale
cursusbibliotheek) is gebouwd in spec 009 (`specs/009-course-sharing-library`); dit is deel 2 en komt
direct daarna. Het gaat om:

- Een cursus uit de bibliotheek toevoegen aan de eigen organisatie, als verwijzing naar het
  origineel (geen kopie).
- Een eigen volledige kopie zodra de organisatie de cursus wil aanpassen; het origineel blijft
  ongewijzigd en de kopie krijgt geen updates meer.
- Een melding bij een organisatie met een verwijzing als de eigenaar een nieuwe versie publiceert;
  zij kiest de nieuwe of de oude versie en de verwijzing wijst naar de gekozen versie.
- De ontvanger mag video's die niet algemeen beschikbaar zijn binnen die cursus gebruiken en de
  cursus verder volledig aanpassen; dit is niet terug te draaien (FR-14).
- Een verwijderde cursus blijft bestaan zolang een andere organisatie hem via een verwijzing
  gebruikt (zachte verwijdering, besloten bij feature 006). Hangt samen met "Cursussen en video's
  van verwijderde cursussen echt opruimen" hieronder.
- De Quest-API (feature 007) toont ook overgenomen cursussen; bij een verwijzing de gekozen versie.

Open punten uit spec 009 (research R13):

- Wat er met een verwijzing gebeurt als de eigenaar de cursus later beperkt (minder organisaties of
  "Alleen eigen organisatie"): blijft de verwijzing werken, of verdwijnt hij?
- Hoe de onomkeerbare toestemming voor beperkte video's wordt vastgelegd bij het overnemen. Spec 009
  laat de eigenaar die video's bevestigen bij het delen, maar slaat de bevestiging niet op.
- Spec 009 legt bij een cursus `Course.visibility` en `CourseAccess` vast; `questLiveVersions` in
  `backend/src/modules/quest/questCatalog.js` is de enige plek die voor overgenomen cursussen hoeft te
  veranderen.

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
