import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { basedOnOf, findOwnCopyOf, findOwnCourse, grantedVideoIds } from '../../src/modules/courses/courseRepository.js'
import { createOrganisationRow, createVideoRow, resetDatabase, restrictVideo, softDeleteVideo } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { publishNextVersion } from '../helpers/references.js'

// The derived rules of a copy (specs/011 data-model.md § Afgeleide gegevens, research R3, R4, R6).

let a
let b
let original
let copy
let x
let y

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  x = await createVideoRow({ organisationId: a.id, visibility: 'private' })
  y = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  original = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: x.id, second: y.id }] })
  copy = await publishedCourse({ organisationId: b.id, name: 'Redden', parentCourseId: original.courseId, versions: [{ first: x.id, second: y.id }] })
})

describe('grantedVideoIds', () => {
  it('gives the videos of version 1 of a copy, also restricted ones', async () => {
    await restrictVideo(y.id)
    const granted = await grantedVideoIds([copy.courseId])
    expect([...granted.get(copy.courseId)].sort()).toEqual([x.id, y.id].sort())
  })

  it('leaves out soft-deleted videos and videos only in later versions', async () => {
    const z = await createVideoRow({ organisationId: a.id })
    await publishNextVersion(copy.courseId, { first: z.id })
    await softDeleteVideo(y.id)
    expect([...(await grantedVideoIds([copy.courseId])).get(copy.courseId)]).toEqual([x.id])
  })

  it('keeps a video whose owner organisation was deleted', async () => {
    await db('Organisation').where({ id: a.id }).update({ deletedAt: db.raw('UTC_TIMESTAMP()') })
    expect((await grantedVideoIds([copy.courseId])).get(copy.courseId).has(x.id)).toBe(true)
  })

  it('is empty for a course without parentCourseId', async () => {
    const granted = await grantedVideoIds([original.courseId])
    expect(granted.get(original.courseId) ?? new Set()).toEqual(new Set())
    expect(await grantedVideoIds([])).toEqual(new Map())
  })
})

describe('basedOnOf', () => {
  it('gives the name of the newest published version of the original and the owner name', async () => {
    await publishNextVersion(original.courseId, { first: y.id, name: 'Redden 2.0' })
    await db('CourseVersion').where({ courseId: original.courseId }).whereNull('publishedAt').update({ name: 'Concept-naam' })
    const map = await basedOnOf([copy.courseId, original.courseId])
    expect(map.get(copy.courseId)).toEqual({ courseName: 'Redden 2.0', ownerName: 'Zwembad A' })
    expect(map.has(original.courseId)).toBe(false)
  })

  it('follows renames and keeps the names of a deleted original and owner', async () => {
    await db('Organisation').where({ id: a.id }).update({ name: 'Zwembad Anders', deletedAt: db.raw('UTC_TIMESTAMP()') })
    await db('Course').where({ id: original.courseId }).update({ deletedAt: db.raw('UTC_TIMESTAMP()') })
    await db('CourseVersion').where({ id: original.versionIds[0] }).update({ unpublishedAt: db.raw('UTC_TIMESTAMP()') })
    expect((await basedOnOf([copy.courseId])).get(copy.courseId)).toEqual({ courseName: 'Redden', ownerName: 'Zwembad Anders' })
  })
})

describe('findOwnCopyOf', () => {
  it('finds a not deleted own copy only', async () => {
    expect(await findOwnCopyOf(b.id, original.courseId)).toBe(copy.courseId)
    expect(await findOwnCopyOf(a.id, original.courseId)).toBeUndefined()
    await db('Course').where({ id: copy.courseId }).update({ deletedAt: db.raw('UTC_TIMESTAMP()') })
    expect(await findOwnCopyOf(b.id, original.courseId)).toBeUndefined()
  })
})

describe('findOwnCourse', () => {
  it('gives parentCourseId', async () => {
    expect((await findOwnCourse(copy.courseId, b.id)).parentCourseId).toBe(original.courseId)
    expect((await findOwnCourse(original.courseId, a.id)).parentCourseId).toBeNull()
  })
})
