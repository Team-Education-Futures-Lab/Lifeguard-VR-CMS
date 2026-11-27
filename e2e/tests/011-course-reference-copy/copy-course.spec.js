import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCompleteCourse } from '../../helpers/course.js';
import { shareCourse } from '../../helpers/sharing.js';
import { addReference, copyTakenOverCourse, publishNewVersion, questVersions, takenOverRow } from '../../helpers/references.js';

// Spec 011, US1 (quickstart 1–4): een overgenomen cursus aanpassen geeft een eigen kopie van de gekozen versie;
// de editor opent meteen en de kopie komt in de plaats van de overgenomen cursus.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('US1: aanpassen maakt een eigen kopie van de gekozen versie', async ({ browser }) => {
  test.setTimeout(180_000);
  const shared = await createCompleteCourse(t, browser, '011-1');
  await shareCourse(shared.api, shared.course.id, { visibility: 'public' });
  const b = await t.organisation({ name: uniqueName('E2E-011-1-B') });
  const api = await t.login(b.loginCode);
  await addReference(api, shared.course.id);
  // A publiceert intussen versie 2; B blijft op versie 1.
  expect(await publishNewVersion(shared.api, shared.course.id, 'Versie twee van de vraag?')).toBe(2);

  const page = await t.pageAs(browser, b.loginCode);
  await page.goto('/courses');

  // Annuleren verandert niets.
  await takenOverRow(page, shared.course.name).getByRole('button').click();
  await page.locator('[data-test="copy-reference"]').click();
  await expect(page.locator('.confirm-backdrop')).toContainText('Je krijgt een eigen kopie van versie 1');
  await page.locator('.confirm-backdrop').getByRole('button', { name: 'Annuleren' }).click();
  await expect(page.locator('.confirm-backdrop')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(takenOverRow(page, shared.course.name)).toHaveCount(1);

  // Aanpassen: de editor opent met de kopie.
  const copyId = await copyTakenOverCourse(page, shared.course.name);
  expect(copyId).not.toBe(shared.course.id);
  await expect(page.locator('[data-test="editor-based-on"]')).toHaveText(`Gebaseerd op ${shared.course.name} van ${shared.org.name}`);
  const doc = await (await api.get(`/api/organisation/courses/${copyId}`)).json();
  expect(doc.steps.find((s) => s.stepType === 'question').questionText).not.toBe('Versie twee van de vraag?');
  expect(doc.publication.versionNumber).toBe(1);

  // Het cursusoverzicht: de kopie als eigen cursus, de overgenomen cursus is weg.
  await page.goto('/courses');
  await expect(page.locator('[data-test="based-on"]')).toHaveText(`Gebaseerd op ${shared.course.name} van ${shared.org.name}`);
  await expect(takenOverRow(page, shared.course.name)).toHaveCount(0);

  // De Quest van B ziet de kopie en niet meer het origineel.
  const versions = await questVersions(t, b.questLinkCode);
  expect(versions.get(copyId)).toBe(1);
  expect(versions.has(shared.course.id)).toBe(false);
});
