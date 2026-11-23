import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';
import { createCourse, openCourse } from '../../helpers/course.js';

// Scenario 1 en 2: het voorbeeld in een nieuwe cursus en een complete cursus.
// De editor staat op "Canvas + paneel": een blok aanklikken opent het in het zijpaneel.
// Blokken worden gevonden op hun id op het canvas (`s<id van het onderdeel>`), pijlen op "Edge from … to …".
// Bron: docs/e2e plans/e2e-plan-spec-005.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 1: een nieuwe cursus heeft het voorbeeld en "2 nog te doen"', async ({ browser }) => {
  // A+H. createCourse, openCourse: vraag "Wat doe je?" met "Start", pijlen A en B naar twee videoblokken met "Einde".
  // Balk "2 nog te doen"; in de lijst twee keer "Kies een video". Handmatig: de oranje kleur.
  const org = await t.organisation({ name: uniqueName('E2E-005-SC1') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC1-005 cursus') });
  const question = course.steps.find((s) => s.stepType === 'question');
  const [answerA, answerB] = question.answers;
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const node = (id) => page.locator(`.vue-flow__node[data-id="s${id}"]`);

  // De startvraag met twee pijlen, A en B, elk naar een eigen videoblok met "Einde".
  await expect(node(question.id)).toContainText('Wat doe je?');
  await expect(node(question.id).locator('[data-test="badges"]')).toContainText('Start');
  await expect(page.getByRole('group', { name: `Edge from s${question.id} to s${answerA.nextStepId}` })).toHaveCount(1);
  await expect(page.getByRole('group', { name: `Edge from s${question.id} to s${answerB.nextStepId}` })).toHaveCount(1);
  expect(answerA.nextStepId).not.toBe(answerB.nextStepId);
  await expect(page.locator('[data-letter="A"]')).toHaveCount(1);
  await expect(page.locator('[data-letter="B"]')).toHaveCount(1);
  for (const id of [answerA.nextStepId, answerB.nextStepId]) {
    await expect(node(id).locator('[data-test="badges"]')).toContainText('Einde');
    await expect(node(id)).toContainText('Kies een video');
  }

  // De balk en de lijst.
  const todo = page.getByRole('button', { name: '2 nog te doen' });
  await expect(todo).toBeVisible();
  await todo.click();
  await expect(page.getByRole('button', { name: /^Video-onderdelen zonder video/ })).toContainText('2');
  await expect(page.getByRole('button', { name: /^Kies een video/ })).toHaveCount(2);
});

test('scenario 2: met een video in beide videoblokken is de cursus compleet', async ({ browser }) => {
  // A. Twee eigen video's (uploadVideos), in elk videoblok een kiezen: balk "Cursus is compleet".
  test.setTimeout(90_000);
  const org = await t.organisation({ name: uniqueName('E2E-005-SC2') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC2-005 cursus') });
  const videoIds = course.steps.filter((s) => s.stepType === 'video').map((s) => s.id);
  const names = [uniqueName('SC2-005 video 1'), uniqueName('SC2-005 video 2')];

  const page = await openLibraryAs(t, browser, org);
  await uploadVideos(page, [
    { file: 'valid-512x256.mp4', name: names[0], visibility: 'private' },
    { file: 'valid-opus-audio-512x256.mp4', name: names[1], visibility: 'private' },
  ]);
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  await expect(page.getByRole('button', { name: '2 nog te doen' })).toBeVisible();

  for (const [i, id] of videoIds.entries()) {
    await page.locator(`.vue-flow__node[data-id="s${id}"] [data-test="block"]`).click();
    const panel = page.getByRole('complementary');
    await panel.locator('[data-test="video-option"]').filter({ hasText: names[i] }).click();
    await expect(page.locator(`.vue-flow__node[data-id="s${id}"]`)).toContainText(names[i]);
  }

  await expect(page.getByText('Cursus is compleet')).toBeVisible();
  await expect(page.getByRole('button', { name: /nog te doen/ })).toHaveCount(0);
});
