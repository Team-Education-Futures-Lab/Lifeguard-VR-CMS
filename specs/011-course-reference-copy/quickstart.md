# Quickstart: een overgenomen cursus aanpassen valideren

Deze gids toont na de implementatie aan dat de feature werkt.
- Endpoints: [contracts/api.md](contracts/api.md)
- Schermen: [contracts/ui.md](contracts/ui.md)
- Regels: [data-model.md](data-model.md)

Voorbereiding zoals in [feature 010 quickstart](../010-course-reference-takeover/quickstart.md).
Er is geen nieuwe migratie. Drie organisaties A, B en C:
- A heeft "Redden" met video X ("Alleen in deze cursus", niet in de bibliotheek van B) en video Y
  (algemeen beschikbaar), en publiceert versie 1 en daarna versie 2 met "Algemeen beschikbaar".
- B nam "Redden" over op versie 1 en heeft de melding over versie 2 niet beantwoord. C nam
  "Redden" over op versie 2.
- B en C hebben elk een Quest gekoppeld, of je gebruikt de Quest-API met hun koppelcode.

## Geautomatiseerde tests

```bash
docker compose --profile test run --rm --build api-test
```

```bash
docker compose --profile test run --rm --build web-build npm test
```

Verwacht: alles groen, in het bijzonder:

| Test | Dekt |
| --- | --- |
| `courseReferenceCopy.test.js` | FR-001, FR-003 – FR-007: kopie van de gekozen versie (niet de nieuwste), versie 1 live + versie 2 concept, `parentCourseId`, eigenaarsrij, verwijzing weg; ook bij ingetrokken/verwijderd/beperkt origineel en verwijderde eigenaar (SC-002) |
| `courseReferenceCopyConcurrency.test.js` | FR-006: 10 gelijktijdige verzoeken → 1 kopie, de rest `409 course_already_copied` (SC-004) |
| `courseReferenceCopyIsolation.test.js` | FR-008 – FR-010, FR-020: origineel en andere ontvangers ongewijzigd; 404 voor andermans verwijzing, eigen cursus, onbekend id; ontvangers bij de eigenaar zonder B (SC-003, SC-006) |
| `courseCopyVideos.test.js` | FR-014 – FR-017: meegekregen video blijft na beperken; publiceren na onpubliceren; verwijderde video na onpubliceren → `course_incomplete`; niet in een ander onderdeel; niet in de videobibliotheek; Quest downloadt hem (SC-005) |
| `courseCopySharing.test.js` | FR-013: `visibility` ≠ `private` → 422 bij publiceren en beschikbaarheid; niet in de bibliotheek |
| `courseCopyRepository.test.js` | `grantedVideoIds`, `basedOnOf` (FR-012: nieuwste gepubliceerde naam, ook na verwijderen van origineel of eigenaar), `findOwnCopyOf` |
| `courseCopyOwnCourse.test.js` | FR-011: opslaan, publiceren, onpubliceren, verwijderen van de kopie |
| `courseLibrary.test.js` | FR-021: `hasCopy` |
| `questCourseReferences.test.js` | FR-018: na aanpassen kopie in de lijst, origineel niet; altijd een versie te downloaden (SC-007) |
| frontend: `taken-over-course-dialog.test.js`, `courses-view.test.js`, `completeness.test.js`, `course-sharing-editor.test.js`, `course-library-view.test.js` | knop, bevestiging, navigatie, "Gebaseerd op", `keptFromOriginal`, geen deelkeuze, hint |

E2e: `e2e/tests/011-course-reference-copy/`.

## Handmatige scenario's

| # | Stappen | Verwacht |
| --- | --- | --- |
| 1 | Als B: Cursussen → "Redden" → **Aanpassen** → Annuleren | Niets veranderd |
| 2 | Als B: **Aanpassen** → bevestigen | Editor opent met de inhoud van versie 1 van A (niet versie 2); kop "Gebaseerd op Redden van A" |
| 3 | Als B: Cursussen | Kopie bij de eigen cursussen, "Op de Quest: versie 1 · vandaag", geen overgenomen "Redden", teller zonder melding |
| 4 | Quest van B synchroniseren | Nieuwe cursus "Redden" (te downloaden), de oude als niet meer in het CMS; video X te downloaden |
| 5 | Als A: versies, beschikbaarheid, publicatiemenu bekijken | Ongewijzigd; bij "Overgenomen door" alleen C |
| 6 | Als C: Cursussen | "Redden" nog overgenomen op versie 2, niets veranderd |
| 7 | Als B: tekst wijzigen, publiceren | Geen deelkeuze in het venster; versie 2 van de kopie op de Quest; geen fout over video X |
| 8 | Als A: video X op "Alleen eigen organisatie"; als B: onpubliceren, opnieuw publiceren | Lukt; X blijft in de kopie |
| 9 | Als A: video Y verwijderen; als B: onpubliceren, publiceren | Geweigerd: "Video niet meer beschikbaar: kies een andere." |
| 10 | Als B: Videobibliotheek; in de editor een video kiezen | X staat er niet in |
| 11 | Als B: bibliotheek → "Redden" van A | "Jullie hebben al een aangepaste kopie van deze cursus." en de knop "Toevoegen aan mijn organisatie" |
| 12 | Als C: in twee tabbladen tegelijk **Aanpassen** | Eén kopie; het tweede tabblad meldt dat de cursus al is aangepast |

## Controle in de database (optioneel)

```sql
SELECT id, parentCourseId, visibility FROM Course WHERE parentCourseId IS NOT NULL;
SELECT * FROM OrganisationCourse WHERE courseId IN (<origineel>, <kopie>);
SELECT courseId, versionNumber, publishedAt, unpublishedAt FROM CourseVersion WHERE courseId = <kopie>;
```

Verwacht: kopie `private`; B is eigenaar van de kopie en heeft geen rij meer bij het origineel;
versie 1 gepubliceerd, versie 2 concept.

## Resultaten handmatige test

Getest op 2026-11-27 in de lokale ontwikkelomgeving, samen met de handmatige tests van 009 en 010.
De cursus heette daar "Zwemmen" in plaats van "Redden".

| # | Resultaat | Opmerking |
| --- | --- | --- |
| 1 | ✅ | Bevestiging heeft veel tekst → backlog "Teksten nalopen in het CMS" |
| 2 | ✅ | "Gebaseerd op" in de kop maakt de editor drukker → backlog "UI-refactor van de cursus-editor" |
| 3 | ✅ | Kopie gezien; nakijken dat de overgenomen cursus en de melding weg zijn |
| 4 | open | Quest-test, later |
| 5 | ✅ | |
| 6 | ✅ | |
| 7 | ✅ | Wens: icoon voor origineel, overgenomen en kopie → backlog |
| 8 | ✅ | |
| 9 | ✅ | |
| 10 | ✅ | |
| 11 | ✅ | Hint kan duidelijker → UI-refactor |
| 12 | ✅ | |

De SQL-controle uit "Controle in de database" is nog niet gedaan.
