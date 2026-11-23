import { test, expect } from '@playwright/test';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse, draftSteps, openCourse, publishCourse, saveCourse } from '../../helpers/course.js';

// Scenario 10, 11 en 16: onpubliceren, dezelfde versie terugzetten, en een gepubliceerde cursus verwijderen.
// Bron: docs/e2e plans/e2e-plan-spec-006.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

/** Complete cursus, gepubliceerd als versie 1 en, na een gewijzigde vraagtekst, als versie 2 (via de API). */
async function publishedTwice(browser, tag) {
  const complete = await createCompleteCourse(t, browser, tag);
  let doc = await publishCourse(complete.api, complete.course.id);
  doc = await saveCourse(complete.api, doc, draftSteps(doc).map((s) => (s.stepType === 'question' ? { ...s, questionText: 'Wat doe je nu?' } : s)));
  doc = await publishCourse(complete.api, complete.course.id);
  expect(doc.publication.versionNumber).toBe(2);
  return { ...complete, doc };
}

async function unpublishViaMenu(page) {
  await page.locator('[data-test="publish-menu"]').click();
  await page.locator('[data-test="unpublish"]').click();
  await page.getByRole('alertdialog', { name: 'Cursus onpubliceren?' }).getByRole('button', { name: 'Onpubliceren' }).click();
}

test('scenario 10: onpubliceren', async ({ browser }) => {
  // A. Gepubliceerde cursus (versie 2); [data-test="unpublish"], bevestigen: status alleen "Concept", zonder extra
  // regel; melding "Cursus is niet meer gepubliceerd"; het concept is ongewijzigd.
  test.setTimeout(90_000);
  const { api, page, course, doc } = await publishedTwice(browser, '10');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const status = page.locator('[data-test="publication-status"]');

  await unpublishViaMenu(page);

  await expect(page.getByText('Cursus is niet meer gepubliceerd')).toBeVisible();
  await expect(status).toHaveAttribute('data-status', 'draft');
  await expect(status).toHaveText('Concept');
  const after = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  expect(after.draftVersionNumber).toBe(doc.draftVersionNumber);
  // De inhoud vergelijken, niet de afgeleide velden: video.keptByLiveVersion is na onpubliceren terecht false.
  expect(draftSteps(after)).toEqual(draftSteps(doc));
});

test('scenario 11: direct weer publiceren zet dezelfde versie terug', async ({ browser }) => {
  // A. Zoals 10, dan "Publiceren", bevestigen: melding "Versie 2 staat weer op de VR-brillen"; status "Gepubliceerd"
  // met versie 2 en de datum van versie 2.
  test.setTimeout(90_000);
  const { page, course } = await publishedTwice(browser, '11');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  const status = page.locator('[data-test="publication-status"]');
  await expect(status).toContainText('Versie 2 ·');
  const before = await status.textContent(); // zelfde vorm als toHaveText vergelijkt (zonder regelovergang)

  await unpublishViaMenu(page);
  await expect(status).toHaveAttribute('data-status', 'draft');
  await page.locator('[data-test="publish-menu"]').click();
  await page.locator('[data-test="publish"]').click();
  await page.getByRole('alertdialog', { name: 'Publiceren?' }).getByRole('button', { name: 'Publiceren' }).click();

  await expect(page.getByText('Versie 2 staat weer op de VR-brillen')).toBeVisible();
  await expect(status).toHaveAttribute('data-status', 'published');
  await expect(status).toHaveText(before);
});

test('scenario 16: een gepubliceerde cursus verwijderen in het overzicht', async ({ browser }) => {
  // A. Gepubliceerde cursus; in /courses de verwijderknop: de bevestiging bevat "Deze cursus is gepubliceerd. Na
  // verwijderen is hij niet meer te downloaden op de VR-brillen."; "Verwijderen": weg uit het overzicht.
  // deletedAt, bewaarde versies en geen live versie: B (courseUnpublish.test.js).
  test.setTimeout(90_000);
  const { api, page, course } = await createCompleteCourse(t, browser, '16');
  await publishCourse(api, course.id);
  await page.goto('/courses');

  const row = page.locator('li').filter({ hasText: course.name });
  await expect(row.locator('[data-test="publication-status"]')).toHaveAttribute('data-status', 'published');
  await row.getByRole('button', { name: 'Verwijderen' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Deze cursus is gepubliceerd. Na verwijderen is hij niet meer te downloaden op de VR-brillen.');
  await confirm.getByRole('button', { name: 'Verwijderen' }).click();

  await expect(row).toHaveCount(0);
});
