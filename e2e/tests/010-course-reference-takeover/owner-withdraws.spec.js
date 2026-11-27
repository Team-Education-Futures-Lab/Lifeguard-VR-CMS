import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse, openCourse } from '../../helpers/course.js';
import { choosePublishItem, shareCourse } from '../../helpers/sharing.js';
import { addReference, publishNewVersion, questVersions, takenOverRow } from '../../helpers/references.js';

// Spec 010, US4 (quickstart 12–17; e2e-plan-spec-010): de eigenaar beperkt, onpubliceert, publiceert opnieuw en
// verwijdert de cursus, via het scherm met de bevestigingen. B en C houden hun versie op de Quests en zien waarom er
// geen nieuwe versies meer komen; C haalt de cursus daarna zelf weg.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US4: ontvangers houden hun versie als de eigenaar intrekt', async ({ browser }) => {
  test.setTimeout(240_000);
  const shared = await createCompleteCourse(t, browser, '010-4');
  await shareCourse(shared.api, shared.course.id, { visibility: 'public' });
  const b = await t.organisation({ name: uniqueName('E2E-010-4-B') });
  const c = await t.organisation({ name: uniqueName('E2E-010-4-C') });
  await addReference(await t.login(b.loginCode), shared.course.id);
  await addReference(await t.login(c.loginCode), shared.course.id);
  const owner = shared.page;
  const name = shared.course.name;

  // Scenario 12: beperken tot alleen B via "Beschikbaarheid wijzigen"; de bevestiging noemt C als ontvanger.
  await openCourse(owner, shared.course.id, { view: 'Canvas + paneel' });
  await choosePublishItem(owner, 'change-availability');
  const availability = owner.getByRole('dialog', { name: 'Beschikbaarheid wijzigen' });
  await availability.locator('[data-test="visibility-selective"]').check();
  await availability.getByLabel(b.name, { exact: true }).check();
  await availability.locator('[data-test="availability-save"]').click();
  await expect(availability.locator('[data-test="restrict-receivers"]')).toHaveText(
    '1 daarvan heeft deze cursus overgenomen en houdt haar huidige versie.',
  );
  await availability.locator('[data-test="restrict-confirm"]').click();
  await expect(owner.getByText('Beschikbaarheid opgeslagen')).toBeVisible();

  // Scenario 13: een nieuwe versie. C houdt versie 1 en ziet waarom; B krijgt een melding.
  await publishNewVersion(shared.api, shared.course.id, 'Wat doe je nu?');
  const pageC = await t.pageAs(browser, c.loginCode);
  await pageC.goto('/courses');
  await expect(takenOverRow(pageC, name).locator('[data-test="withdrawn"]')).toHaveText(
    'De eigenaar deelt deze cursus niet meer met jullie. Jullie houden versie 1.',
  );
  expect((await questVersions(t, c.questLinkCode)).get(shared.course.id)).toBe(1);
  const pageB = await t.pageAs(browser, b.loginCode);
  await pageB.goto('/courses');
  await expect(takenOverRow(pageB, name).locator('[data-test="new-version-notice"]')).toHaveText('Nieuwe versie beschikbaar (versie 2)');

  // Scenario 14: onpubliceren via het scherm; de bevestiging noemt beide ontvangers. B ziet "ingetrokken".
  await owner.reload();
  await choosePublishItem(owner, 'unpublish');
  const unpublish = owner.getByRole('alertdialog', { name: 'Cursus onpubliceren?' });
  await expect(unpublish.locator('[data-test="unpublish-receivers"]')).toHaveText(
    '2 organisaties hebben deze cursus overgenomen en houden hun huidige versie.',
  );
  await unpublish.locator('[data-test="unpublish-confirm"]').click();
  await expect(owner.locator('[data-test="publication-status"]')).toHaveAttribute('data-status', 'draft');
  await pageB.reload();
  await expect(takenOverRow(pageB, name).locator('[data-test="withdrawn"]')).toHaveText(
    'De eigenaar heeft deze cursus ingetrokken. Jullie houden versie 1.',
  );
  expect((await questVersions(t, b.questLinkCode)).get(shared.course.id)).toBe(1);

  // Scenario 15: opnieuw publiceren (zelfde inhoud, nog steeds alleen voor B; de waarschuwing over de beperkte
  // video's wordt bevestigd). Bij B verdwijnt de uitleg en komt de melding terug; C deelt de eigenaar nog steeds
  // niet mee.
  const republished = await shareCourse(shared.api, shared.course.id, { visibility: 'selective', accessOrganisationIds: [b.id] });
  expect(republished.publication.versionNumber).toBe(2);
  await pageB.reload();
  await expect(takenOverRow(pageB, name).locator('[data-test="withdrawn"]')).toHaveCount(0);
  await expect(takenOverRow(pageB, name).locator('[data-test="new-version-notice"]')).toHaveText('Nieuwe versie beschikbaar (versie 2)');
  await pageC.reload();
  await expect(takenOverRow(pageC, name).locator('[data-test="withdrawn"]')).toHaveText(
    'De eigenaar deelt deze cursus niet meer met jullie. Jullie houden versie 1.',
  );

  // Scenario 16: verwijderen in het cursusoverzicht; de bevestiging noemt de ontvangers. B en C houden hun versie.
  await owner.goto('/courses');
  await owner.locator('li.row').filter({ hasText: name }).getByTitle('Verwijderen').click();
  const confirm = owner.locator('.confirm-backdrop');
  await expect(confirm).toContainText('2 organisaties hebben deze cursus overgenomen en houden hun huidige versie.');
  await confirm.getByRole('button', { name: 'Verwijderen', exact: true }).click();
  await expect(owner.locator('li.row').filter({ hasText: name })).toHaveCount(0);
  await pageB.reload();
  await expect(takenOverRow(pageB, name).locator('[data-test="withdrawn"]')).toHaveText(
    'De eigenaar heeft deze cursus verwijderd. Jullie houden versie 1.',
  );
  expect((await questVersions(t, b.questLinkCode)).get(shared.course.id)).toBe(1);
  expect((await questVersions(t, c.questLinkCode)).get(shared.course.id)).toBe(1);

  // Scenario 17: C haalt de verwijderde cursus weg; de bevestiging zegt dat dat niet terug kan. Bij B niets anders.
  await pageC.reload();
  await takenOverRow(pageC, name).getByRole('button').click();
  await pageC.locator('[data-test="remove-reference"]').click();
  const remove = pageC.locator('.confirm-backdrop');
  await expect(remove).toContainText('Je kunt hem daarna niet opnieuw toevoegen, omdat hij niet meer in de cursusbibliotheek staat.');
  await remove.getByRole('button', { name: 'Verwijderen', exact: true }).click();
  await expect(takenOverRow(pageC, name)).toHaveCount(0);
  expect((await questVersions(t, c.questLinkCode)).has(shared.course.id)).toBe(false);
  expect((await questVersions(t, b.questLinkCode)).get(shared.course.id)).toBe(1);
});
