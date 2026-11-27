# Data Model: Gedeelde cursussen overnemen als verwijzing (FR-12, deel 2)

Dit zijn de wijzigingen ten opzichte van feature 009. Tabellen en velden staan in het Engels
(constitutie VI). Het ERD `docs/Diagrams.simp` wordt op dezelfde manier bijgewerkt (research R12).
Er komen alleen twee velden bij; er komt geen nieuwe tabel. Bestaande rijen veranderen niet.

## OrganisationCourse (gewijzigd)

| Veld | Type | Regel |
| --- | --- | --- |
| `organisationId` | INT NOT NULL → Organisation | ongewijzigd; deel van de PK. Komt altijd uit de sessie |
| `courseId` | INT NOT NULL → Course | ongewijzigd; deel van de PK |
| `isOwner` | BOOLEAN NOT NULL | ongewijzigd. `TRUE` = eigenaar (precies één per cursus). `FALSE` = overgenomen cursus (verwijzing) |
| `addedAt` | DATETIME NOT NULL | ongewijzigd. Bij een verwijzing: het moment van toevoegen (`UTC_TIMESTAMP()`) |
| `courseVersionId` | INT NULL → CourseVersion | **nieuw**. De gekozen versie. Bij `isOwner = FALSE` altijd gevuld, bij `isOwner = TRUE` altijd NULL |
| `declinedCourseVersionId` | INT NULL → CourseVersion | **nieuw**. De live versie waarvoor de ontvanger "Huidige versie houden" koos. Wordt NULL bij "Nieuwe versie gebruiken". Bij `isOwner = TRUE` altijd NULL |

Regels:
- De PK `(organisationId, courseId)` geeft ten hoogste één rij per organisatie per cursus. Daardoor
  kan een organisatie niet tegelijk eigenaar en ontvanger zijn, en niet twee keer toevoegen
  (FR-005).
- `courseVersionId` en `declinedCourseVersionId` wijzen altijd naar een versie van dezelfde
  `courseId` met `publishedAt IS NOT NULL`. De service controleert dat bij elke wijziging; er komt
  geen databasecontrole over twee tabellen.
- Een verwijzing ontstaat alleen als de cursus op dat moment in de bibliotheek van de ontvanger
  staat en een live versie heeft. `courseVersionId` is dan die live versie (FR-003, FR-004).
- "Nieuwe versie gebruiken" zet `courseVersionId` op de live versie van dat moment en
  `declinedCourseVersionId` op NULL (FR-014).
- "Huidige versie houden" zet `declinedCourseVersionId` op de live versie van dat moment
  (FR-015).
- "Verwijderen uit mijn organisatie" verwijdert de rij (FR-009). Er blijft niets van over;
  opnieuw toevoegen maakt een nieuwe rij met een nieuwe `addedAt`.
- Een eigenaarsrij verandert niet door deze feature.
- Index: de bestaande index op `courseId` dient voor "ontvangers van deze cursus".

## Geen overnamegeschiedenis (FR-020)

Er komt geen aparte tabel (Clarifications 2026-11-27, research R2). Wat nodig is, staat in de
verwijzingsrij:
- wie: `organisationId`;
- wanneer toegevoegd: `addedAt`;
- welke versie nu: `courseVersionId`.

Betekenis voor spec 011 en FR-14: de beperkte video's waarvoor de eigenaar organisatie X
toestemming gaf binnen cursus C, zijn de video's in de onderdelen van de gekozen versie van de
verwijzing van X naar C. Die versie is altijd gekozen terwijl de cursus voor X in de bibliotheek
stond (research R8). Na het omzetten naar een kopie in 011 is de eerste versie van de kopie het
bewijs. Eerdere versies en verwijderde verwijzingen worden niet bewaard.

## Course, CourseVersion, CourseStep, Answer, Video (ongewijzigd)

- `Course.deletedAt`: verwijderen blijft zacht. Een verwijderde cursus met verwijzingen blijft
  bestaan met al zijn versies (FR-018). Hij komt niet terug in `ownCoursesQuery` of
  `libraryCoursesQuery`.
- `Course.parentCourseId` blijft NULL. Spec 011 vult dit veld voor een kopie (research R13).
- `Course.visibility` en `CourseAccess` (specs/009) bepalen of een ontvanger nog toegang heeft tot
  nieuwe versies. Ze bepalen niet of zij haar gekozen versie houdt.
- `CourseVersion`: vastgezette versies veranderen nooit. Een gekozen versie is altijd een
  vastgezette versie.
- `Video`: een video in een gekozen versie blijft met bestand bestaan, omdat de opruimtaak elke
  video in een onderdeel bewaart (research R7).

## Afgeleide begrippen (niet opgeslagen)

**Verwijzingen van organisatie X** (research R3, `referencesQuery`): de rijen van
`OrganisationCourse` met `organisationId = X` en `isOwner = FALSE`. Geen filter op
`Course.deletedAt`, de eigenaar of `visibility`.

**Ontvangers van cursus C** (`receiversOf`): de organisaties met een verwijzing naar C die niet
verwijderd zijn, alfabetisch op naam. Alleen de eigenaar ziet ze (FR-019).

**Wat een Quest van X ziet** (research R6, `questLiveVersions`):
- de live versies van de cursussen waarvan X eigenaar is (specs/006 R1), plus
- de `courseVersionId` van elke verwijzing van X.

**Toegang tot nieuwe versies** (research R5): cursus C staat volgens `libraryCoursesQuery(X)` in de
bibliotheek van X en heeft een live versie.

**Toestand van een verwijzing** (research R4, `referenceState`):

| Situatie | `withdrawn` | `newVersion` | `notice` |
| --- | --- | --- | --- |
| Eigenaar verwijderd | `owner_deleted` | null | false |
| Cursus verwijderd | `course_deleted` | null | false |
| Geen live versie (onpubliceerd) | `unpublished` | null | false |
| Niet (meer) in de bibliotheek van X | `no_access` | null | false |
| Live versie = gekozen versie | null | null | false |
| Live versie nieuwer, niet geweigerd | null | live versie | true |
| Live versie nieuwer, maar dit is de geweigerde versie | null | live versie | false |

De rijen worden van boven naar beneden toegepast; de eerste die past, geldt.

## Overgangen van een verwijzing

```text
(geen) ──Toevoegen──▶ actief(v = live)
actief(v) ──eigenaar publiceert v' > v──▶ melding(v, v')
melding(v, v') ──Nieuwe versie gebruiken──▶ actief(v')
melding(v, v') ──Huidige versie houden──▶ gehouden(v, geweigerd v')
gehouden(v, v') ──Nieuwe versie gebruiken──▶ actief(v')
gehouden(v, v') ──eigenaar publiceert v'' > v'──▶ melding(v, v'')
elke toestand ──eigenaar onpubliceert / verwijdert / beperkt / eigenaar weg──▶ ingetrokken(v, reden)
ingetrokken(v, reden) ──situatie hersteld──▶ actief(v) of melding(v, live)
elke toestand ──Verwijderen uit mijn organisatie──▶ (geen)
```

In elke toestand behalve "(geen)" staat versie `v` op de Quests van de ontvanger (FR-011).

## Migratie `20261127000001_course_references.js`

- `up`: `OrganisationCourse` krijgt `courseVersionId` en `declinedCourseVersionId` (INT UNSIGNED
  NULL, FK → `CourseVersion.id`). Bestaande rijen zijn allemaal eigenaarsrijen en blijven NULL.
- `down`: de twee velden (en hun FK's) verwijderen.
- In de testhelper `testApp.js` moet de volgorde van het legen veranderen. Nu staat
  `CourseVersion` vóór `OrganisationCourse`, maar door de nieuwe FK moet eerst
  `OrganisationCourse` geleegd worden, en daarna pas `CourseVersion`.
