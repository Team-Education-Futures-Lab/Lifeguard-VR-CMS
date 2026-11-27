# Research: Cursussen delen en de centrale cursusbibliotheek (FR-12, deel 1)

Alle keuzes voor deze feature. Er staan geen NEEDS CLARIFICATION-punten open. Bouwt voort op de
keuzes van feature 003 (beschikbaarheid van video's), 006 (versies, live versie) en 008 (thumbnail
per cursus).

## R1 — Beschikbaarheid als veld op `Course`, plus de tabel `CourseAccess`

**Decision**: Nieuw veld `Course.visibility` met `ENUM('public','selective','private') NOT NULL
DEFAULT 'private'`, met dezelfde waarden als `Video.visibility`. Nieuwe tabel
`CourseAccess(courseId, organisationId)` met beide kolommen samen als sleutel en een index op
`organisationId`, net als `VideoAccess`. Deze tabel heeft alleen rijen bij `selective`. Het veld
`Course.isSharedInLibrary` gaat weg: het staat altijd op `false` en wordt nergens gelezen. Eén
migratie doet alles. Bestaande cursussen krijgen `private` via de default (FR-005, SC-007), en hun
versies veranderen niet.

**Rationale**: de beschikbaarheid hoort bij de cursus en niet bij een versie (spec, Assumptions).
Na onpubliceren blijft ze bewaard, zodat opnieuw publiceren haar kan voorstellen (FR-023). De naam
en waarden van video's overnemen houdt code en ERD gelijk, en de bestaande controles in
`backend/src/lib/videoChoices.js` (`validateVisibility`, `validateAccessOrganisations`) zijn dan
direct herbruikbaar. Feature 006 (FR-011) vroeg om ruimte hiervoor "zonder bestaande versies om
te zetten", en daar voldoet dit aan.

**Alternatives considered**:
- `isSharedInLibrary` houden en ernaast een veld voor selectief: dat zijn twee waarheden voor één
  keuze, en de drie keuzes passen niet in een aan/uit-veld.
- De beschikbaarheid per `CourseVersion`: dan verandert "Beschikbaarheid wijzigen" een vastgezette
  versie (verboden, specs/006 FR-004) of moet er een nieuwe versie komen zonder nieuwe inhoud
  (verboden, specs/006 Assumptions).
- `VideoAccess` hergebruiken met een type-kolom: dat wijkt af van het ERD en maakt de foreign keys
  onduidelijk.

## R2 — Eén definitie van "cursussen in de bibliotheek van organisatie X"

**Decision**: Een nieuwe module `backend/src/modules/courseLibrary/` met één query,
`libraryCoursesQuery(organisationId)`. Een cursus komt in de bibliotheek als:
- `Course.deletedAt IS NULL` en `parentCourseId IS NULL`;
- de eigenaar via `OrganisationCourse.isOwner = TRUE` een `Organisation` is die niet verwijderd is;
- `visibility IN ('public','selective')`;
- de cursus van de organisatie zelf is, of `public` is, of `selective` met een rij in
  `CourseAccess` voor deze organisatie.

Daarna houdt de bestaande `liveVersions()` uit `courseRepository.js` alleen cursussen met een live
versie over. Lijst, details en thumbnail beginnen allemaal bij deze ene query. Wat er niet in
staat, krijgt `404 not_found` (FR-021).

**Rationale**: hetzelfde patroon als `visibleVideosQuery` (specs/003 R1), `ownCoursesQuery`
(specs/004 R2) en `questLiveVersions` (specs/007 R3): de regel staat op één plek, dus de lijst en
de losse opvragingen kunnen niet uit elkaar lopen. "Live" blijft één definitie (specs/006 R1).

**Alternatives considered**: de regel in de lijstroute en de detailroute apart schrijven. Dat is
het lekrisico dat feature 003 juist vermeed.

## R3 — De waarschuwing via een 409 en een herhaald verzoek met bevestigde video's

**Decision**: `POST /courses/:id/publish` en `PUT /courses/:id/availability` krijgen in de body
`{ visibility, accessOrganisationIds, acknowledgedVideoIds }`. In dezelfde transactie, nadat het
concept vergrendeld is en de cursus gecontroleerd, berekent de server welke video's in de
waarschuwing moeten (R4). Staan ze niet allemaal in `acknowledgedVideoIds`, dan komt er
`409 shared_videos_warning` met `videos: [{ id, name }]` en verandert er niets. De browser toont de
waarschuwing. Bij "Doorgaan" stuurt hij hetzelfde verzoek opnieuw, nu met die id's. Volgorde van
de controles: velden (400), dan compleetheid (422 `course_incomplete`, alleen bij publiceren), dan
de waarschuwing (409).

**Rationale**: de server beslist zelf (FR-012), en een verzoek buiten de interface om kan de
waarschuwing niet overslaan. Is de inhoud tussen waarschuwen en doorgaan veranderd (bijvoorbeeld
een collega publiceert of de eigenaar van een video beperkt hem), dan komt er een nieuwe 409 met
de actuele lijst. Een bevestiging geldt zo altijd voor precies wat de eigenaar heeft gezien. Er
hoeft niets bewaard te worden.

**Alternatives considered**:
- Een aparte route die vooraf de lijst geeft ("preview"): dat zijn twee verzoeken bij elk
  publiceren en de lijst kan alsnog verouderen.
- Een vlag `acknowledged: true`: die bevestigt ook video's die de eigenaar nooit heeft gezien.
- De bevestiging opslaan per video: daar vraagt de spec niet om, en R4 maakt het overbodig.

## R4 — Welke video's in de waarschuwing staan (FR-009, FR-010)

**Decision**: Een pure functie `sharedVideosWarning({ before, after, contentVideos, previousVideoIds })`
in `backend/src/lib/courseSharing.js`. De onderdelen:
- **Beperkte video**: een video in de inhoud die gedeeld wordt, die niet `public` is, of zacht
  verwijderd, of waarvan de eigenaar verwijderd is. Dat omvat ook video's van andere
  organisaties die selectief met de eigenaar gedeeld zijn.
- **Publiek (audience)**: `private`, of een cursus zonder live versie, telt als leeg. `public`
  telt als "alle organisaties". `selective` is de set gekozen organisaties.
- **Groter**: het publiek na de wijziging bevat een organisatie die er eerst niet in zat. `public`
  na iets anders telt altijd als groter.
- **Uitkomst**:
  - Wordt het publiek na de wijziging leeg (`private`), dan is de lijst leeg.
  - Wordt het publiek groter (dat omvat FR-010 a, van niet gedeeld naar gedeeld, en b), dan komen
    alle beperkte video's in de lijst.
  - Anders (c) alleen de beperkte video's die niet in de vorige live versie zaten.

Bij "Beschikbaarheid wijzigen" is de inhoud de live versie; bij publiceren is het de inhoud die
live gaat (het concept, of de versie die weer live gaat, specs/006 FR-017).

**Rationale**: precies de drie situaties uit de clarification, en verder niets (FR-010, SC-003).
Een pure functie is met een tabel van gevallen te testen. Een onpubliceerde cursus staat niet in
de bibliotheek, dus opnieuw publiceren telt als opnieuw delen (geval a).

## R5 — Beperken: bevestiging in de browser, met het aantal

**Decision**: Het aantal organisaties dat toegang verliest (FR-007) rekent de browser uit, met de
bestaande `audience`/`countLosingAccess` uit `frontend/src/lib/videoAccess.js`. Die functies worden
algemeen gemaakt: `confirmationText(count, noun)`, met een eigen tekst voor cursussen. Dit gebeurt
in het venster "Beschikbaarheid wijzigen" en ook in de bevestiging van "Wijzigingen publiceren"
als daar een beperktere keuze wordt gemaakt. De lijst met actieve organisaties komt van de
bestaande `GET /organisations` (specs/003 R10). De server vraagt hier niet om bevestiging.

**Rationale**: zo werkt het bij video's ook (specs/003 R6). Bij beperken lekt er niets, dus het is
een UX-vraag en geen beveiliging. Een cursus zonder live versie staat niet in de bibliotheek, en
dan verliest niemand toegang.

## R6 — De thumbnail in de bibliotheek lekt geen beperkte video

**Decision**: De bibliotheek toont als cursusafbeelding de thumbnail van feature 008
(`thumbnailVideoId` uit `questThumbnail.js`, op de live versie). Dat gebeurt alleen als die video
in de videobibliotheek van de kijkende organisatie staat (`libraryVideoIds`, specs/003 R1), of als
de kijker de eigenaar van de cursus is. Anders krijgt de cursus de neutrale afbeelding
(`thumbnailUrl: null`). De route `GET /course-library/:id/thumbnail` past dezelfde regel toe en
levert de bytes via `X-Accel-Redirect` (constitutie III).

**Rationale**: in de clarification (FR-018) is besloten dat andere organisaties geen thumbnails
van video's uit de inhoud zien. De afbeelding van feature 008 kan van een video "Alleen eigen
organisatie" komen. Met deze regel ziet een organisatie nooit een afbeelding die ze in haar eigen
videobibliotheek niet ook al ziet. FR-015 in de spec is daarop aangevuld.

**Alternatives considered**:
- De eerste video op de route nemen die wel algemeen beschikbaar is: dan verschilt de afbeelding
  per organisatie en van die op de Quest, wat verwarrend is.
- Altijd een neutrale afbeelding: dan valt de bibliotheek minder goed te gebruiken.

## R7 — Wat de bibliotheek per cursus teruggeeft

**Decision**: Lijst en details gebruiken hetzelfde object: `id`, `name`, `description`,
`owner { id, name, isOwn }`, `versionNumber`, `publishedAt`, `stepCount`, `videoCount` (het aantal
verschillende video's), `thumbnailUrl`. Alleen voor de eigenaar komen daar `visibility` en, bij
`selective`, `accessOrganisations` bij (FR-004, FR-017). Alles komt uit de live versie (FR-016).
Er zijn geen onderdelen, vragen, antwoorden of video-id's (FR-018).

Per lijst zijn er ongeveer zeven queries, ongeacht het aantal cursussen: de bibliotheek, twee voor
`liveVersions`, twee voor `versionContents`, `videoFiles` en `libraryVideoIds`. Zoeken, sorteren en
filteren gebeuren in de browser op de hele lijst, zoals in de videobibliotheek (specs/003 R7).

**Rationale**: SC-006 (200 cursussen binnen 2 s) en dezelfde werkwijze als de videobibliotheek.
`versionContents` en `thumbnailVideoId` bestaan al en worden ook door de Quest gebruikt.

## R8 — Publiceren met een beschikbaarheid: alles of niets

**Decision**: `publishCourse` leest de beschikbaarheid uit de body en controleert haar met
`validateVisibility` en `validateAccessOrganisations` (de eigen organisatie mag niet in de lijst,
alleen actieve organisaties). In dezelfde transactie als het vastzetten schrijft hij daarna
`Course.visibility` en `CourseAccess`. Dat geldt in elke tak van specs/006: een nieuwe versie, een
versie die weer live gaat, en de tak "niets nieuws". Zonder `visibility` in de body blijft de
huidige beschikbaarheid staan, zodat bestaande tests en scripts blijven werken. Bij een andere
waarde dan `selective` verdwijnen de `CourseAccess`-rijen (FR-004).

**Rationale**: FR-002 (inhoud en beschikbaarheid samen) en specs/006 FR-010 (alles of niets). Het
concept wordt al vergrendeld (`lockCurrentDraft`), dus gelijktijdig publiceren en wijzigen lopen
na elkaar.

## R9 — "Beschikbaarheid wijzigen" als eigen route

**Decision**: `PUT /courses/:id/availability`. Die vergrendelt het concept (zoals publiceren),
eist een live versie (anders `409 course_not_live` met "Publiceer de cursus eerst."), en past R4
en R8 toe op de live versie. Versies en `updatedAt` blijven ongewijzigd, zodat de status en de
volgorde van het overzicht niet verspringen (FR-006).

**Rationale**: FR-006 en clarification 1. Een eigen route houdt publiceren en het wijzigen van de
beschikbaarheid apart in de tests en in de foutcodes.

## R10 — Het eigen cursusoverzicht en de editor kennen de beschikbaarheid

**Decision**: Het conceptdocument (`GET`, `PUT`, `publish`) krijgt
`availability: { visibility, accessOrganisations: [{ id, name }] }`, met alleen actieve
organisaties, alfabetisch. De cursuslijst krijgt per cursus `visibility`. Het overzicht toont bij
een gepubliceerde cursus de beschikbaarheid in tekst (spec, Assumptions).

**Rationale**: dit is nodig om de bevestiging voor te vullen (FR-002) en voor de telling van R5.
Het gaat alleen om eigen cursussen (`ownCoursesQuery`), dus er lekt niets.

## R11 — Onpubliceren en verwijderen

**Decision**: Hier is geen code in de backend voor nodig. De bibliotheek vereist een live versie
en een niet-verwijderde cursus (R2), en `Course.visibility` blijft staan (FR-023). De
bevestigingen van onpubliceren (`UnpublishDialog.vue`) en van verwijderen (`CoursesView.vue`)
krijgen bij `visibility !== 'private'` de extra zin uit FR-025. Opent een andere organisatie een
cursus die intussen weg is, dan geeft de detailroute 404 en toont de bibliotheek "Deze cursus is
niet meer beschikbaar." Het venster sluit en de cursus gaat uit de geladen lijst (US5, scenario 4).

## R12 — Quest en bewerken blijven eigen cursussen

**Decision**: `questLiveVersions` en `ownCoursesQuery` veranderen niet. Ze vereisen al
`OrganisationCourse.isOwner = TRUE` voor de eigen organisatie. Er komen tests bij die aantonen dat
een gedeelde cursus niet op de Quest van een andere organisatie komt en niet bewerkbaar is
(FR-022, FR-026).

## R13 — Voorbereiding op deel 2

**Decision**: De bibliotheek gebruikt als sleutel de `Course.id` van het origineel, en de live
versie is altijd die van het origineel. Deel 2 kan dan:
- **Overnemen als verwijzing**: een rij `OrganisationCourse(isOwner = FALSE)` toevoegen, met
  daarbij de gekozen versie. Dat veld komt met deel 2. `questLiveVersions` is al de enige plek die
  dan verandert (specs/007 R3).
- **Een eigen kopie**: een nieuwe `Course` met `parentCourseId`. Die valt door R2 automatisch
  buiten de bibliotheek.

Deze feature legt nergens vast dat een cursus "overgenomen" kan worden. Wat iemand mag zien, staat
alleen in `visibility` en `CourseAccess`.

**Open voor deel 2** (genoteerd, niet in deze feature):
- Wat er met een verwijzing gebeurt als de eigenaar later beperkt.
- Hoe de onomkeerbare toestemming voor beperkte video's (FR-12) wordt vastgelegd bij het overnemen.

## R14 — ERD

**Decision**: In `docs/Diagrams.simp`:
- `Course.isSharedInLibrary` (BOOLEAN) wordt vervangen door `Course.visibility` (ENUM
  `public`/`selective`/`private`).
- De nieuwe entiteit `CourseAccess` (courseId, organisationId) komt erbij, met relaties naar
  `Course` en `Organisation`.
- De notitie "Alleen cursussen met parentCourseId = NULL kunnen in de bibliotheek" blijft staan.

Dit is een taak in tasks.md (constitutie: "Bronnen en domeinregels").

## R15 — Frontend

**Decision**:
- **`AvailabilityPicker.vue`** krijgt een prop `subject` (`'video'` of `'course'`) voor de
  hulpteksten, zodat de cursusvariant "Alle organisaties zien deze cursus in de
  cursusbibliotheek." zegt.
- **`PublishDialog.vue`** toont de picker in de modus `confirm`.
- **Nieuw: `SharedVideosWarningDialog.vue`**: de waarschuwing met de lijst video's.
- **Nieuw: `CourseAvailabilityDialog.vue`**: "Beschikbaarheid wijzigen".
- **`PublishMenu.vue`** krijgt het menu-item "Beschikbaarheid wijzigen".
- **Nieuw: `CourseLibraryView.vue`**, op de route `/course-library`, met het menu-item
  "Cursusbibliotheek".
- **Nieuw: `CourseLibraryDetailsDialog.vue`**: de details van een cursus in de bibliotheek.
- **Nieuw: `lib/courseLibrary.js`**: zoeken, filteren en sorteren. Dit hergebruikt
  `normalizeForSearch` uit `lib/videoLibrary.js`.
- **`OwnerPill.vue`** wordt hergebruikt.

**Rationale**: zo dicht mogelijk bij de videobibliotheek en de publicatie-UI van 006 (NFR-03,
SC-005). Alle teksten zijn in het Nederlands, alle namen in het Engels (constitutie VI).
