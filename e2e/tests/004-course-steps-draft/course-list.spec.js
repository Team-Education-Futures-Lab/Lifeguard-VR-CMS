import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, TEST_PASSWORD } from '../../helpers/org-api.js';
import { loginViaScreen } from '../../helpers/video-upload.js';
import { createCourse, openCourse } from '../../helpers/course.js';

// Scenario 1, 2, 3, 15 en 16: de lijst met cursussen, aanmaken, afscherming en verwijderen.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e plans/e2e-plan-spec-004.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme('scenario 1: zonder cursussen staat "Er zijn nog geen cursussen."', async ({ browser }) => {
  // A. Nieuwe organisatie (t.organisation), inloggen via het scherm, /courses: "Er zijn nog geen cursussen."
});

test.fixme('scenario 2: een nieuwe cursus met lege naam wordt niet aangemaakt', async ({ browser }) => {
  // A. "Nieuwe cursus", alleen [data-test="course-description"] invullen, "Aanmaken".
  // [data-test="create-error"] toont "Vul een naam en een beschrijving in."; het venster blijft open.
  // Via de API (t.login en GET /api/organisation/courses): geen cursus.
});

test.fixme('scenario 3: een nieuwe cursus opent in de editor met het voorbeeld', async ({ browser }) => {
  // A. Aanmaken via het scherm met naam en beschrijving. De editor opent met het label "Concept", een blok
  // "Wat doe je?" met "Start" en twee videoblokken "Kies een video". Terug naar /courses: de regel toont
  // "2 video's · 1 vraag" en "Concept".
});

test.fixme('scenario 15: B opent het adres van de cursus van A', async ({ browser }) => {
  // A. Cursus van A via createCourse. Als B (eigen context, loginViaScreen) /courses/<id van A>:
  // de kop "Cursus niet gevonden".
});

test.fixme('scenario 16: een cursus verwijderen', async ({ browser }) => {
  // A. Cursus via createCourse; in /courses de verwijderknop (title "Verwijderen") bij de regel.
  // alertdialog "Cursus verwijderen?", "Verwijderen": de regel is weg; /courses/<id> geeft "Cursus niet gevonden".
  // Dat deletedAt gevuld is, is B (courseCrud.test.js).
});
