import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';
import { createCourse, openCourse, openStep } from '../../helpers/course.js';

// Scenario 1 en 2: het voorbeeld in een nieuwe cursus en een complete cursus.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e plans/e2e-plan-spec-005.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme('scenario 1: een nieuwe cursus heeft het voorbeeld en "2 nog te doen"', async ({ browser }) => {
  // A+H. createCourse, openCourse: vraag "Wat doe je?" met "Start", pijlen A en B naar twee videoblokken met "Einde".
  // Balk "2 nog te doen"; in de lijst twee keer "Kies een video". Handmatig: de oranje kleur.
});

test.fixme('scenario 2: met een video in beide videoblokken is de cursus compleet', async ({ browser }) => {
  // A. Twee eigen video's (uploadVideos), in elk videoblok een kiezen: balk "Cursus is compleet".
});
