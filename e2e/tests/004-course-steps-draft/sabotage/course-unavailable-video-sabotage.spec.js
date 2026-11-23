import { test, expect } from '@playwright/test';
import { uniqueName } from '../../../helpers/admin.js';
import { createTracker } from '../../../helpers/org-api.js';
import { card, openLibraryAs, uploadVideos } from '../../../helpers/video-upload.js';
import { createCourse, openCourse, openStep } from '../../../helpers/course.js';

// Sabotage van course-unavailable-video.spec.js. ELKE TEST HOORT TE FALEN, op de regel die bij "faalt op" staat.
// Elke functie is een kopie van de originele test; `sab` zet precies één fout aan. Het origineel blijft ongewijzigd.
// Sabotage "beschikbaar" geldt voor elke test: B laat de video beschikbaar, dus er is geen onbeschikbare video.
// Time-out 60 s in plaats van 150 s: een gesaboteerde test wacht soms op een knop die nooit komt.

const t = createTracker();
test.afterEach(() => t.cleanup());
test.beforeEach(() => test.setTimeout(60_000));

const LOST = 'Deze video is niet meer beschikbaar en kan niet worden teruggezet.';

/** Kopie van setupUnavailableVideo. Met sab 'beschikbaar' slaat B de laatste stap over. */
async function setupUnavailableVideo(browser, sab, { deleteVideo = false } = {}) {
  const nameA = uniqueName('E2E-004-SAB14-A');
  const orgA = await t.organisation({ name: nameA });
  const orgB = await t.organisation({ name: uniqueName('E2E-004-SAB14-B') });
  const videoName = uniqueName('SAB14-004 van B');
  const ownVideoName = uniqueName('SAB14-004 eigen van A');

  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [
    deleteVideo
      ? { file: 'valid-512x256.mp4', name: videoName, visibility: 'public' }
      : { file: 'valid-512x256.mp4', name: videoName, visibility: 'selective', organisation: nameA },
  ]);
  const page = await openLibraryAs(t, browser, orgA);
  await uploadVideos(page, [{ file: 'valid-opus-audio-512x256.mp4', name: ownVideoName, visibility: 'private' }]);

  const course = await createCourse(await t.login(orgA.loginCode), { name: uniqueName('SAB14-004 cursus') });
  await openCourse(page, course.id);
  const dialog = await openStep(page, 'Kies een video');
  await dialog.locator('[data-test="video-option"]').filter({ hasText: videoName }).click();
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  await page.locator('[data-test="save"]').click();
  await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');

  if (sab !== 'beschikbaar') {
    const confirmB = pageB.getByRole('alertdialog');
    if (deleteVideo) {
      await card(pageB, videoName).getByRole('button', { name: 'Verwijderen' }).click();
      await confirmB.getByRole('button', { name: 'Verwijderen' }).click();
      await expect(card(pageB, videoName)).toHaveCount(0);
    } else {
      await card(pageB, videoName).getByRole('button', { name: `${videoName} openen` }).click();
      const dialogB = pageB.getByRole('dialog');
      await dialogB.getByRole('button', { name: 'Wijzigen' }).click();
      await dialogB.locator('[data-test="visibility-private"]').check();
      await dialogB.getByRole('button', { name: 'Opslaan' }).click();
      await confirmB.getByRole('button', { name: 'Wijzigen' }).click();
      await expect(confirmB).toBeHidden();
      await expect(dialogB.locator('[data-test="view"]')).toBeVisible();
    }
  }

  await openCourse(page, course.id);
  return { page, course, videoName, ownVideoName };
}

/** Kopie van expectStillInCourseOnly. */
async function expectStillInCourseOnly(page, { course, videoName, ownVideoName }) {
  const block = page.locator('[data-test="block"]').filter({ hasText: videoName });
  await expect(block).toHaveCount(1);
  await expect(block).toContainText(/\d+:\d{2}/);

  const dialog = await openStep(page, 'Kies een video');
  const option = (name) => dialog.locator('[data-test="video-option"]').filter({ hasText: name });
  await expect(option(ownVideoName)).toBeVisible();
  await expect(option(videoName)).toHaveCount(0);

  await page.goto('/videos');
  await expect(card(page, ownVideoName)).toBeVisible();
  await expect(card(page, videoName)).toHaveCount(0);
  await openCourse(page, course.id);
}

async function scenario14(browser, sab) {
  const s = await setupUnavailableVideo(browser, sab);
  const { page, videoName } = s;
  if (sab === 'video-weg') {
    const dialog = await openStep(page, videoName);
    await dialog.locator('[data-test="remove-video"]').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Doorgaan' }).click();
    await dialog.getByRole('button', { name: 'Klaar' }).click();
  }

  await expectStillInCourseOnly(page, s);

  await page.getByRole('button', { name: 'Vraag', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click();
  await page.locator('[data-test="save"]').click();
  await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');
  await page.reload();
  await expect(page.locator('[data-test="block"]').filter({ hasText: videoName })).toHaveCount(1);
}

async function scenario14a(browser, sab) {
  const { page, videoName } = await setupUnavailableVideo(browser, sab);
  const blocks = page.locator('[data-test="block"]');

  const dialog = await openStep(page, videoName);
  await dialog.locator('[data-test="remove-step"]').click();
  const warning = page.getByRole('alertdialog');
  await expect(warning).toContainText('Video niet meer beschikbaar');
  await warning.getByRole('button', { name: sab === 'doorgaan' ? 'Doorgaan' : 'Annuleren' }).click();

  await expect(warning).toBeHidden();
  await expect(blocks).toHaveCount(3);
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(1);
}

async function scenario14b(browser, sab) {
  const { page, videoName, ownVideoName } = await setupUnavailableVideo(browser, sab);
  const warning = page.getByRole('alertdialog');

  const dialog = await openStep(page, videoName);
  await dialog.getByRole('button', { name: 'Wijzig', exact: true }).click();
  await expect(warning).toHaveCount(0);
  await dialog.locator('[data-test="video-option"]').filter({ hasText: ownVideoName }).click();
  await expect(warning).toContainText('Video niet meer beschikbaar');
  await warning.getByRole('button', { name: sab === 'wijzig-doorgaan' ? 'Doorgaan' : 'Annuleren' }).click();
  await expect(warning).toBeHidden();
  await expect(dialog).toContainText(videoName);

  await dialog.locator('[data-test="remove-video"]').click();
  await expect(warning).toContainText('Video niet meer beschikbaar');
  await warning.getByRole('button', { name: 'Annuleren' }).click();
  await expect(warning).toBeHidden();
  await expect(dialog).toContainText(videoName);

  await dialog.locator('[data-test="remove-video"]').click();
  await warning.getByRole('button', { name: sab === 'weghalen-annuleren' ? 'Annuleren' : 'Doorgaan' }).click();
  await expect(dialog).not.toContainText(videoName);
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  const blocks = page.locator('[data-test="block"]');
  await expect(blocks).toHaveCount(3);
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(0);
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(2);
}

async function scenario14c(browser, sab) {
  const { page, videoName } = await setupUnavailableVideo(browser, sab);
  const blocks = page.locator('[data-test="block"]');
  const save = page.locator('[data-test="save"]');

  const dialog = await openStep(page, videoName);
  await dialog.locator('[data-test="remove-step"]').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Doorgaan' }).click();
  await expect(blocks).toHaveCount(2);

  if (sab !== 'geen-ctrl-z') await page.keyboard.press('Control+z');
  await expect(blocks).toHaveCount(3);
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(1);

  await page.getByRole('button', { name: 'Vraag', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click();
  await save.click();
  await expect(save).toHaveText('Opgeslagen');
  await page.reload();
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(1);
}

async function scenario14d(browser, sab) {
  const { page, videoName } = await setupUnavailableVideo(browser, sab);
  const blocks = page.locator('[data-test="block"]');
  const save = page.locator('[data-test="save"]');

  const dialog = await openStep(page, videoName);
  await dialog.locator('[data-test="remove-step"]').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Doorgaan' }).click();
  await expect(blocks).toHaveCount(2);
  if (sab !== 'niet-opgeslagen') {
    await save.click();
    await expect(save).toHaveText('Opgeslagen');
  }

  await page.keyboard.press('Control+z');
  await expect(blocks).toHaveCount(3);
  const restored = blocks.filter({ hasText: LOST });
  await expect(restored).toHaveCount(1);
  await expect(restored).toContainText('Kies een video');
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(0);

  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  await page.reload();
  await expect(blocks).toHaveCount(3);
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(2);
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(0);
}

async function scenario14e(browser, sab) {
  const { page, videoName, ownVideoName } = await setupUnavailableVideo(browser, sab);
  const blocks = page.locator('[data-test="block"]');
  const save = page.locator('[data-test="save"]');
  const canvasPosition = (block) =>
    block.locator('xpath=ancestor::*[contains(@class, "vue-flow__node")][1]').evaluate((el) => el.style.transform);
  const measured = sab === 'ander-blok' ? blocks.filter({ hasText: 'Kies een video' }) : blocks.filter({ hasText: videoName });
  const before = await canvasPosition(measured);

  const dialog = await openStep(page, videoName);
  await dialog.getByRole('button', { name: 'Wijzig', exact: true }).click();
  await dialog.locator('[data-test="video-option"]').filter({ hasText: ownVideoName }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Doorgaan' }).click();
  await expect(dialog).toContainText(ownVideoName);
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  if (sab !== 'geen-ctrl-z') await page.keyboard.press('Control+z');
  const restored = blocks.filter({ hasText: LOST });
  await expect(restored).toHaveCount(1);
  await expect(blocks.filter({ hasText: ownVideoName })).toHaveCount(0);
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(0);
  expect(before).toMatch(/translate/);
  expect(await canvasPosition(restored)).toBe(before);

  if (sab !== 'geen-ctrl-y') await page.keyboard.press('Control+y');
  await expect(blocks.filter({ hasText: ownVideoName })).toHaveCount(1);
  await expect(page.getByText(LOST)).toHaveCount(0);
}

async function scenario23(browser, sab) {
  const s = await setupUnavailableVideo(browser, sab, { deleteVideo: true });

  await expectStillInCourseOnly(s.page, s);
}

// faalt op: option(videoName) toHaveCount(0) in de kiezer
test('S14-1 B laat de video beschikbaar', ({ browser }) => scenario14(browser, 'beschikbaar'));
// faalt op: blok met de naam toHaveCount(1) (eerste regel van expectStillInCourseOnly)
test('S14-2 A haalt de video uit het blok', ({ browser }) => scenario14(browser, 'video-weg'));

// faalt op: waarschuwing "Video niet meer beschikbaar"
test('S14a-1 B laat de video beschikbaar: geen waarschuwing', ({ browser }) => scenario14a(browser, 'beschikbaar'));
// faalt op: blocks toHaveCount(3)
test('S14a-2 Doorgaan in plaats van Annuleren', ({ browser }) => scenario14a(browser, 'doorgaan'));

// faalt op: waarschuwing na het kiezen van de eigen video
test('S14b-1 B laat de video beschikbaar: geen waarschuwing', ({ browser }) => scenario14b(browser, 'beschikbaar'));
// faalt op: dialog toContainText(videoName) na de eerste waarschuwing
test('S14b-2 Doorgaan bij Wijzig in plaats van Annuleren', ({ browser }) => scenario14b(browser, 'wijzig-doorgaan'));
// faalt op: dialog not.toContainText(videoName) na de laatste waarschuwing
test('S14b-3 Annuleren bij Video weghalen in plaats van Doorgaan', ({ browser }) => scenario14b(browser, 'weghalen-annuleren'));

// faalt op: knop Doorgaan (time-out; zonder waarschuwing is er geen Doorgaan)
test('S14c-1 B laat de video beschikbaar', ({ browser }) => scenario14c(browser, 'beschikbaar'));
// faalt op: blocks toHaveCount(3) na Ctrl+Z
test('S14c-2 geen Ctrl+Z', ({ browser }) => scenario14c(browser, 'geen-ctrl-z'));

// faalt op: knop Doorgaan (time-out)
test('S14d-1 B laat de video beschikbaar', ({ browser }) => scenario14d(browser, 'beschikbaar'));
// faalt op: restored (blok met de melding) toHaveCount(1): zonder opslag komt de video gewoon terug
test('S14d-2 niet opgeslagen voor Ctrl+Z', ({ browser }) => scenario14d(browser, 'niet-opgeslagen'));

// faalt op: knop Doorgaan (time-out)
test('S14e-1 B laat de video beschikbaar', ({ browser }) => scenario14e(browser, 'beschikbaar'));
// faalt op: restored toHaveCount(1)
test('S14e-2 geen Ctrl+Z', ({ browser }) => scenario14e(browser, 'geen-ctrl-z'));
// faalt op: canvasPosition(restored) toBe(before)
test('S14e-3 de plek van een ander blok gemeten', ({ browser }) => scenario14e(browser, 'ander-blok'));
// faalt op: blok met de eigen video toHaveCount(1) na Ctrl+Y
test('S14e-4 geen Ctrl+Y', ({ browser }) => scenario14e(browser, 'geen-ctrl-y'));

// faalt op: option(videoName) toHaveCount(0) in de kiezer
test('S23-1 B verwijdert de video niet', ({ browser }) => scenario23(browser, 'beschikbaar'));
