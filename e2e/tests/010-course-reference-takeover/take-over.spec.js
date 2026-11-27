import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse } from '../../helpers/course.js';
import { libraryCard, openCourseLibrary, shareCourse } from '../../helpers/sharing.js';
import { questVersions } from '../../helpers/references.js';

// Spec 010, US1 (quickstart 1–4): een gedeelde cursus toevoegen aan de eigen organisatie. Hij komt op de Quests
// van B in de gekozen versie, niet op die van C.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US1: een cursus uit de bibliotheek toevoegen', async ({ browser }) => {
  test.setTimeout(150_000);
  const shared = await createCompleteCourse(t, browser, '010-1');
  await shareCourse(shared.api, shared.course.id, { visibility: 'public' });
  const b = await t.organisation({ name: uniqueName('E2E-010-1-B') });
  const c = await t.organisation({ name: uniqueName('E2E-010-1-C') });

  const page = await t.pageAs(browser, b.loginCode);
  await openCourseLibrary(page);
  const card = libraryCard(page, shared.course.name);
  await card.getByRole('button', { name: `${shared.course.name} openen` }).click();
  const details = page.getByRole('dialog', { name: shared.course.name });

  // Eerst annuleren: er verandert niets.
  await details.locator('[data-test="add-course"]').click();
  await expect(page.getByText('Cursus toevoegen aan jouw organisatie?')).toBeVisible();
  await page.getByRole('button', { name: 'Annuleren' }).click();
  expect((await questVersions(t, b.questLinkCode)).has(shared.course.id)).toBe(false);

  // Dan toevoegen.
  await details.locator('[data-test="add-course"]').click();
  await page.getByRole('button', { name: 'Toevoegen', exact: true }).click();
  await expect(page.getByText('Cursus toegevoegd aan jouw cursussen')).toBeVisible();
  await expect(details.locator('[data-test="course-added"]')).toBeVisible();
  await details.locator('[data-test="details-close"]').click();
  await expect(card.locator('[data-test="course-added"]')).toBeVisible();

  // Op de Quest van B in versie 1, niet op die van C; een tweede keer toevoegen kan niet.
  expect((await questVersions(t, b.questLinkCode)).get(shared.course.id)).toBe(1);
  expect((await questVersions(t, c.questLinkCode)).has(shared.course.id)).toBe(false);
  const api = await t.login(b.loginCode);
  const again = await api.post('/api/organisation/course-references', { data: { courseId: shared.course.id } });
  expect(again.status()).toBe(409);
});
