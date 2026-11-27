# Feature Specification: Een overgenomen cursus aanpassen als eigen kopie (FR-12, deel 3, en FR-14)

**Feature Branch**: `Development` (spec-map: `specs/011-course-reference-copy`)

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "Spec 011: Een overgenomen cursus aanpassen (eigen kopie). FR-12 deel 3
en FR-14. Bouwt voort op spec 009 (delen en cursusbibliotheek) en spec 010 (overnemen als
verwijzing, specs/010-course-reference-takeover). Een organisatie die een cursus van een andere
organisatie heeft overgenomen, moet die cursus kunnen aanpassen. In het venster van de overgenomen
cursus staat een knop "Aanpassen". Na een bevestiging in eenvoudige taal krijgt de organisatie een
eigen kopie van de versie die zij nu gebruikt (de gekozen versie). Die kopie is vanaf dan haar eigen
cursus: zij kan hem in de editor aanpassen, publiceren, onpubliceren en verwijderen alsof zij hem
zelf gemaakt heeft. De editor opent meteen met de kopie. Het origineel verandert niet en merkt er
niets van [...]. De kopie heeft ook niets meer met het origineel te maken [...]. De overgenomen
cursus verdwijnt uit het overzicht van de organisatie; de kopie komt ervoor in de plaats. Bij de
kopie staat waar hij op gebaseerd is ("Gebaseerd op <cursus> van <organisatie>") [...]. Vastgelegd
in spec 010 (research R13, FR-022): aanpassen gebeurt in één transactie [...]. Video's (FR-14): de
kopie mag de video's uit de gekozen versie blijven gebruiken, ook als ze niet in de videobibliotheek
van de organisatie staan en ook als de eigenaar ze later beperkt of verwijdert. Dit is niet terug te
draaien. Zulke video's komen niet in de eigen videobibliotheek en kunnen niet in andere cursussen
gekozen worden. [...] Uitzoeken: begint de kopie gepubliceerd of als concept? Welk versienummer
krijgt de kopie? Wat zien de Quests? Mag de kopie gedeeld worden met andere organisaties? Buiten
scope: nieuwe versies automatisch gebruiken, een gedeelde cursus alleen-lezen bekijken, verwijderde
cursussen echt opruimen, versiegeschiedenis (FR-11b), wijzigingen van het origineel later overnemen
in de kopie." (volledige tekst: zie de opdracht bij `/speckit-specify` van 2026-11-27)

**Bronnen**: `docs/Requirements.docx` FR-12 (delen en overnemen; dit is deel 3), FR-13 (zachte
verwijdering van video's, gebruik door cursussen), FR-14 (beschikbaarheid van video's; een
ontvanger mag beperkte video's in haar kopie blijven gebruiken), NFR-03 (eenvoudige taal); ERD
`docs/Diagrams.simp`, tabellen `Course` (veld `parentCourseId`), `OrganisationCourse` (veld
`isOwner`) en `CourseVersion`. Bouwt voort op feature 004/005 (de editor), feature 006 (publiceren,
versies, live versie, zachte verwijdering), feature 007 (Quest-API), feature 008 (thumbnail per
cursus), feature 009 (beschikbaarheid, cursusbibliotheek; FR-014 d: een kopie staat nooit in de
bibliotheek) en feature 010 (overgenomen cursussen; research R13 en FR-022 leggen vast hoe een
verwijzing een kopie wordt). Constitutie principe V (zachte verwijdering) geldt ook voor de kopie.
`docs/backlog.md`, "Eigen kopie van een overgenomen cursus bij aanpassen (spec 011)".

## Begrippen

- **Origineel**: de cursus van de eigenaar die de organisatie via de cursusbibliotheek heeft
  overgenomen (feature 010).
- **Gekozen versie**: de versie van het origineel waar de overgenomen cursus van de organisatie nu
  op staat, en die nu op haar Quests staat (feature 010).
- **Kopie**: de nieuwe, eigen cursus die de organisatie krijgt door "Aanpassen". Zij is er de enige
  eigenaar van; de kopie onthoudt alleen op welk origineel hij gebaseerd is.
- **Meegekregen video**: een video die in de gekozen versie zat op het moment van aanpassen, en dus
  in de eerste versie van de kopie zit. Voor deze video's gaf de eigenaar bij het delen toestemming
  (feature 009, FR-009; feature 010, FR-020).

## Beslissingen over de open vragen

Deze punten stonden in de opdracht als "uitzoeken". De keuzes hieronder zijn het voorstel van deze
spec; vraag 1 en 4 zijn bevestigd in Clarifications (sessie 2026-11-27).

1. **Begint de kopie gepubliceerd of als concept?** Gepubliceerd. De kopie begint met een
   gepubliceerde versie met precies de inhoud van de gekozen versie, plus een concept met dezelfde
   inhoud waarin de editor opent (zoals bij elke gepubliceerde cursus, feature 006). Zo blijft er
   op de Quests ononderbroken dezelfde inhoud beschikbaar; een concept alleen zou de cursus van de
   Quests halen tot de organisatie opnieuw publiceert. Wie de kopie liever nog niet op de Quests
   heeft, kan hem gewoon onpubliceren.
2. **Welk versienummer?** De kopie is een nieuwe cursus met een eigen geschiedenis: de gepubliceerde
   versie is versie 1 (publicatiedatum = het moment van aanpassen) en het concept versie 2.
3. **Wat zien de Quests?** De Quest-API en de vorm van de antwoorden veranderen niet (feature 007).
   De kopie heeft een nieuw cursusnummer: bij de volgende synchronisatie ziet een Quest de kopie als
   nieuwe cursus (te downloaden) en de oude overgenomen cursus als cursus die niet meer in het CMS
   staat, zoals bij elke cursus die van de Quests verdwijnt. De bevestiging bij "Aanpassen" zegt dit
   in eenvoudige taal. Een koppeling tussen de oude en de nieuwe cursus op de Quest vraagt een
   afgesproken wijziging van het API-contract en de Quest-app; die komt op de backlog.
4. **Mag de kopie gedeeld worden?** Nee. Een kopie staat nooit in de cursusbibliotheek (feature 009,
   FR-014 d), dus delen heeft geen effect; de kopie blijft altijd "Alleen eigen organisatie" en de
   keuzes voor beschikbaarheid worden bij een kopie niet aangeboden. Zo komen ook de meegekregen
   video's (waarvoor de toestemming alleen deze organisatie geldt) niet bij andere organisaties.

## Clarifications

### Session 2026-11-27

- Q: Moet de organisatie bij een meegekregen video die de eigenaar verwijdert, na het onpubliceren
  van de kopie eerst een andere video kiezen voordat zij opnieuw publiceert? → A: Ja, zoals bij
  eigen cursussen: zolang de kopie gepubliceerd is, blijft de video werken; na onpubliceren moet
  eerst een andere video gekozen worden (constitutie V, ongewijzigd; FR-015).
- Q: Begint de kopie gepubliceerd of alleen als concept? → A: Gepubliceerd: versie 1 is live met de
  inhoud van de gekozen versie, plus concept versie 2 waarin de editor opent. Omdat de overgenomen
  cursus bij aanpassen meteen verdwijnt (spec 010, R13), zou een kopie die alleen als concept
  begint de cursus van de Quests halen tot hij gepubliceerd wordt. Zo houden de Quests dezelfde
  inhoud en komen de wijzigingen pas op de Quests als de docent het concept publiceert (FR-004).
- Q: Mag een organisatie haar kopie delen met andere organisaties via de cursusbibliotheek? → A:
  Nee: een kopie blijft altijd "Alleen eigen organisatie"; het publicatiemenu toont geen keuzes
  voor beschikbaarheid en de server weigert elke poging (FR-013, feature 009 FR-014 d).
- Q: Toont "Gebaseerd op <cursus> van <organisatie>" de namen van het moment van aanpassen of de
  huidige namen van het origineel en de eigenaar? → A: De huidige namen, gelezen via het origineel:
  de naam van de nieuwste gepubliceerde versie van het origineel en de huidige naam van de
  eigenaar. Er komen geen nieuwe velden; geen versienummer in de tekst (FR-012).
- Q: Mag een organisatie die een kopie heeft, hetzelfde origineel opnieuw toevoegen vanuit de
  cursusbibliotheek? → A: Ja, maar het venster in de bibliotheek zegt naast de knop "Jullie hebben
  al een aangepaste kopie van deze cursus" (FR-021).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Een overgenomen cursus aanpassen en een eigen kopie krijgen (Priority: P1)

Een docent heeft een cursus van een andere organisatie overgenomen en wil er iets aan veranderen. Zij
opent het venster van de overgenomen cursus en klikt op "Aanpassen". Na een korte uitleg en
bevestiging opent de editor met een eigen kopie van de versie die haar Quests nu hebben. In het
cursusoverzicht staat de kopie op de plaats van de overgenomen cursus.

**Why this priority**: Dit is deel 3 van FR-12: zonder dit kan een organisatie een overgenomen cursus
alleen gebruiken zoals de eigenaar hem maakte, of moet zij hem helemaal opnieuw bouwen.

**Independent Test**: B heeft een cursus van A overgenomen op versie 2. B klikt "Aanpassen" en
bevestigt: de editor opent met een concept dat gelijk is aan versie 2 van A. Het cursusoverzicht van
B toont de kopie (eigen cursus, "Gebaseerd op <cursus> van A") en niet meer de overgenomen cursus.
Bij A en bij C (die dezelfde cursus heeft overgenomen) is niets veranderd.

**Acceptance Scenarios**:

1. **Given** het venster van een overgenomen cursus (feature 010), **When** de docent het opent,
   **Then** staat daar de knop "Aanpassen", naast "Verwijderen uit mijn organisatie" en, waar van
   toepassing, de keuze voor een nieuwe versie.
2. **Given** die knop, **When** de docent erop klikt, **Then** vraagt het systeem eerst om
   bevestiging in eenvoudige taal: de organisatie krijgt een eigen kopie van versie <N> die zij zelf
   kan aanpassen; de kopie krijgt geen nieuwe versies meer van <eigenaar>; de cursus van <eigenaar>
   verandert niet; dit kan niet ongedaan gemaakt worden; en de VR-brillen downloaden de cursus bij
   de volgende synchronisatie opnieuw. Met "Aanpassen" en "Annuleren".
3. **Given** de docent annuleert, **When** het venster sluit, **Then** is er niets veranderd.
4. **Given** de docent bevestigt, **When** het aanpassen gelukt is, **Then** opent de editor meteen
   met het concept van de kopie, met dezelfde naam, beschrijving, onderdelen, vragen, antwoorden,
   verbindingen, video's en thumbnail als de gekozen versie.
5. **Given** de kopie bestaat, **When** de docent het cursusoverzicht opent, **Then** staat de kopie
   er als eigen cursus (zonder de pil "Overgenomen van"), met de tekst "Gebaseerd op <naam cursus>
   van <naam eigenaar>" en de status "Op de Quest: versie 1 · <datum van aanpassen>"; de
   overgenomen cursus staat er niet meer.
6. **Given** de overgenomen cursus had een melding over een nieuwe versie (feature 010, FR-012),
   **When** de docent "Aanpassen" kiest, **Then** wordt de gekozen versie gekopieerd, niet de nieuwe
   versie, en verdwijnt de melding samen met de overgenomen cursus.

---

### User Story 2 - De kopie is een gewone eigen cursus (Priority: P1)

Na het aanpassen werkt de organisatie met de kopie zoals met elke cursus die zij zelf gemaakt heeft:
bewerken in de editor, publiceren, onpubliceren en verwijderen. De kopie staat nooit in de
cursusbibliotheek en kan niet met andere organisaties gedeeld worden.

**Why this priority**: Aanpassen heeft alleen zin als de organisatie de kopie daarna volledig kan
beheren; tegelijk mag een kopie de toestemming van de eigenaar niet verder verspreiden.

**Independent Test**: B wijzigt in de kopie een vraag en publiceert: de Quests van B krijgen versie 2
van de kopie. B onpubliceert en verwijdert de kopie: hij verdwijnt van de Quests van B. In de
cursusbibliotheek van A, B en C komt de kopie op geen enkel moment voor.

**Acceptance Scenarios**:

1. **Given** de kopie, **When** de docent hem in de editor aanpast en opslaat, **Then** werkt dat
   precies als bij een eigen cursus (feature 004/005).
2. **Given** een aangepaste kopie, **When** de docent publiceert, **Then** wordt dat versie 2 van de
   kopie en krijgen de Quests van de organisatie die bij hun volgende synchronisatie (feature 006).
3. **Given** de kopie, **When** de docent hem onpubliceert of verwijdert, **Then** gebeurt dat zoals
   bij een eigen cursus (feature 006), en blijft het origineel ongewijzigd.
4. **Given** de kopie, **When** de docent het publicatiemenu opent, **Then** biedt het geen keuzes
   voor beschikbaarheid ("Alle organisaties", "Selectief beschikbaar"); de kopie blijft van de eigen
   organisatie, en de uitleg zegt dat een aangepaste cursus niet gedeeld kan worden.
5. **Given** de kopie, **When** iemand toch probeert hem te delen, ook buiten de interface om,
   **Then** weigert de server dat en blijft de kopie "Alleen eigen organisatie".
6. **Given** de kopie, **When** welke organisatie dan ook de cursusbibliotheek opent, **Then** staat
   de kopie daar niet in (feature 009, FR-014 d).

---

### User Story 3 - Meegekregen video's blijven bruikbaar in de kopie (Priority: P1)

De gekozen versie kan video's bevatten die niet in de videobibliotheek van de organisatie staan
(bijvoorbeeld video's die de eigenaar alleen in de cursus deelde). In de kopie blijven die video's
werken, ook als de eigenaar ze later beperkt. De organisatie kan ze niet in andere cursussen of in
nieuwe onderdelen kiezen.

**Why this priority**: Dit is FR-14: zonder deze regel kan een organisatie een kopie met zulke video's
niet opslaan of publiceren, en zou aanpassen voor veel gedeelde cursussen niet werken.

**Independent Test**: Een cursus van A bevat video V die A alleen in de cursus deelt (niet in de
videobibliotheek van B). B past de cursus aan, verandert een tekst en publiceert: dat lukt, en de
Quests van B kunnen V downloaden. A beperkt V daarna tot "Alleen eigen organisatie": B kan de kopie
nog steeds opslaan, publiceren en downloaden. In de videobibliotheek van B en in de videokeuze van de
editor staat V niet.

**Acceptance Scenarios**:

1. **Given** een kopie met een meegekregen video die niet in de videobibliotheek van de organisatie
   staat, **When** de docent de kopie opslaat of publiceert zonder dat onderdeel te wijzigen,
   **Then** wordt dat niet geweigerd vanwege die video.
2. **Given** zo'n kopie, **When** de eigenaar van de video die video later beperkt, **Then** blijft
   hij in de kopie werken: opslaan, publiceren (ook na onpubliceren) en downloaden door de Quests van
   de organisatie lukken.
3. **Given** de editor van de kopie, **When** de docent een video kiest voor een onderdeel, **Then**
   ziet zij alleen de video's uit haar videobibliotheek (feature 003), niet de meegekregen video's.
4. **Given** een onderdeel met een meegekregen video, **When** de docent er een andere video in zet
   en opslaat, **Then** kan zij de meegekregen video daarna niet meer terugzetten (zoals bij elke
   video die niet in de bibliotheek staat, feature 005).
5. **Given** een meegekregen video die de eigenaar verwijdert, **When** de kopie gepubliceerd is,
   **Then** blijft de video werken, ook in een nieuwe versie van de kopie (constitutie V). Is de
   kopie niet meer gepubliceerd, dan moet de docent vóór het publiceren een andere video kiezen,
   zoals bij elke verwijderde video in een eigen cursus.
6. **Given** de videobibliotheek van de organisatie, **When** de docent die opent, **Then** staan de
   meegekregen video's er niet in.

---

### User Story 4 - Het origineel en de andere organisaties merken niets (Priority: P1)

Aanpassen raakt alleen de organisatie die aanpast. Het origineel krijgt geen nieuwe versie of
concept, houdt dezelfde beschikbaarheid, en andere organisaties die hem hebben overgenomen houden
alles zoals het was. Omgekeerd raken latere wijzigingen aan het origineel de kopie niet.

**Why this priority**: De eigenaar moet erop kunnen vertrouwen dat delen haar cursus niet verandert,
en de organisatie die aanpast moet erop kunnen vertrouwen dat haar kopie van haar blijft.

**Independent Test**: B past een cursus van A aan. Bij A zijn versies, concept, beschikbaarheid en
inhoud ongewijzigd; C (ook overgenomen) heeft dezelfde versie en meldingen als ervoor. A publiceert
daarna versie 3, onpubliceert, beperkt en verwijdert de cursus: de kopie van B en wat er op de Quests
van B staat, veranderen niet en B krijgt geen meldingen.

**Acceptance Scenarios**:

1. **Given** een organisatie past een overgenomen cursus aan, **When** het aanpassen klaar is,
   **Then** heeft het origineel geen nieuwe versie, geen gewijzigd concept, dezelfde live versie en
   dezelfde beschikbaarheid.
2. **Given** andere organisaties hebben hetzelfde origineel overgenomen, **When** één organisatie
   aanpast, **Then** houden zij hun gekozen versie, hun meldingen en hun uitleg (feature 010).
3. **Given** een kopie, **When** de eigenaar van het origineel een nieuwe versie publiceert, de
   cursus onpubliceert, beperkt of verwijdert, of zelf verwijderd wordt, **Then** verandert er niets
   aan de inhoud van de kopie en aan wat er op de Quests staat, en krijgt de organisatie geen
   melding. Alleen de namen in "Gebaseerd op" volgen het origineel (FR-012).
4. **Given** de eigenaar van het origineel, **When** zij het aantal en de namen van de organisaties
   die de cursus hebben overgenomen bekijkt (feature 010, FR-019), **Then** telt de organisatie die
   aanpaste daar niet meer in mee; de eigenaar ziet nergens dat er een kopie bestaat.
5. **Given** de organisatie die aanpaste, **When** zij het origineel daarna in de cursusbibliotheek
   ziet (als het daar nog voor haar staat), **Then** staat bij de knop "Toevoegen aan mijn
   organisatie" de tekst "Jullie hebben al een aangepaste kopie van deze cursus", en kan zij het
   opnieuw toevoegen als overgenomen cursus; dat staat los van haar kopie.

---

### Edge Cases

- **De eigenaar heeft de cursus ingetrokken, verwijderd, beperkt of is zelf verwijderd** (feature
  010, User Story 4): aanpassen kan gewoon, op basis van de gekozen versie. "Gebaseerd op" blijft
  staan; een verwijderde cursus of eigenaar houdt zijn laatste naam (zachte verwijdering).
- **Een nieuwere versie van de eigenaar**: er wordt altijd de gekozen versie gekopieerd, ook als de
  docent de melding over een nieuwe versie nog niet heeft beantwoord of "Huidige versie houden" koos.
  Wie de nieuwe versie wil aanpassen, kiest eerst "Nieuwe versie gebruiken" en daarna "Aanpassen".
- **Dubbele klik of twee tabbladen**: er ontstaat precies één kopie. Een tweede verzoek voor dezelfde
  overgenomen cursus vindt die niet meer en krijgt de melding dat de cursus al is aangepast en dat
  de kopie in het cursusoverzicht staat; er verandert niets.
- **Overgenomen cursus tegelijk verwijderd of van versie gewisseld** (ander tabblad): wat het eerst
  is opgeslagen, geldt. Is de overgenomen cursus al verwijderd, dan wordt er niets gekopieerd en
  krijgt de docent de melding "Deze cursus staat niet meer bij jouw cursussen." Is de versie net gewisseld, dan wordt
  de versie van dat moment gekopieerd.
- **Mislukt halverwege**: aanpassen is alles of niets. Er is daarna óf de overgenomen cursus (zoals
  ervoor), óf de kopie, nooit beide en nooit geen van beide.
- **Een andere organisatie probeert het**: aanpassen werkt alleen voor de overgenomen cursussen van
  de eigen organisatie uit de sessie; voor elke andere cursus (ook een eigen cursus of een cursus van
  een ander) wordt het geweigerd alsof de cursus niet bestaat.
- **Een eigen cursus of een kopie aanpassen**: de knop "Aanpassen" staat alleen bij overgenomen
  cursussen; eigen cursussen en kopieën open je gewoon in de editor.
- **Een kopie van een kopie**: kan niet ontstaan, want een kopie staat nooit in de bibliotheek en
  kan dus niet overgenomen worden.
- **Cursusnaam gelijk aan een eigen cursus of aan het origineel**: toegestaan; de kopie houdt de naam
  van de gekozen versie tot de docent die wijzigt.
- **Video van een derde organisatie in de gekozen versie** (selectief gedeeld met de eigenaar):
  telt als meegekregen video, met dezelfde regels.
- **Video die al in de videobibliotheek van de organisatie staat**: is gewoon een video uit de
  bibliotheek; de regels voor meegekregen video's zijn dan niet nodig.
- **Thumbnail**: de kopie toont dezelfde thumbnail als de gekozen versie (feature 008), ook als die
  van een meegekregen video is.
- **Gebruik van video's (FR-13)**: na aanpassen telt de gekozen versie van het origineel voor deze
  organisatie niet meer als gebruik (feature 010, User Story 5, scenario 3); de versies van de kopie
  tellen als gebruik zoals bij elke eigen cursus (feature 006).
- **De organisatie verwijdert later de kopie**: gebeurt zacht, zoals elke eigen cursus. Zij kan het
  origineel daarna alleen opnieuw toevoegen als het nog voor haar in de bibliotheek staat.
- **Quest offline**: een Quest houdt wat hij gedownload heeft (feature 007); de wissel van de oude
  naar de nieuwe cursus komt pas bij de volgende synchronisatie.
- **De beheerder**: krijgt geen functies voor aanpassen of kopieën.

## Requirements *(mandatory)*

### Functional Requirements

**Aanpassen**

- **FR-001**: In het venster van een overgenomen cursus (feature 010) MUST de knop "Aanpassen"
  staan, ongeacht of de eigenaar de cursus nog deelt, heeft ingetrokken of heeft verwijderd, en
  ongeacht of de eigenaar zelf nog bestaat. Bij eigen cursussen en kopieën MUST de knop er niet
  staan.
- **FR-002**: Aanpassen MUST eerst om bevestiging vragen in eenvoudige taal (User Story 1, scenario
  2), met "Aanpassen" en "Annuleren". Bij annuleren MUST er niets veranderen.
- **FR-003**: Aanpassen MUST één nieuwe cursus maken waarvan de organisatie de enige eigenaar is, die
  onthoudt op welk origineel hij gebaseerd is, en waarvan de inhoud precies gelijk is aan de gekozen
  versie op het moment van aanpassen: naam, beschrijving, onderdelen, vragen, antwoorden,
  verbindingen, startonderdeel, posities in de editor en video's. Er MUST NOT van een andere versie
  van het origineel gekopieerd worden.
- **FR-004**: De kopie MUST beginnen met een gepubliceerde versie 1 (publicatiedatum = het moment van
  aanpassen) en een concept versie 2 met dezelfde inhoud, en de beschikbaarheid "Alleen eigen
  organisatie".
- **FR-005**: In dezelfde handeling MUST de overgenomen cursus van de organisatie verdwijnen (met de
  melding of uitleg die erbij hoorde, feature 010). Aanpassen MUST alles of niets zijn: na afloop is
  er óf de overgenomen cursus ongewijzigd, óf de kopie, nooit beide en nooit geen van beide.
- **FR-006**: Een herhaald of gelijktijdig verzoek om dezelfde overgenomen cursus aan te passen
  (dubbele klik, twee tabbladen) MUST hoogstens één kopie opleveren; de andere verzoeken MUST niets
  veranderen en de melding geven dat de cursus al is aangepast.
- **FR-007**: Na een gelukt aanpassen MUST de editor meteen openen met het concept van de kopie.

**Het origineel en andere organisaties**

- **FR-008**: Aanpassen MUST NOT iets veranderen aan het origineel (versies, concept, live versie,
  beschikbaarheid, verwijderd of niet) of aan de overgenomen cursussen, meldingen en keuzes van
  andere organisaties.
- **FR-009**: Wijzigingen aan het origineel na het aanpassen (nieuwe versie, onpubliceren, beperken,
  verwijderen, verwijderen van de eigenaar) MUST NOT de kopie, de Quests van de organisatie of haar
  meldingen raken. De kopie MUST NOT meldingen over nieuwe versies van het origineel krijgen.
- **FR-010**: Na het aanpassen MUST de organisatie niet meer meetellen als organisatie die het
  origineel heeft overgenomen (feature 010, FR-019). De eigenaar van het origineel MUST NOT zien dat
  er een kopie bestaat of van wie.

**De kopie als eigen cursus**

- **FR-011**: De kopie MUST voor de organisatie in alles werken als een eigen cursus: openen in de
  editor, opslaan, publiceren, onpubliceren en verwijderen (feature 004 t/m 006), en op de Quests
  van de organisatie volgens de regels voor eigen cursussen (feature 007).
- **FR-012**: In het cursusoverzicht en in de editor MUST bij de kopie de tekst "Gebaseerd op <naam
  cursus> van <naam eigenaar>" staan, met de naam van de nieuwste gepubliceerde versie van het
  origineel (nooit de naam uit een concept van de eigenaar) en de huidige naam van de eigenaar. Ook
  als het origineel of de eigenaar verwijderd is, MUST de tekst blijven staan met de laatste namen.
  De pil "Overgenomen van" MUST NOT bij een kopie staan.
- **FR-013**: Een kopie MUST NOT in de cursusbibliotheek staan (feature 009, FR-014 d) en MUST altijd
  de beschikbaarheid "Alleen eigen organisatie" houden. Het publicatiemenu MUST bij een kopie geen
  keuzes voor beschikbaarheid aanbieden, en de server MUST elke poging om de beschikbaarheid van een
  kopie te wijzigen weigeren.

**Meegekregen video's (FR-14)**

- **FR-014**: Een meegekregen video MUST in de kopie geaccepteerd worden bij opslaan en publiceren,
  ook als hij niet in de videobibliotheek van de organisatie staat en ook als de eigenaar van de
  video hem na het aanpassen beperkt, zolang hij in een onderdeel staat waar hij al stond. Dit geldt
  ook voor publiceren nadat de kopie is ingetrokken. Deze toestemming MUST NOT terug te draaien zijn.
- **FR-015**: Voor een meegekregen video die zacht verwijderd is, MUST de regel van constitutie V
  gelden zoals bij elke eigen cursus: hij blijft werken zolang hij in de live versie van de kopie
  zit (ook in een nieuwe versie); is de kopie niet gepubliceerd, dan MUST vóór het publiceren een
  andere video gekozen worden.
- **FR-016**: Meegekregen video's MUST NOT in de videobibliotheek van de organisatie verschijnen en
  MUST NOT in de videokeuze van de editor staan, ook niet in de kopie zelf. Ze MUST NOT in andere
  cursussen of in een ander onderdeel gezet kunnen worden, ook niet buiten de interface om.
- **FR-017**: De Quests van de organisatie MUST de meegekregen video's van de live versie van de kopie
  kunnen downloaden, net als bij elke eigen cursus (feature 007), en de video's MUST als gebruikt
  tellen zolang een versie van de kopie ze volgens de regels van feature 006 gebruikt (FR-13).

**Quests**

- **FR-018**: De Quest-API MUST NOT van vorm veranderen. De kopie MUST voor de Quests een nieuwe
  cursus zijn; de overgenomen cursus MUST na het aanpassen niet meer in de lijst van de Quests van
  de organisatie staan. Omdat de kopie gepubliceerd begint, MUST er op elk moment dezelfde inhoud
  voor de Quests te downloaden zijn.

**Algemeen**

- **FR-019**: Alle teksten die de docent ziet MUST in het Nederlands zijn, in eenvoudige taal zonder
  technische termen (NFR-03); het woord "verwijzing" MUST NOT in de interface staan.
- **FR-020**: Aanpassen MUST alleen werken voor de overgenomen cursussen van de eigen organisatie uit
  de sessie; elk ander verzoek MUST geweigerd worden alsof de cursus niet bestaat. De beheerder MUST
  NOT functies voor aanpassen of kopieën krijgen.
- **FR-021**: Heeft een organisatie een (niet verwijderde) kopie van een cursus die voor haar in de
  cursusbibliotheek staat, dan MUST het venster van die cursus in de bibliotheek naast de knop
  "Toevoegen aan mijn organisatie" de tekst "Jullie hebben al een aangepaste kopie van deze cursus"
  tonen. Opnieuw toevoegen MUST toegestaan blijven (feature 010, FR-001 t/m FR-005).

### Key Entities *(include if feature involves data)*

- **Course** (bestaat): de kopie is een nieuwe cursus; `parentCourseId` wijst naar het origineel en
  is het enige verband (FR-012). Een cursus met `parentCourseId` staat nooit in de bibliotheek en
  heeft altijd de beschikbaarheid "Alleen eigen organisatie" (FR-013).
- **CourseVersion** (bestaat, feature 006): de kopie krijgt versie 1 (gepubliceerd) en versie 2
  (concept), beide met de inhoud van de gekozen versie. Versie 1 van de kopie is samen met
  `parentCourseId` het bewijs van de toestemming voor de meegekregen video's (spec 010, R13).
- **OrganisationCourse** (bestaat): voor de kopie komt een rij met `isOwner = TRUE` voor de
  organisatie; de rij van de overgenomen cursus (`isOwner = FALSE`) verdwijnt (spec 010, FR-022).
- **"Gebaseerd op"**: geen nieuwe velden; de tekst wordt afgeleid via `parentCourseId` (de nieuwste
  gepubliceerde versie van het origineel en de eigenaar daarvan, ook als die verwijderd zijn)
  (FR-012).
- **Video** (bestaat): een meegekregen video blijft van zijn eigenaar en verschijnt niet in de
  videobibliotheek van de organisatie (FR-016).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een docent zonder technische kennis past een overgenomen cursus aan en staat binnen 1
  minuut in de editor met de kopie, zonder hulp (NFR-03).
- **SC-002**: In 100% van de geteste gevallen is de inhoud van de kopie direct na het aanpassen gelijk
  aan de gekozen versie (alle onderdelen, antwoorden, verbindingen en video's), ook als de eigenaar
  een nieuwere versie heeft of de cursus heeft ingetrokken, beperkt of verwijderd.
- **SC-003**: In een test met drie organisaties is na het aanpassen door één organisatie bij het
  origineel en bij de andere organisaties 0 gegevens veranderd, en veranderen latere wijzigingen aan
  het origineel 0 keer iets aan de kopie of aan de Quests van de organisatie die aanpaste.
- **SC-004**: Bij 10 snel achter elkaar of gelijktijdig verstuurde verzoeken om dezelfde overgenomen
  cursus aan te passen ontstaat precies 1 kopie.
- **SC-005**: 100% van de kopieën met meegekregen video's kan worden opgeslagen, gepubliceerd en door
  de Quests gedownload, ook nadat de eigenaar die video's heeft beperkt; 0% van de pogingen om een
  meegekregen video in een andere cursus of een ander onderdeel te zetten slaagt.
- **SC-006**: 0% van de pogingen om een kopie te delen, in de bibliotheek te krijgen, of een cursus
  van een andere organisatie aan te passen slaagt, ook niet buiten de interface om.
- **SC-007**: Op elk moment tijdens en na het aanpassen is er voor de Quests van de organisatie een
  versie van de cursus te downloaden (de overgenomen cursus of de kopie).

## Assumptions

- Aanpassen kan alleen vanuit het venster van een overgenomen cursus; er komt geen andere ingang.
- De organisatie die aanpast, mag de meegekregen video's in de kopie houden omdat de eigenaar bij het
  delen toestemming gaf voor alle video's in de gekozen versie (feature 009, FR-009; feature 010,
  FR-020). Die toestemming geldt alleen voor deze organisatie; daarom kan een kopie niet gedeeld
  worden.
- Het verschil tussen "beperkt" en "verwijderd" bij meegekregen video's: beperken door de eigenaar
  raakt de kopie nooit (FR-14). Verwijderen volgt constitutie V, net als bij video's in eigen
  cursussen: zolang de kopie gepubliceerd is, blijft de video werken; na onpubliceren moet eerst een
  andere video gekozen worden (bevestigd in Clarifications). De constitutie blijft ongewijzigd.
- Een meegekregen video blijft alleen in het onderdeel waar hij stond; hem in een ander of nieuw
  onderdeel zetten kan niet, omdat de videokeuze van de editor alleen de videobibliotheek toont
  (feature 005). Dit volgt "kunnen niet in andere cursussen gekozen worden" zo eenvoudig mogelijk.
- De Quest ziet de kopie als een nieuwe cursus; dat de oude overgenomen cursus op de Quest even als
  "niet meer in het CMS" staat, is acceptabel. Een koppeling tussen oud en nieuw op de Quest staat op
  de backlog (Quest-app en API-contract, in overleg).
- Er is één account per organisatie (feature 001); aanpassen geldt voor de hele organisatie.
- Buiten scope (`docs/backlog.md`): nieuwe versies automatisch gebruiken, de inhoud van een gedeelde
  cursus alleen-lezen bekijken, verwijderde cursussen en video's echt opruimen, de
  versiegeschiedenis (FR-11b), wijzigingen van het origineel later overnemen in de kopie, een kopie
  delen met andere organisaties, en de koppeling tussen oude en nieuwe cursus op de Quest.
