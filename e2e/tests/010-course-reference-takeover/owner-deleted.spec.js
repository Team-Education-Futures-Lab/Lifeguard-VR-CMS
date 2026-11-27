import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse } from '../../helpers/course.js';
import { libraryCard, openCourseLibrary, shareCourse } from '../../helpers/sharing.js';
import { addReference, copyTakenOverCourse, questVersions, takenOverRow } from '../../helpers/references.js';

// De beheerder verwijdert de eigenaar van een gedeelde cursus (e2e-plan-spec-010 scenario 18, ook spec 009
// quickstart 15 en spec 011 US4): de cursus verdwijnt uit de bibliotheek, B houdt haar overgenomen versie met de
// uitleg, en de eigen kopie van C werkt door met "Gebaseerd op …".

const t = createTracker();
test.afterEach(() => t.cleanup());

test('de eigenaar wordt verwijderd: bibliotheek, overgenomen cursus en kopie', async ({ browser }) => {
  test.setTimeout(180_000);
  const shared = await createCompleteCourse(t, browser, '010-18');
  await shareCourse(shared.api, shared.course.id, { visibility: 'public' });
  const name = shared.course.name;
  const b = await t.organisation({ name: uniqueName('E2E-010-18-B') });
  const c = await t.organisation({ name: uniqueName('E2E-010-18-C') });
  await addReference(await t.login(b.loginCode), shared.course.id);
  const apiC = await t.login(c.loginCode);
  await addReference(apiC, shared.course.id);
  const pageC = await t.pageAs(browser, c.loginCode);
  const copyId = await copyTakenOverCourse(pageC, name);

  // De beheerder verwijdert de eigenaar.
  const admin = await t.admin();
  expect((await admin.delete(`/api/admin/organisations/${shared.org.id}`)).status()).toBe(204);

  // Spec 009, scenario 15: niet meer in de bibliotheek.
  const pageB = await t.pageAs(browser, b.loginCode);
  await openCourseLibrary(pageB);
  await expect(libraryCard(pageB, name)).toHaveCount(0);

  // Spec 010, scenario 18: B houdt versie 1 met de uitleg; de Quest van B heeft de cursus nog.
  await pageB.goto('/courses');
  await expect(takenOverRow(pageB, name).locator('[data-test="withdrawn"]')).toHaveText(
    'De eigenaar van deze cursus bestaat niet meer. Jullie houden versie 1.',
  );
  await expect(takenOverRow(pageB, name).locator('[data-test="taken-over-pill"]')).toHaveText(`Overgenomen van ${shared.org.name}`);
  expect((await questVersions(t, b.questLinkCode)).get(shared.course.id)).toBe(1);

  // Spec 011: de kopie van C werkt door en toont nog waar hij op gebaseerd is.
  await pageC.goto('/courses');
  await expect(pageC.locator('[data-test="based-on"]')).toHaveText(`Gebaseerd op ${name} van ${shared.org.name}`);
  expect((await questVersions(t, c.questLinkCode)).get(copyId)).toBe(1);
  const doc = await (await apiC.get(`/api/organisation/courses/${copyId}`)).json();
  expect(doc.status).toBe('published');
});
