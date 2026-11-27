import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse } from '../../helpers/course.js';
import { libraryCard, openCourseLibrary, shareCourse } from '../../helpers/sharing.js';
import { addReference, questVersions, takenOverRow } from '../../helpers/references.js';

// Spec 011, US4 (quickstart 5, 6, 11, 12): het origineel en andere organisaties merken niets; de bibliotheek wijst
// op een bestaande kopie; twee tabbladen tegelijk geven één kopie.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US4: het origineel blijft gelijk, de hint in de bibliotheek, één kopie bij twee tabbladen', async ({ browser }) => {
  test.setTimeout(180_000);
  const shared = await createCompleteCourse(t, browser, '011-4');
  await shareCourse(shared.api, shared.course.id, { visibility: 'public' });
  const b = await t.organisation({ name: uniqueName('E2E-011-4-B') });
  const c = await t.organisation({ name: uniqueName('E2E-011-4-C') });
  const apiB = await t.login(b.loginCode);
  const apiC = await t.login(c.loginCode);
  await addReference(apiB, shared.course.id);
  await addReference(apiC, shared.course.id);
  const before = await (await shared.api.get(`/api/organisation/courses/${shared.course.id}`)).json();
  expect(before.receivers.map((r) => r.name).sort()).toEqual([b.name, c.name].sort());

  // B kiest in twee tabbladen tegelijk "Aanpassen".
  const tab1 = await t.pageAs(browser, b.loginCode);
  const tab2 = await t.pageAs(browser, b.loginCode);
  for (const page of [tab1, tab2]) {
    await page.goto('/courses');
    await takenOverRow(page, shared.course.name).getByRole('button').click();
    await page.locator('[data-test="copy-reference"]').click();
  }
  await Promise.all([tab1, tab2].map((page) => page.locator('.confirm-backdrop').getByRole('button', { name: 'Aanpassen', exact: true }).click()));
  await tab1.waitForTimeout(1000);
  const opened = [tab1, tab2].filter((page) => /\/courses\/\d+$/.test(new URL(page.url()).pathname));
  expect(opened).toHaveLength(1);
  const other = opened[0] === tab1 ? tab2 : tab1;
  await expect(other.getByText('Deze cursus is al aangepast. De aangepaste cursus staat bij je cursussen.')).toBeVisible();
  const { courses } = await (await apiB.get('/api/organisation/courses')).json();
  expect(courses.filter((course) => course.basedOn)).toHaveLength(1);

  // A ziet alleen C nog als organisatie die de cursus heeft overgenomen; de rest van de cursus is gelijk.
  const after = await (await shared.api.get(`/api/organisation/courses/${shared.course.id}`)).json();
  expect(after.receivers.map((r) => r.name)).toEqual([c.name]);
  expect(after.publication).toEqual(before.publication);
  expect(after.draftVersionNumber).toBe(before.draftVersionNumber);
  expect(after.availability).toEqual(before.availability);

  // C merkt niets.
  expect((await questVersions(t, c.questLinkCode)).get(shared.course.id)).toBe(1);

  // B ziet de hint in de bibliotheek en kan het origineel opnieuw toevoegen.
  await openCourseLibrary(tab1);
  await libraryCard(tab1, shared.course.name).click();
  await expect(tab1.locator('[data-test="has-copy-hint"]')).toHaveText('Jullie hebben al een aangepaste kopie van deze cursus.');
  await expect(tab1.locator('[data-test="add-course"]')).toBeVisible();
});
