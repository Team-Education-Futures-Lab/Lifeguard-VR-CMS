import { api } from './client'

// Course library API (specs/009 contracts/api.md).

export async function listLibraryCourses() {
  const data = await api('/api/organisation/course-library')
  return data.courses
}

export function getLibraryCourse(id) {
  return api(`/api/organisation/course-library/${id}`)
}
