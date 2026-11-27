import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { versionsByIds } from '../../src/modules/courses/courseRepository.js'
import { receiversOf, referencesQuery } from '../../src/modules/courseReferences/courseReferenceRepository.js'
import { createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'

// The only definitions of references and receivers (specs/010 research R3, FR-019).

let a
let b
let c
let course

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Albatros C', loginCode: 'ALBATROS-C' })
  const video = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  course = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: video.id }] })
})

describe('referencesQuery', () => {
  it('only gives the reference rows of the organisation, never owner rows', async () => {
    await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
    await createReferenceRow({ organisationId: c.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })

    const rows = await referencesQuery(b.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ courseId: course.courseId, courseVersionId: course.versionIds[0], ownerId: a.id, ownerName: 'Zwembad A' })
    expect(await referencesQuery(a.id)).toEqual([])
  })

  it('keeps references to a deleted course and of a deleted owner', async () => {
    await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
    await db('Course').where({ id: course.courseId }).update({ deletedAt: new Date() })
    await db('Organisation').where({ id: a.id }).update({ deletedAt: new Date() })

    const [row] = await referencesQuery(b.id)
    expect(row.courseDeletedAt).not.toBeNull()
    expect(row.ownerDeletedAt).not.toBeNull()
  })

  it('requires an organisation id', () => {
    expect(() => referencesQuery(undefined)).toThrow()
  })
})

describe('receiversOf', () => {
  it('gives the active receivers by name, without the owner', async () => {
    await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
    await createReferenceRow({ organisationId: c.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
    expect((await receiversOf([course.courseId])).get(course.courseId)).toEqual([
      { id: c.id, name: 'Albatros C' },
      { id: b.id, name: 'Zwembad B' },
    ])

    await db('Organisation').where({ id: c.id }).update({ deletedAt: new Date() })
    expect((await receiversOf([course.courseId])).get(course.courseId)).toEqual([{ id: b.id, name: 'Zwembad B' }])
    expect((await receiversOf([])).size).toBe(0)
  })
})

describe('versionsByIds', () => {
  it('gives published versions in the shape of latestPublishedVersions', async () => {
    const versions = await versionsByIds([course.versionIds[0], course.draftVersionId])
    expect([...versions.keys()]).toEqual([course.versionIds[0]])
    expect(versions.get(course.versionIds[0])).toMatchObject({ courseId: course.courseId, versionNumber: 1, unpublishedAt: null })
  })
})
