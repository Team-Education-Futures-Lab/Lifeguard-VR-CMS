import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse } from '../../helpers/course.js';
import { libraryCard, openCourseLibrary, shareCourse } from '../../helpers/sharing.js';

// Spec 009, US2 (quickstart 3, 9, 10, 11): de centrale cursusbibliotheek. Organisatie A deelt één cursus algemeen
// en houdt een tweede voor zichzelf; organisatie B zoekt en bekijkt de gedeelde cursus.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US2: gedeelde cursussen vinden en bekijken', async ({ browser }) => {
  test.setTimeout(150_000);
  const shared = await createCompleteCourse(t, browser, '009-2a');
  await shareCourse(shared.api, shared.course.id, { visibility: 'public' });
  const own = await createCompleteCourse(t, browser, '009-2b');
  await shareCourse(own.api, own.course.id, { visibility: 'private' });

  const b = await t.organisation({ name: uniqueName('E2E-009-2-B') });
  const page = await t.pageAs(browser, b.loginCode);
  await openCourseLibrary(page);

  // De gedeelde cursus staat erin met de pil van de eigenaar; de cursus "Alleen eigen organisatie" niet.
  const card = libraryCard(page, shared.course.name);
  await expect(card).toBeVisible();
  await expect(card.locator('[data-test="owner"]')).toHaveText(shared.org.name);
  await expect(card).toContainText('Versie 1');
  await expect(libraryCard(page, own.course.name)).toHaveCount(0);

  // Zoeken op een deel van de naam van de eigenaar, en filteren via de pil.
  await page.locator('[data-test="search"]').fill(shared.org.name.slice(0, 12).toLowerCase());
  await expect(card).toBeVisible();
  await page.locator('[data-test="search"]').fill('');
  await card.locator('[data-test="owner"]').click();
  await expect(page.locator('[data-test="owner-filter"]')).toContainText(`Organisatie: ${shared.org.name}`);
  await expect(page.locator('[data-test="library-course"]')).toHaveCount(1);

  // Het venster: alleen de samenvatting en "Sluiten", geen knoppen om te bewerken.
  await card.getByRole('button', { name: `${shared.course.name} openen` }).click();
  const details = page.getByRole('dialog', { name: shared.course.name });
  await expect(details.locator('[data-test="library-details"]')).toContainText('3 onderdelen');
  await expect(details.locator('[data-test="open-editor"]')).toHaveCount(0);
  await expect(details.locator('[data-test="details-availability"]')).toHaveCount(0);
  await details.locator('[data-test="details-close"]').click();
  await expect(page.locator('[data-test="owner-filter"]')).toBeVisible();

  // Buiten de interface: de cursus "Alleen eigen organisatie" en het bewerken van de gedeelde cursus geven 404.
  const api = await t.login(b.loginCode);
  expect((await api.get(`/api/organisation/course-library/${own.course.id}`)).status()).toBe(404);
  expect((await api.get(`/api/organisation/courses/${shared.course.id}`)).status()).toBe(404);
  expect((await api.put(`/api/organisation/courses/${shared.course.id}/availability`, { data: { visibility: 'private' } })).status()).toBe(404);
});
