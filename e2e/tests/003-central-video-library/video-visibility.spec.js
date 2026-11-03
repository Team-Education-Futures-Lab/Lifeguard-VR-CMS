import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { card, openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';

// Scenario 4 en 5 (samen), 8 en 9 (samen), 16: wie welke video ziet en het wijzigen van de beschikbaarheid.
// Bron: docs/e2e plans/e2e-plan-spec-003.md. De hulpfuncties (card, openLibraryAs, uploadVideos) staan in helpers/video-upload.js.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 4 en 5: B ziet de algemene en de selectieve video van A, C alleen de algemene', async ({ browser }) => {
  // A+H. A uploadt een algemene, een selectieve (voor B) en een privévideo. B ziet de algemene en de selectieve,
  // niet de privé, zonder Wijzigen of Verwijderen. C ziet alleen de algemene. De kleur van de pillen is handmatig.
  test.setTimeout(120_000);
  const nameA = uniqueName('E2E-003-SC4-A');
  const nameB = uniqueName('E2E-003-SC4-B');
  const orgA = await t.organisation({ name: nameA });
  const orgB = await t.organisation({ name: nameB });
  const orgC = await t.organisation({ name: uniqueName('E2E-003-SC4-C') });
  const nameAll = uniqueName('SC4-003 algemeen');
  const nameSelective = uniqueName('SC4-003 selectief');
  const namePrivate = uniqueName('SC4-003 eigen');

  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [
    { file: 'valid-512x256.mp4', name: nameAll, visibility: 'public' },
    { file: 'valid-max-5760x2880.mp4', name: nameSelective, visibility: 'selective', organisation: nameB },
    { file: 'valid-opus-audio-512x256.mp4', name: namePrivate, visibility: 'private' },
  ]);

  // B: de algemene en de selectieve video, met de pil van A. De privévideo ontbreekt; dat controleren we pas
  // als de andere twee er staan, want "niet aanwezig" is ook waar zolang de lijst nog laadt.
  const pageB = await openLibraryAs(t, browser, orgB);
  await expect(card(pageB, nameAll)).toBeVisible();
  await expect(card(pageB, nameSelective)).toBeVisible();
  await expect(card(pageB, namePrivate)).toHaveCount(0);
  await expect(card(pageB, nameAll).locator('[data-test="owner"]')).toContainText(nameA);

  // Andermans video: geen "Verwijderen" op de kaart, geen "Wijzigen" of "Verwijderen" in het videovenster.
  await expect(card(pageB, nameAll).locator('[data-test="delete"]')).toHaveCount(0);
  await card(pageB, nameAll).getByRole('button', { name: `${nameAll} openen` }).click();
  const dialog = pageB.getByRole('dialog');
  await expect(dialog.locator('[data-test="view"]')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Wijzigen' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Verwijderen' })).toHaveCount(0);

  // C: alleen de algemene video.
  const pageC = await openLibraryAs(t, browser, orgC);
  await expect(card(pageC, nameAll)).toBeVisible();
  await expect(card(pageC, nameSelective)).toHaveCount(0);
  await expect(card(pageC, namePrivate)).toHaveCount(0);
});

test('scenario 8 en 9: A beperkt een algemene video tot B en maakt hem daarna weer algemeen', async ({ browser }) => {
  // A. Beperken vraagt een bevestiging en C ziet de video daarna niet meer, B wel.
  // Weer algemeen maken vraagt geen bevestiging en C ziet de video weer.
  test.setTimeout(120_000);
  const nameB = uniqueName('E2E-003-SC8-B');
  const orgA = await t.organisation({ name: uniqueName('E2E-003-SC8-A') });
  const orgB = await t.organisation({ name: nameB });
  const orgC = await t.organisation({ name: uniqueName('E2E-003-SC8-C') });
  const nameChanged = uniqueName('SC8-003 beperkt');
  const nameStays = uniqueName('SC8-003 blijft algemeen'); // controlevideo: staat altijd in de lijst van C, ook als de andere weg is

  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [
    { file: 'valid-512x256.mp4', name: nameChanged, visibility: 'public' },
    { file: 'valid-opus-audio-512x256.mp4', name: nameStays, visibility: 'public' },
  ]);
  const pageB = await openLibraryAs(t, browser, orgB);
  const pageC = await openLibraryAs(t, browser, orgC);
  await expect(card(pageC, nameChanged)).toBeVisible();

  // Scenario 8: beperken tot B, met bevestiging.
  await card(pageA, nameChanged).getByRole('button', { name: `${nameChanged} openen` }).click();
  const dialog = pageA.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Wijzigen' }).click();
  await dialog.locator('[data-test="visibility-selective"]').check();
  await dialog.getByLabel(nameB, { exact: true }).check();
  await dialog.getByRole('button', { name: 'Opslaan' }).click();
  // Het aantal organisaties in de tekst hangt af van alle organisaties in de database, dus niet op "1" controleren.
  const confirm = pageA.getByRole('alertdialog');
  await expect(confirm).toContainText('Beschikbaarheid beperken?');
  await expect(confirm).toContainText(/niet meer zien/);
  await confirm.getByRole('button', { name: 'Wijzigen' }).click();
  await expect(dialog.locator('[data-test="availability-text"]')).toHaveText(`Selectief beschikbaar: ${nameB}`);

  await pageC.reload();
  await expect(card(pageC, nameStays)).toBeVisible();
  await expect(card(pageC, nameChanged)).toHaveCount(0);
  await pageB.reload();
  await expect(card(pageB, nameChanged)).toBeVisible();

  // Scenario 9: weer algemeen, zonder bevestiging.
  await dialog.getByRole('button', { name: 'Wijzigen' }).click();
  await dialog.locator('[data-test="visibility-public"]').check();
  await dialog.getByRole('button', { name: 'Opslaan' }).click();
  await expect(dialog.locator('[data-test="availability-text"]')).toHaveText('Algemeen beschikbaar');
  await expect(pageA.getByRole('alertdialog')).toHaveCount(0);

  await pageC.reload();
  await expect(card(pageC, nameChanged)).toBeVisible();
});

test('scenario 16: als de beheerder A verwijdert, zien B en C de video\'s van A niet meer', async ({ browser }) => {
  // A. A heeft een algemene video. De beheerder verwijdert A. B en C zien de video niet meer na herladen.
  // B heeft zelf ook een algemene video: die blijft zichtbaar (voor B en C) en bewijst dat de lijst geladen is.
  test.setTimeout(120_000);
  const orgA = await t.organisation({ name: uniqueName('E2E-003-SC16-A') });
  const orgB = await t.organisation({ name: uniqueName('E2E-003-SC16-B') });
  const orgC = await t.organisation({ name: uniqueName('E2E-003-SC16-C') });
  const nameGone = uniqueName('SC16-003 verdwijnt');
  const nameStays = uniqueName('SC16-003 blijft');

  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [{ file: 'valid-512x256.mp4', name: nameGone, visibility: 'public' }]);
  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [{ file: 'valid-opus-audio-512x256.mp4', name: nameStays, visibility: 'public' }]);
  const pageC = await openLibraryAs(t, browser, orgC);

  // Eerst zien B en C de video van A.
  await pageB.reload();
  await expect(card(pageB, nameGone)).toBeVisible();
  await expect(card(pageC, nameGone)).toBeVisible();

  // De beheerder verwijdert A.
  const res = await (await t.admin()).delete(`/api/admin/organisations/${orgA.id}`);
  expect(res.ok()).toBeTruthy();

  // Na herladen is de video van A weg, de video van B er nog.
  await pageB.reload();
  await expect(card(pageB, nameStays)).toBeVisible();
  await expect(card(pageB, nameGone)).toHaveCount(0);
  await pageC.reload();
  await expect(card(pageC, nameStays)).toBeVisible();
  await expect(card(pageC, nameGone)).toHaveCount(0);
});
