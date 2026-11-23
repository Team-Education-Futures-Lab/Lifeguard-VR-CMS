import { test, expect } from '@playwright/test';
import { uniqueName } from '../../../helpers/admin.js';
import { createTracker } from '../../../helpers/org-api.js';
import { createCourse, openCourse, openStep } from '../../../helpers/course.js';

// Sabotage van course-editing.spec.js. ELKE TEST HOORT TE FALEN, op de regel die bij "faalt op" staat.
// Elke functie is een kopie van de originele test; `sab` zet precies één fout aan. Het origineel blijft ongewijzigd.

const t = createTracker();
test.afterEach(() => t.cleanup());

async function addStep(page, kind) {
  await page.getByRole('button', { name: kind, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click(); // een nieuw onderdeel opent meteen zijn venster
}

async function scenario9(browser, sab) {
  const org = await t.organisation({ name: uniqueName('E2E-004-SAB9') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SAB9-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);
  const blocks = page.locator('[data-test="block"]');
  await expect(blocks).toHaveCount(3);

  const dialog = await openStep(page, 'Kies een video');
  await dialog.locator('[data-test="remove-step"]').click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(blocks).toHaveCount(2);

  if (sab !== 'geen-ctrl-z') await page.keyboard.press('Control+z');
  await expect(blocks).toHaveCount(3);
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(2);
  if (sab === 'nog-een-wijziging') await addStep(page, 'Vraag');
  await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');
}

async function scenario10(browser, sab) {
  const org = await t.organisation({ name: uniqueName('E2E-004-SAB10') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SAB10-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);

  await addStep(page, 'Vraag');
  await expect(page.locator('[data-test="block"]')).toHaveCount(4);
  if (sab === 'opgeslagen') {
    await page.locator('[data-test="save"]').click();
    await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');
  }
  await page.getByTitle('Terug naar cursussen').click();

  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Wijzigingen niet opgeslagen');
  await confirm.getByRole('button', { name: sab === 'verlaten' ? 'Verlaten' : 'Annuleren' }).click();

  await expect(confirm).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/courses/${course.id}$`));
  await expect(page.locator('[data-test="block"]')).toHaveCount(4);
  await expect(page.locator('[data-test="save"]')).toHaveText('Opslaan als concept');
}

async function scenario11(browser, sab) {
  const org = await t.organisation({ name: uniqueName('E2E-004-SAB11') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SAB11-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);

  if (sab !== 'geen-wijziging') {
    await addStep(page, 'Vraag');
    await expect(page.locator('[data-test="block"]')).toHaveCount(4);
  }

  // Zonder dialoog wacht waitForEvent tot de time-out; 10 s is genoeg om het verschil te zien.
  const dialogPromise = page.waitForEvent('dialog', { timeout: 10_000 });
  const reload = page.reload();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.accept();
  await reload;

  await expect(page.locator('[data-test="block"]')).toHaveCount(3);
}

async function scenario12(browser, sab) {
  const org = await t.organisation({ name: uniqueName('E2E-004-SAB12') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SAB12-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);
  const blocks = page.locator('[data-test="block"]');
  const save = page.locator('[data-test="save"]');

  await addStep(page, 'Video');
  await expect(blocks).toHaveCount(4);

  if (sab !== 'online') await page.context().setOffline(true);
  await save.click();
  await expect(page.getByText('De cursus is niet opgeslagen. Probeer het opnieuw.')).toBeVisible();
  await expect(blocks).toHaveCount(4);
  await expect(save).toHaveText('Opslaan als concept');

  if (sab !== 'blijft-offline') await page.context().setOffline(false);
  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  if (sab === 'dubbel') {
    await addStep(page, 'Video');
    await save.click();
    await expect(save).toHaveText('Opgeslagen');
  }
  await page.reload();
  await expect(blocks).toHaveCount(4);
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(3);
}

async function scenario17(browser, sab) {
  const org = await t.organisation({ name: uniqueName('E2E-004-SAB17') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SAB17-004 cursus') });
  const name1 = uniqueName('SAB17-004 tabblad 1');
  const name2 = uniqueName('SAB17-004 tabblad 2');
  const page1 = await t.pageAs(browser, org.loginCode);
  const page2 = await page1.context().newPage();
  await openCourse(page1, course.id);
  await openCourse(page2, course.id);

  let order = [[page1, name1], [page2, name2]];
  if (sab === 'omgekeerd') order = order.reverse();
  if (sab === 'alleen-tabblad-1') order = [[page1, name1]];
  for (const [page, name] of order) {
    await page.getByRole('button', { name: course.name }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Naam' }).fill(name);
    await dialog.getByRole('button', { name: 'Klaar' }).click();
    await page.locator('[data-test="save"]').click();
    await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByText('De cursus is niet opgeslagen. Probeer het opnieuw.')).toHaveCount(0);
  }

  await page1.reload();
  await expect(page1.getByRole('button', { name: name2 })).toBeVisible();
  await expect(page1.getByText(name1)).toHaveCount(0);
}

// faalt op: blocks toHaveCount(3) na Ctrl+Z
test('S9-1 geen Ctrl+Z', ({ browser }) => scenario9(browser, 'geen-ctrl-z'));
// faalt op: save toHaveText('Opgeslagen')
test('S9-2 na Ctrl+Z nog iets gewijzigd', ({ browser }) => scenario9(browser, 'nog-een-wijziging'));

// faalt op: alertdialog "Wijzigingen niet opgeslagen"
test('S10-1 eerst opgeslagen: geen vraag bij weggaan', ({ browser }) => scenario10(browser, 'opgeslagen'));
// faalt op: toHaveURL /courses/<id>
test('S10-2 Verlaten in plaats van Annuleren', ({ browser }) => scenario10(browser, 'verlaten'));

// faalt op: waitForEvent('dialog') (time-out)
test('S11-1 niets gewijzigd: geen vraag van de browser', ({ browser }) => scenario11(browser, 'geen-wijziging'));

// faalt op: toast "De cursus is niet opgeslagen. Probeer het opnieuw."
test('S12-1 het netwerk blijft aan', ({ browser }) => scenario12(browser, 'online'));
// faalt op: save toHaveText('Opgeslagen') na de tweede poging
test('S12-2 het netwerk blijft uit', ({ browser }) => scenario12(browser, 'blijft-offline'));
// faalt op: blocks toHaveCount(4) na herladen
test('S12-3 het onderdeel staat er twee keer', ({ browser }) => scenario12(browser, 'dubbel'));

// faalt op: knop met name2 na herladen
test('S17-1 eerst tabblad 2 opgeslagen, dan 1', ({ browser }) => scenario17(browser, 'omgekeerd'));
// faalt op: knop met name2 na herladen
test('S17-2 alleen tabblad 1 opgeslagen', ({ browser }) => scenario17(browser, 'alleen-tabblad-1'));
