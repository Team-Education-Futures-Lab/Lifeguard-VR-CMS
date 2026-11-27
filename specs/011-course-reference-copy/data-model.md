# Data model: een overgenomen cursus aanpassen als eigen kopie

Geen migratie en geen nieuwe tabellen of velden (research R10). Deze feature vult velden die al
bestaan en voegt afgeleide gegevens toe.

## Bestaande tabellen

### Course

| Veld | Bij een kopie |
| --- | --- |
| `id` | nieuw id; voor de Quests een nieuwe cursus (R7) |
| `parentCourseId` | het id van het origineel. Het enige verband met het origineel. NULL bij elke andere cursus |
| `visibility` | altijd `'private'`; de server weigert iets anders (R5) |
| `createdAt`, `updatedAt` | het moment van aanpassen |
| `deletedAt` | NULL; zacht verwijderen zoals bij elke eigen cursus |

Regels:
- Een cursus met `parentCourseId` staat nooit in de cursusbibliotheek (`libraryCoursesQuery`,
  spec 009 FR-014 d) en heeft geen `CourseAccess`-rijen.
- Het origineel kan zelf geen kopie zijn: alleen bibliotheekcursussen kunnen overgenomen worden.

### OrganisationCourse

| Rij | Voor aanpassen | Na aanpassen |
| --- | --- | --- |
| organisatie ↔ origineel, `isOwner = FALSE` (de overgenomen cursus) | bestaat | verwijderd |
| organisatie ↔ kopie, `isOwner = TRUE` | — | nieuw; `addedAt` = nu, `courseVersionId` en `declinedCourseVersionId` NULL |
| eigenaar ↔ origineel, andere ontvangers ↔ origineel | bestaan | ongewijzigd |

### CourseVersion (van de kopie)

| `versionNumber` | `publishedAt` | `unpublishedAt` | Inhoud |
| --- | --- | --- | --- |
| 1 | het moment van aanpassen | NULL | kopie van de gekozen versie (`copyVersionAsDraft` + `freezeDraft`) |
| 2 | NULL (concept) | NULL | kopie van versie 1 |

Onderdelen (`CourseStep`) en antwoorden (`Answer`) worden gekopieerd met nieuwe id's;
verbindingen wijzen binnen de nieuwe versie. `videoId` wordt overgenomen (verwijst naar dezelfde
`Video`). De versies van het origineel veranderen niet.

### Video

Niet gewijzigd. Een meegekregen video blijft van zijn eigenaar, krijgt geen `VideoAccess` voor de
organisatie en staat dus niet in haar videobibliotheek.

## Afgeleide gegevens

### Meegekregen video's — `grantedVideoIds(courseIds)` (research R4)

```text
grantedVideoIds(course) =
  { s.videoId | s in CourseStep van CourseVersion(courseId = course, versionNumber = 1),
                course.parentCourseId IS NOT NULL,
                Video(s.videoId).deletedAt IS NULL }
```

Een video in een onderdeel van het concept is in orde bij publiceren als hij in de
videobibliotheek staat, OF in de live versie zit (constitutie V), OF in `grantedVideoIds` staat.

| Situatie van video V (zat in de gekozen versie) | Kopie gepubliceerd | Kopie niet gepubliceerd |
| --- | --- | --- |
| in de bibliotheek van de organisatie | in orde | in orde |
| niet in de bibliotheek (alleen in de cursus gedeeld, later beperkt, eigenaar verwijderd) | in orde | in orde (granted) |
| zacht verwijderd door de eigenaar | in orde zolang V in de live versie zit | eerst een andere video kiezen |
| V in een nieuw of ander onderdeel zetten | geweigerd bij opslaan (bestaande regel) | geweigerd bij opslaan |

### Gebaseerd op — `basedOnOf(courseIds)` (research R6)

```text
basedOn(copy) = {
  courseName: naam van de nieuwste gepubliceerde versie van copy.parentCourseId,
  ownerName:  naam van de Organisation met isOwner = TRUE voor copy.parentCourseId
}   — geen filter op deletedAt; null als parentCourseId NULL is
```

### Kopie bestaat al — `hasCopy(organisationId, courseId)` (research R3, R8)

```text
hasCopy = er is een Course c met c.parentCourseId = courseId, c.deletedAt IS NULL,
          en een OrganisationCourse(organisationId, c.id, isOwner = TRUE)
```

Gebruikt voor `409 course_already_copied` (dubbele klik) en voor de hint in de bibliotheek.

## Overgang

```text
overgenomen cursus (isOwner = FALSE, courseVersionId = V)
      │  "Aanpassen" — één transactie, verwijzingsrij FOR UPDATE
      ▼
eigen kopie (nieuwe Course, parentCourseId = origineel, isOwner = TRUE)
  versie 1 = inhoud van V, gepubliceerd (live)  ← op de Quests
  versie 2 = concept met dezelfde inhoud        ← in de editor
```

Niet terug te draaien: er is geen weg terug van kopie naar overgenomen cursus. De organisatie kan
het origineel wel opnieuw toevoegen als het nog voor haar in de bibliotheek staat (los van de
kopie).
