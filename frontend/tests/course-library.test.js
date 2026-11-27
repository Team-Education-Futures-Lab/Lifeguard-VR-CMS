import { describe, expect, it } from 'vitest'
import { filterCourses, libraryView, sortCourses } from '../src/lib/courseLibrary'

// Search, filter and sort of the course library (specs/009 FR-019).

const OWN = { id: 3, name: 'Zwembad A', isOwn: true }
const NORTH = { id: 4, name: 'Brandweer Académie Noord', isOwn: false }
const SOUTH = { id: 5, name: 'Reddingsbrigade Zuid', isOwn: false }

const COURSES = [
  { id: 1, name: 'Redden in open water', description: 'Stroming en golven', owner: NORTH, publishedAt: '2026-11-20T10:00:00Z' },
  { id: 2, name: 'Duiken', description: null, owner: OWN, publishedAt: '2026-11-22T10:00:00Z' },
  { id: 3, name: 'Brand in de keuken', description: 'Eerste hulp bij brandwonden', owner: SOUTH, publishedAt: '2026-11-21T10:00:00Z' },
  { id: 4, name: 'Aquarobics', description: 'Rustig begin', owner: SOUTH, publishedAt: '2026-11-21T10:00:00Z' },
]
const ids = (list) => list.map((course) => course.id)

describe('filterCourses', () => {
  it('searches name, description and owner, on part of a word, ignoring case and accents', () => {
    expect(ids(filterCourses(COURSES, { query: 'REDD' }))).toEqual([1, 3, 4])
    expect(ids(filterCourses(COURSES, { query: 'brandwond' }))).toEqual([3])
    expect(ids(filterCourses(COURSES, { query: 'academie' }))).toEqual([1])
  })

  it('filters own courses, courses of others and one owner', () => {
    expect(ids(filterCourses(COURSES, { ownership: 'own' }))).toEqual([2])
    expect(ids(filterCourses(COURSES, { ownership: 'others' }))).toEqual([1, 3, 4])
    expect(ids(filterCourses(COURSES, { ownerId: SOUTH.id }))).toEqual([3, 4])
  })
})

describe('sortCourses', () => {
  it('sorts on publication date and name, with the id as tie-break', () => {
    expect(ids(sortCourses(COURSES, { field: 'publishedAt', direction: 'desc' }))).toEqual([2, 4, 3, 1])
    expect(ids(sortCourses(COURSES, { field: 'publishedAt', direction: 'asc' }))).toEqual([1, 3, 4, 2])
    expect(ids(sortCourses(COURSES, { field: 'name', direction: 'asc' }))).toEqual([4, 3, 2, 1])
    expect(ids(sortCourses(COURSES, { field: 'name', direction: 'desc' }))).toEqual([1, 2, 3, 4])
  })
})

describe('libraryView', () => {
  it('combines search, filters and sorting; the newest publication comes first by default', () => {
    expect(ids(libraryView(COURSES, { query: '', ownership: 'all' }))).toEqual([2, 4, 3, 1])
    expect(ids(libraryView(COURSES, { query: 'r', ownership: 'others', ownerId: SOUTH.id, sort: 'name-asc' }))).toEqual([4, 3])
  })
})
