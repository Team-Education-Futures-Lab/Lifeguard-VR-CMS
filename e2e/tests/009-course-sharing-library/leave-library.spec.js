import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse, openCourse } from '../../helpers/course.js';
import { choosePublishItem, libraryCard, shareCourse } from '../../helpers/sharing.js';

// Spec 009, US5 (quickstart 12, 13): een gedeelde cursus verdwijnt uit de cursusbibliotheek na onpubliceren en
// verwijderen.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US5: onpubliceren, opnieuw publiceren en verwijderen', async ({ browser }) => {
  test.setTimeout(150_000);
  const { api, page, course } = await createCompleteCourse(t, browser, '009-5');
  await shareCourse(api, course.id, { visibility: 'public' });
  const b = await t.organisation({ name: uniqueName('E2E-009-5-B') });
  const pageB = await t.pageAs(browser, b.loginCode);
  await pageB.goto('/course-library');
  await expect(libraryCard(pageB, course.name)).toBeVisible();

  // Onpubliceren: de bevestiging noemt de cursusbibliotheek; B ziet de cursus na herladen niet meer.
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  await choosePublishItem(page, 'unpublish');
  const unpublish = page.getByRole('alertdialog', { name: 'Cursus onpubliceren?' });
  await expect(unpublish.locator('[data-test="unpublish-library-note"]')).toHaveText(
    'Andere organisaties zien hem dan ook niet meer in de cursusbibliotheek.',
  );
  await unpublish.getByRole('button', { name: 'Onpubliceren' }).click();
  await expect(page.locator('[data-test="publication-status"]')).toHaveAttribute('data-status', 'draft');
  await pageB.reload();
  await expect(pageB.getByRole('heading', { name: 'Cursusbibliotheek' })).toBeVisible();
  await expect(libraryCard(pageB, course.name)).toHaveCount(0);

  // Opnieuw publiceren: "Algemeen beschikbaar" is voorgeselecteerd; delen geeft opnieuw de waarschuwing.
  await choosePublishItem(page, 'publish');
  const confirm = page.getByRole('alertdialog', { name: 'Publiceren?' });
  await expect(confirm.locator('[data-test="visibility-public"]')).toBeChecked();
  await confirm.locator('[data-test="publish-confirm"]').click();
  await page.locator('[data-test="warning-continue"]').click();
  await expect(page.locator('[data-test="publication-status"]')).toHaveAttribute('data-status', 'published');
  await pageB.reload();
  await expect(libraryCard(pageB, course.name)).toBeVisible();

  // Verwijderen terwijl B de bibliotheek open heeft: B krijgt bij openen een melding en de cursus gaat uit de lijst.
  expect((await api.delete(`/api/organisation/courses/${course.id}`)).status()).toBe(204);
  await libraryCard(pageB, course.name).getByRole('button', { name: `${course.name} openen` }).click();
  await expect(pageB.getByText('Deze cursus is niet meer beschikbaar.')).toBeVisible();
  await expect(libraryCard(pageB, course.name)).toHaveCount(0);
});
