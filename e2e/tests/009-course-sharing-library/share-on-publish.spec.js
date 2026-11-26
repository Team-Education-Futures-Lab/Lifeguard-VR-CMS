import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse, draftSteps, openCourse, saveCourse } from '../../helpers/course.js';
import { choosePublishItem, libraryCard } from '../../helpers/sharing.js';

// Spec 009, US1 en US3 (quickstart 2, 3, 4, 16): de beschikbaarheid kiezen bij het publiceren, en de waarschuwing
// over video's die niet algemeen beschikbaar zijn. createCompleteCourse gebruikt twee video's "Alleen eigen
// organisatie", dus delen geeft altijd de waarschuwing.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US1 + US3: delen bij publiceren, met de waarschuwing', async ({ browser }) => {
  test.setTimeout(120_000);
  const { api, page, course, videoNames } = await createCompleteCourse(t, browser, '009-1');
  await openCourse(page, course.id, { view: 'Canvas + paneel' });

  // "Alleen eigen organisatie" is voorgeselecteerd; "Selectief beschikbaar" zonder organisatie kan niet.
  await choosePublishItem(page, 'publish');
  const confirm = page.getByRole('alertdialog', { name: 'Publiceren?' });
  await expect(confirm.locator('[data-test="visibility-private"]')).toBeChecked();
  await confirm.locator('[data-test="visibility-selective"]').check();
  await expect(confirm.locator('[data-test="no-organisation"]')).toHaveText('Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’.');
  await expect(confirm.locator('[data-test="publish-confirm"]')).toBeDisabled();

  // "Algemeen beschikbaar": eerst de waarschuwing met beide video's. Annuleren: terug, met de keuze nog ingevuld.
  await confirm.locator('[data-test="visibility-public"]').check();
  await expect(confirm.locator('[data-test="library-note"]')).toHaveText('De cursus komt ook in de cursusbibliotheek, voor alle organisaties.');
  await confirm.locator('[data-test="publish-confirm"]').click();
  const warning = page.getByRole('alertdialog', { name: "Video's die niet algemeen beschikbaar zijn" });
  await expect(warning.locator('[data-test="warning-video"]')).toHaveText(videoNames);
  await warning.locator('[data-test="warning-cancel"]').click();
  await expect(confirm.locator('[data-test="visibility-public"]')).toBeChecked();
  expect((await (await api.get(`/api/organisation/courses/${course.id}`)).json()).status).toBe('draft');

  // Doorgaan: gepubliceerd en gedeeld.
  await confirm.locator('[data-test="publish-confirm"]').click();
  await warning.locator('[data-test="warning-continue"]').click();
  await expect(page.locator('[data-test="publication-status"]')).toHaveAttribute('data-status', 'published');
  const doc = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  expect(doc.availability.visibility).toBe('public');

  // Een andere organisatie ziet de cursus in de cursusbibliotheek.
  const other = await t.organisation({ name: uniqueName('E2E-009-1-andere') });
  const otherPage = await t.pageAs(browser, other.loginCode);
  await otherPage.goto('/course-library');
  await expect(libraryCard(otherPage, course.name)).toBeVisible();

  // Een tekstwijziging opnieuw publiceren: geen nieuwe waarschuwing (geen nieuwe beperkte video), "Algemeen
  // beschikbaar" staat al ingevuld.
  const current = await (await api.get(`/api/organisation/courses/${course.id}`)).json();
  await saveCourse(api, current, draftSteps(current).map((s) => (s.stepType === 'question' ? { ...s, questionText: 'Wat doe je nu?' } : s)));
  await page.reload();
  await expect(page.locator('[data-test="publication-status"]')).toHaveAttribute('data-status', 'published_changed');
  await choosePublishItem(page, 'publish');
  const again = page.getByRole('alertdialog', { name: 'Wijzigingen publiceren?' });
  await expect(again.locator('[data-test="visibility-public"]')).toBeChecked();
  await again.locator('[data-test="publish-confirm"]').click();
  await expect(page.locator('[data-test="publication-status"]')).toHaveAttribute('data-status', 'published');
  await expect(warning).toHaveCount(0);
});
