import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse } from '../../helpers/course.js';
import { shareCourse } from '../../helpers/sharing.js';
import { addReference, questVersions, takenOverRow } from '../../helpers/references.js';

// Spec 010, US2 (quickstart 3, 5, 6, 17): de overgenomen cursus in het cursusoverzicht, niet bewerkbaar, en weer
// te verwijderen uit de eigen organisatie.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US2: een overgenomen cursus bekijken en verwijderen', async ({ browser }) => {
  test.setTimeout(150_000);
  const shared = await createCompleteCourse(t, browser, '010-2');
  await shareCourse(shared.api, shared.course.id, { visibility: 'public' });
  const b = await t.organisation({ name: uniqueName('E2E-010-2-B') });
  const api = await t.login(b.loginCode);
  await addReference(api, shared.course.id);

  const page = await t.pageAs(browser, b.loginCode);
  await page.goto('/courses');
  await expect(page.locator('[data-test="taken-over-section"]')).toHaveText('Overgenomen cursussen');
  const row = takenOverRow(page, shared.course.name);
  await expect(row.locator('[data-test="taken-over-pill"]')).toHaveText(`Overgenomen van ${shared.org.name}`);
  await expect(row).toContainText('Op de Quest: versie 1');

  // Het venster: samenvatting, geen weg naar de editor.
  await row.getByRole('button').click();
  const details = page.getByRole('dialog', { name: shared.course.name });
  await expect(details.locator('[data-test="taken-over-details"]')).toContainText('3 onderdelen');
  await expect(details.locator('a[href^="/courses/"]')).toHaveCount(0);

  // Buiten de interface: bewerken geeft 404.
  expect((await api.get(`/api/organisation/courses/${shared.course.id}`)).status()).toBe(404);
  expect((await api.post(`/api/organisation/courses/${shared.course.id}/publish`)).status()).toBe(404);

  // Verwijderen uit de eigen organisatie: weg bij B en van de Quest van B; het origineel blijft.
  await details.locator('[data-test="remove-reference"]').click();
  await page.getByRole('button', { name: 'Verwijderen', exact: true }).click();
  await expect(page.getByText('Cursus verwijderd uit jouw cursussen')).toBeVisible();
  await expect(takenOverRow(page, shared.course.name)).toHaveCount(0);
  expect((await questVersions(t, b.questLinkCode)).has(shared.course.id)).toBe(false);
  expect((await shared.api.get(`/api/organisation/courses/${shared.course.id}`)).status()).toBe(200);

  // Opnieuw toevoegen kan.
  expect((await addReference(api, shared.course.id)).version.versionNumber).toBe(1);
});
