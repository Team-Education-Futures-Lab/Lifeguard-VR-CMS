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

## Cursussen aan elkaar koppelen

Na een cursus door kunnen naar een volgende cursus (zoals de twee delen van de democursus). Nu stopt
een cursus altijd op het stopscherm. Vraagt eerst een CMS-spec en een uitbreiding van het API-contract
(constitutie II: het contract wordt niet eenzijdig gewijzigd). Het stopscherm heeft er al een vrije
plek voor (`CourseEndView.ExtraContentContainer`).

## Reflectievraag op het stopscherm

Het prototype had per scenario een open reflectievraag aan het eind. Het CMS kent die niet. Ook hier
eerst een CMS-spec en contractuitbreiding; de app toont hem daarna op het stopscherm.

## Democursussen en -video's weghalen

Zodra een cursus uit het CMS gedownload op de Quest te doorlopen is: `Assets/LifeGuard/DemoCourse/`,
`Assets/LifeGuard/Scripts/App/Demo/` en `Assets/StreamingAssets/Videos/` weghalen. Daarmee vervalt de
tijdelijke uitzondering in principe II van de constitution.

## UI verbeteren

De UI is in spec 001 hergebruikt van het prototype en werkt, maar moet nog verbeterd worden: het menu
met de cursuslijst (nu `AnswerButton`-knoppen op de plek van de oude startknop), het serverlabel, het
stopscherm (de oude reflectietekst is verborgen) en de vraag- en feedbackschermen (de timer in
`QuestionUI` wordt niet gebruikt). Nieuwe prefabs alleen met toestemming van het team.

Sinds spec 003 (editortest 2026-11-25, E8): de kaart van het cursussenscherm met voortgangsbalk en de
knoppen "Pauzeren"/"Annuleren" werkt, maar de opmaak moet beter (`CourseCard.prefab`).

## UI volgt het hoofd te snel

De schermen in `MainMenu` en `CoursePlayer` volgen de blik van de gebruiker met het XRI-component
`LazyFollow`. Dat werkt nu niet goed: de UI beweegt te snel mee, wat onrustig is. Uitzoeken welke
instellingen (vertraging, drempel voor afstand en hoek, snelheid) prettig zijn, of dat de UI pas
meebeweegt als hij buiten beeld raakt. Testen op een echte Quest; in de editor met simulatie voelt het
anders.

## Vaste Quest-build en CI

Een vast build profile voor de Quest, een commandline-build, en de EditMode-tests in GitHub Actions
(zoals bij het CMS).

## Cursussen van andere organisaties op de Quest

Spec 003 (FR-038): wordt een Quest aan een andere organisatie gekoppeld, dan blijven de gedownloade
cursussen van de vorige organisatie op de Quest staan, maar ze worden niet getoond. Ze houden ruimte
bezet die de gebruiker niet ziet en niet kan vrijmaken (bijv. een Quest van lang geleden die helemaal
vol staat). Mogelijke oplossingen: een overzicht van alle cursussen op de Quest waarin je cursussen van
andere organisaties kunt verwijderen, of alle geïnstalleerde cursussen tonen terwijl alleen die van de
eigen organisatie te spelen zijn. Nog te bepalen; let op constitutie III (nooit automatisch weggooien).

## Melding als een download klaar is

Editortest spec 003 (E10, 2026-11-25): een download loopt door als je het cursussenscherm sluit of een
oefencursus speelt, maar je merkt niet dat hij klaar is. Een duidelijke melding (bijv. een pop-up of een
regel in het menu: "Cursus X is gedownload") als de download klaar is, ook als het cursussenscherm dicht is.

## Waarschuwing bij verwijderen duidelijker

Editortest spec 003 (E13, 2026-11-25): de vraag "Deze cursus van de bril verwijderen?" staat op de kaart
in de plaats van de status en valt weinig op. Duidelijker maken, vooral bij een cursus die niet meer in het
CMS staat (die is na verwijderen niet opnieuw te downloaden; dat zou de vraag ook moeten zeggen).

## Nieuwe versie beschikbaar tonen

Editortest spec 003 (E14, 2026-11-25): een gedownloade cursus blijft op de oude versie staan (zo bedoeld in
spec 003), maar er staat nergens dat er een nieuwere versie is. Dat is FR-06-VR ("Update beschikbaar") en
FR-07-VR (zelf bijwerken, oude versie speelbaar tot de nieuwe binnen is); staat in de bouwvolgorde na het
afspelen (spec 004). De opslag per cursus en versie (spec 003 FR-007) is daar al op voorbereid.

## Reden tonen als je opnieuw moet koppelen

Editortest spec 003 (E16, 2026-11-25): na een vernieuwde koppelcode word je naar het koppelscherm gestuurd
zonder dat duidelijk is waarom. Spec 002 (FR-008) bedoelt dat daar "De koppelcode is veranderd. Vul de nieuwe
koppelcode in." staat; nagaan of die tekst verschijnt als het gebeurt tijdens een download (via de
coördinator) en hem zo nodig opvallender maken. Daarna hervat "Downloaden" wel gewoon waar hij was.

## Knop om de Quest te ontkoppelen

Editortest spec 003 (E17, 2026-11-25): er moet een knop komen om de Quest te ontkoppelen (bijv. om hem aan
een ander zwembad te geven). In spec 002 is bewust gekozen voor geen ontkoppelknop; dat besluit wordt hiermee
herzien. Samen bekijken met "Cursussen van andere organisaties op de Quest" (wat gebeurt er met de
gedownloade cursussen bij ontkoppelen).

## Alle teksten in VR nalopen

Editortest spec 003 (E20, 2026-11-25): de meldingen staan nu goed en leesbaar, maar de woorden zelf moeten
nog eens worden nagelopen. Alle teksten in `MenuTexts` (en de andere VR-teksten) samen met het team checken
op eenvoudig Nederlands, toon en lengte.
