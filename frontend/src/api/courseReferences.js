import { api } from './client'

// Courses taken over from the course library (specs/010 contracts/api.md). The id is the id of
// the original course.

const BASE = '/api/organisation/course-references'

/** { references, noticeCount } */
export function listReferences() {
  return api(BASE)
}

export function getReference(courseId) {
  return api(`${BASE}/${courseId}`)
}

export function addReference(courseId) {
  return api(BASE, { method: 'POST', body: { courseId } })
}

export function removeReference(courseId) {
  return api(`${BASE}/${courseId}`, { method: 'DELETE' })
}

/** "Nieuwe versie gebruiken": always the live version of this moment. */
export function useNewVersion(courseId) {
  return api(`${BASE}/${courseId}/update`, { method: 'POST' })
}

/** "Huidige versie houden". */
export function keepVersion(courseId) {
  return api(`${BASE}/${courseId}/keep`, { method: 'POST' })
}
