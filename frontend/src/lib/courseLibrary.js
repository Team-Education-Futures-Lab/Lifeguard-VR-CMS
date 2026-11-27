// Search, filter and sort of the course library, in the browser on the full list (specs/009
// FR-019, research R7), like the video library. Pure functions, so they are easy to test.
import { normalizeForSearch } from './videoLibrary'

export const OWNERSHIP_OPTIONS = [
  { key: 'all', label: 'Alle cursussen' },
  { key: 'own', label: 'Eigen cursussen' },
  { key: 'others', label: 'Van andere organisaties' },
]

export const SORT_OPTIONS = [
  { key: 'newest', label: 'Nieuwste publicatie eerst', field: 'publishedAt', direction: 'desc' },
  { key: 'oldest', label: 'Oudste publicatie eerst', field: 'publishedAt', direction: 'asc' },
  { key: 'name-asc', label: 'Naam (A–Z)', field: 'name', direction: 'asc' },
  { key: 'name-desc', label: 'Naam (Z–A)', field: 'name', direction: 'desc' },
]

export const DEFAULT_SORT = 'newest'

/** Courses whose name, description or owner contains the query, and that match the filters. */
export function filterCourses(courses, { query = '', ownership = 'all', ownerId = null } = {}) {
  const needle = normalizeForSearch(query.trim())
  return courses.filter((course) => {
    if (ownership === 'own' && !course.owner.isOwn) return false
    if (ownership === 'others' && course.owner.isOwn) return false
    if (ownerId !== null && course.owner.id !== ownerId) return false
    if (!needle) return true
    return [course.name, course.description, course.owner.name].some((text) => normalizeForSearch(text).includes(needle))
  })
}

const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true })

const COMPARE = {
  name: (a, b) => collator.compare(a.name, b.name),
  publishedAt: (a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt),
}

/** A sorted copy; equal values are ordered by id, so the order is always the same. */
export function sortCourses(courses, { field = 'publishedAt', direction = 'desc' } = {}) {
  const compare = COMPARE[field] ?? COMPARE.publishedAt
  const sign = direction === 'asc' ? 1 : -1
  return [...courses].sort((a, b) => sign * (compare(a, b) || a.id - b.id))
}

/** The library as shown: filtered, then sorted with the chosen option. */
export function libraryView(courses, { query, ownership, ownerId = null, sort = DEFAULT_SORT }) {
  const option = SORT_OPTIONS.find((o) => o.key === sort) ?? SORT_OPTIONS[0]
  return sortCourses(filterCourses(courses, { query, ownership, ownerId }), option)
}
