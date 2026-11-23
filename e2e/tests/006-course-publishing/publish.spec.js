import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse, createCourse, draftSteps, openCourse, publishCourse, saveCourse } from '../../helpers/course.js';

// Scenario 1, 2, 7, 8 en 17: publiceren, een onvolledige cursus, publiceren na opslaan, en dubbel klikken.
// De editor staat op "Canvas + paneel" (zoals in spec 005). Na een nieuwe versie heeft het concept nieuwe id's (R14):
// gebruik dan het document dat publishCourse teruggeeft.
// Bron: docs/e2e plans/e2e-plan-spec-006.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

/** "Versie 1 · 23 november 2026 om 15:02": het nummer exact, de datum en tijd alleen in vorm. */
const versionLine = (n) => new RegExp(`Versie ${n} · \\d{1,2} \\S+ \\d{4} om \\d{2}:\\d{2}`);

test('scenario 1: een onvolledige cursus wordt niet gepubliceerd', async ({ browser }) => {
  // A. Nieuwe cursus (voorbeeld zonder video's), [data-test="publish-menu"], [data-test="publish"]: dialoog
  // "Nog niet klaar om te publiceren" met twee keer "Kies een video"; een regel aanklikken opent het onderdeel.
  // Via de API is de status nog "draft".
  const org = await t.organisation({ name: uniqueName('E2E-006-SC1') });
  const api = await t.login(org.loginCode);
  const course = await createCourse(api, { name: uniqueName('SC1-006 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id, { view: 'Canvas + paneel' });

  await page.locator('[data-test="publish-menu"]').click();
  await page.locator('[data-test="publish"]').click();
  const dialog = page.getByRole('alertdialog', { name: 'Nog niet klaar om te publiceren' });
  await expect(dialog).toBeVisible();
  const rows = dialog.getByRole('button', { name: /^Kies een video/ });
  await expect(rows).toHaveCount(2);

  await rows.first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('complementary').getByRole('heading', { name: 'Video-onderdeel' })).toBeVisible();

  const doc = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  expect(doc.status).toBe('draft');
  expect(doc.publication).toBeNull();
});

test('scenario 2: een complete cursus publiceren', async ({ browser }) => {
  // A+H. Twee eigen video's in de videoblokken (via de API), "Publiceren", bevestigen: melding "Gepubliceerd als
  // versie 1"; [data-test="publication-status"] "Gepubliceerd" met "Versie 1 · <datum> om <tijd>", in de editor en
  // in het overzicht. Handmatig: de opmaak van de balk.
  test.setTimeout(90_000);
  const { page, course } = await createCompleteCourse(t, browser, '2');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const status = page.locator('[data-test="publication-status"]');
  await expect(status).toHaveAttribute('data-status', 'draft');

  await page.locator('[data-test="publish-menu"]').click();
  await page.locator('[data-test="publish"]').click();
  const confirm = page.getByRole('alertdialog', { name: 'Publiceren?' });
  await confirm.getByRole('button', { name: 'Publiceren' }).click();

  await expect(page.getByText('Gepubliceerd als versie 1')).toBeVisible();
  await expect(status).toHaveAttribute('data-status', 'published');
  await expect(status).toContainText('Gepubliceerd');
  await expect(status).toContainText(versionLine(1));

  await page.goto('/courses');
  const rowStatus = page.locator('li').filter({ hasText: course.name }).locator('[data-test="publication-status"]');
  await expect(rowStatus).toHaveAttribute('data-status', 'published');
  await expect(rowStatus).toContainText(versionLine(1));
});

test('scenario 7: eerst opslaan, dan de wijzigingen publiceren', async ({ browser }) => {
  // A. Gepubliceerde cursus; een wijziging zonder opslaan: [data-test="publish"] uitgeschakeld met
  // [data-test="publish-reason"] "Sla eerst je wijzigingen op". Opslaan, "Wijzigingen publiceren", bevestigen:
  // "Gepubliceerd als versie 2".
  test.setTimeout(90_000);
  const { api, page, course } = await createCompleteCourse(t, browser, '7');
  const doc = await publishCourse(api, course.id);
  const q = doc.steps.find((s) => s.stepType === 'question');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const save = page.locator('[data-test="save"]');

  await page.locator(`.vue-flow__node[data-id="s${q.id}"] [data-test="block"]`).click();
  await page.getByRole('complementary').locator('[data-test="question"]').fill('Wat doe je als eerste?');
  await page.locator('[data-test="publish-menu"]').click();
  await expect(page.locator('[data-test="publish"]')).toBeDisabled();
  await expect(page.locator('[data-test="publish-reason"]')).toHaveText('Sla eerst je wijzigingen op');
  await page.keyboard.press('Escape');

  await save.click();
  await expect(save).toHaveText('Opgeslagen');
  await page.locator('[data-test="publish-menu"]').click();
  await page.locator('[data-test="publish"]').click();
  await page.getByRole('alertdialog', { name: 'Wijzigingen publiceren?' }).getByRole('button', { name: 'Wijzigingen publiceren' }).click();

  await expect(page.getByText('Gepubliceerd als versie 2')).toBeVisible();
  await expect(page.locator('[data-test="publication-status"]')).toContainText(versionLine(2));
});

test('scenario 8: na een losgekoppeld antwoord wordt niet gepubliceerd', async ({ browser }) => {
  // A. Gepubliceerde cursus (versie 2, via de API); antwoord B loskoppelen ("Verbinding weghalen" in het menu bij de
  // letter), opslaan, publiceren: dialoog "Nog niet klaar om te publiceren" met "Antwoord B is nog niet verbonden".
  // Via de API staat versie 2 nog live.
  test.setTimeout(90_000);
  const { api, page, course } = await createCompleteCourse(t, browser, '8');
  let doc = await publishCourse(api, course.id);
  doc = await saveCourse(api, doc, draftSteps(doc).map((s) => (s.stepType === 'question' ? { ...s, questionText: 'Wat doe je nu?' } : s)));
  doc = await publishCourse(api, course.id);
  expect(doc.publication.versionNumber).toBe(2);
  const q = doc.steps.find((s) => s.stepType === 'question');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const save = page.locator('[data-test="save"]');

  await page.locator(`.vue-flow__node[data-id="s${q.id}"]`).getByTitle('Klik of sleep om antwoord B te verbinden').click();
  await page.getByRole('menu').getByRole('menuitem', { name: 'Verbinding weghalen' }).click();
  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  await page.locator('[data-test="publish-menu"]').click();
  await page.locator('[data-test="publish"]').click();
  const dialog = page.getByRole('alertdialog', { name: 'Nog niet klaar om te publiceren' });
  await expect(dialog).toContainText('Antwoord B is nog niet verbonden');

  const after = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  expect(after.publication.versionNumber).toBe(2);
  expect(after.status).toBe('published_changed');
});

test('scenario 17: twee keer snel op "Publiceren" geeft één versie', async ({ browser }) => {
  // A. Complete cursus; in de bevestiging dubbelklikken op "Publiceren": via de API één versie (versie 1, het
  // concept is versie 2). Twintig gelijktijdige verzoeken: B (coursePublish.test.js, SC-006).
  test.setTimeout(90_000);
  const { api, page, course } = await createCompleteCourse(t, browser, '17');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });

  await page.locator('[data-test="publish-menu"]').click();
  await page.locator('[data-test="publish"]').click();
  await page.getByRole('alertdialog', { name: 'Publiceren?' }).getByRole('button', { name: 'Publiceren' }).dblclick();
  await expect(page.getByText('Gepubliceerd als versie 1')).toBeVisible();

  const doc = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  expect(doc.publication.versionNumber).toBe(1);
  expect(doc.draftVersionNumber).toBe(2);
});
