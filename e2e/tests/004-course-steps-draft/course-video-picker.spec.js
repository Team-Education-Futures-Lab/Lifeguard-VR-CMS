import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';
import { createCourse, openCourse, openStep } from '../../helpers/course.js';

// Scenario 4, 13 en 24: welke video's de kiezer toont, één video in twee cursussen, en zoeken.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e plans/e2e-plan-spec-004.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme("scenario 4: de videokiezer toont alleen beschikbare video's", async ({ browser }) => {
  // A. A met een eigen video; B met "Algemeen", "Selectief" voor A en "Alleen eigen"; C met "Selectief" voor B
  // (uploadVideos met visibility en organisation). Als A een videoblok openen: precies drie
  // [data-test="video-option"]: de eigen video, B-algemeen en B-selectief.
});

test.fixme('scenario 13: dezelfde video in twee cursussen', async ({ browser }) => {
  // A. Eén eigen video, twee cursussen via createCourse. In beide een videoblok openen, de video kiezen en opslaan.
  // Na herladen staat de video in beide cursussen.
});

test.fixme('scenario 24: zoeken in de videokiezer (FR-014b)', async ({ browser }) => {
  // A met drie eigen video's, waarvan één met een lange naam; B met een video "Algemeen"
  // (uploadVideos met visibility en organisation). Als A een videoblok openen en typen in
  // [data-test="video-search"]: op een deel van de naam blijft alleen die video-option over; op de
  // naam van B alleen B's video; op een woord zonder resultaat [data-test="video-search-empty"] met
  // de zoekterm. De gevonden video kiezen en opslaan: na herladen staat hij in het blok.
});
