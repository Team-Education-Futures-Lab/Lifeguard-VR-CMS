import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse } from '../../helpers/course.js';
import { shareCourse } from '../../helpers/sharing.js';
import { addReference, publishNewVersion, questVersions, takenOverRow } from '../../helpers/references.js';

// Spec 010, US3 (quickstart 8–11): een melding bij een nieuwe versie, de huidige versie houden, en later toch de
// nieuwe versie gebruiken.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US3: kiezen welke versie op de Quests staat', async ({ browser }) => {
  test.setTimeout(180_000);
  const shared = await createCompleteCourse(t, browser, '010-3');
  await shareCourse(shared.api, shared.course.id, { visibility: 'public' });
  const b = await t.organisation({ name: uniqueName('E2E-010-3-B') });
  await addReference(await t.login(b.loginCode), shared.course.id);
  expect(await publishNewVersion(shared.api, shared.course.id, 'Wat doe je nu?')).toBe(2);

  // B ziet de teller en de melding; de Quest houdt versie 1.
  const page = await t.pageAs(browser, b.loginCode);
  await page.goto('/courses');
  await expect(page.locator('[data-test="notice-count"]')).toHaveText('1');
  const row = takenOverRow(page, shared.course.name);
  await expect(row.locator('[data-test="new-version-notice"]')).toHaveText('Nieuwe versie beschikbaar (versie 2)');
  expect((await questVersions(t, b.questLinkCode)).get(shared.course.id)).toBe(1);

  // Huidige versie houden: de melding en de teller verdwijnen.
  await row.getByRole('button').click();
  const details = page.getByRole('dialog', { name: shared.course.name });
  await details.locator('[data-test="keep-version"]').click();
  await expect(details.locator('[data-test="keep-version"]')).toHaveCount(0);
  await details.locator('[data-test="details-close"]').click();
  await expect(page.locator('[data-test="notice-count"]')).toHaveCount(0);
  await expect(row.locator('[data-test="newer-version"]')).toHaveText('Nieuwere versie beschikbaar (versie 2)');

  // Een nog nieuwere versie: de melding komt terug; nu de nieuwe versie gebruiken.
  expect(await publishNewVersion(shared.api, shared.course.id, 'Wat doe je als eerste?')).toBe(3);
  await page.reload();
  await expect(row.locator('[data-test="new-version-notice"]')).toHaveText('Nieuwe versie beschikbaar (versie 3)');
  await row.getByRole('button').click();
  await details.locator('[data-test="use-new-version"]').click();
  await expect(page.getByText('Jullie VR-brillen krijgen versie 3 bij de volgende synchronisatie.')).toBeVisible();
  expect((await questVersions(t, b.questLinkCode)).get(shared.course.id)).toBe(3);
});
