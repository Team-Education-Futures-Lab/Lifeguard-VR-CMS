import { test, expect } from '@playwright/test';
import { uniqueName } from '../../../helpers/admin.js';
import { createTracker, TEST_PASSWORD } from '../../../helpers/org-api.js';
import { loginViaScreen } from '../../../helpers/video-upload.js';
import { createCourse } from '../../../helpers/course.js';

// Sabotage van course-list.spec.js. ELKE TEST HOORT TE FALEN, op de regel die bij "faalt op" staat.
// Elke functie is een kopie van de originele test; `sab` zet precies één fout aan. Het origineel blijft ongewijzigd.
// Controle: npx playwright test tests/004-course-steps-draft/sabotage --reporter=json > sab.json
//           node zz-sab-report.mjs sab.json

const t = createTracker();
test.afterEach(() => t.cleanup());

async function scenario1(browser, sab) {
  const org = await t.organisation({ name: uniqueName('E2E-004-SAB1') });
  if (sab === 'heeft-cursus') await createCourse(await t.login(org.loginCode), { name: uniqueName('SAB1-004 cursus') });
  const page = await (await t.browserContext(browser)).newPage();
  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/courses');

  await expect(page.getByText('Er zijn nog geen cursussen.')).toBeVisible();
}

async function scenario2(browser, sab) {
  const org = await t.organisation({ name: uniqueName('E2E-004-SAB2') });
  const page = await t.pageAs(browser, org.loginCode);
  await page.goto('/courses');

  await page.getByRole('button', { name: 'Nieuwe cursus' }).click();
  const dialog = page.getByRole('dialog');
  if (sab === 'naam-ingevuld') await dialog.locator('[data-test="course-name"]').fill(uniqueName('SAB2-004 cursus'));
  await dialog.locator('[data-test="course-description"]').fill('Alleen een beschrijving');
  await dialog.getByRole('button', { name: 'Aanmaken' }).click();

  await expect(dialog.locator('[data-test="create-error"]')).toHaveText('Vul een naam en een beschrijving in.');
  await expect(dialog).toBeVisible();

  const api = await t.login(org.loginCode);
  if (sab === 'toch-aangemaakt') await createCourse(api, { name: uniqueName('SAB2-004 toch') });
  const { courses } = await (await api.get('/api/organisation/courses')).json();
  expect(courses).toHaveLength(0);
}

async function scenario3(browser, sab) {
  const org = await t.organisation({ name: uniqueName('E2E-004-SAB3') });
  const courseName = uniqueName('SAB3-004 cursus');
  const page = await t.pageAs(browser, org.loginCode);
  await page.goto('/courses');

  await page.getByRole('button', { name: 'Nieuwe cursus' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-test="course-name"]').fill(courseName);
  await dialog.locator('[data-test="course-description"]').fill('Beschrijving van scenario 3');
  await dialog.getByRole('button', { name: 'Aanmaken' }).click();

  await expect(page).toHaveURL(/\/courses\/\d+$/);
  await expect(page.getByText('Concept', { exact: true })).toBeVisible();
  const blocks = page.locator('[data-test="block"]');
  // De sabotage voegt onderdelen toe; in "Canvas" opent dat een venster met "Klaar" (zoals openCourse dat kiest).
  await page.getByRole('radio', { name: 'Canvas', exact: true }).check();
  if (sab === 'extra-blok') {
    await page.getByRole('button', { name: 'Vraag', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click();
  }
  if (sab === 'video-is-start') {
    await blocks.filter({ hasText: 'Kies een video' }).first().click();
    await page.getByRole('dialog').locator('[data-test="start"]').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click();
  }
  await expect(blocks).toHaveCount(3);
  const question = blocks.filter({ hasText: 'Wat doe je?' });
  await expect(question.locator('[data-test="badges"]')).toContainText('Start');
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(2);

  if (sab === 'derde-video') {
    await page.getByRole('button', { name: 'Video', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click();
    await page.locator('[data-test="save"]').click();
    await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');
  }
  await page.getByTitle('Terug naar cursussen').click();
  await expect(page).toHaveURL(/\/courses$/);
  const row = page.locator('li').filter({ hasText: courseName });
  await expect(row).toContainText('2 video’s · 1 vraag');
  await expect(row).toContainText('Concept');
}

async function scenario15(browser, sab) {
  const orgA = await t.organisation({ name: uniqueName('E2E-004-SAB15-A') });
  const orgB = await t.organisation({ name: uniqueName('E2E-004-SAB15-B') });
  const course = await createCourse(await t.login(orgA.loginCode), { name: uniqueName('SAB15-004 cursus van A') });

  const pageB = await (await t.browserContext(browser)).newPage();
  const loginAs = sab === 'als-A' ? orgA : orgB;
  await loginViaScreen(pageB, loginAs.loginCode, TEST_PASSWORD);
  await pageB.goto(`/courses/${course.id}`);

  await expect(pageB.getByRole('heading', { name: 'Cursus niet gevonden' })).toBeVisible();
  await expect(pageB.getByText(course.name)).toHaveCount(0);
}

async function scenario16(browser, sab) {
  const org = await t.organisation({ name: uniqueName('E2E-004-SAB16') });
  const api = await t.login(org.loginCode);
  const course = await createCourse(api, { name: uniqueName('SAB16-004 weg') });
  const other = await createCourse(api, { name: uniqueName('SAB16-004 blijft') });
  const page = await t.pageAs(browser, org.loginCode);
  await page.goto('/courses');

  const row = page.locator('li').filter({ hasText: course.name });
  await expect(row).toBeVisible();
  await row.getByTitle('Verwijderen').click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Cursus verwijderen?');
  await confirm.getByRole('button', { name: sab === 'annuleren' ? 'Annuleren' : 'Verwijderen' }).click();

  await expect(confirm).toBeHidden();
  await expect(row).toHaveCount(0);

  await page.goto(`/courses/${sab === 'ander-adres' ? other.id : course.id}`);
  await expect(page.getByRole('heading', { name: 'Cursus niet gevonden' })).toBeVisible();
}

// faalt op: "Er zijn nog geen cursussen." is niet zichtbaar
test('S1-1 de organisatie heeft al een cursus', ({ browser }) => scenario1(browser, 'heeft-cursus'));

// faalt op: create-error "Vul een naam en een beschrijving in."
test('S2-1 naam toch ingevuld: de cursus wordt aangemaakt', ({ browser }) => scenario2(browser, 'naam-ingevuld'));
// faalt op: expect(courses).toHaveLength(0)
test('S2-2 er staat toch een cursus in de API', ({ browser }) => scenario2(browser, 'toch-aangemaakt'));

// faalt op: blocks toHaveCount(3)
test('S3-1 voorbeeld met een extra blok', ({ browser }) => scenario3(browser, 'extra-blok'));
// faalt op: badges van "Wat doe je?" bevatten "Start"
test('S3-2 een videoblok is het startonderdeel', ({ browser }) => scenario3(browser, 'video-is-start'));
// faalt op: de regel bevat "2 video’s · 1 vraag"
test('S3-3 derde video opgeslagen: de regel klopt niet meer', ({ browser }) => scenario3(browser, 'derde-video'));

// faalt op: kop "Cursus niet gevonden"
test('S15-1 A opent zijn eigen cursus', ({ browser }) => scenario15(browser, 'als-A'));

// faalt op: row toHaveCount(0)
test('S16-1 Annuleren in plaats van Verwijderen', ({ browser }) => scenario16(browser, 'annuleren'));
// faalt op: kop "Cursus niet gevonden" (laatste regel)
test('S16-2 het adres van een cursus die nog bestaat', ({ browser }) => scenario16(browser, 'ander-adres'));
