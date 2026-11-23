import { test, expect } from '@playwright/test';
import { uniqueName } from '../../../helpers/admin.js';
import { createTracker } from '../../../helpers/org-api.js';
import { createCourse, openCourse, openStep } from '../../../helpers/course.js';

// Sabotage van course-steps.spec.js. ELKE TEST HOORT TE FALEN, op de regel die bij "faalt op" staat.
// Elke functie is een kopie van de originele test; `sab` zet precies één fout aan. Het origineel blijft ongewijzigd.

const t = createTracker();
test.afterEach(() => t.cleanup());

async function openNewCourse(browser, tag) {
  const org = await t.organisation({ name: uniqueName(`E2E-004-SAB${tag}`) });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName(`SAB${tag}-004 cursus`) });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);
  return page;
}

async function scenario5(browser, sab) {
  const page = await openNewCourse(browser, '5');
  const blocks = page.locator('[data-test="block"]');
  const save = page.locator('[data-test="save"]');
  await expect(blocks).toHaveCount(3);

  await page.getByRole('button', { name: sab === 'vraag' ? 'Vraag' : 'Video', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click();
  await expect(blocks).toHaveCount(4);
  await save.click();
  await expect(save).toHaveText('Opgeslagen');
  if (sab === 'tweede-video') {
    await page.getByRole('button', { name: 'Video', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click();
    await save.click();
    await expect(save).toHaveText('Opgeslagen');
  }

  await page.reload();
  await expect(blocks).toHaveCount(4);
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(3);
}

async function scenario6a(browser, sab) {
  const page = await openNewCourse(browser, '6a');

  const dialog = await openStep(page, 'Wat doe je?');
  const answers = dialog.locator('[data-test="answer"]');
  const addAnswer = dialog.locator('[data-test="add-answer"]');
  await expect(answers).toHaveCount(2);

  await addAnswer.click();
  await expect(answers).toHaveCount(3);
  if (sab !== 'een-keer') await addAnswer.click();
  await expect(answers).toHaveCount(4);
  if (sab === 'weer-drie') await dialog.getByRole('button', { name: 'Antwoord D verwijderen' }).click();
  await expect(addAnswer).toHaveCount(0);
}

async function scenario6b(browser, sab) {
  const page = await openNewCourse(browser, '6b');
  const texts = ['Ik spring erin', 'Ik roep om hulp', 'Ik gooi een reddingsboei', ''];
  const feedback = 'Eerst een hulpmiddel gooien, dan pas zelf erin.';

  let dialog = await openStep(page, 'Wat doe je?');
  await dialog.locator('[data-test="add-answer"]').click();
  await dialog.locator('[data-test="add-answer"]').click();
  const answers = dialog.locator('[data-test="answer"]');
  for (const [i, text] of texts.entries()) await answers.nth(i).fill(text);
  if (sab === 'd-ingevuld') await answers.nth(3).fill('Toch ingevuld');
  await dialog.getByRole('radio', { name: sab === 'b-goed' ? 'Antwoord B is goed' : 'Antwoord C is goed' }).check();
  if (sab !== 'geen-feedback') await dialog.locator('[data-test="feedback"]').fill(feedback);
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  await page.locator('[data-test="save"]').click();
  await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');

  await page.reload();
  dialog = await openStep(page, 'Wat doe je?');
  await expect(answers).toHaveCount(4);
  for (const [i, text] of texts.entries()) await expect(answers.nth(i)).toHaveValue(text);
  await expect(dialog.getByRole('radio', { name: 'Antwoord C is goed' })).toBeChecked();
  await expect(dialog.locator('[data-test="feedback"]')).toHaveValue(feedback);
}

async function scenario7(browser, sab) {
  const page = await openNewCourse(browser, '7');

  const dialog = await openStep(page, 'Wat doe je?');
  const answers = dialog.locator('[data-test="answer"]');
  await dialog.locator('[data-test="add-answer"]').click();
  await dialog.locator('[data-test="add-answer"]').click();
  await expect(answers).toHaveCount(4);
  await dialog.getByRole('radio', { name: sab === 'b-goed' ? 'Antwoord B is goed' : 'Antwoord C is goed' }).check();

  await dialog.getByRole('button', { name: 'Antwoord C verwijderen' }).click();
  await expect(answers).toHaveCount(3);
  await expect(dialog.getByRole('radio', { name: 'Antwoord A is goed' })).toBeChecked();

  if (sab !== 'drie-over') {
    await dialog.getByRole('button', { name: 'Antwoord C verwijderen' }).click();
    await expect(answers).toHaveCount(2);
  }
  await expect(dialog.getByRole('button', { name: /^Antwoord [A-D] verwijderen$/ })).toHaveCount(0);
}

async function scenario8(browser, sab) {
  const page = await openNewCourse(browser, '8');
  const blocks = page.locator('[data-test="block"]');
  const startBlocks = blocks.filter({ has: page.locator('[data-test="badges"]', { hasText: 'Start' }) });

  const dialog = await openStep(page, 'Kies een video');
  if (sab !== 'niet-aangevinkt') await dialog.locator('[data-test="start"]').check();
  await dialog.getByRole('button', { name: 'Klaar' }).click();
  // Zonder wijziging staat Opslaan uit; dan valt er niets op te slaan.
  if (sab !== 'niet-aangevinkt') {
    await page.locator('[data-test="save"]').click();
    await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');
  }

  await page.reload();
  await expect(blocks).toHaveCount(3);
  await expect(startBlocks).toHaveCount(1);
  await expect(startBlocks).toContainText('Kies een video');
  await expect(startBlocks).not.toContainText('Wat doe je?');
}

// faalt op: blocks toHaveCount(4) na herladen
test('S5-1 een tweede video-onderdeel opgeslagen', ({ browser }) => scenario5(browser, 'tweede-video'));
// faalt op: "Kies een video" toHaveCount(3) na herladen
test('S5-2 een vraag toegevoegd in plaats van een video', ({ browser }) => scenario5(browser, 'vraag'));

// faalt op: answers toHaveCount(4)
test('S6a-1 maar één keer op add-answer', ({ browser }) => scenario6a(browser, 'een-keer'));
// faalt op: add-answer toHaveCount(0)
test('S6a-2 terug naar 3 antwoorden: add-answer is er weer', ({ browser }) => scenario6a(browser, 'weer-drie'));

// faalt op: answers.nth(3) toHaveValue('')
test('S6b-1 het lege antwoord toch ingevuld', ({ browser }) => scenario6b(browser, 'd-ingevuld'));
// faalt op: radio "Antwoord C is goed" toBeChecked
test('S6b-2 antwoord B goed in plaats van C', ({ browser }) => scenario6b(browser, 'b-goed'));
// faalt op: feedback toHaveValue
test('S6b-3 geen feedback ingevuld', ({ browser }) => scenario6b(browser, 'geen-feedback'));

// faalt op: radio "Antwoord A is goed" toBeChecked (B blijft goed)
test('S7-1 niet het goede antwoord verwijderd', ({ browser }) => scenario7(browser, 'b-goed'));
// faalt op: verwijderknoppen toHaveCount(0)
test('S7-2 gestopt bij 3 antwoorden', ({ browser }) => scenario7(browser, 'drie-over'));

// faalt op: startBlocks toContainText('Kies een video')
test('S8-1 Startonderdeel niet aangevinkt', ({ browser }) => scenario8(browser, 'niet-aangevinkt'));
