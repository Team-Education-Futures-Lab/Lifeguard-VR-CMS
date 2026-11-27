import { api } from './client'

// Course API (specs/004, 005, 006 and 009 contracts/api.md).

export async function listCourses() {
  const data = await api('/api/organisation/courses')
  return data.courses
}

export function createCourse({ name, description }) {
  return api('/api/organisation/courses', { method: 'POST', body: { name, description } })
}

export function getCourse(id) {
  return api(`/api/organisation/courses/${id}`)
}

/** "Opslaan als concept": sends the whole draft and returns the saved draft with all ids. */
export function saveCourse(id, draft) {
  return api(`/api/organisation/courses/${id}`, { method: 'PUT', body: draft })
}

export function deleteCourse(id) {
  return api(`/api/organisation/courses/${id}`, { method: 'DELETE' })
}

/**
 * Publishes the saved draft; returns the (new) draft document (specs/006 contracts/api.md).
 * `choices` ({ visibility, accessOrganisationIds, acknowledgedVideoIds }) sets who sees the course
 * in the course library (specs/009 contracts/api.md); without it the availability stays.
 */
export function publishCourse(id, choices) {
  return api(`/api/organisation/courses/${id}/publish`, { method: 'POST', body: choices })
}

/** "Beschikbaarheid wijzigen" of a live course; returns the draft document (specs/009 FR-006). */
export function changeCourseAvailability(id, choices) {
  return api(`/api/organisation/courses/${id}/availability`, { method: 'PUT', body: choices })
}

/** Takes the live version off the Quests; returns the draft document (specs/006 FR-016). */
export function unpublishCourse(id) {
  return api(`/api/organisation/courses/${id}/unpublish`, { method: 'POST' })
}
