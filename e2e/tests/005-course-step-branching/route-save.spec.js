import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';
import { createCourse, openCourse } from '../../helpers/course.js';

// Scenario 5, 7, 17 en 18: opslaan met en zonder meldingen, en de pijlen na herladen.
// De editor staat op "Canvas + paneel"; verbinden gaat via het menu bij een verbindingspunt.
// Bron: docs/e2e plans/e2e-plan-spec-005.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

const PLUS = 'Klik of sleep om te verbinden';
const answerPoint = (letter) => `Klik of sleep om antwoord ${letter} te verbinden`;

test('scenario 5: opslaan met een antwoord zonder vervolg', async ({ browser }) => {
  // A+H. De situatie van 4 (een vraag onder video A, antwoord A verbonden, B niet); opslaan: [data-test="save"]
  // "Opgeslagen" en "Antwoord B is nog niet verbonden" staat er nog. Handmatig: de melding en de balk worden rood.
  const org = await t.organisation({ name: uniqueName('E2E-005-SC5') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC5-005 cursus') });
  const videoA = course.steps.find((s) => s.stepType === 'question').answers[0].nextStepId;
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const menu = page.getByRole('menu');
  const save = page.locator('[data-test="save"]');

  await page.locator(`.vue-flow__node[data-id="s${videoA}"]`).getByTitle(PLUS).click();
  await menu.getByRole('menuitem', { name: 'Nieuwe vraag' }).click();
  const newQuestion = page.locator('.vue-flow__node-question').filter({ hasText: 'Nieuwe vraag' });
  await page.getByRole('button', { name: 'Alles in beeld' }).click();
  await newQuestion.getByTitle(answerPoint('A')).click();
  await menu.getByRole('menuitem', { name: 'Nieuw video-onderdeel' }).click();

  await save.click();
  await expect(save).toHaveText('Opgeslagen');
  await newQuestion.locator('[data-test="block"]').click();
  await expect(page.getByRole('complementary')).toContainText('Antwoord B is nog niet verbonden');
});

test('scenario 7: na herladen staan alle pijlen er nog precies zo (SC-002)', async ({ browser }) => {
  // A. Een route met een vertakking en een lus via het menu maken en opslaan. De pijlen na herladen zijn precies de
  // verbindingen die de API teruggeeft, en evenveel als voor het opslaan. Nieuwe onderdelen hebben voor het opslaan
  // een tijdelijke sleutel; daarom wordt na herladen vergeleken met de API en niet met de namen van voor het opslaan.
  // De lus gaat naar de startvraag: die heeft in het menu een eigen naam (lege videoblokken heten alle "Kies een video").
  const org = await t.organisation({ name: uniqueName('E2E-005-SC7') });
  const api = await t.login(org.loginCode);
  const course = await createCourse(api, { name: uniqueName('SC7-005 cursus') });
  const videoA = course.steps.find((s) => s.stepType === 'question').answers[0].nextStepId;
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const menu = page.getByRole('menu');
  const save = page.locator('[data-test="save"]');
  const edges = page.getByRole('group', { name: /^Edge from / });
  const edgeNames = async () => (await edges.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))).sort();

  await page.locator(`.vue-flow__node[data-id="s${videoA}"]`).getByTitle(PLUS).click();
  await menu.getByRole('menuitem', { name: 'Nieuwe vraag' }).click();
  const newQuestion = page.locator('.vue-flow__node-question').filter({ hasText: 'Nieuwe vraag' });
  await page.getByRole('button', { name: 'Alles in beeld' }).click();
  await newQuestion.getByTitle(answerPoint('A')).click();
  await menu.getByRole('menuitem', { name: 'Nieuw video-onderdeel' }).click();
  await page.getByRole('button', { name: 'Alles in beeld' }).click();
  await newQuestion.getByTitle(answerPoint('B')).click();
  await menu.getByRole('menuitem', { name: 'Vraag: Wat doe je?' }).click();
  await expect(edges).toHaveCount(5);
  await expect(page.locator('[data-letter="B"]').filter({ hasText: '↺' })).toHaveCount(1);

  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  // Wat de API heeft opgeslagen, als namen van pijlen.
  const saved = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  const expected = [];
  for (const step of saved.steps) {
    const targets = step.stepType === 'video' ? [step.nextStepId] : step.answers.map((a) => a.nextStepId);
    for (const target of targets.filter(Boolean)) expected.push(`Edge from s${step.id} to s${target}`);
  }
  expected.sort();
  expect(expected).toHaveLength(5);

  await page.reload();
  await expect(edges).toHaveCount(5);
  expect(await edgeNames()).toEqual(expected);
  await expect(page.locator('[data-letter="B"]').filter({ hasText: '↺' })).toHaveCount(1);
});

test('scenario 17: opslaan zonder meldingen geeft "Concept opgeslagen"', async ({ browser }) => {
  // A+H. Cursus compleet maken (twee eigen video's, zoals scenario 2) en opslaan: kort "Concept opgeslagen", daarna
  // [data-test="save"] "Opgeslagen". Handmatig: het vinkje en de groene knop.
  test.setTimeout(90_000);
  const org = await t.organisation({ name: uniqueName('E2E-005-SC17') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC17-005 cursus') });
  const videoIds = course.steps.filter((s) => s.stepType === 'video').map((s) => s.id);
  const names = [uniqueName('SC17-005 video 1'), uniqueName('SC17-005 video 2')];

  const page = await openLibraryAs(t, browser, org);
  await uploadVideos(page, [
    { file: 'valid-512x256.mp4', name: names[0], visibility: 'private' },
    { file: 'valid-opus-audio-512x256.mp4', name: names[1], visibility: 'private' },
  ]);
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const save = page.locator('[data-test="save"]');

  for (const [i, id] of videoIds.entries()) {
    await page.locator(`.vue-flow__node[data-id="s${id}"] [data-test="block"]`).click();
    await page.getByRole('complementary').locator('[data-test="video-option"]').filter({ hasText: names[i] }).click();
  }
  await expect(page.getByText('Cursus is compleet')).toBeVisible();

  await save.click();
  await expect(page.getByText('Concept opgeslagen')).toBeVisible();
  await expect(save).toHaveText('Opgeslagen');
});

test('scenario 18: opslaan met 3 meldingen open', async ({ browser }) => {
  // A. Het voorbeeld heeft 2 meldingen (twee keer "Kies een video"). Een derde antwoord zonder vervolg maakt er 3.
  // Opslaan: "Opgeslagen, nog 3 punten open".
  const org = await t.organisation({ name: uniqueName('E2E-005-SC18') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC18-005 cursus') });
  const question = course.steps.find((s) => s.stepType === 'question');
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id, { view: 'Canvas + paneel' });

  await page.locator(`.vue-flow__node[data-id="s${question.id}"] [data-test="block"]`).click();
  const panel = page.getByRole('complementary');
  await panel.locator('[data-test="add-answer"]').click();
  await panel.locator('[data-test="answer"]').nth(2).fill('Ik bel 112');
  await expect(page.getByRole('button', { name: '3 nog te doen' })).toBeVisible();

  await page.locator('[data-test="save"]').click();
  await expect(page.getByText('Opgeslagen, nog 3 punten open')).toBeVisible();
});
