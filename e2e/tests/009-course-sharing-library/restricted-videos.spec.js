import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse, draftSteps, openCourse, saveCourse } from '../../helpers/course.js';
import { choosePublishItem, libraryCard, shareCourse } from '../../helpers/sharing.js';
import { uploadVideos } from '../../helpers/video-upload.js';

// Spec 009, quickstart 6 en 7 (e2e-plan-spec-009): de waarschuwing noemt alleen de beperkte video's die nieuw
// gedeeld worden, en bij een groter publiek alle beperkte video's. createCompleteCourse gebruikt twee video's
// "Alleen eigen organisatie" (A en B).

const t = createTracker();
test.afterEach(() => t.cleanup());

test('quickstart 6 + 7: waarschuwing bij een nieuwe beperkte video en bij een groter publiek', async ({ browser }) => {
  test.setTimeout(180_000);
  const { api, page, course, videoNames } = await createCompleteCourse(t, browser, '009-6');
  const b = await t.organisation({ name: uniqueName('E2E-009-6-B') });
  const c = await t.organisation({ name: uniqueName('E2E-009-6-C') });
  await shareCourse(api, course.id, { visibility: 'selective', accessOrganisationIds: [b.id] });

  // Scenario 6: een derde beperkte video in plaats van video B, opslaan en publiceren.
  const newName = uniqueName('SC009-6 video C');
  await page.goto('/videos');
  await uploadVideos(page, [{ file: 'valid-512x256.mp4', name: newName, visibility: 'private' }]);
  const { videos } = await (await api.get('/api/organisation/videos')).json();
  const newId = videos.find((v) => v.name === newName).id;
  const oldBId = videos.find((v) => v.name === videoNames[1]).id;
  const current = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  await saveCourse(api, current, draftSteps(current).map((s) => (s.videoId === oldBId ? { ...s, videoId: newId } : s)));

  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  await choosePublishItem(page, 'publish');
  const confirm = page.getByRole('alertdialog', { name: 'Wijzigingen publiceren?' });
  await confirm.locator('[data-test="publish-confirm"]').click();
  const warning = page.getByRole('alertdialog', { name: "Video's die niet algemeen beschikbaar zijn" });
  await expect(warning.locator('[data-test="warning-video"]')).toHaveText([newName]);
  await warning.locator('[data-test="warning-continue"]').click();
  await expect(page.locator('[data-test="publication-status"]')).toHaveAttribute('data-status', 'published');
  const published = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  expect(published.publication.versionNumber).toBe(2);

  // Scenario 7: "Beschikbaarheid wijzigen" naar "Algemeen beschikbaar": groter publiek, dus beide beperkte video's
  // uit de live versie. Versie en datum veranderen niet; C ziet de cursus daarna wel.
  await choosePublishItem(page, 'change-availability');
  const dialog = page.getByRole('dialog', { name: 'Beschikbaarheid wijzigen' });
  await dialog.locator('[data-test="visibility-public"]').check();
  await dialog.locator('[data-test="availability-save"]').click();
  await expect(warning.locator('[data-test="warning-video"]')).toHaveCount(2);
  await expect(warning).toContainText(videoNames[0]);
  await expect(warning).toContainText(newName);
  await warning.locator('[data-test="warning-continue"]').click();
  await expect(page.getByText('Beschikbaarheid opgeslagen')).toBeVisible();
  const after = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  expect(after.availability.visibility).toBe('public');
  expect(after.publication).toEqual(published.publication);

  const pageC = await t.pageAs(browser, c.loginCode);
  await pageC.goto('/course-library');
  await expect(libraryCard(pageC, course.name)).toBeVisible();
});
