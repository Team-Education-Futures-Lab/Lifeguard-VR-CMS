// Hulpfuncties voor de tests van spec 009 (cursussen delen en de cursusbibliotheek).
import { expect } from '@playwright/test';

/**
 * Publiceert een cursus via de API met een beschikbaarheid (spec 009): `body` is
 * { visibility, accessOrganisationIds }. Komt er een waarschuwing over video's die niet algemeen beschikbaar zijn
 * (409 shared_videos_warning), dan worden precies die video's bevestigd en wordt opnieuw gepubliceerd.
 * Geeft het concept-document terug.
 */
export async function shareCourse(api, id, body) {
  let res = await api.post(`/api/organisation/courses/${id}/publish`, { data: body });
  if (res.status() === 409) {
    const { error } = await res.json();
    expect(error.code).toBe('shared_videos_warning');
    res = await api.post(`/api/organisation/courses/${id}/publish`, {
      data: { ...body, acknowledgedVideoIds: error.videos.map((v) => v.id) },
    });
  }
  if (res.status() !== 200) {
    throw new Error(`Cursus delen mislukt: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

/** De kaart van een cursus in de cursusbibliotheek. */
export const libraryCard = (page, name) => page.locator('[data-test="library-course"]').filter({ hasText: name });

/** Opent de cursusbibliotheek via het menu en wacht tot de pagina er staat. */
export async function openCourseLibrary(page) {
  await page.goto('/courses');
  await page.getByRole('navigation', { name: 'Hoofdmenu' }).getByRole('link', { name: 'Cursusbibliotheek' }).click();
  await expect(page.getByRole('heading', { name: 'Cursusbibliotheek' })).toBeVisible();
}

/** Opent in de editor het publicatiemenu en kiest een item ('publish', 'unpublish', 'change-availability'). */
export async function choosePublishItem(page, item) {
  await page.locator('[data-test="publish-menu"]').click();
  await page.locator(`[data-test="${item}"]`).click();
}
