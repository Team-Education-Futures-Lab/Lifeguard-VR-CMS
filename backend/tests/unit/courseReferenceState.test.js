import { describe, expect, it } from 'vitest'
import { referenceState } from '../../src/lib/courseReference.js'

// The table of data-model.md § Toestand van een verwijzing (specs/010 research R4).
const v = (id, versionNumber) => ({ id, versionNumber, publishedAt: new Date(`2026-11-2${versionNumber}T10:00:00.000Z`) })
const base = { chosen: v(1, 1), live: v(1, 1), declinedVersionId: null, courseDeleted: false, ownerDeleted: false, hasAccess: true }
const state = (changes) => referenceState({ ...base, ...changes })

describe('referenceState', () => {
  it.each([
    ['owner deleted', { ownerDeleted: true, live: v(2, 2) }, 'owner_deleted'],
    ['course deleted', { courseDeleted: true, live: v(2, 2) }, 'course_deleted'],
    ['unpublished', { live: null }, 'unpublished'],
    ['no access', { hasAccess: false, live: v(2, 2) }, 'no_access'],
  ])('%s: withdrawn without a new version or notice', (_name, changes, withdrawn) => {
    expect(state(changes)).toEqual({ withdrawn, newVersion: null, notice: false })
  })

  it('takes the most lasting reason first', () => {
    expect(state({ ownerDeleted: true, courseDeleted: true }).withdrawn).toBe('owner_deleted')
    expect(state({ courseDeleted: true, live: null }).withdrawn).toBe('course_deleted')
    expect(state({ live: null, hasAccess: false }).withdrawn).toBe('unpublished')
  })

  it('live version is the chosen version: nothing to do', () => {
    expect(state({})).toEqual({ withdrawn: null, newVersion: null, notice: false })
  })

  it('a newer live version, not declined: notice', () => {
    const live = v(2, 2)
    expect(state({ live })).toEqual({ withdrawn: null, newVersion: { id: 2, versionNumber: 2, publishedAt: live.publishedAt }, notice: true })
  })

  it('a newer live version that was declined: newVersion stays, no notice', () => {
    const result = state({ live: v(2, 2), declinedVersionId: 2 })
    expect(result.newVersion.versionNumber).toBe(2)
    expect(result.notice).toBe(false)
  })

  it('an even newer version than the declined one: notice again', () => {
    expect(state({ live: v(3, 3), declinedVersionId: 2 }).notice).toBe(true)
  })
})
