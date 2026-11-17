import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { videoFixture } from '../../helpers/video-upload.js';

// Scenario 1, 2 en 3: het uploadvenster met beschikbaarheid. Scenario 1 en 3 mogen in één test.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e plans/e2e-plan-spec-003.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 1: het uploadvenster toont "Alleen eigen organisatie" en de velden per bestand', async ({ page }) => {
  // A. Eigen organisatie. /videos, bestand kiezen. [data-test="visibility-private"] is geselecteerd;
  // het veld Beschrijving en de groep Beschikbaarheid staan bij het bestand.
  await page.goto('/videos')
  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  const dialog = page.getByRole('dialog');
await expect(dialog.locator('[data-test="description"]')).toBeVisible();
await expect(dialog.locator('[data-test="availability"]')).toBeVisible();
await expect(dialog.locator('[data-test="visibility-private"]')).toBeChecked();

});

test('scenario 2: drie video\'s met drie beschikbaarheden uploaden', async ({ browser }) => {
  // A. Organisatie A en B (t.organisation twee keer). Drie bestanden in het uploadvenster:
  // "Algemeen" (met beschrijving), "Selectief" voor B ([data-test="organisation-<id van B>"]) en "Alleen eigen".
  // Alle drie in de lijst van A met de pil "Eigen" en de beschikbaarheid in [data-test="visibility"].
  test.setTimeout(90_000);
  // Namen die bij dit scenario horen, zodat de video's van andere tests er niet mee botsen.
  const nameAll = 'SC2-003 algemeen';
  const nameSelective = 'SC2-003 selectief';
  const namePrivate = 'SC2-003 eigen';
  const orgA = await t.organisation({ name: uniqueName('E2E-003-SC2-A') });
  const nameB = uniqueName('E2E-SC2-B');
const orgB = await t.organisation({ name: nameB });

  
  const page = await t.pageAs(browser, orgA.loginCode);
  await page.goto('/videos')
  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4'),
    videoFixture('valid-max-5760x2880.mp4'),
    videoFixture('valid-opus-audio-512x256.mp4'),]);


     await page.locator('[data-test="visibility-public"]').first().check();
  await page.locator('[data-test="visibility-selective"]').nth(1).check();
  await page.getByLabel(nameB, { exact: true }).check();

  await expect(page.locator('[data-test="visibility-public"]').first()).toBeChecked();
  await expect(page.locator('[data-test="visibility-selective"]').nth(1)).toBeChecked();
  await expect(page.locator('[data-test="visibility-private"]').nth(2)).toBeChecked();

  // Beschrijving bij de algemene video, dan uploaden en wachten tot alle drie in de lijst staan.
  await page.locator('[data-test="entry"]').nth(0).getByLabel('Naam').fill(nameAll);
  await page.locator('[data-test="entry"]').nth(1).getByLabel('Naam').fill(nameSelective);
  await page.locator('[data-test="entry"]').nth(2).getByLabel('Naam').fill(namePrivate);
  await page.locator('[data-test="entry"]').first().getByLabel('Beschrijving').fill('Beschrijving van de algemene video');
  await page.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();

  const own = page.locator('[data-test="video"]').filter({
  has: page.locator('[data-test="owner"]', { hasText: /^Eigen$/ }),
});

  await expect(own.getByText(nameAll, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(own.getByText(nameSelective, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(own.getByText(namePrivate, { exact: true })).toBeVisible({ timeout: 30_000 });

  const card1 = own.filter({ hasText: nameAll });
await expect(card1.locator('[data-test="owner"]')).toHaveText('Eigen');
await expect(card1.locator('[data-test="visibility"]')).toHaveText('Algemeen');
await expect(card1.locator('[data-test="description"]')).toHaveText('Beschrijving van de algemene video');

const card2 = own.filter({ hasText: nameSelective });
await expect(card2.locator('[data-test="owner"]')).toHaveText('Eigen');
await expect(card2.locator('[data-test="visibility"]')).toHaveText('Selectief');

await card2.getByRole('button', { name: `${nameSelective} openen` }).click();
await expect(page.locator('[data-test="availability-text"]')).toHaveText(`Selectief beschikbaar: ${nameB}`);
 await page.getByLabel('Sluiten').click();

const card3 = own.filter({ hasText: namePrivate });
await expect(card3.locator('[data-test="owner"]')).toHaveText('Eigen');
await expect(card3.locator('[data-test="visibility"]')).toHaveText('Alleen eigen organisatie');

});

test('scenario 3: "Selectief" zonder organisatie geeft een melding en zet Uploaden uit', async ({ browser }) => {
  // A. [data-test="visibility-selective"] kiezen zonder organisatie: [data-test="no-organisation"] met
  // "Kies minstens één organisatie", "Uploaden" uit. Daarna een organisatie kiezen: "Uploaden" aan.
    const orgA = await t.organisation({ name: uniqueName('E2E-003-SC3-A') });
    const nameB = uniqueName('E2E-003-SC3-B');
  const orgB = await t.organisation({ name: nameB });
  const page = await t.pageAs(browser, orgA.loginCode);
    await page.goto('/videos')
  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  
  
  await page.locator('[data-test="visibility-selective"]').check();

  const dialog = page.getByRole('dialog');
    await expect(page.locator('[data-test="no-organisation"]')).toContainText('Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’.');

await expect(dialog.getByRole('button', { name: 'Uploaden' })).toBeDisabled();
});

