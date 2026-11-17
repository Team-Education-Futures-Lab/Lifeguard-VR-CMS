import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, TEST_PASSWORD } from '../../helpers/org-api.js';
import { loginViaScreen } from '../../helpers/video-upload.js';
import { createCourse, openCourse, openStep } from '../../helpers/course.js';

// Scenario 5, 6a, 6b, 7 en 8: onderdelen toevoegen, vragen en antwoorden, het startonderdeel.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e plans/e2e-plan-spec-004.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme('scenario 5: een video-onderdeel zonder video opslaan', async ({ browser }) => {
  // A. Knop "Video" op het canvas, geen video kiezen, [data-test="save"]: daarna "Opgeslagen".
  // Na herladen staat het nieuwe blok er met "Kies een video".
});

test.fixme('scenario 6a: antwoorden toevoegen tot 4', async ({ browser }) => {
  // A. Het blok "Wat doe je?" openen (openStep), twee keer [data-test="add-answer"]:
  // 4 [data-test="answer"]-velden en [data-test="add-answer"] is weg.
});

test.fixme('scenario 6b: een vraag met 4 antwoorden blijft na opslaan en herladen gelijk', async ({ browser }) => {
  // A. 4 antwoorden; het derde goed (radio "Antwoord C is goed"); [data-test="feedback"] invullen; één antwoord
  // leeg laten. Opslaan, herladen, het blok weer openen: teksten, het goede antwoord, de feedback en het lege
  // antwoord zijn ongewijzigd.
});

test.fixme('scenario 7: antwoorden verwijderen tot er 2 over zijn', async ({ browser }) => {
  // A. Vanaf 4 antwoorden het goede antwoord verwijderen ("Antwoord X verwijderen"): het eerste antwoord is nu goed.
  // Verder verwijderen tot 2: er staat geen verwijderknop meer.
});

test.fixme('scenario 8: een ander onderdeel als start markeren', async ({ browser }) => {
  // A. Een videoblok openen, [data-test="start"] aanvinken, "Klaar", opslaan, herladen:
  // alleen dat blok heeft "Start" in [data-test="badges"].
});
