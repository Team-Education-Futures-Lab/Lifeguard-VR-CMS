# Feature Specification: Cursussen delen en de centrale cursusbibliotheek (FR-12, deel 1)

**Feature Branch**: `Development` (spec-map: `specs/009-course-sharing-library`)

**Created**: 2026-11-26

**Status**: Draft

**Input**: User description: "spec 009: Cursussen delen en de centrale cursusbibliotheek (FR-12,
deel 1). Bij het publiceren kiest de organisatie de beschikbaarheid van de cursus, net als bij
video's (FR-14): algemeen beschikbaar, selectief beschikbaar (de organisatie kiest welke
organisaties) of alleen eigen organisatie (zoals nu in feature 006). Gedeelde cursussen staan in
een centrale cursusbibliotheek; een organisatie ziet daarin alleen de cursussen die voor haar
beschikbaar zijn, en alleen originele cursussen. Bevat een cursus video's die niet algemeen
beschikbaar zijn, dan krijgt de eigenaar bij het delen een waarschuwing (doorgaan of annuleren).
Verwijdert of onpubliceert de eigenaar een cursus, dan verdwijnt hij uit de bibliotheek. Bouw voort
op feature 006 (publiceren en versies) en op hoe beschikbaarheid bij video's werkt (feature 003).
Het uiteindelijke doel van deze library is dat andere organisaties een cursus kunnen gebruiken als
eigen cursus, dus houd hier rekening mee. Buiten scope (volgende spec, zie docs/backlog.md): een
cursus overnemen als verwijzing, een eigen kopie bij aanpassen, meldingen bij een nieuwe versie,
overgenomen cursussen in de Quest-API, en het echt opruimen van verwijderde cursussen."

**Bronnen**: `docs/Requirements.docx` FR-12 (delen en overnemen; dit is deel 1), FR-09 (bij het
publiceren kiest de gebruiker de beschikbaarheid), FR-13 en FR-14 (zachte verwijdering en
beschikbaarheid van video's), NFR-03 (eenvoudige taal); ERD `docs/Diagrams.simp`, tabellen
`Course` (velden `parentCourseId`, `isSharedInLibrary`), `OrganisationCourse` (veld `isOwner`) en
`VideoAccess` (voorbeeld voor selectieve toegang). Bouwt voort op feature 001 (organisaties,
afscherming), feature 003 (beschikbaarheid van video's, de centrale videobibliotheek), feature 006
(publiceren, live versie, FR-011 "ruimte voor beschikbaarheid") en feature 008 (thumbnail per
cursus). `docs/backlog.md`, "Gedeelde cursussen overnemen (FR-12, deel 2)", beschrijft het vervolg.

## Clarifications

### Session 2026-11-26

- Q: Mag een andere organisatie in deel 1 de volledige inhoud van een gedeelde cursus
  alleen-lezen bekijken, of alleen de samenvatting? → A: Alleen de samenvatting (FR-017). De
  volledige inhoud alleen-lezen bekijken is een apart item op `docs/backlog.md` ("Inhoud van een
  gedeelde cursus alleen-lezen bekijken"), zodat deze spec klein blijft.
- Q: Mag de eigenaar de beschikbaarheid van een live cursus wijzigen zonder opnieuw te publiceren?
  → A: Ja, via "Beschikbaarheid wijzigen" in het publicatiemenu, zonder nieuwe versie, zoals bij
  video's (FR-006, User Story 4).
- Q: Wanneer verschijnt de waarschuwing over video's die niet algemeen beschikbaar zijn? → A: Alleen
  als er meer gedeeld wordt: de cursus wordt voor het eerst gedeeld, de groep organisaties wordt
  groter, of een nieuwe versie bevat beperkte video's die niet in de vorige gedeelde live versie
  zaten (dan alleen die nieuwe video's) (FR-010).
- Q: Ziet een organisatie haar eigen gedeelde cursussen ook in de cursusbibliotheek? → A: Ja, eigen
  cursussen met "Algemeen beschikbaar" of "Selectief beschikbaar" staan erin met de pil "Eigen";
  cursussen met "Alleen eigen organisatie" niet (FR-014, FR-015).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Beschikbaarheid kiezen bij het publiceren (Priority: P1)

De docent publiceert een cursus en kiest in de bevestiging van het publiceren wie de cursus mag
zien in de centrale cursusbibliotheek: alle organisaties ("Algemeen beschikbaar"), alleen gekozen
organisaties ("Selectief beschikbaar") of alleen de eigen organisatie ("Alleen eigen organisatie").
Dat werkt en ziet eruit zoals bij video's (feature 003).

**Why this priority**: Dit is de kern van deel 1 van FR-12: zonder een keuze bij het publiceren
kan geen enkele cursus gedeeld worden en blijft elke organisatie alles zelf maken.

**Independent Test**: Als organisatie A drie complete cursussen publiceren, één met elke
beschikbaarheid (de selectieve voor organisatie B). Daarna als B en als C de cursusbibliotheek
openen en controleren welke cursussen elk ziet.

**Acceptance Scenarios**:

1. **Given** een complete cursus die nog nooit gepubliceerd is, **When** de docent op
   "Publiceren" klikt, **Then** bevat de bevestiging het veld "Beschikbaarheid" met de drie keuzes,
   en is "Alleen eigen organisatie" al geselecteerd.
2. **Given** een cursus die al eerder gepubliceerd is (ook als hij intussen onpubliceerd is),
   **When** de docent opnieuw publiceert, **Then** is in de bevestiging de laatst gekozen
   beschikbaarheid (met, bij "Selectief beschikbaar", de gekozen organisaties) al ingevuld en kan
   de docent die aanpassen.
3. **Given** de docent kiest "Selectief beschikbaar", **When** de keuze is gemaakt, **Then** kan
   de docent een of meer organisaties aanvinken uit een lijst met de namen van alle andere actieve
   organisaties, en kan er pas gepubliceerd worden als er minstens één is gekozen.
4. **Given** de bevestiging, **When** de docent annuleert, **Then** verandert er niets: niet aan
   de cursus, niet aan de versies en niet aan de beschikbaarheid.
5. **Given** een gepubliceerde cursus met "Alleen eigen organisatie", **When** een andere
   organisatie de cursusbibliotheek opent of de cursus op een andere manier probeert op te vragen,
   **Then** ziet zij hem niet en wordt elke poging geweigerd alsof de cursus niet bestaat.
6. **Given** een cursus die voor de invoering van deze feature al gepubliceerd was, **When** deze
   feature in gebruik komt, **Then** heeft hij "Alleen eigen organisatie" en staat hij niet in de
   bibliotheek van andere organisaties.

---

### User Story 2 - Gedeelde cursussen vinden in de centrale cursusbibliotheek (Priority: P1)

Een docent opent de nieuwe pagina "Cursusbibliotheek" en ziet de gedeelde cursussen die voor de
eigen organisatie beschikbaar zijn, met bij elke cursus van wie hij is. Zo kan een organisatie
zien welke cursussen er al bestaan voordat zij er zelf een maakt; in deel 2 kan zij een cursus
uit deze bibliotheek overnemen als eigen cursus.

**Why this priority**: Zonder de bibliotheek heeft delen geen zichtbaar effect; het is de plek
waar organisaties elkaars cursussen vinden, en de basis voor overnemen in deel 2.

**Independent Test**: A deelt een cursus algemeen en B deelt een cursus selectief met A. Als A de
cursusbibliotheek openen: beide cursussen staan erin, de cursus van B met de pil "B"; de eigen
cursus van A staat erin met de pil "Eigen". Als C openen: alleen de cursus van A.

**Acceptance Scenarios**:

1. **Given** gedeelde cursussen die voor de organisatie beschikbaar zijn, **When** de docent de
   cursusbibliotheek opent, **Then** staan ze in één lijst met per cursus de thumbnail (feature
   008, of een neutrale afbeelding als er geen is), naam, beschrijving (ingekort), eigenaar,
   versienummer en publicatiedatum van de live versie, en het aantal onderdelen.
2. **Given** een cursus van een andere organisatie, **When** hij in de bibliotheek staat,
   **Then** heeft hij een duidelijk zichtbare pil met de naam van de eigenaar, zoals bij video's
   (feature 003, FR-009); een eigen gedeelde cursus heeft de neutrale pil "Eigen".
3. **Given** een cursus die gepubliceerd is met wijzigingen die nog niet gepubliceerd zijn,
   **When** een andere organisatie hem in de bibliotheek ziet, **Then** ziet zij alleen de live
   versie, nooit het concept.
4. **Given** een cursus die selectief gedeeld is met B, **When** B en C de bibliotheek openen,
   **Then** ziet B hem en C niet; B ziet niet met welke organisaties de cursus verder gedeeld is.
5. **Given** de bibliotheek, **When** de docent zoekt, sorteert of filtert, **Then** werken
   zoeken (naam, beschrijving, eigenaar), sorteren (naam, publicatiedatum) en filteren ("Alle
   cursussen", "Eigen cursussen", "Van andere organisaties", en klikken op een eigenaar-pil) samen,
   zoals in de videobibliotheek.
6. **Given** een cursus in de bibliotheek, **When** de docent erop klikt, **Then** opent een
   venster boven de bibliotheek met de gegevens van de live versie: thumbnail, naam, volledige
   beschrijving, eigenaar, versienummer, publicatiedatum, aantal onderdelen en aantal video's;
   na sluiten staat de lijst er precies zo als ervoor.
7. **Given** een cursus van een andere organisatie in de bibliotheek, **When** de docent hem
   bekijkt, **Then** zijn er geen knoppen om hem te bewerken, te publiceren, te onpubliceren of te
   verwijderen, en wordt elke poging om dat toch te doen geweigerd.
8. **Given** de bibliotheek zonder cursussen of zonder zoekresultaten, **When** de lijst leeg is,
   **Then** staat er in gewone taal dat er (nog) geen gedeelde cursussen zijn, of "Geen cursussen
   gevonden" met een knop om zoekterm en filters te wissen.

---

### User Story 3 - Waarschuwing bij video's die niet algemeen beschikbaar zijn (Priority: P1)

Deelt de eigenaar een cursus met andere organisaties en zitten daar video's in die niet algemeen
beschikbaar zijn, dan waarschuwt het systeem eerst. De eigenaar ziet welke video's het zijn en
kiest "Doorgaan" of "Annuleren".

**Why this priority**: Zonder deze waarschuwing kan een organisatie zonder het te merken video's
die zij bewust niet heeft gedeeld, via een cursus toch aan andere organisaties laten zien. Bij
overnemen (deel 2) mogen ontvangers deze video's zelfs blijvend in hun cursus gebruiken
(FR-12, niet terug te draaien), dus de eigenaar moet hier bewust ja op zeggen.

**Independent Test**: Een cursus met één video "Alleen eigen organisatie" en één video "Algemeen
beschikbaar" publiceren met "Algemeen beschikbaar": de waarschuwing noemt alleen de eerste video.
Annuleren: er is niets gepubliceerd of gedeeld. Doorgaan: de cursus is gepubliceerd en staat in
de bibliotheek.

**Acceptance Scenarios**:

1. **Given** een cursus met een of meer video's die niet "Algemeen beschikbaar" zijn, **When** de
   eigenaar publiceert met "Algemeen beschikbaar" of "Selectief beschikbaar", **Then** verschijnt
   een waarschuwing in eenvoudige taal met de namen van die video's, die zegt dat organisaties
   waarmee de cursus gedeeld wordt deze video's binnen de cursus mogen gebruiken als zij de
   cursus overnemen, met de knoppen "Doorgaan" en "Annuleren".
2. **Given** die waarschuwing, **When** de eigenaar op "Annuleren" klikt, **Then** wordt er niets
   gepubliceerd en verandert de beschikbaarheid niet; de eigenaar keert terug naar de bevestiging
   en kan een andere beschikbaarheid kiezen.
3. **Given** die waarschuwing, **When** de eigenaar op "Doorgaan" klikt, **Then** wordt de cursus
   gepubliceerd met de gekozen beschikbaarheid.
4. **Given** een cursus met alleen algemeen beschikbare video's (of zonder video's), **When** de
   eigenaar hem deelt, **Then** verschijnt er geen waarschuwing.
5. **Given** een cursus met "Alleen eigen organisatie", **When** de eigenaar publiceert, **Then**
   verschijnt er geen waarschuwing, ook niet als er beperkte video's in zitten.
6. **Given** de waarschuwing telt mee: video's die de eigenaar zelf beperkt heeft (selectief of
   alleen eigen organisatie), video's van een andere organisatie die selectief met de eigenaar
   gedeeld zijn, en video's die intussen verwijderd zijn maar in de cursus blijven werken
   (feature 006, FR-012), **When** zo'n cursus gedeeld wordt, **Then** staan al deze video's in de
   waarschuwing.

---

### User Story 4 - Beschikbaarheid van een gepubliceerde cursus wijzigen (Priority: P2)

De eigenaar wil een gepubliceerde cursus breder of minder breed delen zonder de inhoud opnieuw te
publiceren. In het publicatiemenu kiest de eigenaar "Beschikbaarheid wijzigen".

**Why this priority**: Organisaties moeten een vergissing kunnen herstellen of later besluiten een
cursus te delen; bij video's kan dat ook (feature 003). Voor de eerste werkende versie is de keuze
bij het publiceren het belangrijkst.

**Independent Test**: Een algemeen gedeelde cursus wijzigen naar "Selectief beschikbaar" voor B:
na bevestiging ziet C hem niet meer en B wel, en versienummer en publicatiedatum zijn ongewijzigd.

**Acceptance Scenarios**:

1. **Given** een cursus met een live versie, **When** de eigenaar het publicatiemenu opent,
   **Then** staat daar "Beschikbaarheid wijzigen"; bij een cursus zonder live versie niet.
2. **Given** de eigenaar maakt de beschikbaarheid ruimer, **When** hij opslaat, **Then** geldt de
   nieuwe beschikbaarheid direct, met eerst de waarschuwing van User Story 3 als de live versie
   video's bevat die niet algemeen beschikbaar zijn.
3. **Given** de eigenaar maakt de beschikbaarheid beperkter, **When** daardoor organisaties de
   cursus niet meer zien, **Then** vraagt het systeem eerst "<aantal> organisaties kunnen deze
   cursus daarna niet meer zien in de cursusbibliotheek." (bij één: "1 organisatie kan …"), met
   "Wijzigen" en "Annuleren", zoals bij video's (feature 003, FR-017a).
4. **Given** een wijziging van de beschikbaarheid, **When** die is opgeslagen, **Then** blijven
   versienummer, publicatiedatum en de status van de cursus (feature 006, FR-018) gelijk, en
   verandert er niets voor de Quests van de eigen organisatie.

---

### User Story 5 - Uit de bibliotheek bij onpubliceren of verwijderen (Priority: P2)

Onpubliceert of verwijdert de eigenaar een gedeelde cursus, dan verdwijnt hij meteen uit de
cursusbibliotheek van alle organisaties. De bevestiging zegt dat.

**Why this priority**: Een organisatie moet erop kunnen rekenen dat een ingetrokken of verwijderde
cursus niet meer door anderen gevonden wordt; dit hoort bij publiceren en verwijderen (feature
006).

**Independent Test**: Een algemeen gedeelde cursus onpubliceren: hij staat niet meer in de
bibliotheek van B. Opnieuw publiceren: de vorige beschikbaarheid is voorgesteld en na bevestigen
staat hij er weer. Verwijderen: hij staat er niet meer in en is ook niet meer op te vragen.

**Acceptance Scenarios**:

1. **Given** een gedeelde cursus, **When** de eigenaar onpubliceert, **Then** verdwijnt hij uit de
   bibliotheek van alle organisaties, en zegt de bevestiging van onpubliceren ook dat andere
   organisaties hem niet meer in de cursusbibliotheek zien.
2. **Given** een gedeelde cursus, **When** de eigenaar hem verwijdert (zacht, feature 004 en 006),
   **Then** verdwijnt hij uit de bibliotheek van alle organisaties en zegt de bevestiging dat.
3. **Given** een onpubliceerde cursus die gedeeld was, **When** de eigenaar opnieuw publiceert,
   **Then** is de vorige beschikbaarheid voorgesteld (User Story 1, scenario 2), en staat de cursus
   pas na bevestigen weer in de bibliotheek.
4. **Given** een andere organisatie die de bibliotheek nog open heeft, **When** de cursus intussen
   is onpubliceerd of verwijderd en zij hem opent, **Then** krijgt zij de melding dat de cursus niet
   meer beschikbaar is, en is hij bij het volgende laden uit de lijst.

---

### Edge Cases

- **Alleen originele cursussen**: in de bibliotheek staan alleen cursussen die geen kopie zijn van
  een andere cursus. In deze feature bestaan nog geen kopieën (die komen met deel 2), maar de regel
  geldt vanaf nu, zodat een kopie nooit in de bibliotheek komt.
- **Concept nooit zichtbaar**: andere organisaties zien alleen de live versie; het concept,
  niet-gepubliceerde wijzigingen en oude versies uit de geschiedenis zijn voor hen niet op te vragen.
- **Nieuwe versie van een gedeelde cursus**: na "Wijzigingen publiceren" toont de bibliotheek de
  nieuwe live versie (versienummer en datum). Meldingen aan andere organisaties komen in deel 2.
- **Nieuwe beperkte video in een nieuwe versie**: zit er in de nieuwe versie een video die niet
  algemeen beschikbaar is en die niet in de vorige gedeelde live versie zat, dan verschijnt de
  waarschuwing van User Story 3 bij het publiceren, met alleen die nieuwe video's.
- **Beschikbaarheid ruimer en beperkte video's**: wordt de doelgroep groter (van "Alleen eigen
  organisatie" naar gedeeld, of van selectief naar algemeen, of selectief met extra organisaties),
  dan noemt de waarschuwing alle video's in de live versie die niet algemeen beschikbaar zijn.
- **Video wordt later beperkt of verwijderd**: verandert de eigenaar van een video na het delen de
  beschikbaarheid, of verwijdert hij de video, dan blijft de cursus gewoon in de bibliotheek
  staan; de video blijft werken in de live versie (feature 006, FR-012). Een nieuwe waarschuwing
  komt pas bij het volgende delen of publiceren.
- **Cursus met een video van een andere organisatie**: is die video selectief gedeeld met de
  eigenaar van de cursus, dan telt hij mee voor de waarschuwing (User Story 3, scenario 6).
- **Selectief zonder organisaties**: wordt geweigerd met "Kies minstens één organisatie, of kies
  ‘Alleen eigen organisatie’." (zoals bij video's).
- **Een gekozen organisatie wordt door de beheerder verwijderd**: zij ziet de cursus niet meer en
  verdwijnt uit de lijst met gekozen organisaties. Blijft er geen actieve organisatie over, dan
  ziet niemand anders de cursus; de beschikbaarheid verandert niet vanzelf (zoals bij video's).
- **De eigenaar wordt door de beheerder verwijderd**: haar cursussen verdwijnen uit de bibliotheek
  van alle organisaties (feature 001, FR-014).
- **Nieuwe organisatie**: ziet meteen alle algemeen gedeelde cursussen; selectief gedeelde pas als
  de eigenaar haar toevoegt.
- **Twee cursussen met dezelfde naam van verschillende organisaties**: toegestaan; de eigenaar-pil
  maakt het verschil zichtbaar.
- **Cursus van een andere organisatie openen in de editor of publiceren**: wordt geweigerd alsof de
  cursus niet bestaat (feature 006, FR-002); delen maakt een cursus niet bewerkbaar voor anderen.
- **Quests van andere organisaties**: een gedeelde cursus komt niet op de Quests van andere
  organisaties; dat kan pas na overnemen (deel 2). Voor de Quests van de eigenaar verandert er
  niets.
- **Publiceren mislukt na de waarschuwing** (bijvoorbeeld de cursus blijkt op de server toch
  onvolledig): er wordt niets gepubliceerd en de beschikbaarheid verandert niet (feature 006,
  FR-010).
- **De beheerder**: heeft geen functies voor cursussen of de cursusbibliotheek.

## Requirements *(mandatory)*

### Functional Requirements

**Beschikbaarheid**

- **FR-001**: Elke cursus MUST precies één van drie beschikbaarheden hebben: "Algemeen
  beschikbaar" (alle actieve organisaties), "Selectief beschikbaar" (de eigenaar en de gekozen
  organisaties) of "Alleen eigen organisatie" (alleen de eigenaar). De beschikbaarheid hoort bij de
  cursus en geldt voor de live versie; een nieuwe versie neemt haar over.
- **FR-002**: De bevestiging van het publiceren (feature 006, FR-003) MUST het veld
  "Beschikbaarheid" met de drie keuzes bevatten. Bij een cursus die nooit gepubliceerd is MUST
  "Alleen eigen organisatie" voorgeselecteerd zijn; anders de laatst opgeslagen beschikbaarheid
  (met de gekozen organisaties). Publiceren MUST de inhoud en de gekozen beschikbaarheid samen
  opslaan: allebei of geen van beide (feature 006, FR-010).
- **FR-003**: Bij "Selectief beschikbaar" MUST de docent een of meer organisaties kunnen kiezen
  uit een alfabetische lijst met alleen de namen van alle actieve organisaties behalve de eigen
  organisatie, zoals bij video's (feature 003, FR-004). Zonder gekozen organisatie MUST de keuze
  geweigerd worden met "Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’." Dit
  geldt bij publiceren en bij wijzigen, ook op de server.
- **FR-004**: De gekozen organisaties van een cursus MUST alleen voor de eigenaar zichtbaar zijn.
  Zodra de beschikbaarheid niet meer "Selectief beschikbaar" is, MUST de lijst met gekozen
  organisaties vervallen.
- **FR-005**: Cursussen die al bestonden voordat deze feature beschikbaar is, MUST "Alleen eigen
  organisatie" hebben (feature 006, FR-011); hun versies hoeven daarvoor niet te veranderen.
- **FR-006**: De eigenaar MUST de beschikbaarheid van een cursus met een live versie kunnen wijzigen
  via "Beschikbaarheid wijzigen" in het publicatiemenu, zonder opnieuw te publiceren. Versienummer,
  publicatiedatum en status (feature 006, FR-018) MUST daarbij gelijk blijven. Bij een cursus zonder
  live versie MUST deze actie niet in het menu staan.
- **FR-007**: Verliezen een of meer organisaties door een wijziging hun toegang, dan MUST het
  systeem eerst om bevestiging vragen met het aantal: "<aantal> organisaties kunnen deze cursus
  daarna niet meer zien in de cursusbibliotheek." (bij één: "1 organisatie kan deze cursus daarna
  niet meer zien in de cursusbibliotheek."), met "Wijzigen" en "Annuleren". Bij annuleren MUST
  niets veranderen.
- **FR-008**: Alleen de eigenaar van een cursus MUST de beschikbaarheid kunnen kiezen of wijzigen;
  elke poging van een andere organisatie MUST geweigerd worden alsof de cursus niet bestaat,
  ongeacht hoe het verzoek is samengesteld.

**Waarschuwing bij video's**

- **FR-009**: Wordt een cursus gedeeld ("Algemeen beschikbaar" of "Selectief beschikbaar") en
  bevat de inhoud die gedeeld wordt video's die niet "Algemeen beschikbaar" zijn, dan MUST het
  systeem vóór het opslaan een waarschuwing tonen met de namen van die video's, in eenvoudige taal,
  met de knoppen "Doorgaan" en "Annuleren". "Niet algemeen beschikbaar" omvat: selectief of alleen
  eigen organisatie, video's van andere organisaties die selectief met de eigenaar gedeeld zijn, en
  verwijderde video's die in de live versie blijven werken.
- **FR-010**: De waarschuwing MUST verschijnen als (a) een cursus van niet gedeeld naar gedeeld
  gaat, (b) de groep organisaties die de cursus ziet groter wordt, of (c) een nieuwe versie van een
  gedeelde cursus wordt gepubliceerd met zulke video's die niet in de vorige gedeelde live versie
  zaten. Bij (a) en (b) noemt zij alle zulke video's in de inhoud die gedeeld wordt, bij (c) alleen
  de nieuwe. In alle andere gevallen MUST er geen waarschuwing verschijnen.
- **FR-011**: De waarschuwing MUST zeggen dat organisaties waarmee de cursus gedeeld wordt deze
  video's binnen de cursus mogen gebruiken als zij de cursus overnemen, ook als de video daarna
  beperkt wordt. (Het overnemen zelf komt met deel 2; de waarschuwing geldt nu al, zodat wat nu
  gedeeld wordt daar later onder valt.) Bij "Annuleren" MUST er niets
  gepubliceerd of gewijzigd worden; bij "Doorgaan" MUST de actie doorgaan.
- **FR-012**: De server MUST de video's voor de waarschuwing zelf bepalen op basis van de inhoud
  die gedeeld wordt; een verzoek om te delen dat de waarschuwing niet heeft bevestigd terwijl die
  nodig was, MUST geweigerd worden zonder iets te veranderen.

**Centrale cursusbibliotheek**

- **FR-013**: Er MUST een pagina "Cursusbibliotheek" komen, bereikbaar vanuit de navigatie voor
  ingelogde organisaties.
- **FR-014**: De cursusbibliotheek van een organisatie MUST precies de cursussen tonen die (a) een
  live versie hebben, (b) niet verwijderd zijn, (c) een actieve eigenaar hebben, (d) origineel zijn
  (geen kopie van een andere cursus), en (e) "Algemeen beschikbaar" zijn, of "Selectief
  beschikbaar" met deze organisatie gekozen, of gedeeld door deze organisatie zelf. Cursussen met
  "Alleen eigen organisatie" MUST NOT in de bibliotheek staan, ook niet bij de eigenaar.
- **FR-015**: Per cursus MUST de bibliotheek de thumbnail van de live versie (feature 008; een
  neutrale afbeelding als er geen is, of als de video van die thumbnail niet in de videobibliotheek
  van de kijkende organisatie staat, zodat er geen beperkte video zichtbaar wordt, FR-018), naam, ingekorte beschrijving, eigenaar, versienummer,
  publicatiedatum en het aantal onderdelen tonen. Een cursus van een andere organisatie MUST een
  duidelijk zichtbare pil met de naam van de eigenaar hebben, een eigen gedeelde cursus de neutrale
  pil "Eigen", zoals in de videobibliotheek (feature 003, FR-009).
- **FR-016**: Alles wat een andere organisatie van een cursus ziet, MUST uit de live versie komen;
  het concept, niet-gepubliceerde wijzigingen, oude versies en de gekozen organisaties MUST NOT
  voor andere organisaties op te vragen zijn.
- **FR-017**: Klikken op een cursus MUST een venster boven de bibliotheek openen met thumbnail,
  naam, volledige beschrijving (met behoud van regels), eigenaar, versienummer, publicatiedatum,
  aantal onderdelen en aantal video's van de live versie. Voor de eigenaar MUST het venster ook de
  beschikbaarheid tonen en een link naar de editor. Na sluiten MUST de lijst er precies zo uitzien
  als ervoor (zoekterm, filters, sortering, scrollpositie).
- **FR-018**: Een andere organisatie MUST van een gedeelde cursus alleen de samenvatting van
  FR-017 kunnen zien. De inhoud (onderdelen, vragen, antwoorden, verbindingen, video's en hun
  thumbnails) MUST NOT voor andere organisaties op te vragen zijn. De inhoud alleen-lezen bekijken
  staat op de backlog (Clarifications).
- **FR-019**: De docent MUST in de bibliotheek kunnen zoeken op naam, beschrijving en naam van de
  eigenaar (deel van een woord, hoofdletters maken niet uit), sorteren op naam en publicatiedatum
  (oplopend of aflopend; standaard nieuwste publicatie bovenaan), en filteren op "Alle cursussen",
  "Eigen cursussen" en "Van andere organisaties". Klikken op de pil van een andere organisatie MUST
  filteren op die organisatie, met het label "Organisatie: <naam> ✕" naast het zoekveld. Alles MUST
  samenwerken, op één lijst zonder pagina's, zoals in de videobibliotheek (feature 003, FR-023 t/m
  FR-026).
- **FR-020**: Levert zoeken of filteren niets op, dan MUST "Geen cursussen gevonden" verschijnen
  met een knop die zoekterm en filters wist. Is er helemaal geen gedeelde cursus beschikbaar, dan
  MUST er in gewone taal staan dat er nog geen gedeelde cursussen zijn.
- **FR-021**: Elke poging van een organisatie om een cursus, de thumbnail of de gegevens op te
  vragen die volgens FR-014 niet voor haar beschikbaar is, MUST geweigerd worden met dezelfde
  reactie als voor een cursus die niet bestaat, ongeacht hoe het verzoek is samengesteld.
- **FR-022**: De bibliotheek MUST NOT bewerken, publiceren, onpubliceren of verwijderen van
  cursussen van andere organisaties mogelijk maken; die acties blijven voorbehouden aan de eigenaar
  (feature 006, FR-002).

**Onpubliceren en verwijderen**

- **FR-023**: Onpubliceert de eigenaar een gedeelde cursus, dan MUST hij vanaf het volgende verzoek
  uit de bibliotheek van alle organisaties verdwijnen. De opgeslagen beschikbaarheid MUST bewaard
  blijven zodat opnieuw publiceren haar voorstelt (FR-002); de cursus staat pas na bevestigen weer
  in de bibliotheek.
- **FR-024**: Verwijdert de eigenaar een gedeelde cursus (zacht), dan MUST hij vanaf het volgende
  verzoek uit de bibliotheek van alle organisaties verdwijnen.
- **FR-025**: De bevestigingen van onpubliceren en verwijderen (feature 006, FR-015 en FR-021) MUST
  bij een gedeelde cursus ook zeggen dat andere organisaties hem niet meer in de cursusbibliotheek
  zien.

**Voorbereiding op overnemen (deel 2)**

- **FR-026**: Een gedeelde cursus MUST in deze feature NOT op de Quests van andere organisaties
  komen en MUST NOT door andere organisaties bewerkt of overgenomen kunnen worden; de Quest-API
  (feature 007) blijft voor elke organisatie alleen haar eigen cursussen tonen.
- **FR-027**: Het ontwerp MUST ruimte laten voor deel 2 zonder bestaande gegevens om te zetten:
  een organisatie kan later een cursus uit de bibliotheek overnemen als verwijzing naar het
  origineel (met een gekozen live versie), of als eigen kopie die naar het origineel verwijst; een
  kopie komt nooit in de bibliotheek (FR-014 d). Elke cursus heeft precies één eigenaar.

**Algemeen**

- **FR-028**: Alle teksten die de docent ziet MUST in het Nederlands zijn, in eenvoudige taal
  zonder technische termen (NFR-03). De beheerder MUST NOT functies voor cursussen of de
  cursusbibliotheek krijgen.

### Key Entities *(include if feature involves data)*

- **Course** (bestaat): krijgt een beschikbaarheid met dezelfde drie keuzes als een video (FR-001).
  Het ERD kent nu alleen het veld `isSharedInLibrary` (aan/uit); dat MUST worden vervangen of
  aangevuld zodat de drie keuzes passen, en de wijziging MUST ook in het ERD komen (constitutie).
  Het veld `parentCourseId` blijft leeg voor originele cursussen; alleen cursussen zonder
  `parentCourseId` kunnen in de bibliotheek staan (FR-014 d, ERD-notitie).
- **Selectieve toegang tot een cursus** (nieuw): de koppeling tussen een selectief beschikbare
  cursus en een organisatie die hem in de bibliotheek mag zien, zoals `VideoAccess` bij video's.
  Moet aan het ERD worden toegevoegd.
- **OrganisationCourse** (bestaat): eigendom via `isOwner = TRUE` (precies één per cursus). Wordt in
  deze feature niet uitgebreid; rijen met `isOwner = FALSE` (verwijzingen) komen met deel 2. Toegang
  tot de bibliotheek loopt via de beschikbaarheid, niet via deze tabel.
- **CourseVersion** (bestaat, feature 006): de bibliotheek toont alleen de live versie. Versies
  veranderen niet door het kiezen of wijzigen van de beschikbaarheid.
- **Video** (bestaat, feature 003): de beschikbaarheid van de video's in een cursus bepaalt of de
  waarschuwing van FR-009 verschijnt; deze feature verandert de beschikbaarheid van video's niet.
- **Organisation** (bestaat): eigenaar van cursussen en mogelijk gekozen voor selectief gedeelde
  cursussen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In een test met drie organisaties en cursussen met elk van de drie beschikbaarheden
  (plus onpubliceerde, verwijderde en nog niet gepubliceerde cursussen) ziet elke organisatie in de
  cursusbibliotheek precies de cursussen die volgens FR-014 voor haar beschikbaar zijn: 0 te veel en
  0 te weinig.
- **SC-002**: 0% van de pogingen van een organisatie om een niet-beschikbare cursus, het concept of
  een oude versie van een andere organisatie op te vragen, of om de beschikbaarheid van andermans
  cursus te wijzigen, slaagt, ook niet buiten de interface om.
- **SC-003**: De waarschuwing van FR-009 verschijnt in 100% van de geteste gevallen waarin dat
  volgens FR-010 moet, noemt precies de juiste video's, en verschijnt in 0% van de andere gevallen.
- **SC-004**: Na onpubliceren, verwijderen of beperken van een gedeelde cursus staat hij bij het
  eerstvolgende laden in 100% van de gevallen niet meer in de bibliotheek van organisaties zonder
  toegang.
- **SC-005**: Een docent zonder technische kennis kiest zonder hulp bij het publiceren een
  beschikbaarheid, begrijpt de waarschuwing (getoetst met een vraag: "wat kunnen andere
  organisaties nu zien?"), en vindt in de bibliotheek een cursus van een andere organisatie binnen
  1 minuut (NFR-03).
- **SC-006**: Met 200 zichtbare cursussen staat de volledige bibliotheek binnen 2 seconden in beeld,
  en het resultaat van zoeken, sorteren of filteren binnen 1 seconde.
- **SC-007**: 100% van de cursussen die voor deze feature gepubliceerd waren, heeft daarna "Alleen
  eigen organisatie" en staat niet in de bibliotheek van andere organisaties.
- **SC-008**: Publiceren met een beschikbaarheid kost de docent ten hoogste één extra keuze ten
  opzichte van feature 006 (bij "Alleen eigen organisatie" geen enkele extra klik).

## Assumptions

- De beschikbaarheid hoort bij de cursus, niet bij elke versie: een nieuwe versie wordt gedeeld met
  dezelfde organisaties als de vorige, tenzij de docent in de bevestiging iets anders kiest.
- Voor een cursus die nooit gepubliceerd is, is "Alleen eigen organisatie" de voorselectie; er komt
  geen instelbare standaard zoals bij video's (feature 003, FR-003), omdat de docent bij elk
  publiceren bewust bevestigt.
- De eigenaar ziet de eigen gedeelde cursussen ook in de bibliotheek (pil "Eigen"), zodat hij kan
  zien wat anderen zien; eigen cursussen met "Alleen eigen organisatie" staan alleen in het eigen
  cursusoverzicht.
- De waarschuwing verschijnt alleen bij momenten waarop meer wordt gedeeld (FR-010), niet bij elke
  publicatie, om docenten niet steeds met dezelfde vraag lastig te vallen.
- Elke organisatie kan bij "Selectief beschikbaar" de namen van alle andere actieve organisaties
  zien; dat is al aanvaard bij video's (feature 003).
- In het cursusoverzicht ziet de eigenaar bij elke gepubliceerde cursus ook de beschikbaarheid in
  tekst ("Alleen eigen organisatie", "Algemeen beschikbaar" of "Selectief beschikbaar").
- Een gedeelde cursus geeft andere organisaties in deze feature nog geen toegang tot de
  videobestanden; video's afspelen in de browser blijft buiten scope (feature 002, FR-018).
- De bibliotheek wordt niet op de achtergrond ververst (geen polling, feature 001); wijzigingen
  verschijnen bij het volgende laden.
- Buiten scope (deel 2, `docs/backlog.md`): een cursus overnemen als verwijzing, een eigen kopie
  bij aanpassen, meldingen bij een nieuwe versie en kiezen tussen versies, het gebruiken van
  beperkte video's door de ontvanger, overgenomen cursussen in de Quest-API, en het echt opruimen
  van verwijderde cursussen. Ook buiten scope: de versiegeschiedenis (FR-11b) en eigendom van een
  cursus overdragen.
