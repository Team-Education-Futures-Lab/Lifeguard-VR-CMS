import { test, expect } from '@playwright/test';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse, draftSteps, openCourse, publishCourse, saveCourse } from '../../helpers/course.js';

// Scenario 3, 4, 5, 6 en 18: de status na publiceren, wijzigingen ten opzichte van de live versie, twee tabbladen.
// Elke test begint met een complete cursus die via de API is gepubliceerd (versie 1). Het document dat
// publishCourse teruggeeft, heeft de nieuwe id's van het concept (R14).
// Bron: docs/e2e plans/e2e-plan-spec-006.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 3: het menu na publiceren', async ({ browser }) => {
  // A. Gepubliceerde cursus: [data-test="publish-menu"] heet "Wijzigingen publiceren"; [data-test="publish"]
  // uitgeschakeld met [data-test="publish-reason"] "Er is niets nieuws om te publiceren"; [data-test="unpublish"]
  // staat erin.
  test.setTimeout(90_000);
  const { api, page, course } = await createCompleteCourse(t, browser, '3');
  await publishCourse(api, course.id);
  await openCourse(page, course.id, { view: 'Canvas + paneel' });

  const menu = page.locator('[data-test="publish-menu"]');
  await expect(menu).toHaveText('Wijzigingen publiceren');
  await menu.click();
  await expect(page.locator('[data-test="publish"]')).toBeDisabled();
  await expect(page.locator('[data-test="publish-reason"]')).toHaveText('Er is niets nieuws om te publiceren');
  await expect(page.locator('[data-test="unpublish"]')).toHaveText('Onpubliceren');
});

test('scenario 4: alleen het canvas gewijzigd', async ({ browser }) => {
  // A. Gepubliceerde cursus met de blokken kriskras (alleen posities, via de API: telt niet als wijziging).
  // "Canvas ordenen" en opslaan (niet slepen): status blijft "Gepubliceerd".
  test.setTimeout(90_000);
  const { api, page, course } = await createCompleteCourse(t, browser, '4');
  let doc = await publishCourse(api, course.id);
  const messy = [[500, 400], [-400, 0], [900, -300]];
  doc = await saveCourse(api, doc, draftSteps(doc).map((s, i) => ({ ...s, positionX: messy[i][0], positionY: messy[i][1] })));
  expect(doc.status).toBe('published');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const status = page.locator('[data-test="publication-status"]');
  const save = page.locator('[data-test="save"]');

  await page.getByRole('button', { name: 'Canvas ordenen' }).click();
  await expect(save).toHaveText('Opslaan als concept');
  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  await expect(status).toHaveAttribute('data-status', 'published');
  await expect(status).not.toContainText('wijzigingen nog niet gepubliceerd');
});

test('scenario 5: de inhoud gewijzigd en opgeslagen', async ({ browser }) => {
  // A. Gepubliceerde cursus; vraagtekst wijzigen, opslaan: "Gepubliceerd · wijzigingen nog niet gepubliceerd" met
  // "Op de Quest: versie 1".
  test.setTimeout(90_000);
  const { api, page, course } = await createCompleteCourse(t, browser, '5');
  const doc = await publishCourse(api, course.id);
  const q = doc.steps.find((s) => s.stepType === 'question');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const status = page.locator('[data-test="publication-status"]');
  const save = page.locator('[data-test="save"]');

  await page.locator(`.vue-flow__node[data-id="s${q.id}"] [data-test="block"]`).click();
  await page.getByRole('complementary').locator('[data-test="question"]').fill('Wat doe je als eerste?');
  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  await expect(status).toHaveAttribute('data-status', 'published_changed');
  await expect(status).toContainText('Gepubliceerd · wijzigingen nog niet gepubliceerd');
  await expect(status).toContainText('Op de Quest: versie 1');
});

test('scenario 6: de wijziging teruggedraaid en opgeslagen', async ({ browser }) => {
  // A. Zoals 5, dan de oude vraagtekst terug en opslaan: weer "Gepubliceerd".
  test.setTimeout(90_000);
  const { api, page, course } = await createCompleteCourse(t, browser, '6');
  const doc = await publishCourse(api, course.id);
  const q = doc.steps.find((s) => s.stepType === 'question');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const status = page.locator('[data-test="publication-status"]');
  const save = page.locator('[data-test="save"]');
  const question = page.getByRole('complementary').locator('[data-test="question"]');

  await page.locator(`.vue-flow__node[data-id="s${q.id}"] [data-test="block"]`).click();
  await question.fill('Wat doe je als eerste?');
  await save.click();
  await expect(status).toHaveAttribute('data-status', 'published_changed');

  await question.fill(q.questionText);
  await save.click();
  await expect(save).toHaveText('Opgeslagen');
  await expect(status).toHaveAttribute('data-status', 'published');
  await expect(status).not.toContainText('wijzigingen nog niet gepubliceerd');
});

test('scenario 18: publiceren in tabblad 1, opslaan in tabblad 2', async ({ browser }) => {
  // A. Twee pagina's in één context met dezelfde complete cursus (nog niet gepubliceerd). Tab 1 publiceert; tab 2
  // wijzigt en slaat op: dialoog "Cursus is intussen gepubliceerd" met de tekst van de server en "Pagina opnieuw
  // laden". Via de API is de wijziging van tab 2 er niet; tab 1 kan daarna nog wijzigen en opslaan.
  test.setTimeout(90_000);
  const { api, page: page1, course } = await createCompleteCourse(t, browser, '18');
  const q = course.steps.find((s) => s.stepType === 'question');
  const page2 = await page1.context().newPage();
  await openCourse(page1, course.id, { view: 'Canvas + paneel' });
  await openCourse(page2, course.id, { view: 'Canvas + paneel' });

  // Tab 1 publiceert.
  await page1.locator('[data-test="publish-menu"]').click();
  await page1.locator('[data-test="publish"]').click();
  await page1.getByRole('alertdialog', { name: 'Publiceren?' }).getByRole('button', { name: 'Publiceren' }).click();
  await expect(page1.getByText('Gepubliceerd als versie 1')).toBeVisible();

  // Tab 2 wijzigt en slaat op.
  await page2.locator(`.vue-flow__node[data-id="s${q.id}"] [data-test="block"]`).click();
  await page2.getByRole('complementary').locator('[data-test="question"]').fill('Tab 2 was hier');
  await page2.locator('[data-test="save"]').click();
  await expect(page2.getByText('Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw om verder te werken.')).toBeVisible();
  await expect(page2.getByRole('button', { name: 'Pagina opnieuw laden' })).toBeVisible();

  const doc = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  const savedQuestion = doc.steps.find((s) => s.stepType === 'question');
  expect(savedQuestion.questionText).toBe(q.questionText);

  // Tab 1 werkt verder op het nieuwe concept (nieuwe id's).
  await page1.locator(`.vue-flow__node[data-id="s${savedQuestion.id}"] [data-test="block"]`).click();
  await page1.getByRole('complementary').locator('[data-test="question"]').fill('Tab 1 gaat door');
  await page1.locator('[data-test="save"]').click();
  await expect(page1.locator('[data-test="save"]')).toHaveText('Opgeslagen');
});
