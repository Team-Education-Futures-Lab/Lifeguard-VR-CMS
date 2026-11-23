import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCourse, openCourse, saveCourse } from '../../helpers/course.js';

// Scenario 13, 14, 19 en 21: de weergave "Lijst", "Canvas ordenen" en de tooltip op een blok.
// Een andere route dan het voorbeeld wordt via de API klaargezet (saveCourse, met key en nextStepKey).
// Bron: docs/e2e plans/e2e-plan-spec-005.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

const video = (key, nextStepKey, extra = {}) => ({
  key, stepType: 'video', isStart: false, positionX: 0, positionY: 0, videoId: null, nextStepKey, ...extra,
});
const question = (key, answers, extra = {}) => ({
  key, stepType: 'question', isStart: false, positionX: 0, positionY: 0, questionText: 'Wat doe je?', feedback: null,
  answers: answers.map(([answerText, nextStepKey], i) => ({ answerText, isCorrect: i === 0, nextStepKey })),
  ...extra,
});

/** Nieuwe organisatie en cursus; met `steps` wordt de route via de API vervangen. Opent de editor. */
async function openRoute(browser, tag, steps) {
  const org = await t.organisation({ name: uniqueName(`E2E-005-SC${tag}`) });
  const api = await t.login(org.loginCode);
  let course = await createCourse(api, { name: uniqueName(`SC${tag}-005 cursus`) });
  if (steps) course = await saveCourse(api, course, steps);
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  return { course, page };
}

/** De plek van elk blok op het canvas (de transform van het Vue Flow-blok), gesorteerd op id. */
const positions = (page) =>
  page.locator('.vue-flow__node').evaluateAll((els) => els.map((el) => `${el.dataset.id} ${el.style.transform}`).sort());

test('scenario 13: de weergave "Lijst"', async ({ browser }) => {
  // A. Route via de API met een vertakking, een lus en een los onderdeel. Weergave "Lijst": de route vanaf de start
  // met A/B-vertakkingen, "Einde", "Verder bij “…”" bij de lus, het losse onderdeel onder "Niet bereikbaar".
  const { page } = await openRoute(browser, '13', [
    question('q', [['Ik grijp in', 'v1'], ['Ik wacht af', 'v2']], { isStart: true }),
    video('v1', 'q', { positionX: -150, positionY: 260 }),
    video('v2', null, { positionX: 150, positionY: 260 }),
    video('los', null, { positionX: 450, positionY: 0 }),
  ]);

  await page.getByRole('radio', { name: 'Lijst', exact: true }).check();
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Wat doe je? Start' })).toBeVisible();
  await expect(main.getByText('A. Ik grijp in')).toBeVisible();
  await expect(main.getByText('B. Ik wacht af')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Verder bij “Wat doe je?”' })).toBeVisible();
  await expect(main.getByText('Einde', { exact: true })).toBeVisible();

  // Het losse onderdeel staat onder "Niet bereikbaar"; de twee verbonden videoblokken erboven.
  const unreachable = main.getByText('Niet bereikbaar', { exact: true });
  await expect(unreachable).toBeVisible();
  const videoRows = main.getByRole('button', { name: /^Kies een video/ });
  await expect(videoRows).toHaveCount(3);
  const below = (await unreachable.boundingBox()).y;
  expect((await videoRows.nth(1).boundingBox()).y).toBeLessThan(below);
  expect((await videoRows.nth(2).boundingBox()).y).toBeGreaterThan(below);
});

test('scenario 14: "Canvas ordenen" zonder bevestigingsvraag', async ({ browser }) => {
  // A+H. Knop "Canvas ordenen": geen alertdialog; melding "Canvas geordend" met "Ongedaan maken".
  // Handmatig: de nieuwe indeling (volgens de route, vertakkingen naast elkaar).
  const { page } = await openRoute(browser, '14');

  await page.getByRole('button', { name: 'Canvas ordenen' }).click();

  await expect(page.getByText('Canvas geordend')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ongedaan maken', exact: true })).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('scenario 19: de tooltip bij geen of één binnenkomende pijl', async ({ browser }) => {
  // A. Met de muis op de startvraag (geen binnenkomende pijl): geen tooltip. Op een videoblok (één pijl):
  // "Wordt bereikt vanuit 1 verbinding". Nergens een vaste "← n" op een blok.
  const { course, page } = await openRoute(browser, '19');
  const q = course.steps.find((s) => s.stepType === 'question');
  const qBlock = page.locator(`.vue-flow__node[data-id="s${q.id}"] [data-test="block"]`);
  const vBlock = page.locator(`.vue-flow__node[data-id="s${q.answers[0].nextStepId}"] [data-test="block"]`);

  await qBlock.hover();
  expect(await qBlock.getAttribute('title')).toBeNull();
  await vBlock.hover();
  await expect(vBlock).toHaveAttribute('title', 'Wordt bereikt vanuit 1 verbinding');
  await expect(page.locator('.vue-flow__node')).toHaveCount(3);
  for (const block of await page.locator('.vue-flow__node').all()) await expect(block).not.toContainText('←');
});

test('scenario 21: "Canvas ordenen", "Ongedaan maken" en Ctrl+Y', async ({ browser }) => {
  // A. Posities op het canvas (de transform van het Vue Flow-blok, zoals in spec 004 scenario 14e) voor het ordenen.
  // "Canvas ordenen", "Ongedaan maken" in de melding: posities gelijk aan ervoor. Ctrl+Y: weer de geordende posities.
  // De blokken staan eerst kriskras (via de API), zodat ordenen ze zeker verplaatst.
  const { page } = await openRoute(browser, '21', [
    question('q', [['Ik grijp in', 'v1'], ['Ik wacht af', 'v2']], { isStart: true, positionX: 400, positionY: 300 }),
    video('v1', null, { positionX: -300, positionY: 0 }),
    video('v2', null, { positionX: 500, positionY: -200 }),
  ]);
  await expect(page.locator('.vue-flow__node')).toHaveCount(3);
  const before = await positions(page);

  await page.getByRole('button', { name: 'Canvas ordenen' }).click();
  await expect.poll(() => positions(page)).not.toEqual(before);
  const ordered = await positions(page);

  await page.getByRole('button', { name: 'Ongedaan maken', exact: true }).click();
  await expect.poll(() => positions(page)).toEqual(before);

  await page.keyboard.press('Control+y');
  await expect.poll(() => positions(page)).toEqual(ordered);
});
