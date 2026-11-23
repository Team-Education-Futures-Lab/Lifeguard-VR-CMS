import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { card, openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';
import { createCourse, openCourse, openStep } from '../../helpers/course.js';

// Scenario 14, 14a t/m 14e en 23: een video die onbeschikbaar wordt terwijl een cursus hem gebruikt.
// 14a t/m 14e zijn scenario 18, 19, 20, 21 en 21a uit de quickstart. Elke test zet de situatie van 14 zelf
// klaar (setupUnavailableVideo), zodat hij los kan draaien.
// Bron: docs/e2e plans/e2e-plan-spec-004.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

const LOST = 'Deze video is niet meer beschikbaar en kan niet worden teruggezet.';

/**
 * De situatie van scenario 14: B maakt een video "Selectief" voor A, A kiest hem in een videoblok en slaat op,
 * B zet hem op "Alleen eigen organisatie". Met `deleteVideo` (scenario 23) is de video van B "Algemeen" en
 * verwijdert B hem. A heeft ook een eigen video (om in de kiezer te zien en om te kiezen in 14b en 14e).
 * Geeft de pagina van A terug, met de cursus open; het tweede videoblok is nog leeg ("Kies een video").
 */
async function setupUnavailableVideo(browser, { deleteVideo = false } = {}) {
  const nameA = uniqueName('E2E-004-SC14-A');
  const orgA = await t.organisation({ name: nameA });
  const orgB = await t.organisation({ name: uniqueName('E2E-004-SC14-B') });
  const videoName = uniqueName('SC14-004 van B');
  const ownVideoName = uniqueName('SC14-004 eigen van A');

  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [
    deleteVideo
      ? { file: 'valid-512x256.mp4', name: videoName, visibility: 'public' }
      : { file: 'valid-512x256.mp4', name: videoName, visibility: 'selective', organisation: nameA },
  ]);
  const page = await openLibraryAs(t, browser, orgA);
  await uploadVideos(page, [{ file: 'valid-opus-audio-512x256.mp4', name: ownVideoName, visibility: 'private' }]);

  // A kiest de video van B in het eerste videoblok en slaat op.
  const course = await createCourse(await t.login(orgA.loginCode), { name: uniqueName('SC14-004 cursus') });
  await openCourse(page, course.id);
  const dialog = await openStep(page, 'Kies een video');
  await dialog.locator('[data-test="video-option"]').filter({ hasText: videoName }).click();
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  await page.locator('[data-test="save"]').click();
  await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');

  // B maakt de video onbeschikbaar voor A.
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

  await openCourse(page, course.id);
  return { page, course, videoName, ownVideoName };
}

/** Controles van scenario 14 en 23: A ziet de video nog in de cursus, maar niet meer in /videos of de kiezer. */
async function expectStillInCourseOnly(page, { course, videoName, ownVideoName }) {
  const block = page.locator('[data-test="block"]').filter({ hasText: videoName });
  await expect(block).toHaveCount(1);
  await expect(block).toContainText(/\d+:\d{2}/); // de duur

  const dialog = await openStep(page, 'Kies een video');
  const option = (name) => dialog.locator('[data-test="video-option"]').filter({ hasText: name });
  await expect(option(ownVideoName)).toBeVisible();
  await expect(option(videoName)).toHaveCount(0);

  await page.goto('/videos');
  await expect(card(page, ownVideoName)).toBeVisible();
  await expect(card(page, videoName)).toHaveCount(0);
  await openCourse(page, course.id);
}

test('scenario 14: A ziet een video die onbeschikbaar is geworden nog in de cursus', async ({ browser }) => {
  // A. Na setupUnavailableVideo: het blok toont nog naam en duur; opslaan lukt. In /videos en in de kiezer
  // ([data-test="video-option"]) staat de video niet meer.
  test.setTimeout(150_000);
  const s = await setupUnavailableVideo(browser);
  const { page, videoName } = s;

  await expectStillInCourseOnly(page, s);

  // Opslaan lukt (een wijziging nodig, anders staat de knop al op "Opgeslagen"); de video blijft staan.
  await page.getByRole('button', { name: 'Vraag', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click(); // een nieuw onderdeel opent meteen zijn venster
  await page.locator('[data-test="save"]').click();
  await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');
  await page.reload();
  await expect(page.locator('[data-test="block"]').filter({ hasText: videoName })).toHaveCount(1);
});

test('scenario 14a: het onderdeel verwijderen geeft een waarschuwing', async ({ browser }) => {
  // A. [data-test="remove-step"]: alertdialog "Video niet meer beschikbaar"; "Annuleren": het onderdeel blijft.
  test.setTimeout(150_000);
  const { page, videoName } = await setupUnavailableVideo(browser);
  const blocks = page.locator('[data-test="block"]');

  const dialog = await openStep(page, videoName);
  await dialog.locator('[data-test="remove-step"]').click();
  const warning = page.getByRole('alertdialog');
  await expect(warning).toContainText('Video niet meer beschikbaar');
  await warning.getByRole('button', { name: 'Annuleren' }).click();

  await expect(warning).toBeHidden();
  await expect(blocks).toHaveCount(3);
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(1);
});

test('scenario 14b: "Wijzig" en "Video weghalen" geven een waarschuwing', async ({ browser }) => {
  // A. "Wijzig" (een andere video kiezen) en apart [data-test="remove-video"]: beide eerst dezelfde waarschuwing.
  // "Annuleren" laat de video staan; "Doorgaan" voert het uit. Doorgaan bij "Wijzig" zit in 14e.
  test.setTimeout(150_000);
  const { page, videoName, ownVideoName } = await setupUnavailableVideo(browser);
  const warning = page.getByRole('alertdialog');

  // Wijzig: de kiezer opent zonder waarschuwing; een andere video kiezen geeft de waarschuwing. Annuleren.
  const dialog = await openStep(page, videoName);
  await dialog.getByRole('button', { name: 'Wijzig', exact: true }).click();
  await expect(warning).toHaveCount(0);
  await dialog.locator('[data-test="video-option"]').filter({ hasText: ownVideoName }).click();
  await expect(warning).toContainText('Video niet meer beschikbaar');
  await warning.getByRole('button', { name: 'Annuleren' }).click();
  await expect(warning).toBeHidden();
  await expect(dialog).toContainText(videoName);

  // Video weghalen: dezelfde waarschuwing. Annuleren: de video blijft.
  await dialog.locator('[data-test="remove-video"]').click();
  await expect(warning).toContainText('Video niet meer beschikbaar');
  await warning.getByRole('button', { name: 'Annuleren' }).click();
  await expect(warning).toBeHidden();
  await expect(dialog).toContainText(videoName);

  // Video weghalen met Doorgaan: het onderdeel blijft, zonder video.
  await dialog.locator('[data-test="remove-video"]').click();
  await warning.getByRole('button', { name: 'Doorgaan' }).click();
  await expect(dialog).not.toContainText(videoName);
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  const blocks = page.locator('[data-test="block"]');
  await expect(blocks).toHaveCount(3);
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(0);
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(2);
});

test('scenario 14c: na verwijderen met Doorgaan zet Ctrl+Z het onderdeel met video terug', async ({ browser }) => {
  // A. Verwijderen met "Doorgaan", Ctrl+Z: onderdeel en video zijn terug; opslaan lukt.
  test.setTimeout(150_000);
  const { page, videoName } = await setupUnavailableVideo(browser);
  const blocks = page.locator('[data-test="block"]');
  const save = page.locator('[data-test="save"]');

  const dialog = await openStep(page, videoName);
  await dialog.locator('[data-test="remove-step"]').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Doorgaan' }).click();
  await expect(blocks).toHaveCount(2);

  await page.keyboard.press('Control+z');
  await expect(blocks).toHaveCount(3);
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(1);

  // Opslaan lukt. De knop kan al op "Opgeslagen" staan (niets gewijzigd ten opzichte van de opslag); voeg iets
  // toe zodat er echt een opslag is, en controleer na herladen dat de video er nog staat.
  await page.getByRole('button', { name: 'Vraag', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click(); // een nieuw onderdeel opent meteen zijn venster
  await save.click();
  await expect(save).toHaveText('Opgeslagen');
  await page.reload();
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(1);
});

test('scenario 14d: na opslaan komt het onderdeel terug zonder video', async ({ browser }) => {
  // A. Verwijderen met "Doorgaan", opslaan, Ctrl+Z: het blok is terug zonder video, met de melding
  // "Deze video is niet meer beschikbaar en kan niet worden teruggezet." Opslaan lukt; na herladen is het een
  // video-onderdeel zonder video.
  test.setTimeout(150_000);
  const { page, videoName } = await setupUnavailableVideo(browser);
  const blocks = page.locator('[data-test="block"]');
  const save = page.locator('[data-test="save"]');

  const dialog = await openStep(page, videoName);
  await dialog.locator('[data-test="remove-step"]').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Doorgaan' }).click();
  await expect(blocks).toHaveCount(2);
  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  await page.keyboard.press('Control+z');
  await expect(blocks).toHaveCount(3);
  const restored = blocks.filter({ hasText: LOST }); // op het blok staat de melding zonder data-test
  await expect(restored).toHaveCount(1);
  await expect(restored).toContainText('Kies een video');
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(0);

  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  await page.reload();
  await expect(blocks).toHaveCount(3);
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(2);
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(0);
});

test('scenario 14e: na een andere video kiezen, opslaan, Ctrl+Z en Ctrl+Y', async ({ browser }) => {
  // A. "Wijzig", een andere (eigen) video kiezen, "Doorgaan", opslaan. Ctrl+Z: het blok staat op dezelfde plek
  // zonder video, met de melding. Ctrl+Y: de gekozen video staat er weer.
  test.setTimeout(150_000);
  const { page, videoName, ownVideoName } = await setupUnavailableVideo(browser);
  const blocks = page.locator('[data-test="block"]');
  const save = page.locator('[data-test="save"]');
  // De plek op het canvas: de transform van het Vue Flow-blok. Pixels op het scherm hangen af van zoom en verschuiving.
  const canvasPosition = (block) =>
    block.locator('xpath=ancestor::*[contains(@class, "vue-flow__node")][1]').evaluate((el) => el.style.transform);
  const before = await canvasPosition(blocks.filter({ hasText: videoName }));

  const dialog = await openStep(page, videoName);
  await dialog.getByRole('button', { name: 'Wijzig', exact: true }).click();
  await dialog.locator('[data-test="video-option"]').filter({ hasText: ownVideoName }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Doorgaan' }).click();
  await expect(dialog).toContainText(ownVideoName);
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  // Ctrl+Z: zelfde plek, zonder video, met de melding.
  await page.keyboard.press('Control+z');
  const restored = blocks.filter({ hasText: LOST }); // op het blok staat de melding zonder data-test
  await expect(restored).toHaveCount(1);
  await expect(blocks.filter({ hasText: ownVideoName })).toHaveCount(0);
  await expect(blocks.filter({ hasText: videoName })).toHaveCount(0);
  expect(before).toMatch(/translate/);
  expect(await canvasPosition(restored)).toBe(before);

  // Ctrl+Y: de gekozen video staat er weer, de melding is weg.
  await page.keyboard.press('Control+y');
  await expect(blocks.filter({ hasText: ownVideoName })).toHaveCount(1);
  await expect(page.getByText(LOST)).toHaveCount(0);
});

test('scenario 23: B verwijdert een algemene video die A gebruikt', async ({ browser }) => {
  // A. Zoals 14, maar B uploadt de video "Algemeen" en verwijdert hem (zacht) nadat A hem heeft gekozen en opgeslagen.
  // A ziet in de cursus nog naam en duur; in /videos en in de kiezer staat hij niet meer.
  test.setTimeout(150_000);
  const s = await setupUnavailableVideo(browser, { deleteVideo: true });

  await expectStillInCourseOnly(s.page, s);
});
