# Backlog van de Quest-app

> **Kopie.** Het origineel staat in de Quest-repository:
> [docs/backlog.md](https://github.com/Team-Education-Futures-Lab/Yonder-Futureslab-VR-Lifeguard/blob/Development/docs/backlog.md).
> Beide bestanden MUST gelijk blijven: wie een item toevoegt, wijzigt of weghaalt, werkt in dezelfde
> werksessie beide bij (constitutie van de Quest-app, sectie Ontwikkelworkflow). Zo ziet het CMS-team
> welke wensen van de Quest een CMS-spec of contractuitbreiding nodig hebben.

Uitgestelde wensen voor de Quest-app. Een item hier is nog geen afspraak; het gaat via de Spec Kit-flow
zodra het wordt opgepakt.

Dit bestand staat ook in de CMS-repository als `docs/backlog-quest-app.md`. Werk bij elke wijziging
beide bij (constitutie 1.2.0, Ontwikkelworkflow).

## Nieuwe versie beschikbaar tonen

Een gedownloade cursus blijft op de oude versie staan (zo bedoeld in spec 003), maar er staat nergens dat
er een nieuwere versie is. Dit zijn FR-06-VR ("Update beschikbaar") en FR-07-VR (zelf bijwerken; de oude
versie blijft speelbaar tot de nieuwe binnen is). Volgens de bouwvolgorde wordt dit **spec 005**; het item
gaat weg als die spec begint. Er is al op voorbereid: de opslag per cursus en versie (spec 003 FR-007), en
"Mijn cursussen" speelt de hoogste complete versie (spec 004). Bevestigd in de Quest-test van CMS-spec 010
(2026-11-27): een overgenomen cursus die naar een nieuwe versie overstapt, toont op de Quest geen update;
alleen na het verwijderen van de oude versie kwam de nieuwe binnen.

## Ontkoppelen en opslag van andere organisaties

Er moet een knop komen om de Quest te ontkoppelen, bijvoorbeeld om hem aan een ander zwembad te geven
(editortest spec 003, E17). In spec 002 is bewust gekozen voor geen ontkoppelknop; dat besluit wordt
hiermee herzien.

Samen te bepalen: wat er dan gebeurt met de gedownloade cursussen. Nu (spec 003 FR-038) blijven de
cursussen van de vorige organisatie op de Quest staan als de Quest aan een andere organisatie wordt
gekoppeld, maar ze worden niet getoond. Ze houden ruimte bezet die de gebruiker niet ziet en niet kan
vrijmaken (bijv. een Quest van lang geleden die helemaal vol staat). Hetzelfde geldt sinds spec 004 voor een
cursus waarvan de inhoud zo beschadigd is dat zelfs naam en versie niet te lezen zijn (spec 004, research
R4). Mogelijke oplossingen: een overzicht van alle cursussen op de Quest waarin je cursussen van andere
organisaties (en onleesbare cursussen) kunt verwijderen, of alle cursussen tonen terwijl alleen die van de
eigen organisatie te spelen zijn. Let op constitutie III: nooit automatisch weggooien.

## Aangepaste kopie herkennen (spec 011 van het CMS)

Past een organisatie in het CMS een overgenomen cursus aan, dan krijgt zij een eigen kopie met een nieuw
cursusnummer. De Quest ziet nu een nieuwe cursus en de oude als "niet meer in het CMS". Wens: de Quest
herkent dat de nieuwe cursus de oude vervangt. Vraagt een afgesproken wijziging van het API-contract
(zie in de CMS-repo `docs/backlog.md`, "Koppeling tussen oude en nieuwe cursus op de Quest na aanpassen").

Quest-test van 2026-11-27: na "Aanpassen" staan beide op de Quest. De oude "Redden" toont versie 2 en de
grootte, de kopie is bijna gelijk maar versie 1. Niet te zien wat het verschil is: geen eigenaar, geen
"gebaseerd op", geen aanduiding dat de oude niet meer in het CMS staat die opvalt. Wens: per cursus de
eigenaar (of "eigen"/"overgenomen"/"aangepast") tonen en de oude duidelijk als vervangen markeren.

## Reden tonen als je opnieuw moet koppelen

Editortest spec 003 (E16): na een vernieuwde koppelcode werd je naar het koppelscherm gestuurd zonder dat
duidelijk was waarom. Spec 002 (FR-008) bedoelt dat daar "De koppelcode is veranderd. Vul de nieuwe koppelcode
in." staat. In de editortest van spec 004 (E13: koppelcode vernieuwd tijdens een download, terwijl er een cursus
speelde) kwam het koppelscherm na terugkomst in het menu goed terug. **Nog controleren in de Quest-sessie**
(`docs/quest-testsessie.md`, stap 18): staat de reden erbij en valt hij genoeg op? Daarna dit item weghalen of
aanscherpen.

## Melding als een download klaar is

Editortest spec 003 (E10): een download loopt door als je het cursussenscherm sluit of een cursus speelt,
maar je krijgt geen melding als hij klaar is. Sinds spec 004 verschijnt de cursus wel vanzelf onder "Mijn
cursussen". Een duidelijke melding is er nog niet (bijv. een pop-up of een regel in het menu: "Cursus X is
gedownload"), ook niet als het cursussenscherm dicht is.

## Afbeeldingscache opruimen

Editortest na spec 003: de map `thumbnails/` in `persistentDataPath` groeit steeds. Dat is de cache met
afbeeldingen voor de kaarten op het cursussenscherm, per adres (`?v=<versie>`, spec 003 research R11). Die
wordt niet opgeruimd: niet als een cursus wordt verwijderd, niet bij een nieuwe versie (nieuw adres, de oude
afbeelding blijft) en niet als een cursus uit het CMS verdwijnt (regel P5 is in spec 003 bewust geschrapt,
analyse M3). De afbeelding van een gedownloade cursus zelf (`courses/<id>/v<n>/thumbnail.jpg`) gaat wel weg bij
verwijderen. Uitzoeken hoe de cache klein blijft, bijv. bij het opstarten afbeeldingen weggooien die bij geen
cursus uit de laatste lijst horen, of een index adres → cursus-id bijhouden. Ook nagaan hoe groot dit in de
praktijk wordt (±100 KB per afbeelding).

## Commandline-build en CI

Het build profile "Meta Quest" bestaat (sinds 2026-11-25). Wat nog ontbreekt: een build vanaf de commandline
voor de Quest, en de EditMode-tests in GitHub Actions (zoals bij het CMS).

## Cursussen aan elkaar koppelen (eerst CMS)

Na een cursus door kunnen naar een volgende cursus, bijvoorbeeld een cursus in twee delen. Nu stopt een
cursus altijd op het stopscherm. Vraagt eerst een CMS-spec en een uitbreiding van het API-contract
(constitutie II: het contract wordt niet eenzijdig gewijzigd). Het stopscherm heeft er al een vrije plek voor
(`CourseEndView.ExtraContentContainer`).

## Reflectievraag op het stopscherm (eerst CMS)

Het prototype had per scenario een open reflectievraag aan het eind. Het CMS kent die niet. Ook hier eerst
een CMS-spec en een contractuitbreiding; de app toont hem daarna op het stopscherm.

## UI verbeteren

De UI is in spec 001 hergebruikt van het prototype en werkt, maar moet nog verbeterd worden. Nieuwe prefabs
alleen met toestemming van het team.

- **Menu**: de cursuslijst ("Mijn cursussen", `AnswerButton`-knoppen op de plek van de oude startknop) en
  het serverlabel. Sinds spec 004: staan er geen cursussen op de bril, dan loopt de uitleg "Er staan nog
  geen cursussen op deze bril…" over de andere tekst heen. Die tekst (`EmptyText` in `MainMenu.unity`) moet
  een eigen plek en grootte krijgen.
- **Cursussenscherm** (spec 003, E8): de kaart met voortgangsbalk en de knoppen "Pauzeren"/"Annuleren"
  werkt, maar de opmaak moet beter (`CourseCard.prefab`).
- **Verwijderen** (spec 003, E13): de vraag "Deze cursus van de bril verwijderen?" staat op de kaart in de
  plaats van de status en valt weinig op. Duidelijker maken, vooral bij een cursus die niet meer in het CMS
  staat: die is na verwijderen niet opnieuw te downloaden, en dat zou de vraag ook moeten zeggen.
- **Stopscherm**: de oude reflectietekst is verborgen.
- **Vraag- en feedbackschermen**: de timer in `QuestionUI` wordt niet gebruikt.

## UI volgt het hoofd te snel

De schermen in `MainMenu` en `CoursePlayer` volgen de blik van de gebruiker met het XRI-component
`LazyFollow`. Dat werkt nu niet goed: de UI beweegt te snel mee, wat onrustig is. Uitzoeken welke
instellingen (vertraging, drempel voor afstand en hoek, snelheid) prettig zijn, of dat de UI pas meebeweegt
als hij buiten beeld raakt. Testen op een echte Quest; in de editor met simulatie voelt het anders.

## Alle teksten in VR nalopen

Editortest spec 003 (E20): de meldingen staan nu goed en leesbaar, maar de woorden zelf moeten nog eens
worden nagelopen. Alle teksten in `MenuTexts` (sinds spec 004 ook die van de speler) samen met het team
checken op eenvoudig Nederlands, toon en lengte.
