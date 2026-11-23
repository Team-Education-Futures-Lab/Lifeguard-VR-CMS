import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCourse, openCourse, openStep } from '../../helpers/course.js';

// Scenario 5, 6a, 6b, 7 en 8: onderdelen toevoegen, vragen en antwoorden, het startonderdeel.
// Elke test begint met een nieuwe cursus (via de API) met het voorbeeld: vraag "Wat doe je?" en twee videoblokken.
// Bron: docs/e2e plans/e2e-plan-spec-004.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 5: een video-onderdeel zonder video opslaan', async ({ browser }) => {
  // A. Knop "Video" op het canvas, geen video kiezen, [data-test="save"]: daarna "Opgeslagen".
  // Na herladen staat het nieuwe blok er met "Kies een video".
  const org = await t.organisation({ name: uniqueName('E2E-004-SC5') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC5-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);
  const blocks = page.locator('[data-test="block"]');
  const save = page.locator('[data-test="save"]');
  await expect(blocks).toHaveCount(3);

  await page.getByRole('button', { name: 'Video', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click(); // een nieuw onderdeel opent meteen zijn venster
  await expect(blocks).toHaveCount(4);
  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  await page.reload();
  await expect(blocks).toHaveCount(4);
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(3);
});

test('scenario 6a: antwoorden toevoegen tot 4', async ({ browser }) => {
  // A. Het blok "Wat doe je?" openen (openStep), twee keer [data-test="add-answer"]:
  // 4 [data-test="answer"]-velden en [data-test="add-answer"] is weg.
  const org = await t.organisation({ name: uniqueName('E2E-004-SC6a') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC6a-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);

  const dialog = await openStep(page, 'Wat doe je?');
  const answers = dialog.locator('[data-test="answer"]');
  const addAnswer = dialog.locator('[data-test="add-answer"]');
  await expect(answers).toHaveCount(2);

  await addAnswer.click();
  await expect(answers).toHaveCount(3);
  await addAnswer.click();
  await expect(answers).toHaveCount(4);
  await expect(addAnswer).toHaveCount(0);
});

test('scenario 6b: een vraag met 4 antwoorden blijft na opslaan en herladen gelijk', async ({ browser }) => {
  // A. 4 antwoorden; het derde goed (radio "Antwoord C is goed"); [data-test="feedback"] invullen; één antwoord
  // leeg laten. Opslaan, herladen, het blok weer openen: teksten, het goede antwoord, de feedback en het lege
  // antwoord zijn ongewijzigd.
  const org = await t.organisation({ name: uniqueName('E2E-004-SC6b') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC6b-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);
  const texts = ['Ik spring erin', 'Ik roep om hulp', 'Ik gooi een reddingsboei', ''];
  const feedback = 'Eerst een hulpmiddel gooien, dan pas zelf erin.';

  let dialog = await openStep(page, 'Wat doe je?');
  await dialog.locator('[data-test="add-answer"]').click();
  await dialog.locator('[data-test="add-answer"]').click();
  const answers = dialog.locator('[data-test="answer"]');
  for (const [i, text] of texts.entries()) await answers.nth(i).fill(text);
  await dialog.getByRole('radio', { name: 'Antwoord C is goed' }).check();
  await dialog.locator('[data-test="feedback"]').fill(feedback);
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  await page.locator('[data-test="save"]').click();
  await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');

  await page.reload();
  dialog = await openStep(page, 'Wat doe je?');
  await expect(answers).toHaveCount(4);
  for (const [i, text] of texts.entries()) await expect(answers.nth(i)).toHaveValue(text);
  await expect(dialog.getByRole('radio', { name: 'Antwoord C is goed' })).toBeChecked();
  await expect(dialog.locator('[data-test="feedback"]')).toHaveValue(feedback);
});

test('scenario 7: antwoorden verwijderen tot er 2 over zijn', async ({ browser }) => {
  // A. Vanaf 4 antwoorden het goede antwoord verwijderen ("Antwoord X verwijderen"): het eerste antwoord is nu goed.
  // Verder verwijderen tot 2: er staat geen verwijderknop meer.
  const org = await t.organisation({ name: uniqueName('E2E-004-SC7') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC7-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);

  const dialog = await openStep(page, 'Wat doe je?');
  const answers = dialog.locator('[data-test="answer"]');
  await dialog.locator('[data-test="add-answer"]').click();
  await dialog.locator('[data-test="add-answer"]').click();
  await expect(answers).toHaveCount(4);
  await dialog.getByRole('radio', { name: 'Antwoord C is goed' }).check();

  // Het goede antwoord (C) verwijderen: A wordt goed.
  await dialog.getByRole('button', { name: 'Antwoord C verwijderen' }).click();
  await expect(answers).toHaveCount(3);
  await expect(dialog.getByRole('radio', { name: 'Antwoord A is goed' })).toBeChecked();

  // Verder tot 2: geen verwijderknop meer.
  await dialog.getByRole('button', { name: 'Antwoord C verwijderen' }).click();
  await expect(answers).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: /^Antwoord [A-D] verwijderen$/ })).toHaveCount(0);
});

test('scenario 8: een ander onderdeel als start markeren', async ({ browser }) => {
  // A. Een videoblok openen, [data-test="start"] aanvinken, "Klaar", opslaan, herladen:
  // alleen dat blok heeft "Start" in [data-test="badges"].
  const org = await t.organisation({ name: uniqueName('E2E-004-SC8') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC8-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);
  const blocks = page.locator('[data-test="block"]');
  const startBlocks = blocks.filter({ has: page.locator('[data-test="badges"]', { hasText: 'Start' }) });

  const dialog = await openStep(page, 'Kies een video');
  await dialog.locator('[data-test="start"]').check();
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  await page.locator('[data-test="save"]').click();
  await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');

  await page.reload();
  await expect(blocks).toHaveCount(3);
  await expect(startBlocks).toHaveCount(1);
  await expect(startBlocks).toContainText('Kies een video');
  await expect(startBlocks).not.toContainText('Wat doe je?');
});
