import { test, expect } from '@playwright/test';
import { uniqueName } from '../../../helpers/admin.js';
import { createTracker } from '../../../helpers/org-api.js';
import { openLibraryAs, uploadVideos } from '../../../helpers/video-upload.js';
import { createCourse, openCourse, openStep } from '../../../helpers/course.js';

// Sabotage van course-video-picker.spec.js. ELKE TEST HOORT TE FALEN, op de regel die bij "faalt op" staat.
// Elke functie is een kopie van de originele test; `sab` zet precies één fout aan. Het origineel blijft ongewijzigd.

const t = createTracker();
test.afterEach(() => t.cleanup());

async function scenario4(browser, sab) {
  test.setTimeout(150_000);
  const nameA = uniqueName('E2E-004-SAB4-A');
  const nameB = uniqueName('E2E-004-SAB4-B');
  const orgA = await t.organisation({ name: nameA });
  const orgB = await t.organisation({ name: nameB });
  const orgC = await t.organisation({ name: uniqueName('E2E-004-SAB4-C') });
  const own = uniqueName('SAB4-004 A eigen');
  const bPublic = uniqueName('SAB4-004 B algemeen');
  const bSelective = uniqueName('SAB4-004 B selectief');
  const bPrivate = uniqueName('SAB4-004 B eigen');
  const cSelective = uniqueName('SAB4-004 C selectief');
  const nameC = orgC.name;

  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [
    { file: 'valid-512x256.mp4', name: bPublic, visibility: 'public' },
    sab === 'selectief-voor-C'
      ? { file: 'valid-opus-audio-512x256.mp4', name: bSelective, visibility: 'selective', organisation: nameC }
      : { file: 'valid-opus-audio-512x256.mp4', name: bSelective, visibility: 'selective', organisation: nameA },
    { file: 'valid-silent-1024x512.mp4', name: bPrivate, visibility: sab === 'eigen-is-algemeen' ? 'public' : 'private' },
  ]);
  const pageC = await openLibraryAs(t, browser, orgC);
  await uploadVideos(pageC, [
    sab === 'c-voor-A'
      ? { file: 'valid-512x256.mp4', name: cSelective, visibility: 'selective', organisation: nameA }
      : { file: 'valid-512x256.mp4', name: cSelective, visibility: 'selective', organisation: nameB },
  ]);
  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [{ file: 'valid-512x256.mp4', name: own, visibility: 'private' }]);

  const course = await createCourse(await t.login(orgA.loginCode), { name: uniqueName('SAB4-004 cursus') });
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
}

async function scenario13(browser, sab) {
  test.setTimeout(90_000);
  const org = await t.organisation({ name: uniqueName('E2E-004-SAB13') });
  const videoName = uniqueName('SAB13-004 gedeeld');
  const api = await t.login(org.loginCode);
  const course1 = await createCourse(api, { name: uniqueName('SAB13-004 cursus 1') });
  const course2 = await createCourse(api, { name: uniqueName('SAB13-004 cursus 2') });

  const page = await openLibraryAs(t, browser, org);
  await uploadVideos(page, [{ file: 'valid-512x256.mp4', name: videoName, visibility: 'private' }]);

  const chooseIn = sab === 'alleen-cursus-1' ? [course1] : [course1, course2];
  for (const course of chooseIn) {
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
}

async function scenario24(browser, sab) {
  test.setTimeout(150_000);
  const id = Date.now();
  const nameB = uniqueName('E2E-004-SAB24-B');
  const orgA = await t.organisation({ name: uniqueName('E2E-004-SAB24-A') });
  const orgB = await t.organisation({ name: nameB });
  const rescue = `SAB24-004 Reddingsgreep ${id}`;
  const dive = `SAB24-004 Duikeling ${id}`;
  const long = `SAB24-004 Een hele lange naam voor een video over het redden van een drenkeling in diep water ${id}`;
  const bVideo = `SAB24-004 Algemeen van B ${id}`;

  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [{ file: 'valid-512x256.mp4', name: bVideo, visibility: sab === 'b-eigen' ? 'private' : 'public' }]);
  const pageA = await openLibraryAs(t, browser, orgA);
  await uploadVideos(pageA, [
    { file: 'valid-512x256.mp4', name: rescue, visibility: 'private' },
    { file: 'valid-opus-audio-512x256.mp4', name: dive, visibility: 'private' },
    { file: 'valid-silent-1024x512.mp4', name: long, visibility: 'private' },
  ]);

  const course = await createCourse(await t.login(orgA.loginCode), { name: uniqueName('SAB24-004 cursus') });
  await openCourse(pageA, course.id);
  const dialog = await openStep(pageA, 'Kies een video');
  const options = dialog.locator('[data-test="video-option"]');
  const search = dialog.locator('[data-test="video-search"]');
  await expect(search).toHaveAttribute('placeholder', 'Zoek op naam of organisatie');

  await search.fill(sab === 'te-breed' ? `SAB24-004` : `Duikeling ${id}`);
  await expect(options).toHaveCount(1);
  await expect(options).toContainText(dive);

  await search.fill(`drenkeling in diep water ${id}`);
  await expect(options).toHaveCount(1);
  await expect(options).toContainText(long);

  await search.fill(nameB);
  await expect(options).toHaveCount(1);
  await expect(options).toContainText(bVideo);

  const nothing = sab === 'wel-resultaat' ? `Reddingsgreep ${id}` : `geenresultaat${id}`;
  await search.fill(nothing);
  await expect(options).toHaveCount(0);
  await expect(dialog.locator('[data-test="video-search-empty"]')).toContainText(nothing);

  await search.fill(sab === 'andere-gekozen' ? `Reddingsgreep ${id}` : `Duikeling ${id}`);
  await options.filter({ hasText: sab === 'andere-gekozen' ? rescue : dive }).click();
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  await pageA.locator('[data-test="save"]').click();
  await expect(pageA.locator('[data-test="save"]')).toHaveText('Opgeslagen');

  await pageA.reload();
  await expect(pageA.locator('[data-test="block"]').filter({ hasText: dive })).toHaveCount(1);
}

// faalt op: option(bPrivate) toHaveCount(0)
test('S4-1 de video "Alleen eigen" van B is toch algemeen', ({ browser }) => scenario4(browser, 'eigen-is-algemeen'));
// faalt op: option(cSelective) toHaveCount(0)
test('S4-2 C deelt zijn video met A in plaats van B', ({ browser }) => scenario4(browser, 'c-voor-A'));
// faalt op: option(bSelective) toBeVisible
test('S4-3 B deelt zijn selectieve video met C in plaats van A', ({ browser }) => scenario4(browser, 'selectief-voor-C'));

// faalt op: blok met de video toHaveCount(1) in cursus 2
test('S13-1 de video alleen in cursus 1 gekozen', ({ browser }) => scenario13(browser, 'alleen-cursus-1'));

// faalt op: options toHaveCount(1) bij de eerste zoekterm
test('S24-1 zoekterm past op alle drie de video\'s', ({ browser }) => scenario24(browser, 'te-breed'));
// faalt op: options toHaveCount(1) bij de naam van B
test('S24-2 de video van B is niet algemeen', ({ browser }) => scenario24(browser, 'b-eigen'));
// faalt op: options toHaveCount(0) bij de zoekterm zonder resultaat
test('S24-3 de zoekterm zonder resultaat geeft wel resultaat', ({ browser }) => scenario24(browser, 'wel-resultaat'));
// faalt op: blok met Duikeling toHaveCount(1) na herladen
test('S24-4 een andere video gekozen', ({ browser }) => scenario24(browser, 'andere-gekozen'));
