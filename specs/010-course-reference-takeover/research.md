# Research: Gedeelde cursussen overnemen als verwijzing (FR-12, deel 2)

Er waren geen NEEDS CLARIFICATION-punten in de Technical Context. De keuzes uit de clarify-sessie
van 2026-11-27 staan in de spec. Hieronder staan de ontwerpkeuzes, elk met de redenering en de
afgewezen alternatieven.

## R1. De verwijzing: `OrganisationCourse` met de gekozen versie

**Decision**: een verwijzing is een rij in `OrganisationCourse` met `isOwner = FALSE` (ERD). Er
komen twee velden bij, allebei NULL en met een FK naar `CourseVersion`:
- `courseVersionId`: de gekozen versie. Die is bij een verwijzing altijd gevuld en bij de eigenaar
  altijd NULL, want voor de eigenaar geldt de live versie.
- `declinedCourseVersionId`: de live versie waarvoor de ontvanger "Huidige versie houden" koos.
  Anders NULL.

`addedAt` blijft het moment van toevoegen. De bestaande primaire sleutel
`(organisationId, courseId)` zorgt dat er per organisatie ten hoogste één rij per cursus is. Een
organisatie kan dus niet tegelijk eigenaar en ontvanger zijn (FR-005).

**Rationale**:
- Dit is wat het ERD al voorziet. De tabel en de sleutel bestaan, en er hoeft niets omgezet te
  worden.
- De gekozen versie als FK naar een vastgezette versie kan nooit naar een concept of een andere
  cursus wijzen: de service controleert bij elke wijziging dat de versie van dezelfde cursus is en
  `publishedAt` heeft.
- Of er een melding is, kan zonder extra tabel worden bepaald. De live versie gaat alleen vooruit
  (specs/006: onpubliceren haalt de hoogste versie offline, en opnieuw publiceren brengt diezelfde
  versie terug). Daarom geldt: "melding" ⇔ live versie ≠ gekozen versie en live versie ≠
  geweigerde versie (R4).

**Alternatives considered**:
- *Een aparte tabel `CourseReference`*: dubbel met `OrganisationCourse`, wijkt af van het ERD, en
  bij spec 011 zouden twee tabellen moeten samenwerken.
- *Het versienummer opslaan in plaats van een FK*: kan niet naar een niet-bestaande versie
  verwijzen, maar is zwakker. Joins naar de inhoud hebben toch het id nodig.
- *Een aparte meldingentabel*: overbodig. Een melding is een afgeleide toestand en zou anders
  bijgewerkt moeten worden bij elke publicatie, intrekking en beperking.

## R2. Wie, wanneer en welke versie: afgeleid uit de verwijzing, geen aparte tabel

**Decision** (Clarifications 2026-11-27): er komt geen tabel voor een overnamegeschiedenis. Alles
wat nodig is, staat in de verwijzingsrij:
- wie: `OrganisationCourse.organisationId` met `isOwner = FALSE`;
- wanneer toegevoegd: `addedAt`, dat al in het ERD staat;
- welke versie nu: `courseVersionId` (R1).

Eerdere versies van een verwijzing en verwijderde verwijzingen worden niet bewaard.

**Rationale**:
- Een versie verandert nooit (specs/006). De video's waarvoor de eigenaar toestemming gaf, zijn
  dus de video's in de gekozen versie.
- Die toestemming volgt uit het delen: specs/009 dwingt de waarschuwing af voordat een cursus met
  beperkte video's gedeeld wordt (FR-012 van 009). Een verwijzing ontstaat of wisselt alleen van
  versie terwijl de cursus voor die organisatie in de bibliotheek staat; dat controleert de service
  onder een lock (R5, R8).
- Spec 011 maakt een kopie van de gekozen versie terwijl de verwijzing nog bestaat. Daarna zijn de
  kopie (`parentCourseId`) en haar eerste versie zelf het bewijs: een beperkte video mag in de
  kopie blijven als hij in die eerste versie zat (R13).
- Geen enkele eis vraagt om eerdere versies of verwijderde verwijzingen terug te zien. Een tabel
  die niemand leest, is extra onderhoud in de database, het ERD en de tests.

**Alternatives considered**:
- *Een tabel `CourseTakeover` met één rij per toevoegen en overstappen, die nooit verwijderd
  wordt*: dat was het eerste plan. Afgewezen in de clarify-sessie, omdat de informatie niet nodig
  is en anders uit de database af te leiden is.
- *Een veld `updatedAt` op de verwijzing*: niet nodig voor een eis.
- *De geschiedenis in het actielogboek (`AdminActionLog`)*: dat is voor de beheerder.

## R3. Eén definitie van "de verwijzingen van deze organisatie"

**Decision**: `courseReferenceRepository.referencesQuery(organisationId)` is de enige query die
verwijzingen leest. Het is `OrganisationCourse` met `isOwner = FALSE` en `organisationId` uit de
sessie, met join naar `Course` (zonder filter op `deletedAt`), naar de eigenaar
(`OrganisationCourse` met `isOwner = TRUE` → `Organisation`, zonder filter op `deletedAt`) en naar
de gekozen `CourseVersion`. Lijst, venster, thumbnail, verwijderen, overstappen, houden en
`questCatalog` beginnen allemaal hier.

**Rationale**: zoals `ownCoursesQuery`, `libraryCoursesQuery` en `questLiveVersions`. Eén plek
waar staat welke rijen een organisatie mag zien, zodat er nooit een route is die het vergeet
(FR-024). Verwijderde cursussen en eigenaren worden bewust niet uitgesloten (FR-011, FR-018).

**Alternatives considered**: verwijzingen meenemen in `ownCoursesQuery`. Afgewezen: elke
eigenaarsroute (opslaan, publiceren, verwijderen, beschikbaarheid) zou dan per geval moeten
controleren dat het geen verwijzing is. Nu weigert de bestaande afscherming dat vanzelf (FR-008).

## R4. De toestand van een verwijzing: pure functie `referenceState`

**Decision**: `lib/courseReference.js` exporteert
`referenceState({ chosen, live, declinedVersionId, courseDeleted, ownerDeleted, hasAccess })` met
deze uitkomst:

```js
{ withdrawn: null | 'owner_deleted' | 'course_deleted' | 'unpublished' | 'no_access',
  newVersion: null | { id, versionNumber, publishedAt },   // er is een nieuwere live versie te kiezen
  notice: boolean }                                        // de melding (FR-012)
```

Regels, in deze volgorde:
1. `withdrawn`: eerst `owner_deleted`, dan `course_deleted`, dan `unpublished` (geen live versie),
   dan `no_access` (niet in de bibliotheek van de ontvanger). Anders `null`.
2. `newVersion`: alleen als `withdrawn === null` en `live.versionNumber > chosen.versionNumber`.
3. `notice`: `newVersion !== null` en `live.id !== declinedVersionId`.

**Rationale**:
- Alle regels van FR-012 tot FR-017 staan zo op één plek en zijn met een tabel van gevallen te
  testen, net als `sharedVideosWarning` in specs/009 R4.
- De volgorde geeft de meest blijvende reden. Een verwijderde eigenaar zegt meer dan een
  ingetrokken cursus van die eigenaar.
- Het geheugen "Huidige versie houden" geldt alleen voor die ene live versie. Bij een nog nieuwere
  versie verschilt `live.id`, en komt de melding terug (FR-015). Bij "Nieuwe versie gebruiken"
  wordt `declinedCourseVersionId` weer NULL.

**Alternatives considered**: een opgeslagen status per verwijzing. Afgewezen: die zou bij elke
actie van de eigenaar voor alle ontvangers bijgewerkt moeten worden, en dan kan hij ongemerkt
afwijken.

## R5. Toegang tot nieuwe versies volgt uit de bibliotheek

**Decision**: `hasAccess` en de controle bij toevoegen en overstappen gebruiken
`libraryCoursesQuery(ontvanger)` uit specs/009, plus `liveVersions`. Een ontvanger mag toevoegen of
overstappen precies als de cursus nu in haar cursusbibliotheek staat.

**Rationale**:
- Spec FR-004 en FR-012 verwijzen expliciet naar specs/009 FR-014. Hergebruik voorkomt dat
  "beschikbaar" op twee plekken net anders betekent.
- `libraryCoursesQuery` sluit al verwijderde cursussen, verwijderde eigenaren, kopieën en
  `private` uit, en controleert `CourseAccess` voor `selective`.
- Voor de lijst wordt de query één keer uitgevoerd voor alle verwijzingen samen:
  `.whereIn('c.id', ids)`.

**Alternatives considered**: een eigen query met `visibility` en `CourseAccess`. Afgewezen omdat
die dubbel is met de bibliotheek.

## R6. Quests: alleen `questLiveVersions` verandert

**Decision**: `questLiveVersions(organisationId)` geeft een Map `courseId → versierij` met:
1. de eigen cursussen (`isOwner = TRUE`) met hun live versie, zoals nu;
2. plus, uit `referencesQuery`, voor elke verwijzing de gekozen versie (`versionsByIds`). Er is
   geen filter op `Course.deletedAt`, `unpublishedAt`, `visibility` of de eigenaar (FR-011).

De sleutel is het id van de originele cursus. Een organisatie kan geen eigenaar en ontvanger van
dezelfde cursus zijn (R1), dus er botst nooit iets.

**Rationale**:
- specs/007 en het commentaar in `questCatalog.js` maken dit de enige plek die bepaalt wat een
  Quest ziet. `listCourses`, `getCourse`, `getCourseThumbnailKey` en `getVideoKey` gebruiken de
  Map al. De Quest-API verandert daardoor niet van vorm, en een Quest ziet geen verschil tussen
  eigen en overgenomen cursussen (Assumptions).
- De thumbnail- en video-regels van 007/008 (niet filteren op verwijderd of beperkt) gelden zo
  automatisch ook voor de gekozen versie (FR-021, US5 scenario 2).

**Alternatives considered**:
- *Een `parentCourseId`-cursus per ontvanger*: dat is een kopie, en dat is spec 011.
- *Een verwijzing laten volgen naar de live versie van de eigenaar*: in strijd met FR-011 en
  US3.

## R7. Gebruik van video's (FR-13, FR-021)

**Decision**: er is geen nieuwe code nodig voor "in gebruik". Dit wordt vastgelegd met tests en
commentaar:
- Gepubliceerde versies worden nooit verwijderd (specs/006). Hun `CourseStep`-rijen blijven dus
  bestaan, en `videoFileCleanup` ruimt alleen video's op die in geen enkel onderdeel zitten. De
  gekozen versie van een ontvanger houdt zijn video's daardoor altijd met bestand.
- `videoFiles` en `isVideoInVersions` filteren niet op `deletedAt` of beschikbaarheid, dus de Quest
  van de ontvanger kan de video downloaden (R6).
- Een verwijzing die verwijderd wordt of overstapt, houdt de oude versie niet meer in gebruik
  (US5 scenario 3). Omdat de opruimtaak nu nog naar alle versies kijkt, blijft het bestand in de
  praktijk staan. Dat is veilig, en het echt opruimen staat op de backlog.

Voor dat latere opruimen wordt de regel in `docs/backlog.md` ("Cursussen en video's van
verwijderde cursussen echt opruimen") aangevuld: een cursus en zijn versies mogen pas weg als geen
`OrganisationCourse`-rij van een actieve organisatie er nog naar wijst. Ook moet een versie blijven
bestaan zolang een verwijzing haar als `courseVersionId` heeft. De FK naar de versie dwingt dat
ook af.

**Rationale**: het gedrag dat de spec vraagt bestaat al door de keuzes van 004/006. Een tweede
"in gebruik"-mechanisme zou kunnen gaan verschillen van de opruimtaak.

**Alternatives considered**: een teller of vlag "in gebruik" per video. Afgewezen omdat die
afgeleid is en kan verouderen.

## R8. Gelijktijdigheid met acties van de eigenaar

**Decision**: toevoegen en "Nieuwe versie gebruiken" lopen in één transactie (met
`withDeadlockRetry`). Die transactie vergrendelt eerst de `Course`-rij met `FOR SHARE`, controleert
daarna toegang en live versie (R5), en schrijft dan de verwijzing.

**Rationale**:
- Onpubliceren en publiceren werken `Course.updatedAt` bij (`touchCourse`). Verwijderen zet
  `Course.deletedAt` en beperken zet `Course.visibility`. Al deze acties schrijven dus de
  `Course`-rij, en wachten op de gedeelde lock, of de overname wacht op hen.
- Een verwijzing kan daardoor nooit naar een versie wijzen die de organisatie kreeg terwijl de
  eigenaar haar al had uitgesloten. Daarop rust de afgeleide toestemming voor beperkte video's
  (R2).
- Dubbel toevoegen (twee tabbladen) stuit op de primaire sleutel. De service vangt dat af en geeft
  `409 course_already_added`.

**Alternatives considered**: zonder lock controleren. Afgewezen omdat bij gelijktijdig beperken
een overname zonder toestemming kon ontstaan.

## R9. API-vorm: een eigen module en routes

**Decision**: een nieuwe module `courseReferences` met deze routes onder `/api/organisation`:
- `GET /course-references`: de lijst;
- `GET /course-references/:courseId`: één verwijzing;
- `POST /course-references` met body `{ courseId }`: toevoegen;
- `DELETE /course-references/:courseId`: verwijderen uit de eigen organisatie;
- `POST /course-references/:courseId/update`: "Nieuwe versie gebruiken";
- `POST /course-references/:courseId/keep`: "Huidige versie houden";
- `GET /course-references/:courseId/thumbnail`: de afbeelding van de gekozen versie.

Het id in de URL is het id van de originele cursus, want per organisatie is er ten hoogste één
verwijzing per cursus.

**Rationale**:
- De bestaande routes `/courses/:id` blijven alleen eigenaars bedienen. Elke poging om een
  verwijzing via die routes te bewerken, geeft al 404 (FR-008), zonder nieuwe code.
- `update` heeft geen body: hij kiest altijd de live versie van dat moment (spec US3 scenario 5).
  Heeft de verwijzing al de live versie, of is er geen nieuwere te kiezen, dan komt er
  `409 no_newer_version` met de huidige toestand, zodat het venster zich kan bijwerken.

**Alternatives considered**:
- *`POST /course-library/:id/add`*: toevoegen hoort bij de bibliotheek, maar verwijderen en
  versies kiezen niet. Eén module houdt de regels van de verwijzing bij elkaar.
- *`PUT` met een versienummer*: dan zou een oudere versie te kiezen zijn, en dat mag niet (FR-014).

## R10. Cursusoverzicht en teller zonder polling

**Decision**:
- `CoursesView` laadt `GET /courses` en `GET /course-references` tegelijk en toont één lijst.
  Overgenomen cursussen hebben de pil "Overgenomen van <naam>".
- Een Pinia-store `courseReferences` houdt de lijst en `noticeCount` bij. `OrganisationLayout`
  laadt de store bij het openen van het CMS. `CoursesView` en de acties in het venster werken haar
  bij. De teller staat naast "Cursussen" in de navigatie.
- Het laden van alle verwijzingen kost een vast aantal queries: `referencesQuery`, `liveVersions`,
  `libraryCoursesQuery` met `whereIn`, en `versionContents` voor aantallen en thumbnails.

**Rationale**: dit volgt "geen polling" (specs/001), net als de bibliotheek. De teller is per
organisatie (één account, Assumptions).

**Alternatives considered**: de verwijzingen meesturen in `GET /courses`. Afgewezen: die route
hoort bij `ownCoursesQuery` (R3). Een aparte route `/course-references/count` is niet nodig bij
tientallen verwijzingen.

## R11. Thumbnail van een overgenomen cursus

**Decision**: `GET /course-references/:courseId/thumbnail` geeft de afbeelding van de gekozen
versie, bepaald met `thumbnailVideoId` (specs/008), via `sendStoredFile` en `X-Accel-Redirect`
(`private, max-age=3600`). Er is geen filter op de videobibliotheek van de ontvanger (spec, Edge
Cases). De URL krijgt `?v=<versionNumber>`, zodat een nieuwe gekozen versie een nieuwe afbeelding
geeft. In de cursusbibliotheek blijft de regel van specs/009 R6 gelden.

**Rationale**: de ontvanger mag de video's binnen de cursus gebruiken (specs/009 FR-011), en de
Quest toont dezelfde afbeelding al (specs/008).

## R12. ERD bijwerken

**Decision**: in `docs/Diagrams.simp`:
- `OrganisationCourse` krijgt `courseVersionId` en `declinedCourseVersionId` (beide FK naar
  `CourseVersion`, NULL);
- de notitie bij `isOwner` krijgt erbij: "FALSE = overgenomen cursus (verwijzing); wijst naar
  `courseVersionId`".

Dit is een aparte taak, zoals R14 in specs/009.

## R13. Klaar voor spec 011 zonder gegevens om te zetten

**Decision**: spec 011 zet een verwijzing om in één transactie:
1. een nieuwe `Course` met `parentCourseId` = het origineel;
2. een kopie van de gekozen versie (`copyVersionAsDraft` bestaat al);
3. een `OrganisationCourse`-rij met `isOwner = TRUE` voor de nieuwe cursus;
4. de verwijzingsrij verwijderen.

Daarna zijn de kopie en haar eerste versie het bewijs van toestemming: een beperkte video mag in de
kopie blijven als hij in die eerste versie zat (R2, FR-14).

**Rationale**:
- Alles wat 011 nodig heeft, staat al in gewone rijen: de gekozen versie, wie en wanneer.
- Kopieën staan nooit in de bibliotheek (`parentCourseId IS NOT NULL`, specs/009 FR-014 d).
- Er is geen migratie nodig van rijen die in 010 zijn ontstaan.

**Alternatives considered**: de verwijzing nu al als kopie opslaan. Afgewezen: dat is precies wat
de spec uitsluit (FR-003).

## R14. Teksten in de interface

**Decision**:
- Bestaande woorden blijven: de status zegt "Op de Quest: versie N · datum", zoals in
  `lib/publication.js`, en de bevestigingen spreken van "VR-brillen", zoals in specs/006.
- Nieuwe teksten gebruiken "overgenomen cursus" en "Overgenomen van <naam>", nooit "verwijzing"
  (FR-023).
- Een getal met een zelfstandig naamwoord gaat met dezelfde hulpfunctie als in specs/009 ("1
  organisatie" of "2 organisaties").

**Rationale**: dit volgt NFR-03 en de woorden die de docent al kent.
