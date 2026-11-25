# Feature Specification: Thumbnail per cursus in de Quest-API

**Feature Branch**: `Development` (spec-map: `specs/008-quest-course-thumbnail`)

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "spec 008: thumbnail per cursus in de Quest-API (nodig voor Quest-spec
003 en FR-02-VR). De Quest toont per cursus een afbeelding. Een cursus heeft nu geen eigen
afbeelding; video's wel (thumbnailStorageKey). Voorstel: de thumbnail van een cursus is de thumbnail
van de video van het startonderdeel van de live versie; begint de route met een vraag, dan de eerste
video op de route; heeft de route geen video, dan geen thumbnail. Alternatief om in clarify te
beslissen: de docent kiest of uploadt zelf een cursusafbeelding. Breid het contract
specs/007-quest-api/contracts/quest-api.md alleen uit (compatibiliteitsregel v1, niets weghalen of
hernoemen): per cursus in GET /courses en GET /courses/:courseId een veld thumbnailUrl (relatief, of
null), en een endpoint GET /api/quest/v1/courses/:courseId/thumbnail (afbeelding, zelfde
Bearer-koppelcode; 401 relink_required, 404 not_found als de cursus niet zichtbaar is of geen
thumbnail heeft), geleverd via nginx met X-Accel-Redirect zoals video's. De thumbnail hoort bij de
live versie, nooit bij het concept, en blijft beschikbaar als de video intussen verwijderd of
beperkt is (zoals video's in de live versie). downloadSizeBytes blijft ongewijzigd (thumbnail telt
niet mee). API-tests voor alle gevallen. Buiten scope: thumbnails in de editor van het CMS
aanpassen."

**Bronnen**: `docs/Requirements.docx` FR-02-VR (cursussen tonen op de Quest), FR-13 (verwijderde
video blijft werken in een gepubliceerde cursus); Quest-spec 003 (project van de Quest-app: lijst
met cursussen met afbeelding); `specs/007-quest-api` (koppeling, "welke cursussen ziet deze Quest"
FR-006/FR-007, contract `contracts/quest-api.md`); `specs/002-video-library` (thumbnail per video,
opruimregel FR-020a); `specs/006-course-publishing` (live versie, FR-012/FR-014); constitutie III
(bytes via nginx) en V (zachte verwijdering). ERD `docs/Diagrams.simp`: geen wijziging (zie
Clarifications).

## Clarifications

### Session 2026-11-24

- Q: Waar komt de afbeelding van een cursus op de Quest vandaan? → A: Automatisch: de thumbnail van
  de eerste video op de route van de live versie (FR-002–FR-004). De docent kiest of uploadt geen
  eigen afbeelding; geen ERD-wijziging en geen scherm in het CMS.
- Q: Hoe weet de Quest-app dat de afbeelding van een cursus is veranderd? → A: Het adres bevat het
  versienummer van de live versie (`/api/quest/v1/courses/<courseId>/thumbnail?v=<versionNumber>`).
  De server negeert `v` bij het kiezen en levert altijd de afbeelding van de live versie (FR-006,
  FR-010).
- Q: Wat gebeurt er met de afbeelding van een cursus als de cursus wordt verwijderd of
  onpubliceerd? → A: Voor de Quest is hij direct weg (`404`, en de cursus staat niet meer in de
  lijst). Het bestand is de thumbnail van een video en wordt niet apart gewist; het volgt de
  bestaande opruimregel voor video's (feature 002 FR-020a). Er komt geen eigen bestand en geen
  nieuwe map op de VPS (FR-005a).

## User Scenarios & Testing *(mandatory)*

Net als in feature 007 is de "gebruiker" de Quest-app (een programma). De scenario's beschrijven
wat de app aan het CMS vraagt en wat hij terugkrijgt.

### User Story 1 - Per cursus een afbeelding in de lijst (Priority: P1)

De Quest-app haalt de lijst met cursussen op. Bij elke cursus staat of er een afbeelding is en waar
de app die kan ophalen. De app haalt de afbeelding op met dezelfde koppeling en toont hem bij de
cursus. Heeft een cursus geen afbeelding, dan toont de app een eigen standaardafbeelding.

**Why this priority**: De Quest-app (Quest-spec 003) toont de cursuslijst met een afbeelding per
cursus; zonder dit kan dat scherm niet gebouwd worden.

**Independent Test**: Publiceer een cursus die begint met een video-onderdeel. Haal de lijst op met
een gekoppelde Quest: bij de cursus staat een adres voor de afbeelding, en dat adres levert de
thumbnail van die video. Een cursus zonder video's heeft in de lijst "geen afbeelding".

**Acceptance Scenarios**:

1. **Given** een live cursus waarvan het startonderdeel een video-onderdeel is, **When** de Quest de
   lijst ophaalt, **Then** heeft die cursus een adres voor de afbeelding, en levert dat adres de
   thumbnail van de video van het startonderdeel.
2. **Given** een live cursus die begint met een vraag, **When** de Quest de lijst ophaalt en de
   afbeelding ophaalt, **Then** is het de thumbnail van de eerste video op de route (FR-003).
3. **Given** een live cursus waarvan de route geen enkel video-onderdeel heeft, **When** de Quest de
   lijst ophaalt, **Then** staat bij die cursus "geen afbeelding" (`null`), en geeft het adres voor
   de afbeelding "niet gevonden".
4. **Given** een Quest-app die het veld voor de afbeelding nog niet kent, **When** hij de lijst of
   een cursus ophaalt, **Then** werkt alles zoals in feature 007; geen bestaand veld is weggehaald,
   hernoemd of anders van betekenis.

---

### User Story 2 - De afbeelding hoort bij de live versie (Priority: P1)

De afbeelding die de Quest ziet, past bij de versie die hij kan downloaden. Een docent die in het
concept het startonderdeel verandert, verandert de afbeelding op de Quest pas na het publiceren. Een
video die de eigenaar intussen verwijdert of beperkt, laat de afbeelding van een live cursus niet
verdwijnen.

**Why this priority**: Een afbeelding uit het concept zou een cursus laten zien die de Quest nog
niet kan downloaden; een verdwijnende afbeelding na verwijderen zou de regel van feature 006
(FR-012/FR-014) breken.

**Independent Test**: Publiceer een cursus (video A aan het begin), verander in het concept het
begin naar video B zonder te publiceren: de Quest krijgt nog de thumbnail van A. Publiceer: nu die
van B. Verwijder daarna video B zacht als eigenaar: de Quest krijgt nog steeds de thumbnail van B.

**Acceptance Scenarios**:

1. **Given** een live cursus waarvan het concept een ander startonderdeel of een andere video heeft,
   **When** de Quest de afbeelding ophaalt, **Then** krijgt hij de afbeelding die volgt uit de live
   versie, niet uit het concept.
2. **Given** een cursus die opnieuw is gepubliceerd met een andere eerste video, **When** de Quest de
   lijst en de afbeelding ophaalt, **Then** hoort de afbeelding bij de nieuwe live versie en bevat
   het afbeeldingsadres het nieuwe versienummer, zodat de app aan het gewijzigde adres ziet dat hij
   de afbeelding opnieuw moet ophalen.
3. **Given** de video waarvan de thumbnail de afbeelding van een live cursus is, **When** de eigenaar
   die video zacht verwijdert of in beschikbaarheid beperkt, **Then** blijft de afbeelding van die
   cursus op te halen.
4. **Given** een cursus die onpubliceerd of verwijderd is, **When** de Quest de afbeelding ophaalt,
   **Then** wordt dat geweigerd met "niet gevonden".
5. **Given** een oud afbeeldingsadres met het versienummer van een eerdere versie, **When** de Quest
   het ophaalt terwijl de cursus nog live is, **Then** krijgt hij de afbeelding van de huidige live
   versie (geen fout).

---

### User Story 3 - De afbeelding in de cursusinhoud (Priority: P2)

Bij het downloaden van één cursus staat het adres van de afbeelding ook in de cursusinhoud, zodat de
app de afbeelding samen met de cursus op de Quest kan bewaren en tonen bij een gedownloade cursus,
ook zonder verbinding.

**Why this priority**: Handig voor gedownloade cursussen (FR-09-VR), maar de lijst (User Story 1)
dekt het belangrijkste scherm al.

**Independent Test**: Download een live cursus: de inhoud bevat hetzelfde afbeeldingsadres (of
`null`) als de lijst voor die cursus.

**Acceptance Scenarios**:

1. **Given** een live cursus, **When** de Quest de inhoud ophaalt, **Then** bevat die het adres van
   de afbeelding, gelijk aan het adres in de lijst, of `null` als de cursus geen afbeelding heeft.
2. **Given** die cursus, **When** de app de downloadgrootte uit de lijst vergelijkt met wat hij
   ophaalt, **Then** klopt de regel van feature 007 nog: de video's plus de inhoud; de afbeelding
   telt niet mee.

---

### Edge Cases

- **Startonderdeel is een vraag, meerdere wegen naar een video**: De keuze volgt een vaste regel
  (FR-003), zodat dezelfde live versie altijd dezelfde afbeelding geeft.
- **Onderdelen die niet vanaf het start bereikbaar zijn**: Ze tellen niet mee; alleen wat op de route
  vanaf het startonderdeel ligt.
- **Route met een lus** (een antwoord dat terugwijst naar een eerder onderdeel): De zoektocht stopt
  en bezoekt elk onderdeel hooguit één keer.
- **Video zonder thumbnail** (thumbnail ontbreekt in de gegevens): Die video wordt overgeslagen en de
  zoektocht gaat verder (FR-003).
- **Thumbnailbestand ontbreekt op schijf**: Het adres staat in de lijst (de gegevens zeggen dat er
  een thumbnail is), maar het ophalen mislukt met een fout. De lijst en de cursusinhoud blijven
  werken. In productie legt nginx dit vast in zijn foutlog; zonder nginx (ontwikkeling) logt de API
  de fout, net als bij video's (feature 007).
- **Dezelfde video in meerdere cursussen**: Elke cursus heeft zijn eigen afbeeldingsadres; de
  afbeelding kan dezelfde zijn.
- **Cursus verwijderd terwijl de video ook elders gebruikt wordt**: De afbeelding van de verwijderde
  cursus geeft `404`; de andere cursussen en de videobibliotheek tonen de thumbnail van die video
  gewoon (FR-005a).
- **Video uit de centrale bibliotheek van een andere organisatie** (feature 003): Is hij de eerste
  video op de route van een live cursus van de eigen organisatie, dan is zijn thumbnail de
  afbeelding, ook als de eigenaar hem intussen heeft beperkt of verwijderd.
- **Onjuiste of ontbrekende koppeling, of koppelcode vernieuwd**: Het ophalen van de afbeelding wordt
  geweigerd met "opnieuw koppelen nodig", zoals elk ander Quest-verzoek (feature 007 FR-004).
- **Cursus van een andere organisatie, of niet bestaand, of een id met een verkeerde vorm**: "niet
  gevonden", zonder iets prijs te geven.
- **Nieuwe versie gepubliceerd terwijl de app de afbeelding ophaalt**: De app krijgt de afbeelding
  van de versie die op dat moment live is; aan het nieuwe afbeeldingsadres in de lijst ziet hij dat
  hij die later opnieuw moet ophalen.
- **Versienummer in het adres klopt niet** (oud, te hoog, geen getal of weggelaten): Het wordt
  genegeerd; de Quest krijgt de afbeelding van de huidige live versie, of "niet gevonden" volgens
  FR-012. Er is geen aparte fout voor.

## Requirements *(mandatory)*

### Functional Requirements

**Welke afbeelding hoort bij een cursus**

- **FR-001**: Elke cursus die een Quest volgens feature 007 (FR-006/FR-007) ziet, MUST hooguit één
  afbeelding hebben. De afbeelding MUST volgen uit de live versie van de cursus en MUST NOT afhangen
  van het concept of van een oudere versie.
- **FR-002**: Is het startonderdeel van de live versie een video-onderdeel en heeft die video een
  thumbnail, dan MUST de afbeelding de thumbnail van die video zijn.
- **FR-003**: Anders MUST de afbeelding de thumbnail zijn van het eerste video-onderdeel met een
  thumbnail op de route vanaf het startonderdeel. "Eerste" betekent: het minste aantal stappen
  vanaf het startonderdeel; bij gelijke afstand eerst het onderdeel dat bereikt wordt via een
  eerder antwoord (volgorde A–D) of een eerder onderdeel op diezelfde afstand. Elk onderdeel telt
  hooguit één keer; onderdelen die niet vanaf het startonderdeel bereikbaar zijn, tellen niet mee.
- **FR-004**: Ligt er op de route geen video-onderdeel met een thumbnail, dan MUST de cursus geen
  afbeelding hebben.
- **FR-005**: De afbeelding MUST beschikbaar blijven zolang de video in de live versie zit, ook als
  de eigenaar de video intussen zacht heeft verwijderd of in beschikbaarheid heeft beperkt
  (constitutie V; feature 006 FR-012/FR-014; feature 007 FR-014).
- **FR-005a**: Is een cursus (zacht) verwijderd of onpubliceerd, dan MUST de afbeelding direct niet
  meer op te halen zijn (FR-012) en MUST de cursus met haar `thumbnailUrl` uit de lijst verdwijnen.
  Het CMS MUST NOT een eigen bestand voor de cursusafbeelding opslaan en MUST NOT bij het verwijderen
  van een cursus het thumbnailbestand van de video wissen: dat bestand wordt samen met het
  videobestand gewist door de bestaande opruimregel (feature 002 FR-020a), zodat de video in de
  bibliotheek en in andere cursussen zijn thumbnail houdt (Clarifications).

**Lijst en cursusinhoud (uitbreiding van het contract)**

- **FR-006**: Elke cursus in de lijst (`GET /courses`) MUST een veld `thumbnailUrl` krijgen: het
  adres van de afbeelding, relatief ten opzichte van de server
  (`/api/quest/v1/courses/<courseId>/thumbnail?v=<versionNumber>`, met het versienummer van de live
  versie), of `null` als de cursus geen afbeelding heeft. Het adres verandert dus bij elke nieuwe
  live versie, zodat de app afbeeldingen per adres kan bewaren (Clarifications).
- **FR-007**: De cursusinhoud (`GET /courses/:courseId`) MUST hetzelfde veld `thumbnailUrl` krijgen,
  met dezelfde waarde als in de lijst voor die cursus op hetzelfde moment.
- **FR-008**: Het contract `specs/007-quest-api/contracts/quest-api.md` MUST alleen worden
  uitgebreid volgens de compatibiliteitsregel van v1: velden en een endpoint toevoegen. Bestaande
  velden, endpoints, foutcodes en hun betekenis MUST NOT worden weggehaald, hernoemd of veranderd.
- **FR-009**: `downloadSizeBytes` MUST dezelfde definitie houden als in feature 007: de video's uit de
  live versie plus de bytes van de cursusinhoud zoals de server hem stuurt. Het nieuwe veld telt mee
  als deel van die inhoud; de afbeelding zelf MUST NOT meetellen.

**De afbeelding ophalen**

- **FR-010**: Een gekoppelde Quest MUST de afbeelding van een cursus kunnen ophalen op
  `GET /api/quest/v1/courses/:courseId/thumbnail`, met dezelfde koppeling als de andere verzoeken.
  Het antwoord is het afbeeldingsbestand (JPEG, zoals de thumbnails van video's). De parameter `v`
  MUST NOT invloed hebben op welke afbeelding wordt geleverd of op de toegang: het is altijd de
  afbeelding van de huidige live versie.
- **FR-011**: Zonder geldige koppeling MUST het ophalen worden geweigerd met `401 relink_required`
  (feature 007 FR-004).
- **FR-012**: Een cursus die de Quest volgens feature 007 niet ziet (andere organisatie, geen live
  versie, onpubliceerd, verwijderd, niet bestaand, id met een verkeerde vorm) of die geen
  afbeelding heeft, MUST worden geweigerd met `404 not_found`, zonder onderscheid tussen die
  gevallen.
- **FR-013**: Het CMS MUST bij de afbeelding alleen de toegang controleren en bepalen welk bestand
  het is; de bytes MUST door de webserver worden geleverd, niet door de applicatie zelf
  (constitutie III), net als bij video's.
- **FR-014**: Het antwoord MUST NOT door tussenliggende caches gedeeld worden en MUST bij elk gebruik
  opnieuw gecontroleerd kunnen worden, net als bij video's (feature 007), zodat een afbeelding na
  onpubliceren of een vernieuwde koppelcode niet meer te krijgen is. Dit gaat over HTTP-caches; de
  Quest-app mag een opgehaalde afbeelding wel zelf bewaren, per adres (FR-006), net als een
  gedownloade cursus (FR-09-VR).

**Algemeen**

- **FR-015**: Welke cursussen een Quest ziet, MUST via dezelfde ene regel van feature 007 (FR-006)
  worden bepaald; de afbeelding MUST NOT een eigen, afwijkende regel hebben.
- **FR-016**: Er MUST geautomatiseerde API-tests zijn voor alle gevallen uit de acceptatiescenario's
  en edge cases: startonderdeel is een video, start met een vraag (ook met meerdere wegen en een
  lus), geen video op de route, video zonder thumbnail, concept wijkt af van live, opnieuw
  gepubliceerd, video zacht verwijderd of beperkt, onpubliceerd, verwijderd (en het thumbnailbestand
  bestaat daarna nog voor de bibliotheek), andere organisatie,
  niet bestaand, verkeerde id-vorm, zonder of met een oude koppelcode, `thumbnailUrl` gelijk in lijst
  en inhoud en met het versienummer van de live versie, een oud of onjuist versienummer in het
  adres, en `downloadSizeBytes` volgens FR-009.
- **FR-017**: Foutmeldingen MUST de vaste Engelse foutcodes en de Nederlandse tekst van feature 007
  gebruiken (constitutie VI); er komen geen nieuwe foutcodes bij.

### Key Entities *(include if feature involves data)*

- **Cursusafbeelding** (afgeleid, niet opgeslagen): de thumbnail van één video uit de live versie,
  gekozen volgens FR-002–FR-004. Hoort bij één cursus en verandert alleen als er een nieuwe versie
  live gaat. Heeft geen eigen bestand: bij verwijderen of onpubliceren is hij alleen niet meer
  bereikbaar (FR-005a).
- **Video** (bestaat, feature 002): heeft een thumbnail op schijf. Die blijft bestaan zolang een
  onderdeel van een cursus naar de video verwijst (opruimregel feature 002 FR-020a), dus ook zolang
  hij in een live versie zit.
- **Course**, **CourseVersion**, **CourseStep**, **Answer** (bestaan, features 004–006): de live
  versie, het startonderdeel en de route bepalen welke video de afbeelding levert.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Voor 100% van de live cursussen in de tests geeft het CMS de afbeelding die volgt uit
  de regel FR-002–FR-004, en voor dezelfde live versie elke keer dezelfde.
- **SC-002**: 0% van de verzoeken zonder geldige koppeling, of voor een cursus van een andere
  organisatie, zonder live versie of verwijderd, levert een afbeelding op.
- **SC-003**: Een Quest-app die alleen het contract van feature 007 kent, werkt zonder aanpassing
  met de uitgebreide API (alle tests van feature 007 blijven slagen).
- **SC-004**: De lijst van een organisatie met 100 gepubliceerde cursussen, nu met afbeeldingsadres,
  is nog steeds binnen 2 seconden opgehaald (feature 007 SC-002).
- **SC-005**: Een afbeelding is binnen 1 seconde opgehaald, zodat de lijst op de Quest snel met
  afbeeldingen gevuld is.
- **SC-006**: Na het zacht verwijderen of beperken van de video die de afbeelding levert, is de
  afbeelding van de live cursus in 100% van de gevallen nog op te halen.

## Assumptions

- **Afgeleide afbeelding, geen eigen keuze van de docent** (Clarifications): een eigen
  cursusafbeelding (een video kiezen of een afbeelding uploaden) is afgewezen voor deze feature. Komt
  die later alsnog, dan kan dat binnen v1: `thumbnailUrl` en het adres blijven gelijk, alleen de keuze
  van de afbeelding (FR-001–FR-005) verandert.
- Er komt geen nieuwe map of opslag op de VPS: thumbnails staan al in de map voor video's
  (`VIDEOS_DIR`, feature 002), die nginx al via de interne route levert. Echt opruimen van
  verwijderde cursussen staat op de backlog (`docs/backlog.md`) en valt buiten deze feature.
- Het datamodel verandert niet: de afbeelding wordt afgeleid uit bestaande gegevens
  (de live versie en de thumbnails van video's). Het ERD hoeft niet aangepast te worden.
- Thumbnails van video's zijn JPEG-bestanden die bij het uploaden worden gemaakt (feature 002). De
  afbeelding van een cursus heeft daarom hetzelfde formaat; er wordt niets geschaald of omgezet.
- Het afbeeldingsadres bevat het versienummer van de live versie (Clarifications). Een nieuwe
  versie zonder andere afbeelding geeft toch een nieuw adres; de app haalt de afbeelding dan één
  keer onnodig opnieuw op. Dat is acceptabel, want een afbeelding is klein.
- De aanname uit feature 007 "thumbnails van video's worden niet meegestuurd" blijft gelden voor de
  video's in de cursusinhoud: er komt alleen een afbeelding per cursus bij, niet per video.
- Tests zijn API-tests van de backend (unit en integratie), zoals in feature 007. E2e-tests
  (Playwright) maakt het team zelf.
- Buiten scope: thumbnails in de editor van het CMS aanpassen; een eigen cursusafbeelding kiezen of
  uploaden (Clarifications); de Quest-app zelf (Quest-spec 003); afbeeldingen schalen
  of in meerdere formaten leveren.
