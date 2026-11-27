# Research: een overgenomen cursus aanpassen als eigen kopie

Alle keuzes voor [plan.md](plan.md). De spec heeft geen open punten meer (Clarifications, sessie
2026-11-27). Elke beslissing bouwt voort op bestaande code van de features 006, 009 en 010.

## R1. Aanpassen is één transactie in de module `courseReferences`

**Decision**: een nieuwe route `POST /course-references/:courseId/copy` met
`courseReferenceService.copyReference(organisationId, courseId)`. In één transactie (met
`withDeadlockRetry`):

1. de verwijzingsrij van de organisatie vergrendelen (`OrganisationCourse` met `isOwner = FALSE`,
   `FOR UPDATE`) en `courseVersionId` lezen (R3);
2. een nieuwe `Course`: `parentCourseId` = het origineel, `visibility = 'private'`, `createdAt` en
   `updatedAt` = nu;
3. een `OrganisationCourse`-rij met `isOwner = TRUE` voor de organisatie (`addedAt` = nu,
   `courseVersionId` en `declinedCourseVersionId` NULL);
4. de versies van de kopie (R2);
5. de verwijzingsrij verwijderen.

Antwoord: `201` met `{ "courseId": <id van de kopie> }`; de browser opent daarna de editor via de
bestaande route `GET /courses/:id`.

**Rationale**:
- Dit is precies spec 010, research R13 en FR-022: geen gegevens omzetten, geen nieuwe tabel.
- De route hoort bij de verwijzing (het id in de URL is het id van het origineel, zoals bij de
  andere `/course-references`-routes), en `referencesQuery`/de verwijzingsrij blijft de enige
  ingang: een andere organisatie, een eigen cursus of een cursus zonder verwijzing geeft vanzelf
  `404` (FR-020).
- Alleen de rij van de eigen organisatie wordt verwijderd; het origineel, zijn versies, zijn
  beschikbaarheid en de rijen van andere ontvangers worden niet aangeraakt (FR-008).

**Alternatives considered**:
- *De kopie maken via `POST /courses` met een `fromCourseId`*: afgewezen; dan moet de
  eigenaarsmodule verwijzingen gaan lezen, terwijl die bewust alleen `isOwner = TRUE` kent
  (spec 010, R9).
- *De verwijzingsrij omzetten (`isOwner = TRUE` op dezelfde `courseId`)*: afgewezen; dan wordt de
  organisatie eigenaar van het origineel en heeft het twee eigenaren (spec 009, FR-027).

## R2. Versies van de kopie: versie 1 gepubliceerd, versie 2 concept

**Decision**: met de bestaande functies van publiceren (spec 006, research R3):
`copyVersionAsDraft(trx, chosenVersionId, copyId, 1)` → `freezeDraft(trx, v1)` (zet
`publishedAt` = nu) → `copyVersionAsDraft(trx, v1, copyId, 2)`. `unpublishedAt` van versie 1 is
NULL, ook als de gekozen versie bij de eigenaar is ingetrokken.

**Rationale**:
- Clarifications Q2: de Quests houden ononderbroken dezelfde inhoud; wijzigingen komen pas op de
  Quests als de docent publiceert.
- Na deze stappen is de kopie in niets te onderscheiden van een gewone gepubliceerde cursus:
  `liveVersions` geeft versie 1, `publicationInfo` geeft `published` (concept = live), en de
  editor, publiceren, onpubliceren en verwijderen werken zonder aanpassing (FR-011).
- `copyVersionAsDraft` kopieert onderdelen, antwoorden, verbindingen, startonderdeel, posities en
  video-id's (FR-003). De thumbnail van een cursus volgt uit de inhoud (spec 008), dus die is
  vanzelf gelijk.

**Alternatives considered**: de inhoud van de gekozen versie gebruiken als concept en direct
publiceren via `publishCourse`: afgewezen, omdat `publishCourse` de controles en de
deelwaarschuwing doet die hier niet horen, en dan eerst een concept moet bestaan.

## R3. Dubbele klik, twee tabbladen en gelijktijdige wijzigingen

**Decision**:
- De verwijzingsrij wordt met `FOR UPDATE` gelezen. Een tweede verzoek wacht en vindt daarna geen
  rij meer.
- Is er geen verwijzing, maar wel een niet-verwijderde kopie van deze organisatie met
  `parentCourseId` = dit origineel, dan `409 course_already_copied` met `{ courseId }` van de
  kopie ("Deze cursus is al aangepast. De aangepaste cursus staat bij je cursussen."). Anders
  `404 not_found`.
- "Nieuwe versie gebruiken", "Huidige versie houden" en "Verwijderen uit mijn organisatie" (spec
  010) schrijven dezelfde rij, dus wat het eerst is vastgelegd, geldt (spec, Edge Cases).

**Rationale**: één rijlock is genoeg. De gekozen versie is onveranderlijk (spec 006), dus wat de
eigenaar intussen doet (intrekken, verwijderen, beperken, nieuwe versie) kan de kopie niet raken;
het origineel hoeft niet vergrendeld te worden (anders dan bij toevoegen en overstappen, spec 010
R8, waar toegang op dat moment telt).

**Alternatives considered**: een unieke index op (`parentCourseId`, eigenaar): kan niet in één
tabel (de eigenaar staat in `OrganisationCourse`) en zou opnieuw toevoegen en nog eens aanpassen
(spec, User Story 4, scenario 5) verbieden.

## R4. Meegekregen video's: één definitie, `grantedVideoIds`

**Decision**: `courseRepository.grantedVideoIds(courseIds, trx)` is de enige definitie van "video's
die deze kopie van het origineel heeft meegekregen": de video's in de onderdelen van **versie 1**
van een cursus met `parentCourseId IS NOT NULL`, waarvan `Video.deletedAt IS NULL`. Map courseId →
Set(videoId); leeg voor gewone cursussen. Gebruikt op drie plekken:

1. **Publiceren**: `checkCourse` krijgt een derde set: een video is in orde als hij in de
   bibliotheek staat, in de live versie zit, of in `grantedVideoIds` staat (FR-014).
2. **Conceptdocument**: de video van een onderdeel krijgt `keptFromOriginal: true/false`. De
   editor (`lib/completeness.js`) meldt zo'n video niet als "niet meer beschikbaar" (FR-014).
3. **Status**: `publication.hasUnavailableVideo` telt meegekregen video's niet mee, zodat de
   onpubliceer-waarschuwing (spec 006) niet ten onrechte verschijnt.

Ongewijzigd: opslaan (`checkVideos`) laat al alleen de video staan die een opgeslagen onderdeel al
had; een video buiten de bibliotheek kan nooit in een nieuw of ander onderdeel (FR-016). De
videobibliotheek (`visibleVideosQuery`) en de videokeuze van de editor veranderen niet, dus
meegekregen video's staan daar niet in, ook niet in andere cursussen (FR-016). De Quest-API
controleert video's al op de inhoud van de versies die de Quest ziet, niet op de bibliotheek
(spec 007), dus de Quests kunnen ze downloaden (FR-017).

**Rationale**:
- Versie 1 van de kopie is onveranderlijk en is precies de gekozen versie: zij is het bewijs van
  toestemming dat spec 010 (R13, FR-022) bedoelde. Er is geen extra veld of tabel nodig.
- Eén functie voorkomt dat publiceren, de editor en de status het oneens zijn.
- De voorwaarde `deletedAt IS NULL` maakt FR-015 waar zonder extra regel: een verwijderde
  meegekregen video valt terug op de bestaande regel van constitutie V (`liveVideoIds`); is de
  kopie niet gepubliceerd, dan moet eerst een andere video gekozen worden (Clarifications Q1).
- Beperken door de eigenaar (`visibility`, `VideoAccess`) of het verwijderen van de eigenaar van
  de video speelt geen rol: alleen `Video.deletedAt` telt. De toestemming is niet terug te
  draaien (FR-014).

**Alternatives considered**:
- *Meegekregen video's als `available: true` doorgeven*: afgewezen; `available` betekent "staat in
  de bibliotheek" en stuurt ook de waarschuwing vóór het weghalen van een video die je niet
  opnieuw kunt kiezen (`isLost` in `editor/context.js`). Die waarschuwing klopt juist ook voor
  meegekregen video's en blijft dus staan.
- *Een tabel met toegestane video's per kopie*: overbodig; versie 1 bevat al precies die set.

## R5. Een kopie kan niet gedeeld worden

**Decision**: `findOwnCourse` geeft ook `parentCourseId`. In `resolveAvailability` (gebruikt door
`publishCourse` en `changeAvailability`) weigert de server bij een kopie elke `visibility` anders
dan `'private'` met `400 validation_failed` (het bestaande foutformaat) (`visibility`: "Een aangepaste cursus kan niet gedeeld
worden."). Zonder `visibility` blijft de kopie `'private'`. Het conceptdocument krijgt
`basedOn` (R6); de editor verbergt bij een kopie de keuze voor beschikbaarheid in het
publiceervenster en het menu-item "Beschikbaarheid wijzigen", en toont één zin uitleg.

**Rationale**: Clarifications Q3 en FR-013. `libraryCoursesQuery` sluit kopieën al uit
(`parentCourseId IS NULL`, spec 009 FR-014 d); de serverregel voorkomt dat er toch een
`visibility` of `CourseAccess` op een kopie komt die later verwarring geeft. De deelwaarschuwing
(`checkSharingWarning`) doet bij `'private'` al niets.

**Alternatives considered**: alleen de interface aanpassen: afgewezen, de server moet het weigeren
(SC-006).

## R6. "Gebaseerd op": afgeleid via `parentCourseId`

**Decision**: `courseRepository.basedOnOf(courseIds, trx)` geeft Map courseId → `{ courseName,
ownerName }` voor cursussen met `parentCourseId`: de naam van de **nieuwste gepubliceerde versie**
van het origineel (`latestPublishedVersions`, dus nooit een conceptnaam) en de naam van de
eigenaar van het origineel (`OrganisationCourse` met `isOwner = TRUE` → `Organisation`). Geen
filter op `deletedAt` van cursus of organisatie. Het conceptdocument en `GET /courses` krijgen een
veld `basedOn` (object of `null`).

**Rationale**: Clarifications Q4: de huidige namen, geen nieuwe velden. Het origineel heeft altijd
een gepubliceerde versie (een verwijzing kon alleen naar een gepubliceerde versie wijzen) en
verwijderde cursussen en organisaties houden hun naam (zachte verwijdering). Twee queries voor de
hele lijst, wat ook het aantal kopieën is.

**Alternatives considered**: de namen opslaan bij de kopie (Clarifications Q4, optie A):
afgewezen door de keuze van de stakeholder.

## R7. De Quests: niets veranderen

**Decision**: `questCatalog.questLiveVersions` blijft ongewijzigd. Na het aanpassen is de kopie
een eigen cursus met een live versie (dus in de lijst) en is de verwijzing weg (dus het origineel
niet meer). De vorm van de Quest-API blijft gelijk (FR-018). Een koppeling tussen oude en nieuwe
cursus op de Quest komt op de backlog (`docs/backlog-quest-app.md` en `docs/backlog.md`).

**Rationale**: in dezelfde transactie verdwijnt de verwijzing en ontstaat een live versie met
dezelfde inhoud, dus er is op elk moment een versie te downloaden (SC-007). Het API-contract niet
eenzijdig wijzigen (opdracht).

## R8. Hint in de cursusbibliotheek

**Decision**: `GET /course-library/:id` (het venster) krijgt `hasCopy: boolean`: de organisatie
heeft een niet-verwijderde eigen cursus met `parentCourseId` = deze cursus. Alleen voor cursussen
van een andere organisatie; `false` bij een eigen cursus. Het venster toont dan "Jullie hebben al
een aangepaste kopie van deze cursus" naast de knop (FR-021). De lijst verandert niet.

**Rationale**: FR-021 noemt alleen het venster; één query voor één cursus. Toevoegen blijft
toegestaan: de bestaande regels van spec 010 (FR-004, FR-005) gaan over verwijzingen en eigendom
van dezelfde `courseId`; de kopie heeft een eigen id.

## R9. Interface

**Decision**:
- `TakenOverCourseDialog.vue`: knop "Aanpassen" en een bevestiging (contracts/ui.md). Na succes
  verdwijnt de rij uit de store van verwijzingen (en daarmee een eventuele melding uit de teller)
  en opent de router `/courses/<id van de kopie>`. Bij `409 course_already_copied`: de melding,
  de lijsten vernieuwen, venster sluiten.
- `CoursesView.vue` en de kop van `CourseEditor.vue`: de regel "Gebaseerd op <cursus> van
  <organisatie>" als `basedOn` gevuld is.
- `PublishDialog.vue` en `PublishMenu.vue`: geen beschikbaarheidskeuze bij een kopie (R5).
- `lib/courseMapping.js`, `lib/completeness.js`: `keptFromOriginal` meenemen (R4).
- `CourseLibraryDetailsDialog.vue`: de hint van R8.

**Rationale**: zo veel mogelijk bestaande onderdelen; alle nieuwe teksten in één bestand
(`lib/courseReference.js`), zoals in spec 010 (R14). Het woord "verwijzing" komt nergens in de
interface (FR-019).

## R10. Datamodel en ERD

**Decision**: geen migratie. `Course.parentCourseId` (met FK, dus met index) bestaat al sinds
feature 004 en is tot nu toe altijd NULL. Het ERD verandert niet; alleen de notitie bij
`parentCourseId` wordt aangevuld ("gevuld voor een aangepaste kopie, spec 011").

**Rationale**: spec 010 R13 heeft dit zo voorbereid; FR-022 van spec 010 is daarmee waargemaakt.

## R11. Gebruik van video's en opruimen

**Decision**: geen wijziging. De versies van de kopie verwijzen naar dezelfde video's als het
origineel; `videoFileCleanup` bewaart elke video waarnaar een onderdeel verwijst. Na het aanpassen
telt de gekozen versie voor deze organisatie niet meer als gebruik (de verwijzing is weg); de
versies van het origineel blijven wel bestaan en houden hun video's (spec 010, R7).

## R12. Prestaties

**Decision**: aanpassen kost een vast aantal queries plus het kopiëren van de inhoud (twee keer
`copyVersionAsDraft`, zoals bij publiceren). `basedOnOf` en `grantedVideoIds` zijn elk een vast
aantal queries voor alle cursussen in de lijst. Het cursusoverzicht blijft binnen de grens van
spec 010 (200 + 200 cursussen binnen 2 s). Doel voor SC-001: aanpassen tot de editor open is
binnen 2 s bij een cursus van 100 onderdelen.
