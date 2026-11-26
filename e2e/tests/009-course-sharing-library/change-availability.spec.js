import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse, openCourse } from '../../helpers/course.js';
import { choosePublishItem, libraryCard, shareCourse } from '../../helpers/sharing.js';

// Spec 009, US4 (quickstart 8): "Beschikbaarheid wijzigen" van een live cursus, zonder nieuwe versie. Andere
// tests maken tegelijk organisaties aan, dus deze test beperkt van twee gekozen organisaties naar één: dan verliest
// precies één organisatie de cursus.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US4: een gedeelde cursus beperken tot één organisatie', async ({ browser }) => {
  test.setTimeout(150_000);
  const b = await t.organisation({ name: uniqueName('E2E-009-4-B') });
  const c = await t.organisation({ name: uniqueName('E2E-009-4-C') });
  const { api, page, course } = await createCompleteCourse(t, browser, '009-4');
  const published = await shareCourse(api, course.id, { visibility: 'selective', accessOrganisationIds: [b.id, c.id] });

  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const status = page.locator('[data-test="publication-status"]');
  const before = await status.textContent();

  await choosePublishItem(page, 'change-availability');
  const dialog = page.getByRole('dialog', { name: 'Beschikbaarheid wijzigen' });
  await expect(dialog.locator('[data-test="visibility-selective"]')).toBeChecked();
  await dialog.getByLabel(c.name, { exact: true }).uncheck();
  await dialog.locator('[data-test="availability-save"]').click();
  await expect(dialog.locator('[data-test="restrict-question"]')).toHaveText(
    '1 organisatie kan deze cursus daarna niet meer zien in de cursusbibliotheek.',
  );
  await dialog.locator('[data-test="restrict-confirm"]').click();
  await expect(page.getByText('Beschikbaarheid opgeslagen')).toBeVisible();
  await expect(dialog).toHaveCount(0);

  // Versie en datum zijn ongewijzigd.
  await expect(status).toHaveText(before);
  const doc = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  expect(doc.publication).toEqual(published.publication);
  expect(doc.availability.accessOrganisations).toEqual([{ id: b.id, name: b.name }]);

  // B ziet de cursus nog, C niet meer.
  const pageB = await t.pageAs(browser, b.loginCode);
  await pageB.goto('/course-library');
  await expect(libraryCard(pageB, course.name)).toBeVisible();
  const pageC = await t.pageAs(browser, c.loginCode);
  await pageC.goto('/course-library');
  await expect(pageC.getByRole('heading', { name: 'Cursusbibliotheek' })).toBeVisible();
  await expect(libraryCard(pageC, course.name)).toHaveCount(0);
});
