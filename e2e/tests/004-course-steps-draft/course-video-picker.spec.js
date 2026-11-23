import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';
import { createCourse, openCourse, openStep } from '../../helpers/course.js';

// Scenario 4, 13 en 24: welke video's de kiezer toont, één video in twee cursussen, en zoeken.
// Een video kiezen is één klik op [data-test="video-option"]; het venster sluit met "Klaar".
// Bron: docs/e2e plans/e2e-plan-spec-004.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test("scenario 4: de videokiezer toont alleen beschikbare video's", async ({ browser }) => {
  // A. A met een eigen video; B met "Algemeen", "Selectief" voor A en "Alleen eigen"; C met "Selectief" voor B.
  // Als A een videoblok openen: de eigen video, B-algemeen en B-selectief staan erin; B-eigen en C-selectief niet.
  // Niet "precies drie": algemene video's van tests die tegelijk draaien staan ook in de kiezer.
  test.setTimeout(150_000);
  const nameA = uniqueName('E2E-004-SC4-A');
  const nameB = uniqueName('E2E-004-SC4-B');
  const orgA = await t.organisation({ name: nameA });
  const orgB = await t.organisation({ name: nameB });
  const orgC = await t.organisation({ name: uniqueName('E2E-004-SC4-C') });
  const own = uniqueName('SC4-004 A eigen');
  const bPublic = uniqueName('SC4-004 B algemeen');
  const bSelective = uniqueName('SC4-004 B selectief');
  const bPrivate = uniqueName('SC4-004 B eigen');
  const cSelective = uniqueName('SC4-004 C selectief');

  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [
    { file: 'valid-512x256.mp4', name: bPublic, visibility: 'public' },
    { file: 'valid-opus-audio-512x256.mp4', name: bSelective, visibility: 'selective', organisation: nameA },
    { file: 'valid-silent-1024x512.mp4', name: bPrivate, visibility: 'private' },
  ]);
  const pageC = await openLibraryAs(t, browser, orgC);
  await uploadVideos(pageC, [{ file: 'valid-512x256.mp4', name: cSelective, visibility: 'selective', organisation: nameB }]);
  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [{ file: 'valid-512x256.mp4', name: own, visibility: 'private' }]);

  const course = await createCourse(await t.login(orgA.loginCode), { name: uniqueName('SC4-004 cursus') });
  await openCourse(pageA, course.id);
  const dialog = await openStep(pageA, 'Kies een video');
  const option = (name) => dialog.locator('[data-test="video-option"]').filter({ hasText: name });

  await expect(option(own)).toBeVisible();
  await expect(option(own)).toContainText('Eigen');
  await expect(option(bPublic)).toBeVisible();
  await expect(option(bPublic)).toContainText(nameB);
  await expect(option(bSelective)).toBeVisible();
  await expect(option(bPrivate)).toHaveCount(0);
  await expect(option(cSelective)).toHaveCount(0);
});

test('scenario 13: dezelfde video in twee cursussen', async ({ browser }) => {
  // A. Eén eigen video, twee cursussen via createCourse. In beide een videoblok openen, de video kiezen en opslaan.
  // Na herladen staat de video in beide cursussen.
  test.setTimeout(90_000);
  const org = await t.organisation({ name: uniqueName('E2E-004-SC13') });
  const videoName = uniqueName('SC13-004 gedeeld');
  const api = await t.login(org.loginCode);
  const course1 = await createCourse(api, { name: uniqueName('SC13-004 cursus 1') });
  const course2 = await createCourse(api, { name: uniqueName('SC13-004 cursus 2') });

  const page = await openLibraryAs(t, browser, org);
  await uploadVideos(page, [{ file: 'valid-512x256.mp4', name: videoName, visibility: 'private' }]);

  for (const course of [course1, course2]) {
    await openCourse(page, course.id);
    const dialog = await openStep(page, 'Kies een video');
    await dialog.locator('[data-test="video-option"]').filter({ hasText: videoName }).click();
    await dialog.getByRole('button', { name: 'Klaar' }).click();
    await page.locator('[data-test="save"]').click();
    await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');
  }

  for (const course of [course1, course2]) {
    await openCourse(page, course.id);
    await expect(page.locator('[data-test="block"]').filter({ hasText: videoName })).toHaveCount(1);
  }
});

test('scenario 24: zoeken in de videokiezer (FR-014b)', async ({ browser }) => {
  // A+H. A met drie eigen video's, waarvan één met een lange naam; B met een video "Algemeen".
  // Als A een videoblok openen en typen in [data-test="video-search"]: op een deel van de naam blijft alleen die
  // video-option over; op de naam van organisatie B alleen B's video; op een woord zonder resultaat
  // [data-test="video-search-empty"] met de zoekterm. De gevonden video kiezen en opslaan: na herladen staat hij
  // in het blok. Handmatig: of de lange naam volledig leesbaar is.
  test.setTimeout(150_000);
  const id = Date.now();
  const nameB = uniqueName('E2E-004-SC24-B');
  const orgA = await t.organisation({ name: uniqueName('E2E-004-SC24-A') });
  const orgB = await t.organisation({ name: nameB });
  const rescue = `SC24-004 Reddingsgreep ${id}`;
  const dive = `SC24-004 Duikeling ${id}`;
  const long = `SC24-004 Een hele lange naam voor een video over het redden van een drenkeling in diep water ${id}`;
  const bVideo = `SC24-004 Algemeen van B ${id}`;

  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [{ file: 'valid-512x256.mp4', name: bVideo, visibility: 'public' }]);
  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [
    { file: 'valid-512x256.mp4', name: rescue, visibility: 'private' },
    { file: 'valid-opus-audio-512x256.mp4', name: dive, visibility: 'private' },
    { file: 'valid-silent-1024x512.mp4', name: long, visibility: 'private' },
  ]);

  const course = await createCourse(await t.login(orgA.loginCode), { name: uniqueName('SC24-004 cursus') });
  await openCourse(pageA, course.id);
  const dialog = await openStep(pageA, 'Kies een video');
  const options = dialog.locator('[data-test="video-option"]');
  const search = dialog.locator('[data-test="video-search"]');
  await expect(search).toHaveAttribute('placeholder', 'Zoek op naam of organisatie');

  // Een deel van de naam.
  await search.fill(`Duikeling ${id}`);
  await expect(options).toHaveCount(1);
  await expect(options).toContainText(dive);

  // Een deel van de lange naam.
  await search.fill(`drenkeling in diep water ${id}`);
  await expect(options).toHaveCount(1);
  await expect(options).toContainText(long);

  // De naam van organisatie B: alleen de video van B.
  await search.fill(nameB);
  await expect(options).toHaveCount(1);
  await expect(options).toContainText(bVideo);

  // Geen resultaat: de melding met de zoekterm.
  const nothing = `geenresultaat${id}`;
  await search.fill(nothing);
  await expect(options).toHaveCount(0);
  await expect(dialog.locator('[data-test="video-search-empty"]')).toContainText(nothing);

  // Zoeken, kiezen, opslaan en herladen.
  await search.fill(`Duikeling ${id}`);
  await options.filter({ hasText: dive }).click();
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  await pageA.locator('[data-test="save"]').click();
  await expect(pageA.locator('[data-test="save"]')).toHaveText('Opgeslagen');

  await pageA.reload();
  await expect(pageA.locator('[data-test="block"]').filter({ hasText: dive })).toHaveCount(1);
});
