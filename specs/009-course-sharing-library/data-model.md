# Data Model: Cursussen delen en de centrale cursusbibliotheek (FR-12, deel 1)

Wijzigingen ten opzichte van feature 006. Tabellen en velden staan in het Engels (constitutie VI).
Het ERD `docs/Diagrams.simp` wordt op dezelfde manier bijgewerkt (research R14).

## Course (gewijzigd)

| Veld | Type | Regel |
| --- | --- | --- |
| `id` | INT PK | ongewijzigd |
| `parentCourseId` | INT NULL → Course | ongewijzigd; blijft in deze feature altijd NULL. Een cursus met een waarde komt nooit in de bibliotheek (FR-014 d) |
| ~~`isSharedInLibrary`~~ | ~~BOOLEAN~~ | **vervalt**: stond altijd op false en werd niet gelezen (research R1) |
| `visibility` | ENUM('public','selective','private') NOT NULL DEFAULT 'private' | **nieuw**. Wie de cursus in de cursusbibliotheek ziet (FR-001). Bestaande cursussen krijgen 'private' (FR-005) |
| `createdAt`, `updatedAt`, `deletedAt` | DATETIME | ongewijzigd. Het wijzigen van de beschikbaarheid verandert `updatedAt` niet (research R9) |

Betekenis van `visibility`:
- `public`: "Algemeen beschikbaar". Alle actieve organisaties zien de cursus.
- `selective`: "Selectief beschikbaar". De eigenaar en de organisaties in `CourseAccess` zien de
  cursus.
- `private`: "Alleen eigen organisatie". De cursus staat niet in de bibliotheek, ook niet bij de
  eigenaar.

De waarde blijft staan na onpubliceren en na zacht verwijderen (FR-023). Of een cursus in de
bibliotheek staat, volgt verder uit de live versie (research R2).

## CourseAccess (nieuw)

| Veld | Type | Regel |
| --- | --- | --- |
| `courseId` | INT NOT NULL → Course | deel van de PK |
| `organisationId` | INT NOT NULL → Organisation | deel van de PK; index voor "cursussen gedeeld met mij" |

Regels (gelijk aan `VideoAccess`, specs/003):
- Er zijn alleen rijen als `Course.visibility = 'selective'`. Bij elke andere waarde worden alle
  rijen van de cursus verwijderd (FR-004).
- Nooit de eigenaar zelf. Alleen organisaties die actief waren op het moment van kiezen
  (`validateAccessOrganisations`).
- Bij `selective` minstens één rij, anders weigert het verzoek met "Kies minstens één organisatie,
  of kies ‘Alleen eigen organisatie’." (FR-003).
- Een organisatie die later wordt verwijderd, telt niet meer mee: de bibliotheek en de lijst met
  gekozen organisaties sluiten verwijderde organisaties uit. De rij blijft staan en de
  beschikbaarheid verandert niet vanzelf (randgeval).
- Alleen de eigenaar krijgt de rijen te zien, als namen (FR-004).

## OrganisationCourse, CourseVersion, CourseStep, Answer, Video (ongewijzigd)

- `OrganisationCourse.isOwner = TRUE` blijft de enige manier om eigenaar te zijn. Rijen met `FALSE`
  (verwijzingen) komen met deel 2 (research R13).
- De bibliotheek leest alleen de live versie (specs/006 R1: de hoogste vastgezette versie, niet
  onpubliceerd, van een niet-verwijderde cursus).
- `Video.visibility`, `Video.deletedAt` en de eigenaar van de video bepalen of een video in de
  waarschuwing komt (research R4). Deze feature verandert niets aan video's.

## Afgeleide begrippen (niet opgeslagen)

**Bibliotheek van organisatie X** (research R2): de cursussen die aan al deze voorwaarden voldoen:
- `deletedAt IS NULL` en `parentCourseId IS NULL`;
- de eigenaar (`isOwner = TRUE`) is niet verwijderd;
- `visibility <> 'private'`;
- (de eigenaar is X), of `visibility = 'public'`, of (`'selective'` en er is een rij in
  `CourseAccess` voor X);
- de cursus heeft een live versie.

**Publiek van een cursus**: de organisaties die de cursus zien, de eigenaar niet meegerekend.
- Zonder live versie, of bij `private`: niemand.
- Bij `public`: alle actieve organisaties.
- Bij `selective`: de actieve organisaties in `CourseAccess`.

**Beperkte video**: een video in de inhoud die gedeeld wordt, waarvoor een van deze dingen geldt:
- `visibility <> 'public'`;
- `deletedAt IS NOT NULL`;
- de eigenaar van de video is verwijderd.

**Lijst voor de waarschuwing** (FR-009, FR-010, research R4):

```text
na = publiek na de wijziging;  voor = publiek nu
als na leeg is                 → []
anders als na ⊄ voor           → alle beperkte video's in de inhoud          (a, b)
anders                         → beperkte video's die niet in de vorige live versie zaten  (c)
```

## Toestanden

`Course.visibility` en de publicatiestatus van 006 staan los van elkaar. Of een cursus in de
bibliotheek staat, volgt uit de combinatie:

| Publicatie (specs/006) | `visibility` | In de bibliotheek? |
| --- | --- | --- |
| Concept (nooit gepubliceerd of onpubliceerd) | elke waarde | nee |
| Gepubliceerd (met of zonder wijzigingen) | `private` | nee |
| Gepubliceerd (met of zonder wijzigingen) | `public` | ja, voor alle organisaties |
| Gepubliceerd (met of zonder wijzigingen) | `selective` | ja, voor de eigenaar en de gekozen organisaties |
| Zacht verwijderd | elke waarde | nee |

Overgangen:
- **Publiceren** (`POST .../publish`): zet inhoud en `visibility` samen, of geen van beide.
- **Beschikbaarheid wijzigen** (`PUT .../availability`): kan alleen bij een live versie en zet
  alleen `visibility` en `CourseAccess`.
- **Onpubliceren en verwijderen**: laten `visibility` staan.

## Migratie

Eén Knex-migratie, `backend/src/db/migrations/20261126000001_course_sharing.js`:
1. `Course`: kolom `visibility` toevoegen (ENUM, NOT NULL, DEFAULT 'private') en kolom
   `isSharedInLibrary` verwijderen.
2. Tabel `CourseAccess` aanmaken: PK (`courseId`, `organisationId`), foreign keys naar `Course` en
   `Organisation`, index op `organisationId`.
3. `down` doet het omgekeerde (`isSharedInLibrary` terug met default false).

Bestaande cursussen worden daarmee `private`. Er wordt geen bestaande versie aangeraakt (FR-005).
