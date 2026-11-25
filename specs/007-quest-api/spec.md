# Feature Specification: Quest-API in het CMS: een Quest koppelen en gepubliceerde cursussen ophalen en downloaden

**Feature Branch**: `Development` (spec-map: `specs/007-quest-api`)

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "spec 007: Quest-API in het CMS: een Quest koppelen en gepubliceerde
cursussen ophalen en downloaden (FR-01-VR, FR-02-VR, FR-03-VR, basis voor FR-06-VR). Dit is de brug
tussen het CMS en de Unity-app op de Quest. De app zelf valt buiten deze feature; deze feature gaat
echt over de API binnen het CMS. Een Quest koppelt zich met de koppelcode van een organisatie
(Organisation.questLinkCode) en krijgt daarmee alleen toegang tot de cursussen van die organisatie.
In het CMS kan de organisatie de koppelcode zien en vernieuwen; een oude code werkt daarna niet meer.
De Quest haalt de lijst op van cursussen die nu gepubliceerd zijn (de live versie uit feature 006):
naam, beschrijving, versienummer, publicatiedatum en downloadgrootte, zodat de Quest zelf kan zien
of er een nieuwere versie is dan de gedownloade. De Quest downloadt één cursus: de inhoud van de
live versie (onderdelen, vragen, antwoorden, route) en de video's die erin zitten. Video's gaan via
nginx; de API controleert alleen de toegang (constitutie III). Een onpubliceerde of verwijderde
cursus verschijnt niet meer in de lijst en is niet meer te downloaden. Ontwerp zo dat 'welke
cursussen ziet deze Quest' op één plek wordt bepaald, zodat overgenomen cursussen (FR-12) later
makkelijk kunnen worden toegevoegd. Buiten scope: de Unity-app, delen en overnemen (FR-12),
voortgang of leerresultaten (FR-15)."

**Bronnen**: `docs/Requirements.docx` FR-01-VR (koppelen via koppelcode, koppelcode zien en
vernieuwen in het CMS), FR-02-VR (cursussen tonen met naam, beschrijving, downloadgrootte, versie of
publicatiedatum), FR-03-VR (de hele cursus met alle video's in één keer downloaden), FR-06-VR
(nieuwe versie herkennen), FR-09-VR (een gedownloade cursus blijft op de Quest bruikbaar), FR-01
(organisatiecode is iets anders dan de koppelcode), FR-12 (overgenomen cursussen, later), NFR-03
(eenvoudige taal); ERD `docs/Diagrams.simp`, tabel `Organisation` (veld `questLinkCode`).
Bouwt voort op feature 001 (organisaties, koppelcode bij aanmaken), feature 002/003 (video's achter
toegangscontrole via nginx) en feature 006 (live versie, versienummer, publicatiedatum).

## Clarifications

### Session 2026-11-24

- Q: Wat gebeurt er met Quests die al met de oude code gekoppeld waren als de organisatie een
  nieuwe koppelcode maakt? → A: Ze worden direct afgesloten: elk volgend verzoek wordt geweigerd
  met "opnieuw koppelen nodig" tot ze met de nieuwe code gekoppeld zijn (FR-004).
- Q: Waar in het CMS ziet en vernieuwt de organisatie haar koppelcode? → A: Op een eigen pagina
  "Quest koppelen" in het menu, met de code, een korte uitleg en de knop "Nieuwe koppelcode maken"
  (FR-017).
- Q: Hoe streng moet het CMS het raden van koppelcodes afremmen? → A: Dat hoeft niet; er komt geen
  afremming van mislukte koppelpogingen in deze feature.
- Q: Hoe laat een gekoppelde Quest bij elk verzoek zien dat hij bij de organisatie hoort? → A: De
  Quest bewaart de koppelcode zelf en stuurt die bij elk verzoek mee. Er komt geen apart token,
  geen extra geheim in `.env` en geen nieuwe tabel. Na een nieuwe koppelcode klopt de bewaarde
  code niet meer en is de Quest direct afgesloten (FR-004).
- Q: Welke tests horen bij deze feature? → A: Unit- en integratietests van de backend horen bij de
  implementatie. De e2e-tests (Playwright) maakt het team zelf en vallen buiten de taken van deze
  feature.
- Q: Geeft de download feedback per antwoord of per vraag mee? → A: Eén feedbacktekst per vraag,
  zoals in het CMS (feature 004/005); de Quest toont hem na elk antwoord. Geen datamodelwijziging
  (FR-011).

## User Scenarios & Testing *(mandatory)*

De "gebruiker" van de API in deze feature is de Quest-app (een programma, geen mens). De
scenario's beschrijven daarom wat de Quest-app aan het CMS vraagt en wat hij terugkrijgt. Alleen
User Story 4 gaat over een persoon in het CMS.

### User Story 1 - Een Quest koppelen aan een organisatie (Priority: P1)

Op de Quest voert iemand van de organisatie de koppelcode in. De Quest-app geeft die code aan het
CMS. Klopt de code, dan hoort de Quest vanaf nu bij die organisatie en krijgt hij de naam van de
organisatie terug, zodat de app kan tonen waaraan hij gekoppeld is. Klopt de code niet, dan krijgt
de Quest geen toegang.

**Why this priority**: Zonder koppeling weet het CMS niet welke cursussen een Quest mag zien; alle
andere stories hangen hiervan af.

**Independent Test**: Stuur de koppelcode van organisatie A naar het CMS: het antwoord bevat de naam
van organisatie A en de Quest kan daarna de cursuslijst ophalen. Stuur een verzonnen code: het
antwoord is "ongeldige koppelcode" en de Quest kan niets ophalen.

**Acceptance Scenarios**:

1. **Given** organisatie A met een geldige koppelcode, **When** de Quest die code aanbiedt,
   **Then** is de Quest gekoppeld aan organisatie A en krijgt hij de naam van organisatie A terug.
2. **Given** een code die bij geen enkele organisatie hoort, **When** de Quest die aanbiedt,
   **Then** wordt het koppelen geweigerd met een melding die alleen zegt dat de code ongeldig is.
3. **Given** de organisatiecode waarmee organisatie A inlogt in het CMS (FR-01), **When** de Quest
   die als koppelcode aanbiedt, **Then** wordt het koppelen geweigerd; alleen de koppelcode werkt.
4. **Given** een code met kleine letters of spaties eromheen, **When** de Quest die aanbiedt,
   **Then** wordt hij behandeld als dezelfde code in hoofdletters zonder spaties.
5. **Given** een zacht verwijderde organisatie, **When** de Quest haar koppelcode aanbiedt,
   **Then** wordt het koppelen geweigerd.

---

### User Story 2 - De lijst met gepubliceerde cursussen ophalen (Priority: P1)

Een gekoppelde Quest vraagt welke cursussen er voor hem klaarstaan. Hij krijgt alle cursussen van
zijn organisatie die nu live zijn, met per cursus naam, beschrijving, versienummer,
publicatiedatum en downloadgrootte. Met het versienummer kan de Quest zelf zien of er een nieuwere
versie is dan die hij heeft gedownload.

**Why this priority**: Dit is wat de Quest als eerste toont (FR-02-VR) en de basis voor "update
beschikbaar" (FR-06-VR).

**Independent Test**: Geef organisatie A een gepubliceerde cursus, een cursus met alleen een
concept, een onpubliceerde en een verwijderde cursus, en organisatie B een gepubliceerde cursus.
Een Quest van A krijgt precies één cursus terug, met de gegevens van de live versie.

**Acceptance Scenarios**:

1. **Given** een Quest gekoppeld aan organisatie A, **When** hij de lijst ophaalt, **Then** bevat
   die alle cursussen van A met een live versie, elk met naam, beschrijving, versienummer,
   publicatiedatum en downloadgrootte van die live versie.
2. **Given** een cursus van A die nooit gepubliceerd is, onpubliceerd is of (zacht) verwijderd is,
   **When** de Quest de lijst ophaalt, **Then** staat die cursus er niet in.
3. **Given** cursussen van organisatie B, **When** een Quest van A de lijst ophaalt, **Then** staat
   geen enkele cursus van B erin.
4. **Given** een gepubliceerde cursus waarvan het concept intussen is gewijzigd maar niet opnieuw
   gepubliceerd, **When** de Quest de lijst ophaalt, **Then** ziet hij naam, beschrijving en
   versienummer van de live versie, niet van het concept.
5. **Given** een cursus die opnieuw is gepubliceerd (versie 2), **When** de Quest de lijst ophaalt,
   **Then** ziet hij versienummer 2, zodat een Quest met versie 1 weet dat er een update is.
6. **Given** organisatie A zonder gepubliceerde cursussen, **When** de Quest de lijst ophaalt,
   **Then** krijgt hij een lege lijst (geen fout).

---

### User Story 3 - Eén cursus downloaden (Priority: P1)

De Quest kiest een cursus uit de lijst en haalt de volledige inhoud van de live versie op: de
onderdelen, de vragen (met hun feedback) en antwoorden (met goed/fout), de route (welk antwoord of
onderdeel naar welk volgend onderdeel gaat, en het startonderdeel) en een lijst van de video's die
erin zitten. Daarna haalt de Quest elke video op. Het CMS controleert per video of deze Quest hem
mag hebben; de bytes zelf komen van nginx.

**Why this priority**: Zonder downloaden kan de Quest de cursus niet doorlopen; dit sluit de
kernworkflow maken → publiceren → downloaden → uitvoeren.

**Independent Test**: Publiceer een cursus met twee video-onderdelen en een vraag. Download hem
met een gekoppelde Quest: de inhoud komt overeen met de live versie, beide video's zijn op te halen
en hun grootte samen klopt met de downloadgrootte uit de lijst. Een video uit een cursus van een
andere organisatie is niet op te halen.

**Acceptance Scenarios**:

1. **Given** een live cursus van de eigen organisatie, **When** de Quest hem downloadt, **Then**
   krijgt hij in één antwoord de volledige inhoud van de live versie: cursusnaam, beschrijving,
   versienummer, publicatiedatum, startonderdeel, alle onderdelen met hun soort, vraagteksten
   met de feedback van de vraag, antwoorden met tekst en goed/fout, en per antwoord of onderdeel het volgende
   onderdeel (of dat het een einde is).
2. **Given** die inhoud, **When** de Quest de lijst met video's bekijkt, **Then** staat elke video
   uit de live versie er precies één keer in (ook als hij in meerdere onderdelen zit), met een
   vaste aanduiding, de bestandsgrootte en een adres om hem op te halen.
3. **Given** een video uit de live versie van een cursus die deze Quest mag zien, **When** de Quest
   hem ophaalt, **Then** krijgt hij het bestand, ook als hij het in delen ophaalt (hervatten na een
   onderbroken download).
4. **Given** een video die de eigenaar intussen zacht heeft verwijderd of heeft beperkt, maar die
   in de live versie zit, **When** de Quest hem ophaalt, **Then** krijgt hij het bestand gewoon
   (constitutie V, feature 006 FR-012/FR-014).
5. **Given** een video die niet in de live versie van een cursus zit die deze Quest mag zien (een
   video uit het concept, uit een oude versie, uit de videobibliotheek of van een andere
   organisatie), **When** de Quest hem ophaalt, **Then** wordt dat geweigerd.
6. **Given** een cursus van een andere organisatie, een cursus zonder live versie of een
   verwijderde cursus, **When** de Quest hem wil downloaden, **Then** wordt dat geweigerd alsof de
   cursus niet bestaat.
7. **Given** de inhoud van de live versie, **When** de Quest hem downloadt, **Then** zit er niets
   in wat alleen voor het CMS is (zoals de plaats van blokken op het canvas of gegevens van het
   concept).

---

### User Story 4 - De koppelcode zien en vernieuwen in het CMS (Priority: P2)

Iemand van de organisatie wil een Quest koppelen en zoekt de koppelcode op in het CMS. Is de code
uitgelekt, of wil de organisatie oude Quests afsluiten, dan maakt zij een nieuwe koppelcode aan. De
oude code werkt daarna niet meer: niet om te koppelen, en Quests die met de oude code gekoppeld
waren, krijgen geen toegang meer tot de cursussen en video's tot ze opnieuw gekoppeld zijn met de
nieuwe code.

**Why this priority**: Nodig voor het koppelen in de praktijk en voor de veiligheid, maar zonder
deze schermen is de API met een bekende code (bijvoorbeeld uit de beheeromgeving) al te testen.

**Independent Test**: Open in het CMS de pagina "Quest koppelen": de code van de eigen organisatie
staat er. Vernieuw hem en bevestig: er staat een andere code, de oude code wordt geweigerd bij
koppelen, een Quest die met de oude code gekoppeld was kan de lijst niet meer ophalen, en de
nieuwe code werkt.

**Acceptance Scenarios**:

1. **Given** een ingelogde organisatie, **When** zij via het menu de pagina "Quest koppelen" opent,
   **Then** ziet zij haar eigen koppelcode, goed leesbaar, met een korte uitleg in eenvoudige
   taal waarvoor de code dient en dat het iets anders is dan de organisatiecode om in te loggen.
2. **Given** die pagina, **When** zij op "Nieuwe koppelcode maken" klikt, **Then** verschijnt een
   bevestiging in eenvoudige taal die zegt dat de oude code daarna niet meer werkt en dat alle
   Quests van de organisatie opnieuw gekoppeld moeten worden met de nieuwe code.
3. **Given** die bevestiging, **When** zij bevestigt, **Then** heeft de organisatie een nieuwe,
   unieke koppelcode, die meteen in beeld staat.
4. **Given** die bevestiging, **When** zij annuleert, **Then** verandert er niets.
5. **Given** een vernieuwde koppelcode, **When** een Quest de oude code aanbiedt of een Quest die
   met de oude code was gekoppeld iets ophaalt (lijst, cursus of video), **Then** wordt dat
   geweigerd met een antwoord waaruit de app kan opmaken dat opnieuw koppelen nodig is.
6. **Given** organisatie A, **When** zij de koppelcode ziet of vernieuwt, **Then** gaat dat alleen
   over haar eigen code; de code van een andere organisatie is niet te zien of te wijzigen.

---

### Edge Cases

- **Cursus onpubliceerd of verwijderd tijdens het downloaden**: Begint de Quest aan een download en
  wordt de cursus daarna onpubliceerd of verwijderd, dan worden de video's die nog niet zijn
  opgehaald geweigerd. Wat de Quest al heeft, blijft op de Quest (FR-09-VR, buiten het CMS).
- **Nieuwe versie gepubliceerd tijdens het downloaden**: De inhoud die de Quest al heeft opgehaald,
  hoort bij één versie (met versienummer). Video's die in die versie zaten maar niet meer in de
  nieuwe live versie, worden daarna geweigerd; de app ziet dan aan het versienummer in de lijst dat
  hij opnieuw moet downloaden. Een download levert nooit een mengsel van twee versies op.
- **Koppelcode vernieuwd tijdens het downloaden**: Vanaf dat moment worden verdere verzoeken van die
  Quest geweigerd (FR-004).
- **Dezelfde video in meerdere cursussen**: Hij mag worden opgehaald zolang hij in de live versie
  van minstens één cursus zit die deze Quest mag zien. Hij staat in elke cursus met dezelfde vaste
  aanduiding, zodat de app hem maar één keer hoeft te bewaren (FR-04-VR).
- **Video uit de centrale videobibliotheek van een andere organisatie** (feature 003): zit hij in de
  live versie van een cursus van de eigen organisatie, dan mag de Quest hem ophalen, ook als de
  eigenaar hem intussen heeft beperkt of verwijderd.
- **Videobestand ontbreekt op schijf**: De download van die video mislukt met een fout; de lijst en
  de cursusinhoud blijven werken. In productie legt nginx dit vast in zijn foutlog; zonder nginx
  (ontwikkeling) logt de API de fout.
- **Onjuiste of ontbrekende koppeling**: Elk verzoek zonder geldige koppeling (lijst, cursus of
  video) wordt geweigerd zonder iets over cursussen of organisaties prijs te geven.
- **Raden van koppelcodes**: Herhaald proberen met verkeerde codes wordt niet afgeremd
  (Clarifications). Elke foute poging krijgt hetzelfde antwoord "ongeldige koppelcode" (FR-002);
  wie vermoedt dat de code bekend is, maakt een nieuwe (FR-018).
- **Ingelogd in het CMS maar geen Quest**: Een sessie van het CMS (organisatie of beheerder) geeft
  geen toegang tot de Quest-verzoeken, en een Quest-koppeling geeft geen toegang tot het CMS.
- **Grote cursus**: Een cursus van 50 onderdelen wordt binnen de tijd van SC-003 als inhoud
  teruggegeven.
- **Veel cursussen**: Een organisatie met 100 gepubliceerde cursussen krijgt ze allemaal in de
  lijst, binnen de tijd van SC-002.

## Requirements *(mandatory)*

### Functional Requirements

**Koppelen**

- **FR-001**: Het CMS MUST een Quest laten koppelen met de koppelcode van een organisatie
  (`Organisation.questLinkCode`). Bij een geldige code van een niet-verwijderde organisatie MUST
  de Quest de naam van de organisatie terugkrijgen; daarna doet hij de volgende verzoeken met
  diezelfde koppelcode (Clarifications). Hoofdletters/kleine letters en spaties rond de code MUST NOT uitmaken.
- **FR-002**: Een ongeldige code, de organisatiecode om in te loggen, of de code van een verwijderde
  organisatie MUST worden geweigerd met één en hetzelfde antwoord ("ongeldige koppelcode"), zodat
  niet af te leiden is of een code ooit heeft bestaan. Mislukte pogingen worden in deze feature
  niet afgeremd (Clarifications).
- **FR-003**: Een koppeling MUST precies bij één organisatie horen en alleen toegang geven tot wat
  FR-008 voor die organisatie bepaalt. Ze MUST NOT toegang geven tot het CMS, en een CMS-sessie
  MUST NOT toegang geven tot de Quest-verzoeken.
- **FR-004**: Een koppeling MUST alleen werken zolang de koppelcode die de Quest meestuurt nog de
  geldige code van de organisatie is en de organisatie niet verwijderd is. Na het vernieuwen van de
  code (FR-018) of het verwijderen van de organisatie MUST elk verzoek met die koppeling worden
  geweigerd met een antwoord dat de app herkent als "opnieuw koppelen nodig", verschillend van
  "niet gevonden".
- **FR-005**: Een koppeling MUST NOT na een vaste tijd verlopen zolang FR-004 niet van toepassing
  is; een Quest hoeft niet periodiek opnieuw gekoppeld te worden.

**Welke cursussen ziet deze Quest**

- **FR-006**: Welke cursussen een Quest mag zien en downloaden, MUST op één plek worden bepaald en
  door de lijst (FR-009), het downloaden (FR-011) en de toegang tot video's (FR-014) worden
  gebruikt. Er MUST geen tweede, afwijkende regel bestaan.
- **FR-007**: In deze feature ziet een Quest precies de cursussen van de eigen organisatie met een
  live versie (feature 006): gepubliceerd, niet onpubliceerd, niet (zacht) verwijderd. Van elke
  cursus is alleen de live versie zichtbaar, nooit het concept of een oudere versie.
- **FR-008**: Het ontwerp van FR-006 MUST ruimte laten om later cursussen toe te voegen die de
  organisatie uit de centrale cursusbibliotheek heeft overgenomen (FR-12), zonder de lijst, het
  downloaden of de videotoegang te hoeven aanpassen.

**Lijst**

- **FR-009**: Een gekoppelde Quest MUST de lijst kunnen ophalen van alle cursussen die hij volgens
  FR-007 ziet, met per cursus: een vaste aanduiding van de cursus (gelijk over versies heen),
  naam, beschrijving, versienummer en publicatiedatum (datum en tijd met tijdzone) van de live
  versie, en de downloadgrootte.
- **FR-010**: De downloadgrootte MUST de totale grootte in bytes zijn van wat de Quest voor die
  cursus ophaalt: de video's uit de live versie (elke video één keer geteld) plus de cursusinhoud.
  Ze MUST overeenkomen met de som van de bestandsgroottes die bij het downloaden worden genoemd
  (FR-012).

**Downloaden**

- **FR-011**: Een gekoppelde Quest MUST de inhoud van één cursus die hij volgens FR-007 ziet, in
  één antwoord kunnen ophalen. De inhoud MUST precies de live versie zijn: naam, beschrijving,
  versienummer, publicatiedatum, het startonderdeel, alle onderdelen (soort, en voor een
  video-onderdeel welke video; voor een vraag de vraagtekst en de feedback van de vraag, één tekst voor
  alle antwoorden samen), alle antwoorden (tekst, goed of fout) en de route (per antwoord of video-onderdeel het volgende onderdeel, of dat het een
  einde is). Gegevens die alleen voor de editor zijn, zoals de plaats op het canvas, MUST NOT
  worden meegestuurd.
- **FR-012**: De inhoud MUST een lijst bevatten van alle video's in de live versie, elke video één
  keer, met een vaste aanduiding van de video (gelijk in alle cursussen en versies waarin hij zit),
  de bestandsgrootte in bytes en het adres waar de Quest hem ophaalt. Onderdelen MUST naar deze
  aanduiding verwijzen.
- **FR-013**: Een cursus die de Quest volgens FR-007 niet ziet (andere organisatie, geen live
  versie, verwijderd, of niet bestaand) MUST worden geweigerd met hetzelfde antwoord "niet
  gevonden".

**Video's**

- **FR-014**: Een gekoppelde Quest MUST een video kunnen ophalen als die video in de live versie zit
  van minstens één cursus die hij volgens FR-006 ziet, ook als de eigenaar de video zacht heeft
  verwijderd of in beschikbaarheid heeft beperkt (constitutie V; feature 006 FR-012 en FR-014).
  Anders MUST het ophalen worden geweigerd.
- **FR-015**: Het CMS MUST bij een video alleen de toegang controleren; de videobytes MUST door de
  webserver worden geleverd, niet door de applicatie zelf (constitutie III). Ophalen in delen
  (hervatten van een onderbroken download) MUST werken.
- **FR-016**: Het adres van een video MUST NOT zonder geldige koppeling bruikbaar zijn; wie alleen
  het adres kent, krijgt het bestand niet.

**Koppelcode in het CMS**

- **FR-017**: Een ingelogde organisatie MUST haar eigen koppelcode kunnen zien op een eigen pagina
  "Quest koppelen", bereikbaar vanuit het menu van het CMS, met een korte uitleg in eenvoudige taal (NFR-03) dat de Quest hiermee aan de organisatie wordt gekoppeld
  en dat het iets anders is dan de organisatiecode om in te loggen.
- **FR-018**: Een ingelogde organisatie MUST een nieuwe koppelcode kunnen maken, na een bevestiging
  in eenvoudige taal die zegt dat de oude code daarna niet meer werkt en dat alle Quests opnieuw
  gekoppeld moeten worden. De nieuwe code MUST dezelfde vorm hebben als nu (feature 001), uniek zijn
  over alle organisatiecodes en koppelcodes heen (ook van verwijderde organisaties) en meteen in
  beeld staan. Annuleren MUST niets veranderen.
- **FR-019**: Een organisatie MUST NOT de koppelcode van een andere organisatie kunnen zien of
  vernieuwen, ook niet buiten de interface om.

**Algemeen**

- **FR-020**: De antwoorden aan de Quest MUST een vaste, gedocumenteerde vorm hebben, zodat de
  Quest-app ze kan gebruiken zonder het CMS te kennen. Wijzigingen die bestaande apps breken, MUST
  vermeden worden of herkenbaar zijn (versie van de Quest-API).
- **FR-021**: Teksten die een persoon in het CMS ziet, MUST in het Nederlands zijn, in eenvoudige
  taal (NFR-03). Meldingen in antwoorden aan de Quest MUST een vaste, Engelstalige foutcode hebben
  (constitutie VI) en een Nederlandse tekst die de app kan tonen.
- **FR-022**: Het CMS MUST NOT bijhouden welke Quest welke cursus heeft gedownload of hoe ver een
  cursist is; voortgang en resultaten (FR-15) vallen buiten deze feature.

### Key Entities *(include if feature involves data)*

- **Organisation** (bestaat, ERD): heeft één geldige koppelcode (`questLinkCode`). Vernieuwen
  vervangt de code; de oude code wordt niet bewaard als geldige code.
- **Quest-koppeling**: de koppelcode die de Quest na een geslaagde koppeling bewaart en bij elk
  verzoek meestuurt. Ze hoort bij één organisatie en werkt alleen zolang die code de geldige code
  van de organisatie is (FR-004). Het CMS slaat hiervoor niets nieuws op en het ERD verandert niet
  (Clarifications). Individuele Quests worden niet geregistreerd of beheerd in deze feature.
- **Course** en **CourseVersion** (bestaan, feature 006): de lijst en de download tonen alleen de
  live versie. Versienummer en publicatiedatum komen van die versie.
- **CourseStep** en **Answer** (bestaan): vormen de inhoud en de route van de download.
- **Video** (bestaat): bestand op schijf met grootte; mag door een Quest worden opgehaald zolang hij
  in een live versie zit die de Quest ziet (FR-014).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0% van de verzoeken zonder geldige koppeling, of voor een cursus of video van een
  andere organisatie, levert een cursus, cursusinhoud of videobestand op (getoetst voor lijst,
  cursus en video, ook met bekende adressen).
- **SC-002**: De lijst van een organisatie met 100 gepubliceerde cursussen is binnen 2 seconden
  opgehaald.
- **SC-003**: De inhoud van een cursus van 50 onderdelen is binnen 2 seconden opgehaald.
- **SC-004**: In 100% van de geteste situaties (nooit gepubliceerd, gepubliceerd, gewijzigd na
  publiceren, opnieuw gepubliceerd, onpubliceerd, verwijderd) klopt de lijst met de status in het
  CMS: een cursus staat erin dan en slechts dan als het CMS hem als gepubliceerd toont, met
  hetzelfde versienummer en dezelfde publicatiedatum.
- **SC-005**: Binnen 5 seconden na het vernieuwen van de koppelcode wordt 100% van de verzoeken met
  de oude code of met een daarmee gemaakte koppeling geweigerd, en werkt koppelen met de nieuwe
  code.
- **SC-006**: Voor elke gedownloade cursus is de downloadgrootte uit de lijst gelijk aan de som van
  de bestandsgroottes van de opgehaalde video's plus de inhoud, en is elke genoemde video op te
  halen (ook zacht verwijderde video's uit de live versie).
- **SC-007**: Iemand van de organisatie zonder technische kennis vindt zonder hulp binnen 1
  minuut de koppelcode in het CMS.
- **SC-008**: Een onderbroken videodownload kan worden hervat vanaf het punt waar hij stopte, zonder
  opnieuw te beginnen.

## Assumptions

- De Quest-app wordt in een andere feature (en een ander project) gebouwd; deze feature is te testen
  met verzoeken naar de API (geautomatiseerde tests), zonder Quest.
- Een Quest hoort bij precies één organisatie (FR-01-VR). Opnieuw koppelen met een andere code
  vervangt de koppeling; dat regelt de app.
- Het vernieuwen van de koppelcode sluit alle Quests van de organisatie af die met de oude code
  gekoppeld waren (de code is mogelijk uitgelekt). Individuele Quests afsluiten zonder de code te
  vernieuwen valt buiten deze feature.
- Iedereen die is ingelogd als de organisatie (feature 001) mag de koppelcode zien en vernieuwen;
  er is geen aparte rol. De beheerder ziet de koppelcode al bij het aanmaken van een organisatie
  (feature 001); vernieuwen door de beheerder valt buiten deze feature.
- De koppelcode behoudt de vorm uit feature 001 (8 tekens uit een alfabet zonder verwarrende
  tekens), zodat hij op de Quest met een controller in te voeren is.
- "Versie" voor de Quest is het versienummer van de live versie (feature 006). Een hoger nummer
  betekent nieuwere inhoud; een cursus die na onpubliceren opnieuw live gaat zonder wijzigingen
  houdt hetzelfde nummer (feature 006 FR-017), dus de Quest ziet dan geen onnodige update.
- De Quest bepaalt zelf de status "niet gedownload", "gedownload" of "update beschikbaar" (FR-02-VR,
  FR-05-VR, FR-06-VR) door de lijst te vergelijken met wat hij heeft; het CMS houdt dat niet bij.
- De Quest haalt de cursusinhoud en de video's in losse verzoeken op; "in één keer downloaden"
  (FR-03-VR) is de taak van de app.
- Thumbnails van video's zijn niet nodig op de Quest en worden niet meegestuurd.
- Buiten scope: de Unity-app; delen, overnemen en de centrale cursusbibliotheek (FR-12; alleen het
  ontwerp houdt er rekening mee, FR-008); voortgang en leerresultaten (FR-15); een overzicht in het
  CMS van gekoppelde Quests; het bijhouden van downloads.
