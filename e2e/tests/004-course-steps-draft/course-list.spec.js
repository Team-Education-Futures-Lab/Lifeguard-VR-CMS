import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, TEST_PASSWORD } from '../../helpers/org-api.js';
import { loginViaScreen } from '../../helpers/video-upload.js';
import { createCourse } from '../../helpers/course.js';

// Scenario 1, 2, 3, 15 en 16: de lijst met cursussen, aanmaken, afscherming en verwijderen.
// Bron: docs/e2e plans/e2e-plan-spec-004.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 1: zonder cursussen staat "Er zijn nog geen cursussen."', async ({ browser }) => {
  // A. Nieuwe organisatie (t.organisation), inloggen via het scherm, /courses: "Er zijn nog geen cursussen."
  const org = await t.organisation({ name: uniqueName('E2E-004-SC1') });
  const page = await (await t.browserContext(browser)).newPage();
  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/courses');

  await expect(page.getByText('Er zijn nog geen cursussen.')).toBeVisible();
});

test('scenario 2: een nieuwe cursus met lege naam wordt niet aangemaakt', async ({ browser }) => {
  // A. "Nieuwe cursus", alleen [data-test="course-description"] invullen, "Aanmaken".
  // [data-test="create-error"] toont "Vul een naam en een beschrijving in."; het venster blijft open.
  // Via de API (t.login en GET /api/organisation/courses): geen cursus.
  const org = await t.organisation({ name: uniqueName('E2E-004-SC2') });
  const page = await t.pageAs(browser, org.loginCode);
  await page.goto('/courses');

  await page.getByRole('button', { name: 'Nieuwe cursus' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-test="course-description"]').fill('Alleen een beschrijving');
  await dialog.getByRole('button', { name: 'Aanmaken' }).click();

  await expect(dialog.locator('[data-test="create-error"]')).toHaveText('Vul een naam en een beschrijving in.');
  await expect(dialog).toBeVisible();

  const api = await t.login(org.loginCode);
  const { courses } = await (await api.get('/api/organisation/courses')).json();
  expect(courses).toHaveLength(0);
});

test('scenario 3: een nieuwe cursus opent in de editor met het voorbeeld', async ({ browser }) => {
  // A. Aanmaken via het scherm met naam en beschrijving. De editor opent met het label "Concept", een blok
  // "Wat doe je?" met "Start" en twee videoblokken "Kies een video". Terug naar /courses: de regel toont
  // "2 video's · 1 vraag" en "Concept".
  const org = await t.organisation({ name: uniqueName('E2E-004-SC3') });
  const courseName = uniqueName('SC3-004 cursus');
  const page = await t.pageAs(browser, org.loginCode);
  await page.goto('/courses');

  await page.getByRole('button', { name: 'Nieuwe cursus' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-test="course-name"]').fill(courseName);
  await dialog.locator('[data-test="course-description"]').fill('Beschrijving van scenario 3');
  await dialog.getByRole('button', { name: 'Aanmaken' }).click();

  // De editor met het voorbeeld.
  await expect(page).toHaveURL(/\/courses\/\d+$/);
  await expect(page.getByText('Concept', { exact: true })).toBeVisible();
  const blocks = page.locator('[data-test="block"]');
  await expect(blocks).toHaveCount(3);
  const question = blocks.filter({ hasText: 'Wat doe je?' });
  await expect(question.locator('[data-test="badges"]')).toContainText('Start');
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(2);

  // Terug naar de lijst: de regel van de nieuwe cursus.
  await page.getByTitle('Terug naar cursussen').click();
  await expect(page).toHaveURL(/\/courses$/);
  const row = page.locator('li').filter({ hasText: courseName });
  await expect(row).toContainText('2 video’s · 1 vraag'); // met een gekrulde apostrof, zoals in de app
  await expect(row).toContainText('Concept');
});

test('scenario 15: B opent het adres van de cursus van A', async ({ browser }) => {
  // A. Cursus van A via createCourse. Als B (eigen context, loginViaScreen) /courses/<id van A>:
  // de kop "Cursus niet gevonden".
  const orgA = await t.organisation({ name: uniqueName('E2E-004-SC15-A') });
  const orgB = await t.organisation({ name: uniqueName('E2E-004-SC15-B') });
  const course = await createCourse(await t.login(orgA.loginCode), { name: uniqueName('SC15-004 cursus van A') });

  const pageB = await (await t.browserContext(browser)).newPage();
  await loginViaScreen(pageB, orgB.loginCode, TEST_PASSWORD);
  await pageB.goto(`/courses/${course.id}`);

  await expect(pageB.getByRole('heading', { name: 'Cursus niet gevonden' })).toBeVisible();
  await expect(pageB.getByText(course.name)).toHaveCount(0);
});

test('scenario 16: een cursus verwijderen', async ({ browser }) => {
  // A. Cursus via createCourse; in /courses de verwijderknop (title "Verwijderen") bij de regel.
  // alertdialog "Cursus verwijderen?", "Verwijderen": de regel is weg; /courses/<id> geeft "Cursus niet gevonden".
  // Dat deletedAt gevuld is, is B (courseCrud.test.js).
  const org = await t.organisation({ name: uniqueName('E2E-004-SC16') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC16-004 weg') });
  const page = await t.pageAs(browser, org.loginCode);
  await page.goto('/courses');

  const row = page.locator('li').filter({ hasText: course.name });
  await expect(row).toBeVisible();
  await row.getByTitle('Verwijderen').click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Cursus verwijderen?');
  await confirm.getByRole('button', { name: 'Verwijderen' }).click();

  await expect(confirm).toBeHidden();
  await expect(row).toHaveCount(0);

  await page.goto(`/courses/${course.id}`);
  await expect(page.getByRole('heading', { name: 'Cursus niet gevonden' })).toBeVisible();
});
