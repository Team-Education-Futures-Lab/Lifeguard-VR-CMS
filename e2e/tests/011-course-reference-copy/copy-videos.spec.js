import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse, draftSteps, publishCourse, saveCourse } from '../../helpers/course.js';
import { shareCourse } from '../../helpers/sharing.js';
import { addReference, copyTakenOverCourse } from '../../helpers/references.js';

// Spec 011, US3 (quickstart 8–10): de video's uit de gekozen versie blijven in de kopie werken, ook buiten de
// eigen videobibliotheek en na onpubliceren; ze komen niet in de videobibliotheek van de organisatie.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US3: meegekregen video\'s blijven bruikbaar in de kopie', async ({ browser }) => {
  test.setTimeout(180_000);
  // De video's van A zijn "Alleen eigen organisatie": B mag ze alleen via de cursus gebruiken.
  const shared = await createCompleteCourse(t, browser, '011-3');
  await shareCourse(shared.api, shared.course.id, { visibility: 'public' });
  const b = await t.organisation({ name: uniqueName('E2E-011-3-B') });
  const api = await t.login(b.loginCode);
  await addReference(api, shared.course.id);

  const page = await t.pageAs(browser, b.loginCode);
  const copyId = await copyTakenOverCourse(page, shared.course.name);

  // In de editor geen melding "Video niet meer beschikbaar".
  await expect(page.getByText('Video niet meer beschikbaar')).toHaveCount(0);

  // Onpubliceren, wijzigen en opnieuw publiceren lukt met de meegekregen video's.
  expect((await api.post(`/api/organisation/courses/${copyId}/unpublish`)).status()).toBe(200);
  const doc = await (await api.get(`/api/organisation/courses/${copyId}`)).json();
  expect(doc.steps.filter((s) => s.video).every((s) => s.video.keptFromOriginal)).toBe(true);
  await saveCourse(api, doc, draftSteps(doc).map((s) => (s.stepType === 'question' ? { ...s, questionText: 'Na onpubliceren?' } : s)));
  const published = await publishCourse(api, copyId);
  expect(published.publication.versionNumber).toBe(2);

  // Niet in de videobibliotheek van B.
  await page.goto('/videos');
  for (const name of shared.videoNames) await expect(page.getByText(name)).toHaveCount(0);
});
