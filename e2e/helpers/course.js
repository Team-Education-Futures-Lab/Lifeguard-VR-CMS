// Hulpfuncties voor de tests van spec 004 (cursussen en onderdelen). Bron: docs/e2e plans/e2e-plan-spec-004.md.
import { expect } from '@playwright/test';

/**
 * Maakt een cursus aan via de API en geeft het concept terug (met `id` en `steps`). `api` komt van
 * `t.login(loginCode)`; die stuurt de CSRF-header al mee. Een nieuwe cursus krijgt het voorbeeld van spec 005:
 * startvraag "Wat doe je?" met twee antwoorden, elk naar een videoblok zonder video.
 */
export async function createCourse(api, { name, description = 'Beschrijving van de testcursus' }) {
  const res = await api.post('/api/organisation/courses', { data: { name, description } });
  if (res.status() !== 201) {
    throw new Error(`Cursus aanmaken mislukt: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

/** Opent de editor van deze cursus en wacht tot de knop Opslaan er staat. */
export async function openCourse(page, id) {
  await page.goto(`/courses/${id}`);
  await expect(page.locator('[data-test="save"]')).toBeVisible();
}

/**
 * Klikt in de weergave "Canvas" op een blok en wacht op het venster ("Video-onderdeel" of "Vraag").
 * `block` is een index of een tekst in het blok. Geeft het venster terug.
 * Open punt uit het plan: nagaan dat één klik het venster opent en niet alleen selecteert.
 */
export async function openStep(page, block) {
  const blocks = page.locator('[data-test="block"]');
  const target = typeof block === 'number' ? blocks.nth(block) : blocks.filter({ hasText: block }).first();
  await target.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}
