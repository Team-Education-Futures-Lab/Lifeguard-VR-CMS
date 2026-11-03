import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { videoFixture, card, openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';

// Scenario 12, 13, 14, 19 en 21 (samen), 22: zoeken, sorteren en filteren in de bibliotheek.
// Bron: docs/e2e plans/e2e-plan-spec-003.md. B is steeds de kijker; A heeft algemene video's.
// Alle video's van één test hebben dezelfde unieke zoekterm in de naam (`run`), zodat video's van andere
// tests of eerdere runs niet meetellen.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 12: zoeken op beschrijving, organisatienaam en zonder accenten', async ({ browser }) => {
  // A. B met video's van A en van zichzelf. Zoeken ([data-test="search"]) op een woord uit de beschrijving,
  // op "zwembad a" en op "cafe" bij een video "Café". Hoofdletters en accenten maken niet uit.
  test.setTimeout(90_000);
  const run = Date.now();
  // De loginCode is standaard gelijk aan de naam en mag geen spaties hebben, dus geven we hem apart mee.
  const orgA = await t.organisation({ name: `Zwembad A SC12 ${run}`, loginCode: `E2E-003-SC12-A-${run}` });
  const orgB = await t.organisation({ name: uniqueName('E2E-003-SC12-B') });
  const nameCafe = `SC12-003 Café ${run}`;
  const nameBeach = `SC12-003 Strand ${run}`;
  const nameOwn = `SC12-003 Eigen ${run}`;

  // A uploadt twee algemene video's; de eerste heeft een beschrijving.
  const pageA = await openLibraryAs(t, browser, orgA);
  await pageA.locator('[data-test="file-input"]').setInputFiles([
    videoFixture('valid-512x256.mp4'),
    videoFixture('valid-opus-audio-512x256.mp4'),
  ]);
  const entries = pageA.locator('[data-test="entry"]');
  await entries.nth(0).getByLabel('Naam').fill(nameCafe);
  await entries.nth(0).locator('[data-test="description"]').fill(`Opgenomen in de kajuit ${run}`);
  await entries.nth(0).locator('[data-test="visibility-public"]').check();
  await entries.nth(1).getByLabel('Naam').fill(nameBeach);
  await entries.nth(1).locator('[data-test="visibility-public"]').check();
  await pageA.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();
  await expect(card(pageA, nameCafe)).toBeVisible({ timeout: 30_000 });
  await expect(card(pageA, nameBeach)).toBeVisible({ timeout: 30_000 });

  // B heeft een eigen video en ziet die van A.
  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [{ file: 'valid-silent-1024x512.mp4', name: nameOwn, visibility: 'private' }]);
  const search = pageB.locator('[data-test="search"]');

  // Een woord uit de beschrijving, in hoofdletters: alleen de video met die beschrijving.
  await search.fill(`KAJUIT ${run}`);
  await expect(card(pageB, nameCafe)).toBeVisible();
  await expect(card(pageB, nameBeach)).toHaveCount(0);
  await expect(card(pageB, nameOwn)).toHaveCount(0);

  // De naam van de organisatie, in kleine letters: beide video's van A.
  await search.fill(`zwembad a sc12 ${run}`);
  await expect(card(pageB, nameCafe)).toBeVisible();
  await expect(card(pageB, nameBeach)).toBeVisible();
  await expect(card(pageB, nameOwn)).toHaveCount(0);

  // "cafe" vindt "Café".
  await search.fill(`cafe ${run}`);
  await expect(card(pageB, nameCafe)).toBeVisible();
  await expect(card(pageB, nameBeach)).toHaveCount(0);
  await expect(card(pageB, nameOwn)).toHaveCount(0);
});

test('scenario 13: sorteren, filteren en zoeken gelden tegelijk', async ({ browser }) => {
  // A. Sorteren ([data-test="sort"]) op grootte, filter "Van andere organisaties" ([data-test="ownership-..."])
  // en een zoekterm tegelijk. Sorteren op duur doen we niet: alle testvideo's duren 2 s (zie frontend/tests/video-library.test.js).
  test.setTimeout(90_000);
  const run = Date.now();
  const orgA = await t.organisation({ name: uniqueName('E2E-003-SC13-A') });
  const orgB = await t.organisation({ name: uniqueName('E2E-003-SC13-B') });
  const token = `SC13-003 ${run}`;
  const nameBig = `${token} groot`; // valid-max-5760x2880.mp4, 168 KB
  const nameSmall = `${token} klein`; // valid-opus-audio-512x256.mp4, 19 KB
  const nameOwn = `${token} eigen`; // valid-silent-1024x512.mp4, 19 KB (B zelf)

  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [
    { file: 'valid-max-5760x2880.mp4', name: nameBig, visibility: 'public' },
    { file: 'valid-opus-audio-512x256.mp4', name: nameSmall, visibility: 'public' },
  ]);
  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [{ file: 'valid-silent-1024x512.mp4', name: nameOwn, visibility: 'private' }]);

  // Zoekterm: alle drie. Filter "Van andere organisaties": alleen die van A.
  await pageB.locator('[data-test="search"]').fill(token);
  const cards = pageB.locator('[data-test="video"]').filter({ hasText: token });
  await expect(cards).toHaveCount(3);
  await pageB.locator('[data-test="ownership-others"]').click();
  await expect(cards).toHaveCount(2);
  await expect(card(pageB, nameOwn)).toHaveCount(0);

  // Sorteren op grootte, met zoekterm en filter nog aan.
  await pageB.locator('[data-test="sort"]').selectOption('largest');
  await expect(cards.first()).toContainText(nameBig);
  await pageB.locator('[data-test="sort"]').selectOption('smallest');
  await expect(cards.first()).toContainText(nameSmall);
  await expect(cards).toHaveCount(2);
});

test('scenario 14: zoeken zonder resultaat toont "Geen video\'s gevonden"', async ({ browser }) => {
  // A. [data-test="no-results"] met "Zoekterm en filter wissen"; die knop wist ook het organisatiefilter.
  test.setTimeout(90_000);
  const run = Date.now();
  const orgA = await t.organisation({ name: uniqueName('E2E-003-SC14-A') });
  const orgB = await t.organisation({ name: uniqueName('E2E-003-SC14-B') });
  const nameA = `SC14-003 ${run}`;

  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [{ file: 'valid-512x256.mp4', name: nameA, visibility: 'public' }]);
  const pageB = await openLibraryAs(t, browser, orgB);

  // Organisatiefilter aan (pil van A), dan een zoekterm zonder resultaat.
  await card(pageB, nameA).locator('[data-test="owner"]').click();
  await expect(pageB.locator('[data-test="owner-filter"]')).toBeVisible();
  await pageB.locator('[data-test="search"]').fill(`geenresultaat ${run}`);
  const noResults = pageB.locator('[data-test="no-results"]');
  await expect(noResults).toContainText("Geen video's gevonden");

  // "Zoekterm en filter wissen" wist de zoekterm én het organisatiefilter.
  await noResults.getByRole('button', { name: 'Zoekterm en filter wissen' }).click();
  await expect(noResults).toHaveCount(0);
  await expect(pageB.locator('[data-test="search"]')).toHaveValue('');
  await expect(pageB.locator('[data-test="owner-filter"]')).toHaveCount(0);
  await expect(card(pageB, nameA)).toBeVisible();
});

test('scenario 19 en 21: een organisatiefilter instellen en weer wegklikken', async ({ browser }) => {
  // A. B met video's van A en van zichzelf. Klik op de pil van A: alleen A's video's, [data-test="owner-filter"]
  // naast het zoekveld ("Organisatie: ... ✕"), het videovenster opent niet. Zoekterm en sortering erbij.
  // Label wegklikken: alleen het organisatiefilter vervalt; zoekterm en sortering blijven.
  test.setTimeout(90_000);
  const run = Date.now();
  const nameOrgA = uniqueName('E2E-003-SC19-A');
  const orgA = await t.organisation({ name: nameOrgA });
  const orgB = await t.organisation({ name: uniqueName('E2E-003-SC19-B') });
  const token = `SC19-003 ${run}`;
  const nameA1 = `${token} a1`;
  const nameA2 = `${token} a2`;
  const nameOwn = `${token} eigen`;

  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [
    { file: 'valid-512x256.mp4', name: nameA1, visibility: 'public' },
    { file: 'valid-opus-audio-512x256.mp4', name: nameA2, visibility: 'public' },
  ]);
  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [{ file: 'valid-silent-1024x512.mp4', name: nameOwn, visibility: 'private' }]);

  // Zoekterm en sortering instellen, dan op de pil van A klikken.
  const cards = pageB.locator('[data-test="video"]').filter({ hasText: token });
  await pageB.locator('[data-test="search"]').fill(token);
  await pageB.locator('[data-test="sort"]').selectOption('name-asc');
  await expect(cards).toHaveCount(3);
  await card(pageB, nameA1).locator('[data-test="owner"]').click();

  // Alleen A's video's, met het label naast het zoekveld; het videovenster is niet geopend.
  await expect(pageB.locator('[data-test="owner-filter"]')).toContainText(`Organisatie: ${nameOrgA}`);
  await expect(cards).toHaveCount(2);
  await expect(card(pageB, nameOwn)).toHaveCount(0);
  await expect(pageB.getByRole('dialog')).toHaveCount(0);

  // Label wegklikken: de eigen video is terug, zoekterm en sortering staan er nog.
  await pageB.locator('[data-test="owner-filter"]').click();
  await expect(pageB.locator('[data-test="owner-filter"]')).toHaveCount(0);
  await expect(cards).toHaveCount(3);
  await expect(pageB.locator('[data-test="search"]')).toHaveValue(token);
  await expect(pageB.locator('[data-test="sort"]')).toHaveValue('name-asc');
});

test('scenario 22: de pil in het videovenster filtert de bibliotheek op die organisatie', async ({ browser }) => {
  // A. Een video van B openen en in het videovenster op de pil klikken. Het venster sluit en de bibliotheek
  // is gefilterd op B met het label "Organisatie: ... ✕".
  test.setTimeout(90_000);
  const run = Date.now();
  const nameOrgA = uniqueName('E2E-003-SC22-A');
  const orgA = await t.organisation({ name: nameOrgA });
  const orgB = await t.organisation({ name: uniqueName('E2E-003-SC22-B') });
  const token = `SC22-003 ${run}`;
  const nameA = `${token} a`;
  const nameOwn = `${token} eigen`;

  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [{ file: 'valid-512x256.mp4', name: nameA, visibility: 'public' }]);
  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [{ file: 'valid-silent-1024x512.mp4', name: nameOwn, visibility: 'private' }]);

  // De video van A openen en in het venster op de pil van A klikken.
  await card(pageB, nameA).getByRole('button', { name: `${nameA} openen` }).click();
  const dialog = pageB.getByRole('dialog');
  await dialog.locator('[data-test="owner"]').click();

  // Het venster sluit en de bibliotheek is gefilterd op A: de eigen video is weg.
  await expect(dialog).toHaveCount(0);
  await expect(pageB.locator('[data-test="owner-filter"]')).toContainText(`Organisatie: ${nameOrgA}`);
  await expect(card(pageB, nameA)).toBeVisible();
  await expect(card(pageB, nameOwn)).toHaveCount(0);
});
