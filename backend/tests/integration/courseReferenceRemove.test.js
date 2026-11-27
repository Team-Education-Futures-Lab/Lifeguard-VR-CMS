import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { addReference, publishNextVersion, questVersions, removeReference } from '../helpers/references.js'

// "Verwijderen uit mijn organisatie" (specs/010 FR-009).

let a
let b
let c
let agentB
let video
let course

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
  c = await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C' })
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  video = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  course = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'selective', accessOrganisationIds: [b.id, c.id], versions: [{ first: video.id }] })
  await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0], addedAt: new Date('2026-11-01T10:00:00.000Z') })
  await createReferenceRow({ organisationId: c.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
})

const snapshot = async () => ({
  course: await db('Course').where({ id: course.courseId }).first(),
  versions: await db('CourseVersion').where({ courseId: course.courseId }).orderBy('id'),
  access: await db('CourseAccess').where({ courseId: course.courseId }).orderBy('organisationId'),
  others: await db('OrganisationCourse').where({ courseId: course.courseId }).whereNot('organisationId', b.id).orderBy('organisationId'),
})

describe('DELETE /course-references/:courseId', () => {
  it('removes only the reference of this organisation', async () => {
    const before = await snapshot()
    const response = await removeReference(agentB, course.courseId)
    expect(response.status).toBe(204)
    expect(await db('OrganisationCourse').where({ organisationId: b.id, courseId: course.courseId })).toEqual([])
    expect(await snapshot()).toEqual(before)
    expect((await questVersions('BBBB2222')).has(course.courseId)).toBe(false)
  })

  it('gives 404 a second time and for an own course', async () => {
    expect((await removeReference(agentB, course.courseId)).status).toBe(204)
    expect((await removeReference(agentB, course.courseId)).status).toBe(404)
    const own = await publishedCourse({ organisationId: b.id, name: 'Eigen', versions: [{ first: video.id }] })
    expect((await removeReference(agentB, own.courseId)).status).toBe(404)
    expect(await db('OrganisationCourse').where({ courseId: own.courseId, isOwner: true })).toHaveLength(1)
  })

  it('can add the course again: a new addedAt and the live version of that moment', async () => {
    await publishNextVersion(course.courseId, { first: video.id })
    await removeReference(agentB, course.courseId)
    const response = await addReference(agentB, course.courseId)
    expect(response.status).toBe(201)
    expect(response.body.version.versionNumber).toBe(2)
    const row = await db('OrganisationCourse').where({ organisationId: b.id, courseId: course.courseId }).first()
    expect(row.addedAt.getTime()).toBeGreaterThan(new Date('2026-11-02T00:00:00.000Z').getTime())
  })
})
