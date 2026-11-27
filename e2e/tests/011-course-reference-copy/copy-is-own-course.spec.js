import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse, draftSteps, saveCourse } from '../../helpers/course.js';
import { choosePublishItem, libraryCard, openCourseLibrary, shareCourse } from '../../helpers/sharing.js';
import { addReference, copyTakenOverCourse, questVersions } from '../../helpers/references.js';

// Spec 011, US2 (quickstart 7): de kopie is een gewone eigen cursus, maar wordt nooit gedeeld.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US2: de kopie publiceren zonder deelkeuze, onpubliceren en verwijderen', async ({ browser }) => {
  test.setTimeout(180_000);
  const shared = await createCompleteCourse(t, browser, '011-2');
  await shareCourse(shared.api, shared.course.id, { visibility: 'public' });
  const b = await t.organisation({ name: uniqueName('E2E-011-2-B') });
  const api = await t.login(b.loginCode);
  await addReference(api, shared.course.id);

  const page = await t.pageAs(browser, b.loginCode);
  const copyId = await copyTakenOverCourse(page, shared.course.name);

  // Een wijziging opslaan (via de API, de editor zelf is elders getest) en publiceren in de editor.
  const doc = await (await api.get(`/api/organisation/courses/${copyId}`)).json();
  await saveCourse(api, doc, draftSteps(doc).map((s) => (s.stepType === 'question' ? { ...s, questionText: 'Aangepaste vraag?' } : s)));
  await page.reload();
  await choosePublishItem(page, 'publish');
  const dialog = page.locator('[data-test="publish-dialog"]');
  await expect(dialog.locator('[data-test="copy-not-shared"]')).toHaveText('Een aangepaste cursus is alleen voor jouw organisatie en kan niet gedeeld worden.');
  await expect(dialog.getByRole('radio')).toHaveCount(0);
  await dialog.locator('[data-test="publish-confirm"]').click();
  await expect(page.getByText('Gepubliceerd als versie 2')).toBeVisible();
  expect((await questVersions(t, b.questLinkCode)).get(copyId)).toBe(2);

  // Geen "Beschikbaarheid wijzigen" in het menu.
  await page.locator('[data-test="publish-menu"]').click();
  await expect(page.locator('[data-test="change-availability"]')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // In geen enkele bibliotheek.
  await openCourseLibrary(page);
  await expect(libraryCard(page, shared.course.name)).toHaveCount(1); // het origineel van A
  expect((await api.get(`/api/organisation/course-library/${copyId}`)).status()).toBe(404);
  expect((await shared.api.get(`/api/organisation/course-library/${copyId}`)).status()).toBe(404);

  // Onpubliceren en verwijderen zoals elke eigen cursus.
  expect((await api.post(`/api/organisation/courses/${copyId}/unpublish`)).status()).toBe(200);
  expect((await questVersions(t, b.questLinkCode)).has(copyId)).toBe(false);
  expect((await api.delete(`/api/organisation/courses/${copyId}`)).status()).toBe(204);
  expect((await shared.api.get(`/api/organisation/courses/${shared.course.id}`)).status()).toBe(200);
});
