import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse } from '../../helpers/course.js';
import { shareCourse } from '../../helpers/sharing.js';
import { addReference, publishNewVersion, questVersions, takenOverRow } from '../../helpers/references.js';

// Spec 010, US4 (quickstart 12–16): de eigenaar beperkt, onpubliceert en verwijdert de cursus. B en C houden hun
// versie op de Quests en zien waarom er geen nieuwe versies meer komen.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US4: ontvangers houden hun versie als de eigenaar intrekt', async ({ browser }) => {
  test.setTimeout(180_000);
  const shared = await createCompleteCourse(t, browser, '010-4');
  await shareCourse(shared.api, shared.course.id, { visibility: 'public' });
  const b = await t.organisation({ name: uniqueName('E2E-010-4-B') });
  const c = await t.organisation({ name: uniqueName('E2E-010-4-C') });
  await addReference(await t.login(b.loginCode), shared.course.id);
  await addReference(await t.login(c.loginCode), shared.course.id);

  // De eigenaar ziet wie de cursus heeft overgenomen.
  const doc = await (await shared.api.get(`/api/organisation/courses/${shared.course.id}`)).json();
  expect(doc.receivers.map((r) => r.id).sort()).toEqual([b.id, c.id].sort());

  // Beperken tot alleen B, en een nieuwe versie: C houdt versie 1 en ziet waarom; B krijgt een melding.
  await shareCourse(shared.api, shared.course.id, { visibility: 'selective', accessOrganisationIds: [b.id] });
  await publishNewVersion(shared.api, shared.course.id, 'Wat doe je nu?');
  const pageC = await t.pageAs(browser, c.loginCode);
  await pageC.goto('/courses');
  await expect(takenOverRow(pageC, shared.course.name).locator('[data-test="withdrawn"]')).toHaveText(
    'De eigenaar deelt deze cursus niet meer met jullie. Jullie houden versie 1.',
  );
  expect((await questVersions(t, c.questLinkCode)).get(shared.course.id)).toBe(1);
  const pageB = await t.pageAs(browser, b.loginCode);
  await pageB.goto('/courses');
  await expect(takenOverRow(pageB, shared.course.name).locator('[data-test="new-version-notice"]')).toBeVisible();

  // Onpubliceren: B ziet de uitleg en houdt versie 1 op de Quest.
  expect((await shared.api.post(`/api/organisation/courses/${shared.course.id}/unpublish`)).status()).toBe(200);
  await pageB.reload();
  await expect(takenOverRow(pageB, shared.course.name).locator('[data-test="withdrawn"]')).toHaveText(
    'De eigenaar heeft deze cursus ingetrokken. Jullie houden versie 1.',
  );

  // Verwijderen: weg bij de eigenaar, B en C houden hun versie.
  expect((await shared.api.delete(`/api/organisation/courses/${shared.course.id}`)).status()).toBe(204);
  await pageB.reload();
  await expect(takenOverRow(pageB, shared.course.name).locator('[data-test="withdrawn"]')).toHaveText(
    'De eigenaar heeft deze cursus verwijderd. Jullie houden versie 1.',
  );
  expect((await questVersions(t, b.questLinkCode)).get(shared.course.id)).toBe(1);
  expect((await questVersions(t, c.questLinkCode)).get(shared.course.id)).toBe(1);
});
