import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';
import { createCourse, openCourse, openStep } from '../../helpers/course.js';

// Scenario 4 en 13: welke video's de kiezer toont, en één video in twee cursussen.
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
