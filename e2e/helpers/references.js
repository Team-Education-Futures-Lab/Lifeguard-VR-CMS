// Hulpfuncties voor de tests van spec 010 (gedeelde cursussen overnemen als verwijzing).
import { expect } from '@playwright/test';
import { draftSteps, publishCourse, saveCourse } from './course.js';

/** Voegt een gedeelde cursus via de API toe aan de organisatie van `api`; geeft de verwijzing terug. */
export async function addReference(api, courseId) {
  const res = await api.post('/api/organisation/course-references', { data: { courseId } });
  if (res.status() !== 201) {
    throw new Error(`Cursus toevoegen mislukt: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Publiceert een nieuwe versie van een cursus via de API: de startvraag krijgt een andere tekst, daarna
 * publiceren. Geeft het nieuwe versienummer terug.
 */
export async function publishNewVersion(api, courseId, questionText) {
  const doc = await (await api.get(`/api/organisation/courses/${courseId}`)).json();
  const steps = draftSteps(doc).map((s) => (s.stepType === 'question' ? { ...s, questionText } : s));
  await saveCourse(api, doc, steps);
  const published = await publishCourse(api, courseId);
  return published.publication.versionNumber;
}

/** De cursussen van de Quest van een organisatie (spec 007) als Map cursus-id → versienummer. */
export async function questVersions(t, questLinkCode) {
  const api = await t.anonymousApi();
  const res = await api.get('/api/quest/v1/courses', { headers: { Authorization: `Bearer ${questLinkCode}` } });
  expect(res.status()).toBe(200);
  const { courses } = await res.json();
  return new Map(courses.map((c) => [c.id, c.versionNumber]));
}

/** De rij van een overgenomen cursus in het cursusoverzicht. */
export const takenOverRow = (page, name) => page.locator('[data-test="taken-over-row"]').filter({ hasText: name });
