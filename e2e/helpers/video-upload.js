// Hulpfuncties voor de tests van spec 002 (videobibliotheek). Nieuw bestand.
import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { TEST_PASSWORD } from './org-api.js';

/** Pad naar een testvideo uit backend/tests/fixtures/videos/. Het werkpad is e2e/ bij `npx playwright test`. */
export const videoFixture = (name) => path.resolve('../backend/tests/fixtures/videos', name);

/**
 * Inloggen via het scherm in een eigen pagina (zoals in organisation-manage.spec.js).
 * Wacht tot het hoofdmenu zichtbaar is, zodat de test pas doorgaat als je echt bent ingelogd.
 * Voor een mislukte login (foutmelding verwachten) is deze helper niet bedoeld.
 */
export async function loginViaScreen(page, loginCode, password) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Organisatiecode' }).fill(loginCode);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(password);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByRole('navigation', { name: 'Hoofdmenu' })).toBeVisible();
}

/**
 * Houdt alle uploadverzoeken van deze pagina vast, zodat een upload "bezig" of "wachtend" blijft staan
 * terwijl de test kijkt. Geeft een functie terug: roep die aan om de uploads los te laten.
 *
 *   const release = await holdUploads(page);
 *   // ...bestanden kiezen, uploaden, controleren wat je ziet...
 *   release();   // de uploads lopen nu door
 *
 * Roep holdUploads aan voordat je de bestanden kiest. Het pad is het tus-eindpunt van de API
 * (UPLOADS_PATH in backend/src/modules/videos/tusServer.js). Wordt release nooit aangeroepen, dan
 * hangen de verzoeken tot de browsercontext sluit; dat is geen probleem aan het eind van een test.
 */
export async function holdUploads(page) {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route('**/api/organisation/video-uploads**', async (route) => {
    await gate;
    // Is de pagina intussen gesloten, dan mag het doorsturen mislukken.
    await route.continue().catch(() => {});
  });
  return release;
}

/**
 * Start een upload en laat hem na het eerste stuk stranden, zodat de server een deel van het bestand heeft
 * (scenario 12, 13, 14, 29, 30 en 31). Er is geen groot bestand nodig: de helper vervangt in de
 * upload-instellingen het stuk van 32 MB door stukken van 8 kB, zodat een testvideo uit
 * backend/tests/fixtures/videos/ uit meerdere stukken bestaat. Het eerste PATCH-verzoek gaat door, elk volgend
 * wordt afgebroken (route.abort), alsof de verbinding wegvalt; de browser blijft dan opnieuw proberen.
 *
 * Roep dit aan nadat je bent ingelogd en nog niet op /videos bent geweest: de helper opent /videos zelf,
 * kiest het bestand en klikt op "Uploaden". Hij wacht tot het eerste verzoek is afgebroken.
 *
 * Geeft terug:
 *   percent: hoeveel procent de server heeft (afgerond naar beneden), bijvoorbeeld 42
 *   resume(): stopt met afbreken; de upload gaat bij de volgende poging verder (binnen een paar seconden)
 */
export async function startHalfUpload(page, fileName = 'valid-512x256.mp4') {
  const CHUNK = 8 * 1024;
  const file = videoFixture(fileName);
  const percent = Math.floor((CHUNK / fs.statSync(file).size) * 100);

  // Kleinere stukken: de instellingen komen van de API en bepalen de stukgrootte van de browser.
  await page.route('**/api/organisation/videos/upload-settings', async (route) => {
    const response = await route.fetch();
    const settings = await response.json();
    await route.fulfill({ response, json: { ...settings, chunkSizeBytes: CHUNK } });
  });

  // Eerste PATCH door, de rest afbreken zolang "cut" aan staat.
  let patches = 0;
  let cut = true;
  let markCut;
  const firstCut = new Promise((resolve) => (markCut = resolve));
  await page.route('**/api/organisation/video-uploads**', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    patches += 1;
    if (patches > 1 && cut) {
      markCut();
      return route.abort('connectionfailed');
    }
    return route.continue();
  });

  await page.goto('/videos');
  await page.locator('[data-test="file-input"]').setInputFiles([file]);
  await page.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();
  await firstCut;

  return { percent, resume: () => (cut = false) };
}

/** De kaart van één video in de lijst van /videos, gevonden op (unieke) naam. */
export const card = (page, name) => page.locator('[data-test="video"]').filter({ hasText: name });

/**
 * Een nieuwe pagina in een eigen browsercontext, ingelogd als deze organisatie, met /videos open.
 * `t` is de tracker van de test (createTracker()), zodat de context na afloop wordt opgeruimd.
 */
export async function openLibraryAs(t, browser, org) {
  const page = await (await t.browserContext(browser)).newPage();
  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await page.goto('/videos');
  return page;
}

/**
 * Uploadt één of meer video's in één keer vanaf /videos: [{ file, name, visibility, organisation? }].
 * `visibility` is 'public', 'selective' of 'private'; bij 'selective' geef je `organisation` (de naam van de
 * gekozen organisatie) mee. Wacht tot de kaarten van alle video's in de lijst staan (en niet op de tekst in het
 * uploadvenster), want pas dan zijn de video's echt klaar.
 */
export async function uploadVideos(page, videos) {
  await page.locator('[data-test="file-input"]').setInputFiles(videos.map((v) => videoFixture(v.file)));
  for (const [i, v] of videos.entries()) {
    const entry = page.locator('[data-test="entry"]').nth(i);
    await entry.getByLabel('Naam').fill(v.name);
    await entry.locator(`[data-test="visibility-${v.visibility}"]`).check();
    if (v.organisation) await entry.getByLabel(v.organisation, { exact: true }).check();
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();
  for (const v of videos) await expect(card(page, v.name)).toBeVisible({ timeout: 30_000 });
}
