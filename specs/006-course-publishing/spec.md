# Feature Specification: Cursus publiceren en onpubliceren, met de basis voor versies

**Feature Branch**: `Development` (spec-map: `specs/006-course-publishing`)

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "spec 006: Cursus publiceren en onpubliceren (FR-09), met de basis voor
versies (FR-11). Een organisatie moet een cursus kunnen publiceren, zodat hij beschikbaar komt voor
haar Quest(s). Alleen een voltooide cursus mag gepubliceerd worden, gecontroleerd met dezelfde regels
als de compleetheidscontrole in de editor, ook op de server. Publiceren zet de huidige inhoud vast als
een gepubliceerde versie met versienummer en publicatiedatum; het concept blijft bewerkbaar;
opnieuw publiceren levert een nieuwe versie die de vorige vervangt. Onpubliceren laat de cursus
verdwijnen voor de Quest; concept en versies blijven bestaan. Status (concept, gepubliceerd,
gepubliceerd met niet-gepubliceerde wijzigingen) met versienummer en publicatiedatum in het
cursusoverzicht en de editor. Bevestiging in eenvoudige taal (NFR-03). Beschikbaarheid in deze
feature alleen voor de eigen organisatie; FR-12 komt later. Een video die de eigenaar verwijdert of
beperkt, houdt publiceren niet tegen en komt mee in de gepubliceerde versie; een gepubliceerde versie
telt mee als gebruik. Buiten scope: versiegeschiedenis bekijken of terugzetten, delen en de
cursusbibliotheek (FR-12), koppelcode en Quest-API, het echt opruimen van video's. Een gepubliceerde
cursus verwijderen kan nog steeds (zacht); de gepubliceerde versie verdwijnt dan voor de Quest."

**Bronnen**: `docs/Requirements.docx` FR-09 (publiceren en intrekken, met keuze van
beschikbaarheid), FR-11 (versies), FR-12 (beschikbaarheid, cursusbibliotheek), FR-13 en FR-14
(zachte verwijdering en beperken van video's), FR-09-VR (een gedownloade cursus blijft op de Quest
bruikbaar), NFR-03 (eenvoudige taal); ERD `docs/Diagrams.simp`, tabel `CourseVersion` (velden
`versionNumber`, `publishedAt`). Bouwt voort op feature 004 (cursussen, concept, onbeschikbare
video's) en feature 005 (verbindingen en de compleetheidscontrole, FR-010 t/m FR-016).

## Clarifications

### Session 2026-11-23

- Q: Wanneer mag een cursus gepubliceerd worden met een video die de eigenaar intussen heeft
  verwijderd of beperkt? → A: Alleen als die video al in de live versie van deze cursus zit.
  Anders (nooit gepubliceerd, onpubliceerd, of de video zit niet in de live versie) houdt hij
  publiceren tegen met "Kies een andere video: deze is niet meer beschikbaar". Dit volgt
  `docs/Requirements.docx` FR-13: alleen een gepubliceerde cursus houdt een verwijderde video in
  leven, en oude versies in de geschiedenis tellen niet mee.
- Q: Wat gebeurt er als de docent een cursus onpubliceert en daarna opnieuw publiceert zonder iets
  aan het concept te veranderen? → A: De laatst gepubliceerde versie wordt weer live, met
  hetzelfde versienummer en dezelfde publicatiedatum. Alleen bij gewijzigde inhoud komt er een
  nieuwe versie, zodat Quests geen onnodige update zien (FR-06-VR).
- Q: Hoe ziet het versiemodel eruit volgens het ERD? → A: Een versie met `publishedAt = NULL` is
  het concept. Bij publiceren wordt het concept zelf vastgezet (`publishedAt` gevuld) en ontstaat
  een nieuw concept als kopie ervan (onderdelen en antwoorden gekopieerd, video's alleen als
  verwijzing), met het volgende versienummer. De live versie is de versie met het hoogste
  `versionNumber` waarvan `publishedAt` is ingevuld. Oude versies blijven bewaard.
- Q: Hoe leggen we vast dat een cursus is onpubliceerd, terwijl alle vastgezette versies bewaard
  blijven? → A: Met een nieuw veld `CourseVersion.unpublishedAt` (DATETIME, NULL). Live = de
  versie met het hoogste `versionNumber` met `publishedAt` gevuld en `unpublishedAt` leeg, van een
  niet-verwijderde cursus. Onpubliceren vult `unpublishedAt` bij die versie; opnieuw publiceren
  zonder wijzigingen maakt het weer leeg. Geen veld `Course.publishedCourseVersionId`.
- Q: Wanneer wordt een verwijderde cursus echt verwijderd? → A: Net als bij video's: verwijderen
  is eerst zacht, en de cursus blijft zacht verwijderd bestaan zolang een andere organisatie hem
  gebruikt via een verwijzing (overnemen, FR-12). Downloads op een Quest worden niet bijgehouden en
  tellen niet mee (de Quest houdt zijn eigen kopie, FR-09-VR). Het echt verwijderen is een latere
  opruimstap (backlog); in deze feature blijft verwijderen zacht zoals in feature 004.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Een complete cursus publiceren (Priority: P1)

De docent heeft een cursus af en klikt in de editor op "Publiceren". Het systeem vraagt in gewone
taal om bevestiging, controleert de cursus en zet de inhoud vast als versie 1. Daarna staat de
cursus als "Gepubliceerd" in het overzicht, met versienummer en datum, en is hij beschikbaar voor
de Quest(s) van de eigen organisatie.

**Why this priority**: Dit is de eerste schakel van de keten maken → publiceren → downloaden →
doorlopen. Zonder publiceren komt geen enkele cursus op een Quest.

**Independent Test**: Bouw een complete cursus (de editor toont "Cursus is compleet"), publiceer
hem en bevestig: het overzicht en de editor tonen "Gepubliceerd · versie 1" met de datum van
vandaag, en de vastgezette versie bevat precies de onderdelen, video's, antwoorden en verbindingen
van het concept op dat moment.

**Acceptance Scenarios**:

1. **Given** een complete cursus van de eigen organisatie die nog nooit gepubliceerd is, **When**
   de docent op "Publiceren" klikt, **Then** verschijnt een bevestiging in eenvoudige taal die
   zegt wat er gebeurt (de cursus komt beschikbaar voor de Quests van de organisatie).
2. **Given** die bevestiging, **When** de docent bevestigt, **Then** wordt de huidige inhoud
   vastgezet als versie 1 met de publicatiedatum, en tonen editor en overzicht "Gepubliceerd ·
   versie 1" met die datum.
3. **Given** die bevestiging, **When** de docent annuleert, **Then** verandert er niets.
4. **Given** een zojuist gepubliceerde cursus, **When** de docent verder bewerkt in de editor,
   **Then** kan dat gewoon; het concept blijft bewerkbaar en de gepubliceerde versie verandert
   niet.
5. **Given** de editor met niet-opgeslagen wijzigingen, **When** de docent publiceert en
   bevestigt, **Then** worden die wijzigingen eerst als concept opgeslagen en daarna gepubliceerd;
   de bevestiging zegt dat vooraf.

---

### User Story 2 - Niet publiceren zolang de cursus niet af is (Priority: P1)

Klikt de docent op "Publiceren" terwijl de cursus nog niet af is, dan publiceert het systeem niet.
De docent ziet in begrijpelijke taal wat er nog mist en bij welk onderdeel, met dezelfde meldingen
als in de lijst "nog te doen" van de editor, en kan per melding naar het onderdeel springen.

**Why this priority**: Een halve cursus op de Quest is onbruikbaar voor de cursist (een vraag
zonder vervolg, een video die ontbreekt). Deze bewaking hoort onlosmakelijk bij publiceren.

**Independent Test**: Laat in een cursus één antwoord onverbonden en klik op "Publiceren": er
wordt niets gepubliceerd en de docent ziet "Antwoord B is nog niet verbonden" bij de juiste vraag.
Stuur hetzelfde verzoek buiten de interface om naar de server: ook die weigert, met dezelfde
melding.

**Acceptance Scenarios**:

1. **Given** een cursus met één of meer meldingen van de compleetheidscontrole, **When** de
   docent op "Publiceren" klikt, **Then** wordt er niet gepubliceerd en ziet de docent de
   meldingen, elk met het onderdeel waar het om gaat; een klik op een melding brengt de docent
   naar dat onderdeel.
2. **Given** een cursus die in de browser compleet lijkt maar op de server niet (bijvoorbeeld een
   verzoek buiten de interface om, of een concept dat intussen door een collega is gewijzigd),
   **When** er gepubliceerd wordt, **Then** weigert de server, verandert er niets en krijgt de
   docent de meldingen van de server te zien.
3. **Given** de regels van FR-005, **When** een cursus precies één regel schendt, **Then** geeft
   de server precies de bijbehorende melding, met dezelfde tekst als de editor.
4. **Given** een gepubliceerde cursus waarvan de live versie een video gebruikt die de eigenaar
   intussen heeft verwijderd of beperkt, **When** de docent het concept wijzigt en opnieuw
   publiceert, **Then** houdt die video het publiceren niet tegen en komt hij mee in de nieuwe
   versie (FR-012).
5. **Given** een cursus zonder live versie (nooit gepubliceerd of onpubliceerd) met een video die
   de eigenaar heeft verwijderd of beperkt, **When** de docent publiceert, **Then** wordt er niet
   gepubliceerd en ziet de docent bij dat onderdeel "Kies een andere video: deze is niet meer
   beschikbaar" (FR-012).

---

### User Story 3 - Wijzigingen opnieuw publiceren (Priority: P1)

Na het publiceren past de docent het concept aan. De Quest houdt de gepubliceerde versie tot de
docent opnieuw publiceert. Overzicht en editor laten zien dat er wijzigingen zijn die nog niet
gepubliceerd zijn. Opnieuw publiceren levert versie 2 op, die versie 1 vervangt.

**Why this priority**: Cursussen worden bijgewerkt; de docent moet kunnen werken zonder dat
halve wijzigingen meteen op de Quest komen, en moet zien of de Quest nog een oudere versie heeft.

**Independent Test**: Publiceer een cursus, wijzig een vraagtekst en sla op: de status wordt
"Gepubliceerd · niet-gepubliceerde wijzigingen" en de live versie heeft nog de oude tekst.
Publiceer opnieuw: de status wordt "Gepubliceerd · versie 2" en de live versie heeft de nieuwe
tekst.

**Acceptance Scenarios**:

1. **Given** een gepubliceerde cursus, **When** de docent de inhoud wijzigt en als concept
   opslaat, **Then** tonen overzicht en editor "Gepubliceerd, met wijzigingen die nog niet
   gepubliceerd zijn", plus versienummer en datum van de live versie.
2. **Given** die status, **When** de docent opnieuw publiceert en bevestigt, **Then** ontstaat
   een nieuwe versie met het volgende versienummer en de datum van nu; deze vervangt de vorige
   als live versie, en de vorige blijft bewaard maar is niet meer live.
3. **Given** een gepubliceerde cursus waarvan alleen de plaats van blokken op het canvas is
   gewijzigd, **When** de docent kijkt, **Then** blijft de status "Gepubliceerd" (zonder
   wijzigingen), omdat de Quest de plaats op het canvas niet gebruikt.
4. **Given** een gepubliceerde cursus zonder niet-gepubliceerde wijzigingen, **When** de docent
   naar de knop "Publiceren" kijkt, **Then** is die niet te gebruiken en staat erbij dat er niets
   nieuws te publiceren is.
5. **Given** een gepubliceerde cursus met wijzigingen die de cursus onvolledig maken, **When** de
   docent opnieuw wil publiceren, **Then** wordt er niet gepubliceerd (User Story 2) en blijft de
   vorige versie gewoon live.

---

### User Story 4 - Een cursus onpubliceren (Priority: P2)

De docent wil een cursus tijdelijk of definitief van de Quests halen en klikt op
"Onpubliceren". Na bevestiging is de cursus niet meer beschikbaar voor de Quest. Het concept en
de vastgezette versies blijven bestaan; later kan de docent de cursus weer publiceren.

**Why this priority**: Nodig om een cursus met een fout of verouderde inhoud snel van de Quest te
halen, maar pas zinvol nadat publiceren werkt.

**Independent Test**: Onpubliceer een gepubliceerde cursus: de status wordt "Concept" (met de
vermelding dat hij eerder gepubliceerd was), de cursus is niet meer beschikbaar voor de Quest, en
het concept is ongewijzigd. Publiceer opnieuw: de cursus is weer beschikbaar.

**Acceptance Scenarios**:

1. **Given** een gepubliceerde cursus, **When** de docent op "Onpubliceren" klikt, **Then**
   verschijnt een bevestiging in eenvoudige taal die zegt dat de cursus niet meer te downloaden
   is voor de Quests, en dat Quests die hem al hebben hem nog kunnen gebruiken.
2. **Given** die bevestiging, **When** de docent bevestigt, **Then** is er geen live versie meer,
   tonen overzicht en editor de status "Concept" (niet gepubliceerd), en blijven concept en
   vastgezette versies bewaard.
3. **Given** die bevestiging, **When** de docent annuleert, **Then** verandert er niets.
4. **Given** een ongepubliceerde cursus die eerder gepubliceerd was, **When** de docent opnieuw
   publiceert, **Then** gelden dezelfde regels als bij User Story 1 en 3: controle, bevestiging,
   en een live versie met versienummer en datum.
5. **Given** een onpubliceerde cursus waarvan het concept inhoudelijk gelijk is aan de laatst
   gepubliceerde versie, **When** de docent opnieuw publiceert, **Then** wordt die versie weer
   live met hetzelfde versienummer en dezelfde publicatiedatum; er ontstaat geen nieuwe versie.

---

### User Story 5 - In het overzicht zien wat live staat (Priority: P2)

In het cursusoverzicht ziet de docent bij elke cursus van de eigen organisatie in één oogopslag
of hij concept is, gepubliceerd, of gepubliceerd met niet-gepubliceerde wijzigingen, en bij een
gepubliceerde cursus het versienummer en de publicatiedatum van de live versie.

**Why this priority**: Overzicht over wat er op de Quests staat; bouwt voort op story 1 t/m 4.

**Independent Test**: Zet drie cursussen in de drie verschillende statussen en open het overzicht:
elke cursus toont de juiste status, en de gepubliceerde tonen versienummer en datum.

**Acceptance Scenarios**:

1. **Given** cursussen in de statussen concept, gepubliceerd en gepubliceerd met wijzigingen,
   **When** de docent het overzicht opent, **Then** toont elke cursus de juiste status in tekst
   (niet alleen met kleur), en de gepubliceerde het versienummer en de publicatiedatum.
2. **Given** de editor van een cursus, **When** de docent hem opent, **Then** staat dezelfde
   status met versienummer en datum ook in de editor.

---

### Edge Cases

- **Cursus van een andere organisatie**: Een verzoek om een cursus van een andere organisatie te
  publiceren of onpubliceren wordt geweigerd alsof de cursus niet bestaat ("niet gevonden"), en
  verandert niets.
- **Verwijderde cursus**: Een cursus die (zacht) is verwijderd, kan niet gepubliceerd of
  onpubliceerd worden. Verwijdert de docent een gepubliceerde cursus, dan verdwijnt hij meteen
  voor de Quest (er is geen live versie meer); de vastgezette versies blijven in de database
  bewaard (constitutie, principe V). De bevestiging bij verwijderen noemt dit als de cursus
  gepubliceerd is.
- **Twee keer snel klikken of twee docenten tegelijk publiceren**: Er ontstaat per keer
  publiceren precies één nieuwe versie; versienummers zijn uniek en lopen op zonder gaten door
  dubbel klikken. Publiceert een collega intussen, dan ziet de docent na afloop de werkelijke
  status.
- **Concept gewijzigd tussen controle en vastzetten**: Wat wordt vastgezet is precies de inhoud
  die op de server is gecontroleerd; een gelijktijdige opslag komt in zijn geheel voor of na het
  publiceren, nooit half.
- **Editor open bij een collega tijdens publiceren**: Na publiceren is het concept een nieuwe
  kopie (Clarifications). Een opslag vanuit een editor die nog het oude concept toont, MUST worden
  geweigerd met "Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw om verder te
  werken." en verandert niets. De editor van wie zelf publiceert, laadt het nieuwe concept
  meteen; de geschiedenis van ongedaan maken begint daarna opnieuw.
- **Onbeschikbare of verwijderde video**: Een video die de eigenaar heeft verwijderd of beperkt,
  blijft in de cursus (feature 004). Zit hij in de live versie, dan houdt hij publiceren niet
  tegen; anders wel (FR-012). De editor meldt hem alleen als "nog te doen" als hij publiceren
  tegenhoudt (FR-013).
- **Onpubliceren met een verwijderde video**: Na onpubliceren heeft de cursus geen live versie
  meer en beschermt hij de video niet langer. Wie daarna opnieuw publiceert, moet eerst een
  andere video kiezen. De bevestiging bij onpubliceren MUST dit noemen als de live versie zo'n
  video bevat.
- **Dezelfde verwijderde video in een tweede onderdeel**: Zit de video in de live versie, dan
  mag hij ook in een ander onderdeel van het concept staan (hij kan daar alleen niet opnieuw
  gekozen worden, feature 004); het gaat om de video, niet om het onderdeel.
- **Een video verwijderen die in een live versie zit**: Dat kan voor de eigenaar zoals nu
  (zacht); het bestand blijft bestaan zolang een live versie hem gebruikt (FR-014).
- **Opnieuw publiceren zonder wijzigingen na onpubliceren**: De laatst gepubliceerde versie wordt
  weer live met haar eigen versienummer en publicatiedatum (FR-017). De controle van FR-005 en
  FR-012 geldt wel opnieuw: bevat die versie een video die intussen niet meer beschikbaar is, dan
  moet de docent eerst een andere video kiezen, en dan is de inhoud gewijzigd en ontstaat er een
  nieuwe versie.
- **Fout tijdens publiceren** (bijvoorbeeld de verbinding valt weg): er is dan ofwel een volledige
  nieuwe live versie, ofwel niets veranderd; de docent krijgt een begrijpelijke foutmelding en kan
  het opnieuw proberen.
- **Grote cursus**: Een cursus van 50 onderdelen wordt binnen de tijd van SC-003 gepubliceerd.

## Requirements *(mandatory)*

### Functional Requirements

**Publiceren**

- **FR-001**: De docent MUST een cursus van de eigen organisatie kunnen publiceren vanuit de
  editor, met de knop "Publiceren".
- **FR-002**: De docent MUST NOT een cursus van een andere organisatie kunnen publiceren of
  onpubliceren; de server MUST zo'n verzoek weigeren alsof de cursus niet bestaat, ook buiten de
  interface om.
- **FR-003**: Vóór het publiceren MUST een bevestiging verschijnen in eenvoudige Nederlandse taal
  (NFR-03), die zegt dat de cursus beschikbaar komt voor de Quests van de organisatie, bij
  opnieuw publiceren dat de nieuwe versie de huidige vervangt, en bij niet-opgeslagen wijzigingen
  dat die eerst worden opgeslagen. Annuleren MUST niets veranderen.
- **FR-004**: Publiceren MUST de inhoud van het concept vastzetten als gepubliceerde versie met
  een versienummer en de publicatiedatum en -tijd: naam, beschrijving, onderdelen, video's,
  vragen, antwoorden (met goed/fout en feedback), verbindingen en het startonderdeel. Een latere
  wijziging van het concept MUST NOT de vastgezette versie veranderen.
- **FR-005**: Publiceren MUST alleen lukken als de cursus compleet is volgens dezelfde regels als
  de compleetheidscontrole van de editor (feature 005, FR-010 t/m FR-016), waarbij de regel over
  onbeschikbare video's werkt zoals in FR-012: precies één startonderdeel; minstens één einde
  bereikbaar; elk onderdeel bereikbaar vanaf de start; vanaf elk bereikbaar onderdeel een route
  naar een einde; elk video-onderdeel heeft een video die beschikbaar is of in de live versie zit
  (FR-012); elke vraag heeft een vraagtekst en 2 tot 4
  antwoorden met tekst, waarvan precies één goed; bij een vraag met minstens één verbonden
  antwoord zijn alle antwoorden verbonden; de cursus heeft minstens één onderdeel.
- **FR-006**: De server MUST de controle van FR-005 zelf uitvoeren op de inhoud die wordt
  vastgezet, onafhankelijk van de browser. Een cursus die niet compleet is, MUST NOT worden
  gepubliceerd; er verandert dan niets.
- **FR-007**: Bij een onvolledige cursus MUST de docent de meldingen zien in begrijpelijke taal,
  elk met het onderdeel (en waar van toepassing het antwoord) waar ze over gaan, met dezelfde
  teksten als de lijst "nog te doen" in de editor. Een klik op een melding MUST naar dat onderdeel
  brengen.
- **FR-008**: Het concept MUST na het publiceren bewerkbaar blijven, zoals in feature 004 en 005.
  Wijzigingen in het concept MUST pas live komen als de docent opnieuw publiceert.
- **FR-009**: Publiceren van een concept dat inhoudelijk (zie FR-018) afwijkt van de laatst
  gepubliceerde versie MUST een nieuwe versie maken met het volgende versienummer (1, 2, 3, …) en
  de datum van nu. De nieuwe versie MUST de vorige vervangen als live versie; er
  is per cursus hoogstens één live versie. Eerdere gepubliceerde versies MUST bewaard blijven
  (basis voor FR-11), maar zijn in deze feature nergens te bekijken.
- **FR-010**: Publiceren MUST in zijn geheel lukken of in zijn geheel mislukken: er is nooit een
  half vastgezette versie, en bij mislukken blijft de vorige live versie (of geen) ongewijzigd.
  Gelijktijdig publiceren MUST NOT tot dubbele versienummers leiden.

**Beschikbaarheid**

- **FR-011**: Een gepubliceerde cursus MUST in deze feature alleen beschikbaar zijn voor de eigen
  organisatie en haar Quests. De docent kiest bij publiceren (nog) geen beschikbaarheid. Het
  ontwerp MUST ruimte laten om per gepubliceerde cursus later een beschikbaarheid vast te leggen
  (de drie opties van FR-12) zonder bestaande gepubliceerde versies te hoeven omzetten; de
  bestaande versies krijgen dan "alleen eigen organisatie".

**Video's**

- **FR-012**: Een video die de eigenaar heeft verwijderd of in beschikbaarheid heeft beperkt
  (FR-13, FR-14) en die in het concept zit, MUST publiceren alleen niet tegenhouden als dezelfde
  video in de live versie van deze cursus zit; hij komt dan mee in de nieuwe versie. Heeft de
  cursus geen live versie, of zit de video er niet in, dan MUST publiceren worden geweigerd met
  bij dat onderdeel "Kies een andere video: deze is niet meer beschikbaar". De server MUST dit
  zelf controleren (FR-006).
- **FR-013**: De editor MUST de melding "Kies een andere video: deze is niet meer beschikbaar"
  (feature 005, FR-015) alleen tonen voor een onbeschikbare video die niet in de live versie zit,
  zodat de lijst "nog te doen" en de controle bij publiceren hetzelfde zeggen (verfijnt FR-015
  van feature 005). De waarschuwing bij het weghalen of vervangen van zo'n video (feature 004,
  FR-020b) en de melding na ongedaan maken (FR-020d) blijven.
- **FR-014**: Een live versie MUST tellen als gebruik van de video's erin: zolang een live versie
  een video gebruikt, MUST die video niet echt (van schijf) worden verwijderd, ook niet als het
  concept hem niet meer gebruikt. Eerdere, niet meer live versies tellen niet mee
  (`docs/Requirements.docx` FR-13).

**Onpubliceren**

- **FR-015**: De docent MUST een gepubliceerde cursus van de eigen organisatie kunnen
  onpubliceren vanuit de editor, met de knop "Onpubliceren", na een bevestiging in eenvoudige
  taal die zegt dat de cursus niet meer te downloaden is voor de Quests en dat Quests die hem al
  hebben hem kunnen blijven gebruiken. Bevat de live versie een video die niet meer beschikbaar
  is, dan MUST de bevestiging ook zeggen dat die video bij opnieuw publiceren vervangen moet
  worden (FR-012). Annuleren MUST niets veranderen.
- **FR-016**: Na onpubliceren MUST de cursus geen live versie meer hebben en dus niet meer
  beschikbaar zijn voor de Quests. Het concept en alle vastgezette versies MUST bewaard blijven.
- **FR-017**: Een ongepubliceerde cursus MUST later opnieuw gepubliceerd kunnen worden, met
  dezelfde controle en bevestiging als bij FR-003 t/m FR-010. Is het concept inhoudelijk gelijk
  aan de laatst gepubliceerde versie, dan MUST die versie weer live worden met hetzelfde
  versienummer en dezelfde publicatiedatum, zonder nieuwe versie.

**Status**

- **FR-018**: Elke cursus MUST een van drie statussen hebben, afgeleid en niet handmatig gezet:
  - **Concept**: geen live versie (nooit gepubliceerd of onpubliceerd);
  - **Gepubliceerd**: een live versie, en het opgeslagen concept is inhoudelijk gelijk aan die
    versie;
  - **Gepubliceerd, met niet-gepubliceerde wijzigingen**: een live versie, en het opgeslagen
    concept wijkt inhoudelijk af.
  "Inhoudelijk" betekent alles wat FR-004 vastzet; de plaats van blokken op het canvas telt niet
  mee. Niet-opgeslagen wijzigingen in de editor tellen niet mee.
- **FR-019**: Het cursusoverzicht en de editor MUST de status tonen in tekst (kleur is nooit het
  enige signaal), en bij een live versie het versienummer en de publicatiedatum. In de editor MUST
  de status direct na publiceren, onpubliceren en opslaan zijn bijgewerkt, zonder herladen.
- **FR-020**: Bij een gepubliceerde cursus zonder niet-gepubliceerde wijzigingen MUST "Publiceren"
  niet te gebruiken zijn, met de uitleg dat er niets nieuws te publiceren is. "Onpubliceren" MUST
  alleen te gebruiken zijn bij een cursus met een live versie.

**Verwijderen**

- **FR-021**: Een gepubliceerde cursus MUST verwijderd kunnen worden zoals nu (zacht, feature
  004). Daarmee MUST de cursus meteen geen live versie meer hebben en niet meer beschikbaar zijn
  voor de Quests; de vastgezette versies blijven in de database bewaard. Is de cursus gepubliceerd,
  dan MUST de bevestiging bij verwijderen zeggen dat hij ook van de Quests verdwijnt. Echt
  verwijderen (als geen andere organisatie de cursus via een verwijzing gebruikt) valt buiten deze
  feature; downloads op een Quest tellen daarbij niet mee (Clarifications).

**Algemeen**

- **FR-022**: Alle teksten die de docent ziet MUST in het Nederlands zijn, in eenvoudige taal
  zonder technische termen (NFR-03).
- **FR-023**: Acties MUST met één klik (plus bevestiging) werken, zoals in feature 005 (FR-026).

### Key Entities *(include if feature involves data)*

- **Course** (bestaat): de cursus van een organisatie. Krijgt in deze feature een afgeleide
  status (FR-018) en hoogstens één live versie. Zacht verwijderd = geen live versie.
- **CourseVersion** (bestaat, ERD): het concept is de versie met `publishedAt = NULL`. Bij
  publiceren wordt het concept vastgezet (`publishedAt` gevuld) en komt er een nieuw concept bij
  als kopie, met het volgende versienummer. Een vastgezette versie wordt inhoudelijk nooit meer
  gewijzigd. De live versie is de vastgezette versie met het hoogste `versionNumber`, mits haar
  nieuwe veld `unpublishedAt` leeg is en de cursus niet verwijderd is (Clarifications). Het nieuwe
  veld MUST ook in het ERD worden doorgevoerd (constitutie).
- **CourseStep** en **Answer** (bestaan): horen bij één versie. Het nieuwe concept krijgt bij
  publiceren kopieën met nieuwe id's die naar elkaar verwijzen (verbindingen en startonderdeel
  blijven kloppen); video's worden alleen als verwijzing meegenomen. De vastgezette versie houdt
  de oorspronkelijke rijen.
- **Beschikbaarheid** (nog geen gegeven): in deze feature altijd "alleen eigen organisatie";
  met FR-12 wordt dit een keuze per gepubliceerde cursus.
- **Video** (bestaat): telt voor het echt verwijderen als "in gebruik" zolang een live versie hem
  gebruikt (FR-014); een concept of een niet meer live versie houdt hem niet in leven.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een docent zonder technische kennis publiceert zonder hulp een complete cursus
  binnen 1 minuut na het openen van de editor, en weet daarna (getoetst met een vraag) dat de
  cursus nu voor de Quests van de organisatie beschikbaar is.
- **SC-002**: 0% van de pogingen om een onvolledige cursus te publiceren slaagt, ook niet buiten
  de interface om; voor elke regel van FR-005 geeft een cursus die alleen die regel schendt
  precies de bijbehorende melding (0 vals positief, 0 vals negatief in de testset).
- **SC-003**: Publiceren of onpubliceren van een cursus van 50 onderdelen is binnen 3 seconden na
  bevestigen zichtbaar afgerond.
- **SC-004**: In 100% van de gevallen is een vastgezette versie na latere wijzigingen van het
  concept nog identiek aan de inhoud op het moment van publiceren.
- **SC-005**: 0% van de verzoeken om een cursus van een andere organisatie te publiceren of
  onpubliceren slaagt.
- **SC-006**: Bij 20 snel achter elkaar of gelijktijdig verstuurde publicatieverzoeken voor één
  cursus heeft de cursus daarna precies één live versie en geen dubbele versienummers.
- **SC-007**: In het overzicht klopt de getoonde status (met versienummer en datum) in 100% van de
  geteste situaties: nooit gepubliceerd, gepubliceerd, gewijzigd na publiceren, alleen canvas
  verschoven, onpubliceerd, opnieuw gepubliceerd.
- **SC-008**: Een onbeschikbare video houdt publiceren in 100% van de geteste gevallen tegen als
  hij niet in de live versie zit, en in 0% van de gevallen als hij er wel in zit.

## Assumptions

- Wie een cursus mag bewerken (de ingelogde organisatie, feature 001 en 004), mag hem ook
  publiceren en onpubliceren; er komt geen aparte rol of goedkeuringsstap.
- Publiceren en onpubliceren gebeuren in de editor; het cursusoverzicht toont alleen de status.
  Een knop in het overzicht kan later worden toegevoegd zonder de regels te veranderen.
- Opnieuw publiceren zonder inhoudelijke wijzigingen kan alleen na onpubliceren (anders is
  "Publiceren" niet te gebruiken, FR-020) en zet de laatst gepubliceerde versie terug (FR-017).
  Een versienummer staat dus altijd voor een andere inhoud; de publicatiedatum is het moment
  waarop die inhoud voor het eerst live ging.
- Het versienummer telt per cursus op vanaf 1 voor de eerste gepubliceerde versie. Hoe het
  concept zelf genummerd is, is een ontwerpkeuze voor het plan; de docent ziet het concept nooit
  met een versienummer.
- De publicatiedatum wordt getoond als datum en tijd in Nederlandse notatie en de tijdzone van de
  docent.
- "Beschikbaar voor de Quest" is in deze feature alleen een toestand in het CMS (er is een live
  versie); hoe een Quest hem ophaalt (koppelcode, API) komt in een latere feature. Deze feature is
  daarom te testen via het CMS en de status, niet op een Quest.
- Wat een Quest doet met een cursus die hij al gedownload heeft (FR-09-VR), valt buiten het CMS.
- Constitutie principe V (versie 3.0.0, 2026-11-23) legt FR-012 vast: een verwijderde video
  blijft werken in een gepubliceerde cursus, ook in een nieuwe versie daarvan; een cursus die niet
  gepubliceerd is (nooit of ingetrokken) moet vóór publiceren een andere video kiezen.
- Het echt opruimen van video's blijft op de backlog; deze feature zorgt alleen dat een video in
  een live versie niet te vroeg verdwijnt (FR-014).
- Buiten scope: de versiegeschiedenis bekijken, een oude versie terugzetten of opnieuw publiceren
  (rest van FR-11); kiezen van beschikbaarheid, delen, overnemen en de centrale cursusbibliotheek
  (FR-12); koppelcode en de API voor de Quest (FR-01-VR t/m FR-09-VR); het echt opruimen van
  video's.
