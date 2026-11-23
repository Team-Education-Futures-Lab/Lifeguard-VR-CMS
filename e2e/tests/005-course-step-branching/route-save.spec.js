import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';
import { createCourse, openCourse, openStep, saveCourse } from '../../helpers/course.js';

// Scenario 5, 7, 17 en 18: opslaan met en zonder meldingen, en de pijlen na herladen.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e plans/e2e-plan-spec-005.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme('scenario 5: opslaan met een antwoord zonder vervolg', async ({ browser }) => {
  // A+H. De situatie van 4 (een vraag onder video A, antwoord A verbonden, B niet); opslaan: [data-test="save"]
  // "Opgeslagen" en "Antwoord B is nog niet verbonden" staat er nog. Handmatig: de melding en de balk worden rood.
});

test.fixme('scenario 7: na herladen staan alle pijlen er nog precies zo (SC-002)', async ({ browser }) => {
  // A. De route van 6 (met de lus) opslaan; de pijlen (bronblok, doelblok, letter) voor en na herladen vergelijken.
  // Niet vergelijken op de sleutels in "Edge from … to …": die kunnen na herladen anders zijn.
});

test.fixme('scenario 17: opslaan zonder meldingen geeft "Concept opgeslagen"', async ({ browser }) => {
  // A+H. Cursus compleet maken (twee eigen video's, zoals scenario 2), iets wijzigen, opslaan: kort
  // "Concept opgeslagen", daarna [data-test="save"] "Opgeslagen". Handmatig: het vinkje en de groene knop.
});

test.fixme('scenario 18: opslaan met 3 meldingen open', async ({ browser }) => {
  // A. Een cursus met 3 meldingen, iets wijzigen, opslaan: "Opgeslagen, nog 3 punten open".
});
