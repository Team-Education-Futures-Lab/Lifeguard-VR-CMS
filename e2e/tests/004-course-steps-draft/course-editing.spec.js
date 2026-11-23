import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCourse, openCourse, openStep } from '../../helpers/course.js';

// Scenario 9, 10, 11, 12 en 17: ongedaan maken, niet-opgeslagen wijzigingen, opslaan zonder netwerk, twee tabbladen.
// Elke test begint met een nieuwe cursus (via de API) met het voorbeeld: vraag "Wat doe je?" en twee videoblokken.
// Bron: docs/e2e plans/e2e-plan-spec-004.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 9: een onderdeel verwijderen en met Ctrl+Z terugzetten', async ({ browser }) => {
  // A. Een blok openen, [data-test="remove-step"]: geen bevestigingsvraag, het blok is weg.
  // Ctrl+Z (focus niet in een tekstveld): het blok is terug en [data-test="save"] toont "Opgeslagen".
  const org = await t.organisation({ name: uniqueName('E2E-004-SC9') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC9-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);
  const blocks = page.locator('[data-test="block"]');
  await expect(blocks).toHaveCount(3);

  const dialog = await openStep(page, 'Kies een video');
  await dialog.locator('[data-test="remove-step"]').click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(blocks).toHaveCount(2);

  await page.keyboard.press('Control+z');
  await expect(blocks).toHaveCount(3);
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(2);
  await expect(page.locator('[data-test="save"]')).toHaveText('Opgeslagen');
});

test('scenario 10: weggaan met niet-opgeslagen wijzigingen', async ({ browser }) => {
  // A. Iets wijzigen (knop "Vraag"), de terugknop (title "Terug naar cursussen"):
  // alertdialog "Wijzigingen niet opgeslagen"; "Annuleren": de editor blijft open.
  const org = await t.organisation({ name: uniqueName('E2E-004-SC10') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC10-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);

  await page.getByRole('button', { name: 'Vraag', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click(); // een nieuw onderdeel opent meteen zijn venster
  await expect(page.locator('[data-test="block"]')).toHaveCount(4);
  await page.getByTitle('Terug naar cursussen').click();

  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Wijzigingen niet opgeslagen');
  await confirm.getByRole('button', { name: 'Annuleren' }).click();

  await expect(confirm).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/courses/${course.id}$`));
  await expect(page.locator('[data-test="block"]')).toHaveCount(4);
  await expect(page.locator('[data-test="save"]')).toHaveText('Opslaan als concept');
});

test('scenario 11: herladen met niet-opgeslagen wijzigingen', async ({ browser }) => {
  // A. Iets wijzigen; page.on('dialog') en page.reload(): de dialoog heeft type "beforeunload".
  // Test de waarschuwing van de browser, niet die van de app (scenario 10).
  const org = await t.organisation({ name: uniqueName('E2E-004-SC11') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC11-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);

  await page.getByRole('button', { name: 'Vraag', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click(); // een nieuw onderdeel opent meteen zijn venster
  await expect(page.locator('[data-test="block"]')).toHaveCount(4);

  const dialogPromise = page.waitForEvent('dialog');
  const reload = page.reload();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.accept();
  await reload;

  // Verlaten bevestigd: de wijziging is weg.
  await expect(page.locator('[data-test="block"]')).toHaveCount(3);
});

test('scenario 12: opslaan zonder netwerk', async ({ browser }) => {
  // A. Iets toevoegen; context.setOffline(true); opslaan: toast "De cursus is niet opgeslagen. Probeer het opnieuw."
  // en de wijziging staat er nog. context.setOffline(false), opnieuw opslaan, herladen: het onderdeel staat er één keer.
  const org = await t.organisation({ name: uniqueName('E2E-004-SC12') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC12-004 cursus') });
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id);
  const blocks = page.locator('[data-test="block"]');
  const save = page.locator('[data-test="save"]');

  await page.getByRole('button', { name: 'Video', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Klaar' }).click(); // een nieuw onderdeel opent meteen zijn venster
  await expect(blocks).toHaveCount(4);

  await page.context().setOffline(true);
  await save.click();
  await expect(page.getByText('De cursus is niet opgeslagen. Probeer het opnieuw.')).toBeVisible();
  await expect(blocks).toHaveCount(4);
  await expect(save).toHaveText('Opslaan als concept');

  await page.context().setOffline(false);
  await save.click();
  await expect(save).toHaveText('Opgeslagen');

  await page.reload();
  await expect(blocks).toHaveCount(4);
  await expect(blocks.filter({ hasText: 'Kies een video' })).toHaveCount(3);
});

test('scenario 17: twee tabbladen, de laatste opslag wint', async ({ browser }) => {
  // A. Twee pagina's in één context met dezelfde cursus. In tabblad 1 en 2 een andere naam via de cursustitel,
  // eerst 1 opslaan en dan 2. Herladen: de naam van 2 staat er; geen waarschuwing.
  const org = await t.organisation({ name: uniqueName('E2E-004-SC17') });
  const course = await createCourse(await t.login(org.loginCode), { name: uniqueName('SC17-004 cursus') });
  const name1 = uniqueName('SC17-004 tabblad 1');
  const name2 = uniqueName('SC17-004 tabblad 2');
  const page1 = await t.pageAs(browser, org.loginCode);
  const page2 = await page1.context().newPage();
  await openCourse(page1, course.id);
  await openCourse(page2, course.id);

  for (const [page, name] of [[page1, name1], [page2, name2]]) {
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
});
