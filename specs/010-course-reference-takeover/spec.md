# Feature Specification: Gedeelde cursussen overnemen als verwijzing (FR-12, deel 2)

**Feature Branch**: `Development` (spec-map: `specs/010-course-reference-takeover`)

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "spec 010: Gedeelde cursussen overnemen als verwijzing (FR-12, deel 2).
Bouw voort op spec 009 (delen bij publiceren en de centrale cursusbibliotheek: Course.visibility,
CourseAccess, libraryCoursesQuery), spec 006 (publiceren, versies, live versie) en spec 007
(Quest-API; questLiveVersions in questCatalog.js is de enige plek die bepaalt welke cursussen een
Quest ziet). Een organisatie kan een cursus uit de cursusbibliotheek toevoegen aan haar eigen
organisatie. Ze krijgt dan een verwijzing naar de originele cursus, geen kopie (ERD:
OrganisationCourse met isOwner = FALSE). De overgenomen cursus staat in haar cursusoverzicht,
duidelijk herkenbaar als overgenomen met de naam van de eigenaar, en komt op haar Quests. De
ontvanger kan een verwijzing niet bewerken in de editor; ze kan hem wel weer uit haar organisatie
verwijderen (dat raakt het origineel niet). Publiceert de eigenaar een nieuwe versie, dan krijgt
elke organisatie met een verwijzing daar een melding van in het CMS. Zij kiest de nieuwe versie of
blijft op de oude; de verwijzing wijst naar de gekozen versie en die versie staat op haar Quests.
Een versie waar een organisatie bewust op blijft, telt mee als gebruik van de video's erin (FR-13),
ook als het geen live versie van de eigenaar meer is. Werk uit wat er met een bestaande verwijzing
gebeurt als de eigenaar de cursus onpubliceert, verwijdert of later beperkt (minder organisaties of
"Alleen eigen organisatie"). Uitgangspunt van feature 006: een verwijderde cursus blijft (zacht)
bestaan zolang een andere organisatie hem via een verwijzing gebruikt. Houd rekening met de volgende
spec (011): daar krijgt een organisatie met een verwijzing bij "Aanpassen" een volledige eigen kopie
(nieuwe Course met parentCourseId), waarin ze video's die niet algemeen beschikbaar zijn mag blijven
gebruiken (FR-14, niet terug te draaien). Kies het datamodel zo dat 011 een verwijzing kan omzetten
naar een kopie zonder bestaande gegevens om te zetten, en leg vast welke organisatie wanneer een
cursus heeft overgenomen, zodat 011 weet voor welke beperkte video's de eigenaar toestemming gaf.
Buiten scope: een eigen kopie bij aanpassen en bewerken in de editor (spec 011), het echt opruimen
van verwijderde cursussen en video's, de inhoud van een gedeelde cursus alleen-lezen bekijken vóór
het overnemen, de versiegeschiedenis (FR-11b), en meldingen per e-mail."

**Bronnen**: `docs/Requirements.docx` FR-12 (delen en overnemen; dit is deel 2), FR-13 (zachte
verwijdering van video's, gebruik door cursussen), FR-14 (beschikbaarheid van video's, gebruik van
beperkte video's door ontvangers), NFR-03 (eenvoudige taal); ERD `docs/Diagrams.simp`, tabellen
`OrganisationCourse` (velden `isOwner`, `addedAt`), `Course` (veld `parentCourseId`) en
`CourseVersion`. Bouwt voort op feature 001 (organisaties, afscherming), feature 006 (publiceren,
live versie, zachte verwijdering van cursussen), feature 007 (Quest-API), feature 008 (thumbnail per
cursus) en feature 009 (beschikbaarheid van cursussen, de cursusbibliotheek, de waarschuwing over
beperkte video's). `docs/backlog.md`, "Gedeelde cursussen overnemen als verwijzing" en "Eigen kopie
van een overgenomen cursus bij aanpassen (spec 011)", beschrijft deze en de volgende stap.

## Begrippen

- **Eigenaar**: de organisatie die de cursus gemaakt heeft en hem als enige kan bewerken,
  publiceren en delen (feature 009, FR-027: elke cursus heeft precies één eigenaar).
- **Ontvanger**: een andere organisatie die de cursus uit de cursusbibliotheek heeft toegevoegd.
- **Verwijzing**: de koppeling tussen de ontvanger en de originele cursus. Een verwijzing wijst
  altijd naar precies één gepubliceerde versie van de eigenaar: de **gekozen versie**. Dat is de
  versie die op de Quests van de ontvanger staat. Er wordt niets gekopieerd.
- **Live versie**: de versie van de eigenaar die nu gepubliceerd is (feature 006).

## Clarifications

### Session 2026-11-27

- Q: Wat gebeurt er met een bestaande verwijzing als de eigenaar de cursus onpubliceert, verwijdert
  of minder breed deelt? → A: In alle drie de gevallen houdt de ontvanger haar gekozen versie op de
  Quests; zij krijgt alleen geen nieuwe versies meer en ziet bij de cursus waarom (User Story 4,
  FR-011, FR-017).
- Q: Mag de eigenaar zien welke organisaties haar cursus hebben overgenomen, of alleen hoeveel?
  → A: Het aantal plus de namen, in het venster van de cursus in de bibliotheek en in het
  publicatiemenu; in de bevestigingen alleen het aantal (FR-019).
- Q: Moet een ontvanger bij elke nieuwe versie zelf kiezen, of kan zij nieuwe versies automatisch
  laten gebruiken? → A: Altijd zelf kiezen; automatisch bijwerken komt op de backlog (FR-012 t/m
  FR-016).
- Q: Wat gebeurt er met overgenomen cursussen als de beheerder de organisatie van de eigenaar
  verwijdert? → A: Ontvangers houden hun gekozen versie op de Quests en zien dat de eigenaar niet
  meer bestaat, net als bij een verwijderde cursus (Edge Cases, FR-011, FR-017).
- Q: Moet spec 010 een aparte overnamegeschiedenis opslaan, of leiden we alles af uit de verwijzing
  zelf? → A: Geen nieuwe tabel. Wie en wanneer volgen uit de verwijzing (`addedAt`), de versie uit
  de gekozen versie. In spec 011 zijn de kopie (`parentCourseId`) en haar eerste versie het bewijs
  van toestemming. Eerdere versies en verwijderde verwijzingen worden niet bewaard (FR-020, FR-022).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Een cursus uit de bibliotheek toevoegen aan de eigen organisatie (Priority: P1)

Een docent vindt in de cursusbibliotheek een cursus van een andere organisatie en klikt in het
venster van die cursus op "Toevoegen aan mijn organisatie". De cursus staat daarna in het eigen
cursusoverzicht, duidelijk herkenbaar als overgenomen van de eigenaar, en komt bij de volgende
synchronisatie op de Quests van de eigen organisatie.

**Why this priority**: Dit is de kern van deel 2 van FR-12 en het doel van de cursusbibliotheek
(feature 009): een organisatie hoeft een cursus die al bestaat niet zelf opnieuw te maken.

**Independent Test**: Organisatie A deelt een cursus algemeen. Als B de cursus toevoegen: in de
cursusbibliotheek van B staat hij als "Toegevoegd", en een Quest van B krijgt de cursus (met inhoud
en video's) via de Quest-API. Een Quest van C krijgt hem niet. (Het cursusoverzicht hoort bij User
Story 2.)

**Acceptance Scenarios**:

1. **Given** een cursus van een andere organisatie in de cursusbibliotheek, **When** de docent het
   venster van de cursus opent, **Then** staat daar de knop "Toevoegen aan mijn organisatie".
2. **Given** die knop, **When** de docent erop klikt, **Then** vraagt het systeem eerst om
   bevestiging in eenvoudige taal: de cursus komt op de Quests van de eigen organisatie, blijft van
   de eigenaar (wie hem wil aanpassen, maakt later een eigen kopie; gewijzigd door spec 011), en bij
   een nieuwe versie kiest de organisatie zelf of zij die gebruikt. Met "Toevoegen" en "Annuleren".
3. **Given** de docent bevestigt, **When** het toevoegen gelukt is, **Then** staat de cursus in het
   eigen cursusoverzicht met de pil "Overgenomen van <naam eigenaar>", het versienummer van de
   gekozen versie (de live versie op het moment van toevoegen) en de status "Op de Quest: versie N
   · <datum>" (zoals bij eigen cursussen, feature 006).
4. **Given** een toegevoegde cursus, **When** een Quest van de organisatie de lijst met cursussen
   opvraagt (feature 007), **Then** staat de gekozen versie erin en kan de Quest de inhoud, de
   thumbnail en de video's ervan downloaden, net als bij een eigen cursus.
5. **Given** een cursus die de organisatie al heeft toegevoegd, **When** zij hem in de
   cursusbibliotheek ziet, **Then** staat er "Toegevoegd" in plaats van de knop, en kan zij hem niet
   een tweede keer toevoegen.
6. **Given** een eigen gedeelde cursus in de bibliotheek (pil "Eigen"), **When** de eigenaar het
   venster opent, **Then** staat de knop "Toevoegen aan mijn organisatie" er niet.
7. **Given** de cursus is net niet meer beschikbaar voor de organisatie (onpubliceerd, verwijderd of
   beperkt terwijl de bibliotheek nog open stond), **When** de docent toch op "Toevoegen" klikt,
   **Then** wordt er niets toegevoegd en krijgt zij de melding dat de cursus niet meer beschikbaar
   is.

---

### User Story 2 - Een overgenomen cursus in het eigen cursusoverzicht (Priority: P1)

De ontvanger ziet haar overgenomen cursussen tussen haar eigen cursussen, maar kan ze niet
bewerken. Zij kan de samenvatting bekijken en de cursus weer uit haar organisatie verwijderen.

**Why this priority**: Zonder dit kan de ontvanger niet zien wat er op haar Quests staat en een
overgenomen cursus niet meer kwijt; de afscherming van de editor beschermt het origineel.

**Independent Test**: Als B (met een verwijzing naar een cursus van A) het cursusoverzicht openen:
de cursus staat erin met de pil "Overgenomen van A", openen toont de samenvatting zonder editor.
Verwijderen: de cursus is weg uit het overzicht van B en van de Quests van B; bij A en bij andere
ontvangers is niets veranderd.

**Acceptance Scenarios**:

1. **Given** het cursusoverzicht van een organisatie met eigen en overgenomen cursussen, **When**
   de docent het opent, **Then** staan beide in één lijst; een overgenomen cursus heeft de pil
   "Overgenomen van <naam eigenaar>" en de naam, beschrijving en thumbnail van de gekozen versie.
2. **Given** een overgenomen cursus, **When** de docent erop klikt, **Then** opent een venster met
   de samenvatting van de gekozen versie (zoals in de cursusbibliotheek, feature 009, FR-017),
   zonder knoppen om te bewerken, te publiceren, te onpubliceren of de beschikbaarheid te wijzigen.
3. **Given** een overgenomen cursus, **When** iemand van de ontvanger hem in de editor probeert te
   openen of te wijzigen, ook buiten de interface om, **Then** wordt dat geweigerd alsof de cursus
   niet bestaat (feature 006, FR-002).
4. **Given** het venster van een overgenomen cursus, **When** de docent op "Verwijderen uit mijn
   organisatie" klikt, **Then** vraagt het systeem om bevestiging: de cursus verdwijnt van de
   Quests van de eigen organisatie bij hun volgende synchronisatie, en het origineel van de
   eigenaar blijft bestaan.
5. **Given** de docent bevestigt het verwijderen, **When** het gelukt is, **Then** staat de cursus
   niet meer in het eigen cursusoverzicht, niet meer in de Quest-API van de eigen organisatie, en
   is voor de eigenaar en voor andere ontvangers niets veranderd.
6. **Given** een verwijderde verwijzing naar een cursus die nog in de bibliotheek staat, **When** de
   docent hem opnieuw toevoegt, **Then** krijgt zij een nieuwe verwijzing naar de live versie van
   dat moment.
7. **Given** een overgenomen cursus die niet meer in de bibliotheek van de ontvanger staat (User
   Story 4), **When** zij op "Verwijderen uit mijn organisatie" klikt, **Then** zegt de bevestiging
   ook dat zij hem daarna niet opnieuw kan toevoegen.

---

### User Story 3 - Melding bij een nieuwe versie en kiezen welke versie (Priority: P1)

Publiceert de eigenaar een nieuwe versie van een cursus, dan ziet elke ontvanger in het CMS een
melding. Zij kiest "Nieuwe versie gebruiken" of "Huidige versie houden". Tot zij kiest, blijft de
oude versie op haar Quests staan.

**Why this priority**: Een ontvanger moet erop kunnen rekenen dat wat op haar Quests staat niet
ongevraagd verandert (bijvoorbeeld midden in een lesperiode), en moet verbeteringen van de eigenaar
toch kunnen gebruiken.

**Independent Test**: B heeft een verwijzing naar versie 1 van een cursus van A. A publiceert
versie 2. B ziet een melding; de Quests van B krijgen nog steeds versie 1. B kiest "Nieuwe versie
gebruiken": de Quests van B krijgen versie 2. Bij C (ook met een verwijzing, kiest "Huidige versie
houden") blijft versie 1 op de Quests, ook als A versie 3 publiceert en C daarover een nieuwe
melding krijgt.

**Acceptance Scenarios**:

1. **Given** een ontvanger met een verwijzing naar versie N, **When** de eigenaar versie N+1
   publiceert, **Then** ziet de ontvanger bij het volgende laden van het CMS een melding: in de
   navigatie bij "Cursussen" het aantal cursussen met een nieuwe versie, en in het cursusoverzicht
   bij die cursus "Nieuwe versie beschikbaar (versie N+1)".
2. **Given** die melding, **When** de docent de cursus opent, **Then** ziet zij het versienummer en
   de publicatiedatum van haar huidige versie en van de nieuwe versie, en de knoppen "Nieuwe versie
   gebruiken" en "Huidige versie houden".
3. **Given** de docent kiest "Nieuwe versie gebruiken", **When** de keuze is opgeslagen, **Then**
   wijst de verwijzing naar de nieuwe versie, verdwijnt de melding, en krijgen de Quests van de
   organisatie bij hun volgende synchronisatie de nieuwe versie.
4. **Given** de docent kiest "Huidige versie houden", **When** de keuze is opgeslagen, **Then**
   blijft de verwijzing op de huidige versie, verdwijnt de melding, en blijft bij de cursus zichtbaar
   dat er een nieuwere versie is, met de knop "Nieuwe versie gebruiken" om later alsnog over te
   stappen.
5. **Given** de ontvanger heeft nog niet gekozen, **When** de eigenaar intussen nog een versie
   publiceert, **Then** is er één melding voor die cursus, die de nieuwste live versie noemt;
   "Nieuwe versie gebruiken" kiest altijd de live versie van dat moment.
6. **Given** de ontvanger heeft "Huidige versie houden" gekozen, **When** de eigenaar daarna weer
   een nieuwe versie publiceert, **Then** krijgt de ontvanger opnieuw een melding.
7. **Given** de eigenaar werkt aan een concept zonder te publiceren, **When** de ontvanger het CMS
   opent, **Then** krijgt zij geen melding en ziet zij niets van het concept.
8. **Given** een ontvanger die een nieuwere versie heeft gekozen, **When** zij terug wil naar de
   vorige versie, **Then** kan dat niet; een oude versie kiezen hoort bij de versiegeschiedenis
   (FR-11b, buiten scope).

---

### User Story 4 - Wat er met een verwijzing gebeurt als de eigenaar intrekt, verwijdert of beperkt (Priority: P2)

De eigenaar blijft vrij om een gedeelde cursus te onpubliceren, te verwijderen of minder breed te
delen. Ontvangers die hem al hebben overgenomen, houden dan de versie die zij hebben, maar krijgen
geen nieuwe versies meer. Zij zien in het CMS waarom.

**Why this priority**: Zonder duidelijke regel kan een ontvanger plotseling een cursus van haar
Quests kwijtraken, of kan de eigenaar onbedoeld blijven leveren aan organisaties die zij heeft
uitgesloten. De regel sluit aan bij feature 006 (een verwijderde cursus blijft bestaan zolang hij
via een verwijzing gebruikt wordt) en bij FR-14 (toestemming voor beperkte video's is niet terug te
draaien).

**Independent Test**: B en C hebben een verwijzing naar versie 2 van een cursus van A. A beperkt de
cursus tot "Selectief beschikbaar" voor alleen C en publiceert versie 3: B houdt versie 2 op de
Quests zonder melding over versie 3 en ziet "De eigenaar deelt deze cursus niet meer met jullie";
C krijgt de melding over versie 3. A verwijdert de cursus: B en C houden hun versie op de Quests en
zien "De eigenaar heeft deze cursus verwijderd"; de cursus staat niet meer in het overzicht van A en
niet meer in de bibliotheek.

**Acceptance Scenarios**:

1. **Given** een cursus met ontvangers, **When** de eigenaar hem onpubliceert, **Then** blijft bij
   elke ontvanger de gekozen versie op de Quests staan, en ziet de ontvanger bij de cursus "De
   eigenaar heeft deze cursus ingetrokken. Jullie houden versie <N>." Er komen geen meldingen over
   nieuwe versies tot de eigenaar weer publiceert.
2. **Given** een ingetrokken cursus, **When** de eigenaar hem opnieuw publiceert en de ontvanger nog
   toegang heeft, **Then** verdwijnt de tekst over intrekken, en krijgt de ontvanger een melding als
   de live versie nieuwer is dan haar gekozen versie.
3. **Given** een cursus met ontvangers, **When** de eigenaar hem verwijdert, **Then** blijft de
   cursus (zacht) bestaan, blijft bij elke ontvanger de gekozen versie op de Quests staan, en ziet de
   ontvanger "De eigenaar heeft deze cursus verwijderd. Jullie houden versie <N>." Voor de eigenaar
   en in de bibliotheek is de cursus weg, zoals bij elke verwijderde cursus.
4. **Given** een cursus met ontvangers, **When** de eigenaar de beschikbaarheid zo wijzigt dat een
   ontvanger geen toegang meer heeft (minder organisaties of "Alleen eigen organisatie"), **Then**
   houdt die ontvanger haar gekozen versie op de Quests, krijgt zij geen meldingen meer over nieuwe
   versies, en ziet zij "De eigenaar deelt deze cursus niet meer met jullie. Jullie houden versie
   <N>."
5. **Given** een ontvanger zonder toegang, **When** de eigenaar haar later weer toegang geeft,
   **Then** verdwijnt die tekst en krijgt zij een melding als de live versie nieuwer is dan haar
   gekozen versie.
6. **Given** een cursus met ontvangers, **When** de eigenaar onpubliceert, verwijdert of de
   beschikbaarheid beperkt, **Then** zegt de bevestiging bij de eigenaar ook hoeveel organisaties de
   cursus hebben overgenomen en dat zij hun huidige versie houden (bij één: "1 organisatie heeft
   deze cursus overgenomen en houdt haar huidige versie.").
7. **Given** de eigenaar van een gedeelde cursus, **When** zij het venster van haar cursus in de
   bibliotheek of het publicatiemenu opent, **Then** ziet zij hoeveel organisaties de cursus hebben
   overgenomen en de namen van die organisaties (alfabetisch).

---

### User Story 5 - Gebruik van video's door overgenomen versies (Priority: P2)

Een versie waar een ontvanger op staat, telt mee als gebruik van de video's erin, ook als het geen
live versie van de eigenaar meer is. Zo blijven die video's werken op de Quests van de ontvanger.

**Why this priority**: Zonder deze regel kan een Quest van een ontvanger een cursus krijgen waarvan
een video niet meer te downloaden is (FR-13).

**Independent Test**: B staat bewust op versie 1 van een cursus van A, A gebruikt in versie 2 een
andere video en verwijdert de video van versie 1. De Quest van B kan de video van versie 1 nog
steeds downloaden, en het bestand wordt niet opgeruimd.

**Acceptance Scenarios**:

1. **Given** een ontvanger op een versie die niet meer de live versie van de eigenaar is, **When**
   de eigenaar een video uit die versie verwijdert (zacht, feature 002), **Then** blijft de video
   met bestand bestaan en kunnen de Quests van de ontvanger hem downloaden.
2. **Given** een video in de gekozen versie van een ontvanger die de eigenaar van de video later
   beperkt (minder organisaties of "Alleen eigen organisatie"), **When** een Quest van de ontvanger
   de cursus downloadt, **Then** krijgt hij die video gewoon (FR-14: de toestemming bij het delen is
   niet terug te draaien).
3. **Given** een ontvanger op een versie, **When** zij de verwijzing verwijdert of naar een nieuwere
   versie overstapt, **Then** telt de oude versie voor haar niet meer als gebruik. (Zolang de
   versie zelf bestaat, blijven haar video's met bestand bestaan; het echt opruimen van versies en
   video's staat op de backlog.)
4. **Given** een Quest van een ontvanger, **When** hij een video opvraagt die niet in de gekozen
   versie van een van de cursussen op die Quest zit, **Then** wordt dat geweigerd alsof de video
   niet bestaat (feature 007).

---

### Edge Cases

- **Eigen cursus toevoegen**: kan niet; de knop staat er niet en de server weigert het.
- **Twee keer toevoegen**: de tweede keer wordt geweigerd; er is per organisatie ten hoogste één
  verwijzing per cursus.
- **Toevoegen terwijl de toegang net vervalt**: de server controleert op het moment van toevoegen
  of de cursus volgens de cursusbibliotheek (feature 009, FR-014) voor de organisatie beschikbaar
  is; zo niet, dan wordt er niets toegevoegd (User Story 1, scenario 7).
- **Overstappen terwijl de toegang net vervalt of de eigenaar intrekt**: "Nieuwe versie gebruiken"
  slaagt alleen als de ontvanger op dat moment toegang heeft en de cursus een live versie heeft;
  anders blijft de verwijzing op de huidige versie en krijgt zij de bijbehorende uitleg.
- **Verwijderde cursus met ontvangers**: blijft zacht bestaan zolang een ontvanger er een verwijzing
  naar heeft; zijn alle verwijzingen verwijderd, dan geldt hij als ongebruikt (het echt opruimen
  staat op de backlog). De eigenaar kan een verwijderde cursus niet terughalen (feature 006).
- **De eigenaar wordt door de beheerder verwijderd** (feature 001): haar cursussen verdwijnen uit de
  bibliotheek (feature 009). Ontvangers houden hun gekozen versie, zoals bij een verwijderde cursus,
  en zien "De eigenaar van deze cursus bestaat niet meer. Jullie houden versie <N>." De pil
  "Overgenomen van <naam>" blijft de oude naam tonen. De video's in de gekozen versie blijven met
  bestand bestaan en te downloaden voor de Quests van de ontvangers (FR-021), ook al is hun eigenaar
  verwijderd.
- **De ontvanger wordt door de beheerder verwijderd**: haar verwijzingen tellen niet meer mee (niet
  voor de Quest-API, niet als gebruik van video's, niet in het aantal bij de eigenaar).
- **Een video in de gekozen versie is van een derde organisatie** (selectief gedeeld met de
  eigenaar): telt mee in de waarschuwing bij delen (feature 009, FR-009) en werkt daarna op de
  Quests van de ontvanger zoals elke andere video in de versie.
- **Thumbnail**: een overgenomen cursus toont in het cursusoverzicht en op de Quests de thumbnail van
  de gekozen versie (feature 008), ook als die van een video is die niet in de videobibliotheek van
  de ontvanger staat, omdat de ontvanger de video's binnen de cursus mag gebruiken (feature 009,
  FR-011). In de cursusbibliotheek blijft de regel van feature 009 (FR-015) gelden.
- **Video's van een overgenomen cursus in de eigen videobibliotheek**: verschijnen daar niet en kunnen
  niet in eigen cursussen gekozen worden, tenzij ze al op een andere manier voor de organisatie
  beschikbaar zijn (feature 003).
- **Cursusnaam gelijk aan een eigen cursus**: toegestaan; de pil maakt het verschil zichtbaar.
- **Melding en meerdere docenten**: de melding hoort bij de organisatie, niet bij een persoon (er is
  één account per organisatie, feature 001); wie kiest, kiest voor de hele organisatie.
- **Twee keer tegelijk kiezen** (twee tabbladen): de laatste opgeslagen keuze geldt; kiezen kan
  nooit leiden tot een versie die geen gepubliceerde versie van de eigenaar is.
- **Nieuwe versie die alleen de beschikbaarheid wijzigt**: bestaat niet; beschikbaarheid wijzigen
  maakt geen nieuwe versie (feature 009, FR-006) en geeft dus geen melding.
- **Quest offline**: een Quest houdt wat hij gedownload heeft (feature 007, FR-09-VR); de nieuwe of
  verwijderde cursus komt pas bij de volgende synchronisatie.
- **De beheerder**: heeft geen functies voor cursussen, verwijzingen of meldingen.

## Requirements *(mandatory)*

### Functional Requirements

**Toevoegen**

- **FR-001**: In het venster van een cursus van een andere organisatie in de cursusbibliotheek
  (feature 009, FR-017) MUST de knop "Toevoegen aan mijn organisatie" staan, tenzij de organisatie
  de cursus al heeft toegevoegd; dan MUST er "Toegevoegd" staan. Bij een eigen cursus MUST de knop
  er niet staan.
- **FR-002**: Toevoegen MUST eerst om bevestiging vragen in eenvoudige taal (User Story 1, scenario
  2), met "Toevoegen" en "Annuleren". Bij annuleren MUST er niets veranderen.
- **FR-003**: Toevoegen MUST een verwijzing maken van de organisatie naar de originele cursus, met
  de live versie van dat moment als gekozen versie. Er MUST NOT iets van de cursus, de versies, de
  onderdelen of de video's gekopieerd worden.
- **FR-004**: De server MUST toevoegen weigeren als de cursus op dat moment niet volgens feature
  009, FR-014 voor de organisatie in de bibliotheek staat, als het een eigen cursus is, of als de
  organisatie al een verwijzing naar de cursus heeft. Een cursus die niet beschikbaar is MUST
  geweigerd worden met dezelfde reactie als een cursus die niet bestaat (feature 009, FR-021).
- **FR-005**: Per organisatie MUST er ten hoogste één verwijzing per cursus zijn, en een organisatie
  MUST NOT tegelijk eigenaar en ontvanger van dezelfde cursus zijn.

**De verwijzing bij de ontvanger**

- **FR-006**: Het cursusoverzicht van een organisatie MUST naast de eigen cursussen ook haar
  verwijzingen tonen, met de naam, beschrijving en thumbnail van de gekozen versie, het
  versienummer, de pil "Overgenomen van <naam eigenaar>", en waar van toepassing de melding van
  FR-012 of de uitleg van FR-017.
- **FR-007**: Een ontvanger MUST van een overgenomen cursus alleen de samenvatting van de gekozen
  versie kunnen zien (zoals feature 009, FR-017). De volledige inhoud bekijken blijft buiten scope
  (backlog "Inhoud van een gedeelde cursus alleen-lezen bekijken").
- **FR-008**: Een ontvanger MUST een overgenomen cursus NOT kunnen openen in de editor, bewerken,
  publiceren, onpubliceren, verwijderen als cursus of de beschikbaarheid ervan wijzigen; elke poging
  MUST geweigerd worden alsof de cursus niet bestaat (feature 006, FR-002), ongeacht hoe het verzoek
  is samengesteld. Een eigen kopie bij aanpassen komt in spec 011.
- **FR-009**: Een ontvanger MUST een verwijzing kunnen verwijderen via "Verwijderen uit mijn
  organisatie", na bevestiging (User Story 2, scenario 4 en 7). Dat MUST alleen de verwijzing van
  deze organisatie verwijderen; de cursus, de versies, de beschikbaarheid en de verwijzingen van
  andere organisaties MUST ongewijzigd blijven.

**Quests**

- **FR-010**: De cursussen die een Quest ziet (feature 007, FR-006) MUST bestaan uit de live versies
  van de eigen cursussen (zoals nu) plus, voor elke verwijzing van de organisatie, de gekozen versie.
  Dit MUST op één plek bepaald worden, zodat de lijst met cursussen, de download van de inhoud, de
  thumbnail en de toegang tot video's altijd hetzelfde antwoord geven.
- **FR-011**: De gekozen versie van een verwijzing MUST op de Quests van de ontvanger blijven staan,
  ongeacht of de eigenaar de cursus intussen onpubliceert, verwijdert of beperkt, of de eigenaar zelf
  verwijderd wordt (User Story 4). Alleen de ontvanger zelf haalt hem eraf (FR-009) of kiest een
  andere versie (FR-014).

**Nieuwe versies**

- **FR-012**: Heeft de eigenaar een live versie die nieuwer is dan de gekozen versie van een
  ontvanger, en heeft de ontvanger nog toegang (feature 009, FR-014), dan MUST de ontvanger een
  melding zien: in de navigatie bij "Cursussen" het aantal cursussen met zo'n melding, en in het
  cursusoverzicht bij de cursus "Nieuwe versie beschikbaar (versie <N>)". De melding MUST
  verschijnen bij het volgende laden van het CMS (geen polling, feature 001).
- **FR-013**: In het venster van een cursus met een melding MUST de ontvanger het versienummer en de
  publicatiedatum van haar gekozen versie en van de live versie zien, met "Nieuwe versie gebruiken"
  en "Huidige versie houden".
- **FR-014**: "Nieuwe versie gebruiken" MUST de verwijzing laten wijzen naar de live versie van dat
  moment. De server MUST dit weigeren als de ontvanger geen toegang meer heeft of de cursus geen live
  versie heeft; de verwijzing blijft dan ongewijzigd. Terug naar een oudere versie MUST NOT mogelijk
  zijn.
- **FR-015**: "Huidige versie houden" MUST de verwijzing ongewijzigd laten en de melding voor die
  live versie laten verdwijnen. De ontvanger MUST daarna in het venster van de cursus nog zien dat
  er een nieuwere versie is en alsnog "Nieuwe versie gebruiken" kunnen kiezen. Publiceert de
  eigenaar daarna een nog nieuwere versie, dan MUST de melding opnieuw verschijnen.
- **FR-016**: Meldingen MUST alleen ontstaan door een nieuwe gepubliceerde versie, nooit door een
  concept, een wijziging van de beschikbaarheid of opnieuw publiceren van een versie die de
  ontvanger al heeft. Er MUST per cursus ten hoogste één openstaande melding zijn, die altijd de
  nieuwste live versie noemt.

**Intrekken, verwijderen en beperken door de eigenaar**

- **FR-017**: Heeft een verwijzing geen toegang meer tot nieuwe versies, dan MUST de ontvanger bij de
  cursus een uitleg zien met de reden en de versie die zij houdt: "De eigenaar heeft deze cursus
  ingetrokken.", "De eigenaar heeft deze cursus verwijderd.", "De eigenaar deelt deze cursus niet
  meer met jullie." of "De eigenaar van deze cursus bestaat niet meer.", telkens gevolgd door
  "Jullie houden versie <N>." Zolang die situatie duurt, MUST er geen melding over nieuwe versies
  komen en MUST "Nieuwe versie gebruiken" niet mogelijk zijn. Herstelt de situatie zich (opnieuw
  gepubliceerd, weer toegang), dan MUST de uitleg verdwijnen en geldt FR-012 weer.
- **FR-018**: Een verwijderde cursus waarnaar nog een verwijzing bestaat MUST (zacht) blijven bestaan
  met al zijn gepubliceerde versies (feature 006). Hij MUST NOT terugkomen in het cursusoverzicht van
  de eigenaar of in de cursusbibliotheek.
- **FR-019**: De bevestigingen bij de eigenaar van onpubliceren, verwijderen (feature 006, FR-015 en
  FR-021) en beperken van de beschikbaarheid (feature 009, FR-007) MUST bij een cursus met ontvangers
  ook het aantal ontvangers noemen en zeggen dat zij hun huidige versie houden (alleen het aantal).
  Bij beperken telt de bevestiging alleen de ontvangers die door de nieuwe keuze geen toegang meer
  hebben.
  Het venster van een eigen gedeelde cursus in de bibliotheek en het publicatiemenu MUST het aantal
  ontvangers en hun namen (alfabetisch) tonen, alleen aan de eigenaar. De versie waarop een
  ontvanger staat MUST NOT voor de eigenaar zichtbaar zijn, en andere ontvangers MUST NOT zien wie
  de cursus nog meer heeft overgenomen.

**Vastleggen voor gebruik van video's en voor spec 011**

- **FR-020**: Een verwijzing MUST vastleggen welke organisatie de cursus heeft overgenomen, wanneer
  zij hem heeft toegevoegd en welke versie zij nu gebruikt. Er komt geen aparte geschiedenis:
  eerdere versies en verwijderde verwijzingen worden niet bewaard (Clarifications). Een verwijzing
  ontstaat en wisselt alleen van versie terwijl de cursus voor de organisatie in de bibliotheek
  staat, dus de eigenaar gaf bij het delen toestemming voor alle video's (ook beperkte) in de
  gekozen versie (feature 009, FR-009 t/m FR-011). Omdat een versie nooit verandert, is dat altijd
  uit de gekozen versie af te leiden.
- **FR-021**: De gekozen versie van elke verwijzing van een niet-verwijderde ontvanger MUST meetellen
  als gebruik van de video's erin (FR-13), ook als die versie niet meer de live versie van de
  eigenaar is, de cursus is verwijderd of de video is verwijderd of beperkt. Een video die zo
  gebruikt wordt, MUST met bestand blijven bestaan en MUST voor de Quests van de ontvanger te
  downloaden zijn.
- **FR-022**: Het ontwerp MUST spec 011 mogelijk maken zonder bestaande gegevens om te zetten: een
  verwijzing kan dan vervangen worden door een nieuwe cursus met een verwijzing naar het origineel
  (`parentCourseId`) waarvan de ontvanger eigenaar wordt, op basis van de gekozen versie. Daarna
  zijn de kopie en haar eerste versie het bewijs van de toestemming voor de beperkte video's daarin.
  Elke cursus blijft precies één eigenaar hebben; een verwijzing maakt een organisatie nooit
  eigenaar.

**Algemeen**

- **FR-023**: Alle teksten die de docent ziet MUST in het Nederlands zijn, in eenvoudige taal zonder
  technische termen (NFR-03); het woord "verwijzing" MUST NOT in de interface staan ("overgenomen
  cursus" en "Overgenomen van <naam>"). De beheerder MUST NOT functies voor verwijzingen of meldingen
  krijgen.
- **FR-024**: Alle acties van deze feature (toevoegen, verwijderen van een verwijzing, versie kiezen)
  MUST alleen werken voor de eigen organisatie uit de sessie; een organisatie MUST NOT de
  verwijzingen of meldingen van een andere organisatie kunnen zien of wijzigen.

### Key Entities *(include if feature involves data)*

- **OrganisationCourse** (bestaat, ERD): de verwijzing is een rij met `isOwner = FALSE` voor de
  ontvanger; `addedAt` is het moment van toevoegen. Krijgt een verwijzing naar de **gekozen versie**
  (een gepubliceerde `CourseVersion` van de cursus); bij de eigenaar (`isOwner = TRUE`) blijft die
  leeg, want daar geldt de live versie. Moet in het ERD worden bijgewerkt (constitutie).
- **Keuze bij een melding** (nieuw veld bij de verwijzing): voor welke live versie de
  ontvanger "Huidige versie houden" heeft gekozen, zodat de melding pas terugkomt bij een nog
  nieuwere versie (FR-015, FR-016).
- **Course** (bestaat): de eigenaar blijft de enige die hem bewerkt; `deletedAt` blijft de zachte
  verwijdering, ook als er nog verwijzingen zijn (FR-018). `parentCourseId` blijft in deze feature
  leeg; die wordt gebruikt in spec 011.
- **CourseVersion** (bestaat, feature 006): een gekozen versie is altijd een gepubliceerde,
  onveranderlijke versie; door deze feature verandert er niets aan versies.
- **Video** (bestaat): een video in een gekozen versie geldt als gebruikt (FR-021).
- **Course.visibility / CourseAccess** (bestaan, feature 009): bepalen of een ontvanger nog toegang
  heeft tot nieuwe versies (FR-012, FR-017), niet of zij haar gekozen versie houdt (FR-011).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een docent zonder technische kennis voegt een cursus uit de bibliotheek toe en ziet
  hem in het eigen cursusoverzicht binnen 1 minuut, zonder hulp (NFR-03).
- **SC-002**: In een test met drie organisaties, eigen en overgenomen cursussen in alle situaties van
  User Story 3 en 4, krijgt elke Quest precies de juiste cursussen in precies de gekozen versie: 0
  te veel, 0 te weinig, 0 verkeerde versies.
- **SC-003**: 0% van de pogingen om een overgenomen cursus te bewerken, de verwijzing of keuze van
  een andere organisatie te wijzigen, of een cursus toe te voegen die niet beschikbaar is, slaagt,
  ook niet buiten de interface om.
- **SC-004**: Na een nieuwe versie van de eigenaar ziet 100% van de ontvangers met toegang bij het
  volgende laden van het CMS de melding, en 0% van de ontvangers zonder toegang.
- **SC-005**: In 100% van de geteste gevallen waarin de eigenaar een gedeelde cursus onpubliceert,
  verwijdert of beperkt, of een video uit een gekozen versie verwijdert of beperkt, blijft de gekozen
  versie van bestaande ontvangers met alle video's te downloaden op hun Quests.
- **SC-006**: Een docent begrijpt na het lezen van de melding wat er op de Quests staat (getoetst
  met de vraag "welke versie gebruiken jullie Quests nu?"), en maakt de keuze in ten hoogste twee
  klikken.
- **SC-007**: Voor 100% van de bestaande verwijzingen is uit de opgeslagen gegevens af te lezen
  welke organisatie de cursus wanneer heeft toegevoegd en welke versie zij gebruikt.

## Assumptions

- Overnemen kan alleen vanuit de cursusbibliotheek (feature 009); er komt geen andere ingang.
- Een nieuwe versie komt nooit vanzelf op de Quests van een ontvanger; zij kiest altijd zelf (FR-014).
  Een instelling om nieuwe versies automatisch te gebruiken staat op de backlog.
- Bij toevoegen is de gekozen versie altijd de live versie van dat moment; een oudere versie kiezen
  kan niet (versiegeschiedenis, FR-11b, buiten scope).
- Bestaande verwijzingen blijven werken als de eigenaar onpubliceert, verwijdert of beperkt (User
  Story 4). Dat volgt uit feature 006 (een verwijderde cursus blijft bestaan zolang een andere
  organisatie hem gebruikt) en FR-14 (de toestemming voor beperkte video's bij het delen is niet
  terug te draaien). De eigenaar kan een ontvanger dus niet dwingen een cursus van haar Quests te
  halen; wel stopt de levering van nieuwe versies. Gegevens die niet verder mogen verspreiden
  (bijvoorbeeld een video die echt weg moet) horen bij het backlog-item "Zien waar een verwijderde
  video nog gebruikt wordt".
- De toestemming van de eigenaar voor beperkte video's volgt uit het delen zelf: de waarschuwing van
  feature 009 is verplicht voordat een cursus met zulke video's gedeeld wordt, dus elke versie die
  een organisatie via de bibliotheek krijgt, valt onder die toestemming. Een aparte opslag van de
  bevestiging is daarom niet nodig; de gekozen versie van de verwijzing (en in spec 011 de kopie)
  is het bewijs (FR-020).
- De melding is alleen in het CMS zichtbaar en wordt niet op de achtergrond ververst; meldingen per
  e-mail zijn buiten scope.
- Er is één account per organisatie (feature 001); een keuze bij een melding geldt voor de hele
  organisatie.
- De Quest-API verandert alleen in welke cursussen en versies een Quest ziet; de vorm van de
  antwoorden blijft gelijk (feature 007). Een Quest ziet geen verschil tussen een eigen en een
  overgenomen cursus.
- Buiten scope (`docs/backlog.md`): een eigen kopie bij aanpassen en bewerken in de editor (spec
  011), het echt opruimen van verwijderde cursussen en video's, de inhoud van een gedeelde cursus
  alleen-lezen bekijken vóór het overnemen, de versiegeschiedenis (FR-11b), meldingen per e-mail, en
  eigendom van een cursus overdragen.
