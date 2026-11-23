// Hulpfuncties voor de tests van spec 004 (cursussen en onderdelen). Bron: docs/e2e plans/e2e-plan-spec-004.md.
import { expect } from '@playwright/test';
import { uniqueName } from './admin.js';
import { openLibraryAs, uploadVideos } from './video-upload.js';

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

/**
 * Opent de editor van deze cursus, wacht tot de knop Opslaan er staat en kiest de weergave (standaard "Canvas").
 * Een nieuwe browser begint in "Canvas + paneel"; daar opent een blok in een zijpaneel in plaats van een venster.
 * De tests van spec 005 gebruiken "Canvas + paneel": in "Canvas" ligt het venster van het blok over het menu van
 * een verbindingspunt.
 */
export async function openCourse(page, id, { view = 'Canvas' } = {}) {
  await page.goto(`/courses/${id}`);
  await expect(page.locator('[data-test="save"]')).toBeVisible();
  await page.getByRole('radio', { name: view, exact: true }).check();
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

/**
 * Slaat een andere route op via de API (spec 005): `PUT /api/organisation/courses/<id>` met de naam en beschrijving
 * van `course` en deze `steps`. Elk onderdeel heeft een `key`; verbindingen gaan via `nextStepKey` (bij een
 * video-onderdeel en bij elk antwoord). Geeft het opgeslagen concept terug (met `nextStepId`).
 */
export async function saveCourse(api, course, steps) {
  // Spec 006 (research R14): elke opslag noemt het nummer van het concept; dat staat in het actuele document.
  const current = await api.get(`/api/organisation/courses/${course.id}`);
  const { draftVersionNumber } = await current.json();
  const res = await api.put(`/api/organisation/courses/${course.id}`, {
    // Volgens het contract van spec 004 zit de beschrijving niet altijd in het document; dan die van createCourse.
    data: { draftVersionNumber, name: course.name, description: course.description ?? 'Beschrijving van de testcursus', steps },
  });
  if (res.status() !== 200) {
    throw new Error(`Cursus opslaan mislukt: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Publiceert een cursus via de API (spec 006): `POST /api/organisation/courses/<id>/publish`. Geeft het
 * concept-document terug (met `status` en `publication`). Gooit een fout bij een andere status dan 200; een test
 * die een `422` verwacht, gebruikt zelf `api.post`.
 */
export async function publishCourse(api, id) {
  const res = await api.post(`/api/organisation/courses/${id}/publish`);
  if (res.status() !== 200) {
    throw new Error(`Cursus publiceren mislukt: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Zet een opgeslagen concept-document om naar de onderdelen van een PUT (spec 005/006): elk onderdeel krijgt de
 * sleutel `s<id>` en verwijst via `nextStepKey` naar zijn vervolg. Pas het resultaat aan (map) en geef het aan
 * saveCourse om één ding te wijzigen.
 */
export function draftSteps(doc) {
  const key = (id) => (id ? `s${id}` : null);
  return doc.steps.map((s) => {
    const base = { key: key(s.id), id: s.id, stepType: s.stepType, isStart: s.isStart, positionX: s.positionX, positionY: s.positionY };
    if (s.stepType === 'video') return { ...base, videoId: s.videoId, nextStepKey: key(s.nextStepId) };
    return {
      ...base, questionText: s.questionText, feedback: s.feedback,
      answers: s.answers.map((a) => ({ id: a.id, answerText: a.answerText, isCorrect: a.isCorrect, nextStepKey: key(a.nextStepId) })),
    };
  });
}

/**
 * Een cursus die gepubliceerd kan worden (spec 006): een nieuwe organisatie, twee eigen video's (geüpload via het
 * scherm) en het voorbeeld van een nieuwe cursus met in elk videoblok een video (via de API). `t` is de tracker van
 * de test. Geeft de organisatie, de API-verbinding, een ingelogde pagina (op /videos), het opgeslagen concept en de
 * namen van de video's terug; video A staat in het blok van antwoord A.
 */
export async function createCompleteCourse(t, browser, tag) {
  const org = await t.organisation({ name: uniqueName(`E2E-006-SC${tag}`) });
  const api = await t.login(org.loginCode);
  const page = await openLibraryAs(t, browser, org);
  const videoNames = [uniqueName(`SC${tag}-006 video A`), uniqueName(`SC${tag}-006 video B`)];
  await uploadVideos(page, [
    { file: 'valid-512x256.mp4', name: videoNames[0], visibility: 'private' },
    { file: 'valid-opus-audio-512x256.mp4', name: videoNames[1], visibility: 'private' },
  ]);
  const { videos } = await (await api.get('/api/organisation/videos')).json();
  const videoId = (name) => videos.find((v) => v.name === name).id;

  const created = await createCourse(api, { name: uniqueName(`SC${tag}-006 cursus`) });
  const [answerA, answerB] = created.steps.find((s) => s.stepType === 'question').answers;
  const chosen = { [answerA.nextStepId]: videoId(videoNames[0]), [answerB.nextStepId]: videoId(videoNames[1]) };
  const course = await saveCourse(api, created, draftSteps(created).map((s) => (s.stepType === 'video' ? { ...s, videoId: chosen[s.id] } : s)));
  return { org, api, page, course, videoNames };
}
