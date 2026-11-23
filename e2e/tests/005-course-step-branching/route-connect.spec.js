import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';
import { createCourse, openCourse } from '../../helpers/course.js';

// Scenario 3, 4, 6, 15 en 16: onderdelen verbinden via het menu bij een verbindingspunt.
// Verbinden gaat via het menu ("+" of de letter aanklikken), niet door te slepen.
// De editor staat op "Canvas + paneel"; in "Canvas" ligt het venster van het blok over het menu.
// "Video A" is het videoblok waar antwoord A van de startvraag naartoe gaat.
// Bron: docs/e2e plans/e2e-plan-spec-005.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

const PLUS = 'Klik of sleep om te verbinden';
const answerPoint = (letter) => `Klik of sleep om antwoord ${letter} te verbinden`;

/** Nieuwe organisatie en cursus met het voorbeeld; de editor open. Geeft ook de ids van vraag, video A en video B. */
async function openExample(browser, tag) {
  const org = await t.organisation({ name: uniqueName(`E2E-005-SC${tag}`) });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName(`SC${tag}-005 cursus`) });
  const question = course.steps.find((s) => s.stepType === 'question');
  const page = await t.pageAs(browser, org.loginCode);
  return { org, course, page, q: question.id, videoA: question.answers[0].nextStepId, videoB: question.answers[1].nextStepId };
}

test('scenario 3: "+" onder video A, "Nieuwe vraag"', async ({ browser }) => {
  // A. Het formulier van de nieuwe vraag is open; een pijl van video A naar de vraag; video A heeft geen "Einde"
  // meer, de nieuwe vraag wel (geen antwoord verbonden).
  const { course, page, videoA } = await openExample(browser, '3');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const node = (id) => page.locator(`.vue-flow__node[data-id="${id}"]`);
  await expect(node(`s${videoA}`).locator('[data-test="end"]')).toHaveCount(1);

  await node(`s${videoA}`).getByTitle(PLUS).click();
  await page.getByRole('menu').getByRole('menuitem', { name: 'Nieuwe vraag' }).click();

  const newQuestion = page.locator('.vue-flow__node-question').filter({ hasText: 'Nieuwe vraag' });
  await page.getByRole('button', { name: 'Alles in beeld' }).click(); // het nieuwe blok staat soms buiten beeld
  await expect(newQuestion).toHaveCount(1);
  await expect(page.getByRole('complementary').getByRole('heading', { name: 'Vraag' })).toBeVisible();
  const newId = await newQuestion.getAttribute('data-id');
  await expect(page.getByRole('group', { name: `Edge from s${videoA} to ${newId}` })).toHaveCount(1);
  await expect(node(`s${videoA}`).locator('[data-test="end"]')).toHaveCount(0);
  await expect(newQuestion.locator('[data-test="end"]')).toHaveCount(1);
});

test('scenario 4: antwoord A van de nieuwe vraag naar een nieuw video-onderdeel', async ({ browser }) => {
  // A+H. Zoals 3, dan op "A" van de nieuwe vraag, "Nieuw video-onderdeel": melding "Antwoord B is nog niet verbonden".
  // Handmatig: de oranje kleur.
  const { course, page, videoA } = await openExample(browser, '4');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const menu = page.getByRole('menu');

  await page.locator(`.vue-flow__node[data-id="s${videoA}"]`).getByTitle(PLUS).click();
  await menu.getByRole('menuitem', { name: 'Nieuwe vraag' }).click();
  const newQuestion = page.locator('.vue-flow__node-question').filter({ hasText: 'Nieuwe vraag' });
  await page.getByRole('button', { name: 'Alles in beeld' }).click(); // het nieuwe blok staat soms buiten beeld
  const newId = await newQuestion.getAttribute('data-id');

  await newQuestion.getByTitle(answerPoint('A')).click();
  await menu.getByRole('menuitem', { name: 'Nieuw video-onderdeel' }).click();

  await expect(page.getByRole('group', { name: new RegExp(`^Edge from ${newId} to `) })).toHaveCount(1);
  await newQuestion.locator('[data-test="block"]').click(); // het blok toont alleen de eerste melding; het paneel alle
  await expect(page.getByRole('complementary')).toContainText('Antwoord B is nog niet verbonden');
  await expect(newQuestion.locator('[data-test="end"]')).toHaveCount(0);
});

test('scenario 6: antwoord B terug naar video A (lus)', async ({ browser }) => {
  // A. Zoals 4, dan op "B", in het menu video A kiezen: pijl met "B ↺"; de melding is weg; op video A de tooltip
  // "Wordt bereikt vanuit 2 verbindingen"; geen "← 2" op het blok.
  // Video A krijgt eerst een video, zodat hij in het menu een eigen naam heeft (lege videoblokken heten alle
  // "Kies een video").
  test.setTimeout(90_000);
  const { org, course, videoA } = await openExample(browser, '6');
  const videoName = uniqueName('SC6-005 video A');
  const page = await openLibraryAs(t, browser, org);
  await uploadVideos(page, [{ file: 'valid-512x256.mp4', name: videoName, visibility: 'private' }]);
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const menu = page.getByRole('menu');
  const nodeA = page.locator(`.vue-flow__node[data-id="s${videoA}"]`);

  await nodeA.locator('[data-test="block"]').click();
  await page.getByRole('complementary').locator('[data-test="video-option"]').filter({ hasText: videoName }).click();
  await expect(nodeA).toContainText(videoName);

  // Scenario 3 en 4.
  await nodeA.getByTitle(PLUS).click();
  await menu.getByRole('menuitem', { name: 'Nieuwe vraag' }).click();
  const newQuestion = page.locator('.vue-flow__node-question').filter({ hasText: 'Nieuwe vraag' });
  await page.getByRole('button', { name: 'Alles in beeld' }).click(); // het nieuwe blok staat soms buiten beeld
  const newId = await newQuestion.getAttribute('data-id');
  await newQuestion.getByTitle(answerPoint('A')).click();
  await menu.getByRole('menuitem', { name: 'Nieuw video-onderdeel' }).click();
  await newQuestion.locator('[data-test="block"]').click(); // het blok toont alleen de eerste melding; het paneel alle
  await expect(page.getByRole('complementary')).toContainText('Antwoord B is nog niet verbonden');

  // Antwoord B terug naar video A.
  await newQuestion.getByTitle(answerPoint('B')).click();
  await menu.getByRole('menuitem', { name: videoName }).click();

  await expect(page.getByRole('group', { name: `Edge from ${newId} to s${videoA}` })).toHaveCount(1);
  await expect(page.locator('[data-letter="B"]').filter({ hasText: '↺' })).toHaveCount(1);
  await expect(page.getByText('Antwoord B is nog niet verbonden')).toHaveCount(0);
  await nodeA.locator('[data-test="block"]').hover();
  await expect(nodeA.locator('[data-test="block"]')).toHaveAttribute('title', 'Wordt bereikt vanuit 2 verbindingen');
  await expect(nodeA).not.toContainText('←');
});

test('scenario 15: een video-onderdeel kan zichzelf niet als vervolg kiezen', async ({ browser }) => {
  // A. Bij het "+" van video A: in het menu staan de vraag en video B, niet video A zelf. In het paneel van video A
  // biedt "Daarna" video A ook niet aan (FR-003). Lege videoblokken heten allebei "Kies een video": met video A erbij
  // zouden het er twee zijn.
  const { course, page, videoA } = await openExample(browser, '15');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const nodeA = page.locator(`.vue-flow__node[data-id="s${videoA}"]`);
  const menu = page.getByRole('menu');

  await nodeA.getByTitle(PLUS).click();
  await expect(menu.getByRole('menuitem', { name: 'Vraag: Wat doe je?' })).toHaveCount(1);
  await expect(menu.getByRole('menuitem', { name: 'Kies een video' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);

  await nodeA.locator('[data-test="block"]').click();
  const next = page.getByRole('complementary').getByRole('combobox', { name: 'Daarna' });
  await expect(next.locator('option', { hasText: 'Vraag: Wat doe je?' })).toHaveCount(1);
  await expect(next.locator('option', { hasText: 'Kies een video' })).toHaveCount(1);
});

test('scenario 16: "Nieuwe vraag" op een "+" dat al verbonden is', async ({ browser }) => {
  // A. Video A naar video B verbinden; daarna op het "+" van video A, "Nieuwe vraag": de vraag staat ertussen,
  // antwoord A gaat naar video B (het oude vervolg) en "Antwoord B is nog niet verbonden".
  const { course, page, videoA, videoB } = await openExample(browser, '16');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const nodeA = page.locator(`.vue-flow__node[data-id="s${videoA}"]`);
  const menu = page.getByRole('menu');

  // Video A naar video B (in het menu van video A is video B het enige lege videoblok).
  await nodeA.getByTitle(PLUS).click();
  await menu.getByRole('menuitem', { name: 'Kies een video' }).click();
  await expect(page.getByRole('group', { name: `Edge from s${videoA} to s${videoB}` })).toHaveCount(1);

  // Nieuwe vraag ertussen.
  await nodeA.getByTitle(PLUS).click();
  await menu.getByRole('menuitem', { name: 'Nieuwe vraag' }).click();
  const newQuestion = page.locator('.vue-flow__node-question').filter({ hasText: 'Nieuwe vraag' });
  await page.getByRole('button', { name: 'Alles in beeld' }).click(); // het nieuwe blok staat soms buiten beeld
  const newId = await newQuestion.getAttribute('data-id');

  await expect(page.getByRole('group', { name: `Edge from s${videoA} to ${newId}` })).toHaveCount(1);
  await expect(page.getByRole('group', { name: `Edge from ${newId} to s${videoB}` })).toHaveCount(1);
  await expect(page.getByRole('group', { name: `Edge from s${videoA} to s${videoB}` })).toHaveCount(0);
  await newQuestion.locator('[data-test="block"]').click(); // het blok toont alleen de eerste melding; het paneel alle
  await expect(page.getByRole('complementary')).toContainText('Antwoord B is nog niet verbonden');
});
