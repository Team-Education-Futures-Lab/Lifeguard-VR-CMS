import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { card, openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';
import { createCompleteCourse, draftSteps, openCourse, publishCourse, saveCourse } from '../../helpers/course.js';

// Scenario 12, 13 en 14: de eigenaar verwijdert een video die in de live versie van een cursus zit.
// Elke test zet die situatie zelf klaar (setupDeletedVideo), zodat hij los kan draaien.
// Bron: docs/e2e plans/e2e-plan-spec-006.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

const LOST = 'Video niet meer beschikbaar: kies een andere.';

/**
 * B uploadt een algemene video; A zet die in het blok van antwoord A van een complete cursus en publiceert (via de
 * API); B verwijdert zijn video. Geeft de pagina van A terug, met de cursus open.
 */
async function setupDeletedVideo(browser, tag) {
  const a = await createCompleteCourse(t, browser, tag);
  const orgB = await t.organisation({ name: uniqueName(`E2E-006-SC${tag}-B`) });
  const videoName = uniqueName(`SC${tag}-006 van B`);
  const pageB = await openLibraryAs(t, browser, orgB);
  await uploadVideos(pageB, [{ file: 'valid-silent-1024x512.mp4', name: videoName, visibility: 'public' }]);

  const { videos } = await (await a.api.get('/api/organisation/videos')).json();
  const videoOfB = videos.find((v) => v.name === videoName).id;
  const stepA = a.course.steps.find((s) => s.stepType === 'question').answers[0].nextStepId;
  let doc = await saveCourse(a.api, a.course, draftSteps(a.course).map((s) => (s.id === stepA ? { ...s, videoId: videoOfB } : s)));
  doc = await publishCourse(a.api, doc.id);

  await card(pageB, videoName).getByRole('button', { name: 'Verwijderen' }).click();
  await pageB.getByRole('alertdialog').getByRole('button', { name: 'Verwijderen' }).click();
  await expect(card(pageB, videoName)).toHaveCount(0);

  await openCourse(a.page, doc.id, { view: 'Canvas + paneel' });
  return { ...a, doc, videoName };
}

test('scenario 12: wijzigen en publiceren lukt, zonder melding over de verwijderde video', async ({ browser }) => {
  // A. Na setupDeletedVideo: A wijzigt de cursus (vraagtekst), slaat op en publiceert: "Gepubliceerd als versie 2";
  // in "nog te doen" geen melding over die video ("Cursus is compleet").
  test.setTimeout(120_000);
  const { page, doc } = await setupDeletedVideo(browser, '12');
  const q = doc.steps.find((s) => s.stepType === 'question');
  const save = page.locator('[data-test="save"]');

  await page.locator(`.vue-flow__node[data-id="s${q.id}"] [data-test="block"]`).click();
  await page.getByRole('complementary').locator('[data-test="question"]').fill('Wat doe je nu?');
  await save.click();
  await expect(save).toHaveText('Opgeslagen');
  await expect(page.getByText('Cursus is compleet')).toBeVisible();
  await expect(page.getByText(LOST)).toHaveCount(0);

  await page.locator('[data-test="publish-menu"]').click();
  await page.locator('[data-test="publish"]').click();
  await page.getByRole('alertdialog', { name: 'Wijzigingen publiceren?' }).getByRole('button', { name: 'Wijzigingen publiceren' }).click();
  await expect(page.getByText('Gepubliceerd als versie 2')).toBeVisible();
});

test('scenario 13: bij onpubliceren noemt de bevestiging de onbeschikbare video', async ({ browser }) => {
  // A. Na setupDeletedVideo: [data-test="unpublish"]: de bevestiging bevat "Let op: een video in deze cursus is niet
  // meer beschikbaar."; na bevestigen "Concept".
  test.setTimeout(120_000);
  const { page } = await setupDeletedVideo(browser, '13');

  await page.locator('[data-test="publish-menu"]').click();
  await page.locator('[data-test="unpublish"]').click();
  const confirm = page.getByRole('alertdialog', { name: 'Cursus onpubliceren?' });
  await expect(confirm).toContainText('Let op: een video in deze cursus is niet meer beschikbaar.');
  await confirm.getByRole('button', { name: 'Onpubliceren' }).click();

  await expect(page.locator('[data-test="publication-status"]')).toHaveText('Concept');
});

test('scenario 14: opnieuw publiceren vraagt om een andere video', async ({ browser }) => {
  // A. Na setupDeletedVideo en onpubliceren (via de API): "Publiceren": "Nog niet klaar om te publiceren" met
  // "Video niet meer beschikbaar: kies een andere."; dezelfde melding in "nog te doen".
  test.setTimeout(120_000);
  const { api, page, doc } = await setupDeletedVideo(browser, '14');
  const res = await api.post(`/api/organisation/courses/${doc.id}/unpublish`);
  expect(res.status()).toBe(200);
  await openCourse(page, doc.id, { view: 'Canvas + paneel' });

  await page.locator('[data-test="publish-menu"]').click();
  await page.locator('[data-test="publish"]').click();
  const dialog = page.getByRole('alertdialog', { name: 'Nog niet klaar om te publiceren' });
  await expect(dialog).toContainText(LOST);
  await dialog.getByRole('button', { name: 'Sluiten' }).click();

  await page.getByRole('button', { name: /nog te doen/ }).click();
  await expect(page.getByRole('button', { name: new RegExp(LOST.replace(/[.:]/g, '.')) }).first()).toBeVisible();
});
