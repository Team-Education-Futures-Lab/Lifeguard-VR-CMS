import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse, createCourse, draftSteps, openCourse, publishCourse, saveCourse } from '../../helpers/course.js';

// SC-007: de status van elke cursus in het overzicht, in elke toestand (tasks.md T054).
// Bron: docs/e2e plans/e2e-plan-spec-006.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

const versionLine = (n) => new RegExp(`Versie ${n} · \\d{1,2} \\S+ \\d{4} om \\d{2}:\\d{2}`);

test('SC-007: de status in het overzicht in elke toestand', async ({ browser }) => {
  // A. Zes cursussen via de API: nooit gepubliceerd, gepubliceerd, gewijzigd na publiceren, alleen canvas verschoven,
  // onpubliceerd, opnieuw gepubliceerd. In /courses per regel [data-test="publication-status"] met de juiste
  // data-status, de tekst uit contracts/ui.md en waar van toepassing versie en datum. In de editor dezelfde status.
  test.setTimeout(120_000);
  const { api, page, course: neverPublished } = await createCompleteCourse(t, browser, '007');
  const videoIds = neverPublished.steps.filter((s) => s.stepType === 'video').map((s) => s.videoId);
  const complete = async (label) => {
    const created = await createCourse(api, { name: uniqueName(`SC007-006 ${label}`) });
    let i = 0;
    return saveCourse(api, created, draftSteps(created).map((s) => (s.stepType === 'video' ? { ...s, videoId: videoIds[i++] } : s)));
  };
  const unpublish = async (id) => expect((await api.post(`/api/organisation/courses/${id}/unpublish`)).status()).toBe(200);

  const published = await complete('gepubliceerd');
  await publishCourse(api, published.id);

  const changed = await complete('gewijzigd');
  let doc = await publishCourse(api, changed.id);
  await saveCourse(api, doc, draftSteps(doc).map((s) => (s.stepType === 'question' ? { ...s, questionText: 'Wat doe je nu?' } : s)));

  const canvasOnly = await complete('canvas');
  doc = await publishCourse(api, canvasOnly.id);
  await saveCourse(api, doc, draftSteps(doc).map((s) => ({ ...s, positionX: s.positionX + 200, positionY: s.positionY + 100 })));

  const unpublished = await complete('onpubliceerd');
  await publishCourse(api, unpublished.id);
  await unpublish(unpublished.id);

  const republished = await complete('opnieuw');
  await publishCourse(api, republished.id);
  await unpublish(republished.id);
  await publishCourse(api, republished.id);

  const expected = [
    { course: neverPublished, status: 'draft', text: 'Concept' },
    { course: published, status: 'published', text: 'Gepubliceerd', version: 1 },
    { course: changed, status: 'published_changed', text: 'Gepubliceerd · wijzigingen nog niet gepubliceerd', quest: true },
    { course: canvasOnly, status: 'published', text: 'Gepubliceerd', version: 1 },
    { course: unpublished, status: 'draft', text: 'Concept' },
    { course: republished, status: 'published', text: 'Gepubliceerd', version: 1 },
  ];

  const check = async (status, e) => {
    await expect(status).toHaveAttribute('data-status', e.status);
    if (e.status === 'draft') await expect(status).toHaveText(e.text);
    else await expect(status).toContainText(e.text);
    if (e.version) await expect(status).toContainText(versionLine(e.version));
    if (e.quest) await expect(status).toContainText(/Op de Quest: versie 1 · /);
    if (e.status === 'published') await expect(status).not.toContainText('wijzigingen nog niet gepubliceerd');
  };

  // Het overzicht.
  await page.goto('/courses');
  for (const e of expected) {
    await check(page.locator('li').filter({ hasText: e.course.name }).locator('[data-test="publication-status"]'), e);
  }

  // Dezelfde status in de editor.
  for (const e of expected) {
    await openCourse(page, e.course.id, { view: 'Canvas + paneel' });
    await check(page.locator('[data-test="publication-status"]'), e);
  }
});
