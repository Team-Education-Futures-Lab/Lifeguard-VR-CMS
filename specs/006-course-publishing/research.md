# Research: Cursus publiceren en onpubliceren

Alle keuzes voor feature 006. Er waren geen open NEEDS CLARIFICATION-punten na
`/speckit-clarify`; dit zijn de ontwerpbeslissingen.

## R1 – Welke versie live is: afgeleid uit `CourseVersion`, plus `unpublishedAt`

- **Decision**: geen veld op `Course`. De live versie van een cursus is de `CourseVersion` met het
  hoogste `versionNumber` waarvan `publishedAt IS NOT NULL`, mits `unpublishedAt IS NULL` en
  `Course.deletedAt IS NULL` (Clarifications 2026-11-23). Eén nieuw veld:
  `CourseVersion.unpublishedAt` (DATETIME, NULL). Onpubliceren vult het bij de hoogste vastgezette
  versie; opnieuw publiceren zonder wijzigingen maakt het weer leeg (FR-017).
- **Rationale**: volgt het ERD en de regel van de gebruiker ("hoogste gepubliceerde versie = live");
  alleen onpubliceren vraagt extra opslag, omdat versies bewaard blijven. Een tijdstip past bij
  `publishedAt` en laat zien wanneer een versie offline ging. Er kan nooit meer dan één versie live
  zijn: alleen de hoogste vastgezette versie telt.
- **Alternatives considered**: `Course.publishedCourseVersionId` (oorspronkelijk plan; afgewezen
  door de gebruiker, een extra verwijzing die het ERD niet nodig heeft); `Course.isPublished`
  (boolean, geen tijdstip, en hoort minder bij de versie die offline gaat).
- **ERD**: `unpublishedAt` toevoegen aan `CourseVersion` in `docs/Diagrams.simp`.
- **Query**: één helper `liveVersions` in de repository: per cursus de hoogste vastgezette
  versie (`MAX(versionNumber) WHERE publishedAt IS NOT NULL`), gefilterd op `unpublishedAt IS NULL`
  en een niet-verwijderde cursus. Status, overzicht, videoregel (R6) en de latere Quest-API
  gebruiken alleen deze helper.

## R2 – Versienummers: het concept draagt het volgende nummer

- **Decision**: het concept heeft altijd het versienummer dat de volgende publicatie krijgt. Een
  nieuwe cursus begint met concept 1 (zoals nu; geen migratie van nummers). Publiceren zet het
  concept vast als versie n en maakt een nieuw concept n+1. De bestaande unieke index (`courseId`,
  `versionNumber`) blijft het vangnet.
- **Rationale**: het ERD-model van de gebruiker; geen kunstmatig nummer 0. De docent ziet het
  nummer van het concept nooit, alleen dat van de live versie (spec, Assumptions).

## R3 – Publiceren = het concept vastzetten en een nieuw concept kopiëren

- **Decision**: `POST /courses/:id/publish` doet in één transactie (met `withDeadlockRetry`):
  1. conceptrij vergrendelen (`findOwnCourse … forUpdate`); onbekend, andermans of verwijderd → 404;
  2. concept laden en de controle van R5 + R6 uitvoeren; meldingen → 422, niets verandert;
  3. de inhoud van het concept vergelijken (R4) met de laatst vastgezette versie (hoogste
     `versionNumber` met `publishedAt`):
     - gelijk en die versie is live → niets te doen (idempotent, R9);
     - gelijk en die versie is onpubliceerd → `unpublishedAt = NULL` (FR-017); het concept blijft;
     - anders (of er is nog geen vastgezette versie) → het concept vastzetten met
       `publishedAt = UTC_TIMESTAMP()`; daarna een nieuw concept met `versionNumber + 1`, dezelfde
       naam en beschrijving, en kopieën van de onderdelen (in id-volgorde, map oud-id → nieuw-id) en
       antwoorden; `nextCourseStepId` van onderdelen en antwoorden via die map (zelfde aanpak als
       feature 005 R1); `videoId` alleen als verwijzing; `positionX/Y` mee;
  4. `Course.updatedAt` bijwerken; het nieuwe concept-document teruggeven.
- **Rationale**: wat gecontroleerd wordt, is precies wat vastgezet wordt: de gecontroleerde rijen
  zelf worden de gepubliceerde versie. Een opslag van hetzelfde concept wacht op het slot en wordt
  daarna door R14 tegengehouden. Alles-of-niets (FR-010).
- **Gevolg**: de onderdelen van het concept krijgen na publiceren nieuwe id's (R14).
- **Alternatives considered**: het concept laten staan en een kopie vastzetten (oorspronkelijk plan;
  stabiele id's in de editor, maar wijkt af van het model van de gebruiker); de versie als JSON-blob
  opslaan (wijkt af van het ERD).

## R4 – "Inhoudelijk gelijk": vergelijken op het moment zelf

- **Decision**: geen opgeslagen hash. `backend/src/lib/courseContent.js` maakt van een versie een
  canonieke inhoud: naam, beschrijving, en de onderdelen in id-volgorde met `stepType`, `isStart`,
  `videoId`, `questionText`, `feedback`, antwoorden in `sortOrder` (`answerText`, `isCorrect`) en
  verbindingen als **positie in die volgorde** in plaats van id. Geen id's, geen `positionX/Y`.
  `sameContent(a, b)` vergelijkt er twee. Omdat de kopie in id-volgorde wordt ingevoegd, is een net
  gekopieerd concept inhoudelijk gelijk aan de versie waar het van komt.
- **Status** (FR-018): geen live versie → `draft`; concept gelijk aan live → `published`; anders
  → `published_changed`.
- **Cursusoverzicht**: voor de cursussen met een live versie worden de onderdelen en antwoorden van
  concept en live versie in twee queries (alle versie-id's tegelijk) geladen en per cursus
  vergeleken. Bij tientallen cursussen per organisatie is dat ruim snel genoeg.
- **Alternatives considered**: `CourseVersion.contentHash` (oorspronkelijk plan; een extra veld
  buiten het ERD, afgewezen); `Course.updatedAt > publishedAt` (telt canvas en ongedaan maken
  verkeerd).

## R5 – Dezelfde controle op de server

- **Decision**: de regels van `frontend/src/lib/completeness.js` worden overgezet naar
  `backend/src/lib/courseCheck.js`, die werkt op het concept zoals de server het leest (onderdelen,
  antwoorden, `nextCourseStepId`). Zelfde codes (`empty`, `noStart`, `noEnd`, `unreachable`,
  `answerOpen`, `neverEnds`, `noVideo`, `videoUnavailable`, `noQuestion`, `emptyAnswer`), zelfde
  Nederlandse teksten, plus `stepId`/`answerId`. Gelijkheid wordt bewaakt met één gedeelde set
  testgevallen, `backend/tests/fixtures/course-check-cases.json` (concept + verwachte codes), die
  zowel een backend-unittest als een frontendtest inlezen (zoals de frontend al de testvideo's van
  de backend gebruikt, specs/002 R12).
- **Rationale**: de backend-image wordt gebouwd met `./backend` als context; een gedeelde map
  vraagt andere Docker-builds. Twee kleine pure functies met één gedeelde testset zijn eenvoudiger
  en de testset maakt afwijking zichtbaar in CI.
- **Alternatives considered**: één gedeelde module in een `shared/`-map (build-contexten en
  imports aanpassen); de frontend laten controleren en de server vertrouwen (in strijd met FR-006).

## R6 – Onbeschikbare video: alleen de live versie beschermt hem

- **Decision**: een video-onderdeel geeft `videoUnavailable` als de video niet in de bibliotheek van
  de organisatie staat (`libraryVideoIds`, ongewijzigde regel van specs/003) **en** niet voorkomt in
  de onderdelen van de live versie (R1). Het concept-document krijgt
  per video `keptByLiveVersion`; de frontendcontrole meldt `videoUnavailable` alleen bij
  `available === false && keptByLiveVersion === false` (FR-013).
- **Rationale**: Clarifications 2026-11-23 en `docs/Requirements.docx` FR-13. Het gaat om de
  video, niet om het onderdeel (spec, Edge Cases).
- **Opslaan verandert niet**: de regel van specs/004 R5 (een onbeschikbare video mag alleen in het
  onderdeel blijven dat hem al had) blijft; publiceren voegt alleen een controle toe.

## R7 – Niet-opgeslagen wijzigingen en de meldingen in de editor

- **Decision**: de knop "Publiceren" opent de bevestiging; na "Publiceren" slaat de editor eerst
  op met de bestaande `saveDraft` (als er wijzigingen zijn) en roept daarna de publiceer-route aan.
  Mislukt opslaan, dan stopt het. Bij 422 toont de editor de meldingen van de server in een dialoog
  "Nog niet klaar om te publiceren", elk met een link die het onderdeel opent (zelfde gedrag als de
  lijst "nog te doen"), en worden de meldingen rood zoals na opslaan (specs/005 FR-022a).
- **Rationale**: FR-003, FR-007, US1 scenario 5. De editor kent zijn eigen meldingen al; is de
  cursus lokaal niet compleet, dan toont de editor de dialoog direct zonder serververzoek (de
  server blijft de beslissing nemen als het lokaal wel klopt).

## R8 – Statusinformatie in de bestaande documenten

- **Decision**: het concept-document en elke rij van de cursuslijst krijgen `status`
  (`draft` | `published` | `published_changed`, vervangt de vaste waarde `draft`) en `publication`
  (`null` of `{ versionNumber, publishedAt, hasUnavailableVideo }`). `hasUnavailableVideo` voedt de
  extra zin in de bevestiging bij onpubliceren (FR-015). Daarnaast `lastPublishedVersionNumber`
  alleen in het concept-document, voor de tekst "eerder gepubliceerd" en de bevestiging.
- **Rationale**: één bron voor overzicht en editor (FR-019); de publiceer- en onpubliceer-routes
  geven dezelfde velden terug, zodat de editor zonder herladen bijwerkt.

## R9 – Dubbel klikken en gelijktijdigheid

- **Decision**: publiceren is idempotent: is het concept inhoudelijk gelijk aan de live versie,
  dan antwoordt de server `200` met de huidige status en maakt geen versie. Onpubliceren
  zonder live versie is ook `200`. In de editor is de knop uitgeschakeld tijdens een verzoek.
- **Rationale**: SC-006 (20 gelijktijdige verzoeken → één live versie, geen dubbele nummers): het
  slot laat ze na elkaar lopen, en het tweede verzoek vindt niets te doen.

## R10 – Verwijderen van een gepubliceerde cursus

- **Decision**: geen wijziging aan `softDeleteOwnCourse`: alleen `Course.deletedAt` wordt gezet.
  Omdat "live" ook `Course.deletedAt IS NULL` eist (R1), is een verwijderde cursus meteen niet meer
  beschikbaar voor de Quest (FR-021). De bevestiging in het overzicht krijgt een extra zin als de
  rij `status ≠ draft` heeft.
- **Waarom zacht**: Requirements FR-12 (wie de cursus al heeft gedownload of overgenomen, kan hem
  blijven gebruiken; pas als niemand hem meer gebruikt, wordt hij echt verwijderd; bevestigd door
  de stakeholder), FR-11 (oude versies blijven onbeperkt bewaard) en constitutie principe V.
- **Later echt verwijderen** (Clarifications 2026-11-23): zoals bij video's blijft een zacht
  verwijderde cursus alleen bestaan zolang een andere organisatie hem via een verwijzing (FR-12)
  gebruikt. Downloads op een Quest worden niet bijgehouden en tellen niet mee. Dat opruimen is het
  backlogpunt "Cursussen en video's van verwijderde cursussen echt opruimen"; tot FR-12 er is, kan
  die stap elke zacht verwijderde cursus opruimen.

## R11 – Video-bestanden opruimen (FR-014)

- **Decision**: geen wijziging. `jobs/videoFileCleanup.js` ruimt alleen bestanden op van video's
  waar **geen enkel** `CourseStep` naar verwijst; de kopieën in gepubliceerde versies zijn ook
  `CourseStep`-rijen en houden de video dus vast.
- **Rationale**: voldoet aan FR-014 (strenger: ook oude versies houden hem vast). Het loslaten van
  video's die alleen in oude versies of verwijderde cursussen zitten, is het backlogpunt "Video's
  van verwijderde cursussen echt opruimen" en moet dan FR-13 volgen (alleen live versies tellen).

## R12 – Ruimte voor beschikbaarheid (FR-12)

- **Decision**: nu geen veld. Met FR-12 komt een beschikbaarheid per cursus (zoals
  `Video.visibility`, met standaard "alleen eigen organisatie") en eventueel een toegangstabel zoals
  `VideoAccess`. Bestaande gepubliceerde cursussen krijgen dan de standaard; niets uit deze feature
  hoeft om. De latere Quest-API leest de live versie via `liveVersions` (R1), en straks ook
  de beschikbaarheid.
- **Rationale**: FR-011; geen velden toevoegen die nog niets doen.

## R13 – Datum en tijd

- **Decision**: `publishedAt` gaat als ISO-tijd in UTC over de lijn (zoals `updatedAt`); de
  frontend toont hem met `Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeStyle: 'short' })`
  in de tijdzone van de browser, bijvoorbeeld "23 november 2026 om 14:05".

## R14 – Nieuwe id's na publiceren en een editor die nog open staat

- **Decision**: het opslaan-verzoek (`PUT /courses/:id`) krijgt een verplicht veld
  `draftVersionNumber`: het versienummer van het concept dat de editor heeft geladen. Wijkt het af
  van het huidige concept (er is intussen gepubliceerd), dan antwoordt de server
  `409 draft_replaced` met "Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw om verder
  te werken." en verandert niets. Na eigen publiceren vervangt de editor zijn lokale kopie door het
  teruggegeven concept en wist hij de geschiedenis van ongedaan maken (de oude id's bestaan in het
  concept niet meer).
- **Rationale**: zonder deze controle zou een oude editor id's sturen die nu bij de vastgezette
  versie horen; `checkIds` weigert die wel, maar met een onbegrijpelijke melding. Vastgezette
  versies kunnen zo nooit via opslaan veranderen (FR-004).
- **Gelijktijdig**: een opslag die op het slot van de conceptrij wacht terwijl die rij wordt
  vastgezet, vindt daarna geen concept meer via die rij. De server kijkt dan of de cursus zelf nog
  van deze organisatie is en niet verwijderd; zo ja → `409 draft_replaced`, niet `404`. Publiceren
  en onpubliceren halen in dat geval het nieuwe concept één keer opnieuw op.
- **Alternatives considered**: de concept-id's stabiel houden door een kopie vast te zetten (zie
  R3, afgewezen).
