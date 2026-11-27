import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createAdmin, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { copyReference, getReference, listReferences, publishNextVersion, questVersions, unpublishLatest } from '../helpers/references.js'

// The original and the other organisations notice nothing; later changes to the original never
// reach the copy (specs/011 FR-008 – FR-010, FR-020, SC-003, SC-006).

let a
let b
let c
let agentA
let agentB
let agentC
let video
let course

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
  c = await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C', questLinkCode: 'CCCC2222' })
  agentA = (await agentWithSession({ organisationId: a.id })).agent
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  agentC = (await agentWithSession({ organisationId: c.id })).agent
  video = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  course = await publishedCourse({
    organisationId: a.id,
    name: 'Redden',
    visibility: 'selective',
    accessOrganisationIds: [b.id, c.id],
    versions: [{ first: video.id }, { first: video.id, questionText: 'Versie 2?' }],
  })
  await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
  await createReferenceRow({ organisationId: c.id, courseId: course.courseId, courseVersionId: course.versionIds[0], declinedCourseVersionId: course.versionIds[1] })
})

const originalRows = async () => ({
  course: await db('Course').where({ id: course.courseId }).first(),
  versions: await db('CourseVersion').where({ courseId: course.courseId }).orderBy('id'),
  steps: await db('CourseStep').whereIn('courseVersionId', [...course.versionIds, course.draftVersionId]).orderBy('id'),
  access: await db('CourseAccess').where({ courseId: course.courseId }).orderBy('organisationId'),
  owner: await db('OrganisationCourse').where({ courseId: course.courseId, isOwner: true }),
  c: await db('OrganisationCourse').where({ courseId: course.courseId, organisationId: c.id }),
})

const copyContent = async (copyId) => ({
  versions: await db('CourseVersion').where({ courseId: copyId }).orderBy('id'),
  steps: await db('CourseStep').join('CourseVersion as cv', 'cv.id', 'CourseStep.courseVersionId').where('cv.courseId', copyId).orderBy('CourseStep.id').select('CourseStep.*'),
})

describe('"Aanpassen" is invisible to the original and other organisations', () => {
  it('changes nothing of the original or of C (FR-008)', async () => {
    const before = await originalRows()
    const referenceOfC = (await getReference(agentC, course.courseId)).body
    expect((await copyReference(agentB, course.courseId)).status).toBe(201)
    expect(await originalRows()).toEqual(before)
    expect((await getReference(agentC, course.courseId)).body).toEqual(referenceOfC)
    expect((await questVersions('CCCC2222')).get(course.courseId)).toBe(1)
  })

  it('B no longer counts as receiver, and nothing about the copy reaches A (FR-010)', async () => {
    const copyId = (await copyReference(agentB, course.courseId)).body.courseId
    const draftA = (await agentA.get(`/api/organisation/courses/${course.courseId}`)).body
    expect(draftA.receivers).toEqual([{ id: c.id, name: 'Zwembad C' }])
    const listA = (await agentA.get('/api/organisation/courses')).body.courses
    expect(listA.find((row) => row.id === course.courseId).receiverCount).toBe(1)
    const libraryA = (await agentA.get('/api/organisation/course-library')).body
    const detailsA = (await agentA.get(`/api/organisation/course-library/${course.courseId}`)).body
    for (const body of [draftA, listA, libraryA, detailsA]) {
      const text = JSON.stringify(body)
      expect(text).not.toContain('parentCourseId')
      expect(text).not.toContain(`"id":${copyId},`)
    }
    expect(listA.map((row) => row.id)).not.toContain(copyId)
  })

  it('later changes to the original never reach the copy (FR-009)', async () => {
    const copyId = (await copyReference(agentB, course.courseId)).body.courseId
    const before = await copyContent(copyId)
    await publishNextVersion(course.courseId, { first: video.id })
    expect(await listReferences(agentB)).toEqual({ references: [], noticeCount: 0 })
    await unpublishLatest(course.courseId)
    await db('Course').where({ id: course.courseId }).update({ visibility: 'private' })
    await db('CourseVersion').where({ courseId: course.courseId }).whereNotNull('publishedAt').update({ name: 'Nieuwe naam' })
    await db('Course').where({ id: course.courseId }).update({ deletedAt: db.raw('UTC_TIMESTAMP()') })
    await db('Organisation').where({ id: a.id }).update({ name: 'Zwembad A nieuw', deletedAt: db.raw('UTC_TIMESTAMP()') })

    expect(await copyContent(copyId)).toEqual(before)
    expect((await questVersions('BBBB2222')).get(copyId)).toBe(1)
    expect(await listReferences(agentB)).toEqual({ references: [], noticeCount: 0 })
    // Only the names in "Gebaseerd op" follow the original (FR-012).
    const doc = (await agentB.get(`/api/organisation/courses/${copyId}`)).body
    expect(doc.basedOn).toEqual({ courseName: 'Nieuwe naam', ownerName: 'Zwembad A nieuw' })
    expect(doc.status).toBe('published')
  })

  it('works only for the own organisation; not for the administrator (FR-020)', async () => {
    expect((await copyReference(agentA, course.courseId)).status).toBe(404)
    const admin = await createAdmin()
    const { agent } = await agentWithSession({ administratorId: admin.id })
    expect([401, 403]).toContain((await copyReference(agent, course.courseId)).status)
    const copyId = (await copyReference(agentB, course.courseId)).body.courseId
    // C cannot reach B's copy, and B cannot copy C's reference.
    expect((await agentC.get(`/api/organisation/courses/${copyId}`)).status).toBe(404)
    expect((await copyReference(agentB, course.courseId)).status).toBe(409)
    expect(await db('OrganisationCourse').where({ organisationId: c.id, courseId: course.courseId })).toHaveLength(1)
    expect(await db('Course').whereNotNull('parentCourseId')).toHaveLength(1)
  })
})
