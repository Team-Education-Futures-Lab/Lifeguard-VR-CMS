import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { videoFixture, card, openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';

// Scenario 10 en 11: naam en beschrijving wijzigen, en de grens van 1000 tekens.
// Bron: docs/e2e plans/e2e-plan-spec-003.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 10: naam en beschrijving wijzigen, met een tweede regel', async ({ browser }) => {
  // A. A wijzigt in het videovenster naam ([data-test="edit-name"]) en beschrijving (met een nieuwe regel), "Opslaan".
  // B ziet na herladen de nieuwe naam en beide regels in het videovenster.
  test.setTimeout(90_000);
  const orgA = await t.organisation({ name: uniqueName('E2E-003-SC10-A') });
  const orgB = await t.organisation({ name: uniqueName('E2E-003-SC10-B') });
  const nameOld = uniqueName('SC10-003 oud');
  const nameNew = uniqueName('SC10-003 nieuw');

  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [{ file: 'valid-512x256.mp4', name: nameOld, visibility: 'public' }]);

  // A wijzigt de naam en de beschrijving (twee regels).
  await card(pageA, nameOld).getByRole('button', { name: `${nameOld} openen` }).click();
  const dialogA = pageA.getByRole('dialog');
  await dialogA.getByRole('button', { name: 'Wijzigen' }).click();
  await dialogA.locator('[data-test="edit-name"]').fill(nameNew);
  await dialogA.locator('[data-test="description"]').fill('Eerste regel\nTweede regel');
  await dialogA.getByRole('button', { name: 'Opslaan' }).click();
  await expect(dialogA.locator('[data-test="view"]')).toBeVisible();

  // B: de nieuwe naam en beide regels.
  const pageB = await openLibraryAs(t, browser, orgB);
  await expect(card(pageB, nameNew)).toBeVisible();
  await expect(card(pageB, nameOld)).toHaveCount(0);
  await card(pageB, nameNew).getByRole('button', { name: `${nameNew} openen` }).click();
  const description = pageB.getByRole('dialog').locator('[data-test="description"]');
  // innerText geeft de tekst zoals getoond, dus met de regelovergang; toHaveText negeert regelovergangen.
  await expect.poll(() => description.evaluate((el) => el.innerText)).toBe('Eerste regel\nTweede regel');
});

test('scenario 11: een beschrijving van 1001 tekens wordt afgekapt op 1000', async ({ browser }) => {
  // A+H. In het uploadvenster en daarna bij Wijzigen: 1001 tekens plakken. De tekst is afgekapt op 1000 en de melding
  // "De beschrijving mag maximaal 1000 tekens zijn; de rest is niet overgenomen." staat er. Eén teken weg: melding weg.
  // Via de API (t.login(org.loginCode) en een PATCH): 400 met "De beschrijving mag maximaal 1000 tekens zijn."
  // Handmatig: de rode kleur van de teller.
  test.setTimeout(90_000);
  const orgA = await t.organisation({ name: uniqueName('E2E-003-SC11-A') });
  const nameVideo = uniqueName('SC11-003 beschrijving');
  const tooLong = 'a'.repeat(1001);
  const cutMessage = 'De beschrijving mag maximaal 1000 tekens zijn; de rest is niet overgenomen.';

  // Uploadvenster: 1001 tekens worden 1000 met de melding; één teken minder haalt de melding weg.
  const pageA = await openLibraryAs(t, browser, orgA);
  await pageA.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  const entry = pageA.locator('[data-test="entry"]').first();
  await entry.getByLabel('Naam').fill(nameVideo);
  await entry.locator('[data-test="description"]').fill(tooLong);
  await expect(entry.locator('[data-test="description"]')).toHaveValue('a'.repeat(1000));
  await expect(entry.locator('[data-test="description-cut"]')).toHaveText(cutMessage);
  await entry.locator('[data-test="description"]').fill('a'.repeat(999));
  await expect(entry.locator('[data-test="description-cut"]')).toHaveCount(0);
  await expect(entry.locator('[data-test="description-counter"]')).toHaveText('1 teken over');
  await pageA.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();
  await expect(card(pageA, nameVideo)).toBeVisible({ timeout: 30_000 });

  // Bij Wijzigen hetzelfde.
  await card(pageA, nameVideo).getByRole('button', { name: `${nameVideo} openen` }).click();
  const dialog = pageA.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Wijzigen' }).click();
  await dialog.locator('[data-test="description"]').fill(tooLong);
  await expect(dialog.locator('[data-test="description"]')).toHaveValue('a'.repeat(1000));
  await expect(dialog.locator('[data-test="description-cut"]')).toHaveText(cutMessage);
  await dialog.locator('[data-test="description"]').fill('a'.repeat(999));
  await expect(dialog.locator('[data-test="description-cut"]')).toHaveCount(0);

  // API: te lange beschrijving geeft 400 met de melding bij het veld.
  const api = await t.login(orgA.loginCode);
  const { videos } = await (await api.get('/api/organisation/videos')).json();
  const video = videos.find((v) => v.name === nameVideo);
  const res = await api.patch(`/api/organisation/videos/${video.id}`, { data: { description: tooLong } });
  expect(res.status()).toBe(400);
  expect((await res.json()).error.fields.description).toBe('De beschrijving mag maximaal 1000 tekens zijn.');
});
