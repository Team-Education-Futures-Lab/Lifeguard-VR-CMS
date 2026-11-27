import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { sameContent } from '../../src/lib/courseContent.js'
import { versionContents } from '../../src/modules/courses/courseRepository.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase, restrictVideo } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { copyReference, keepVersion, listReferences, publishNextVersion, unpublishLatest } from '../helpers/references.js'

// "Aanpassen" (specs/011 FR-001, FR-003 – FR-007; contracts/api.md § POST /course-references/:courseId/copy).

let a
let b
let agentB
let x
let y
let course

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  x = await createVideoRow({ organisationId: a.id, visibility: 'private' })
  y = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  course = await publishedCourse({
    organisationId: a.id,
    name: 'Redden',
    visibility: 'public',
    versions: [{ first: x.id, second: y.id }, { first: y.id, questionText: 'Wat doe je nu?', name: 'Redden 2' }],
  })
  // B stays on version 1, A has version 2 live.
  await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
})

const contentOf = async (versionId) => {
  const version = await db('CourseVersion').where({ id: versionId }).first()
  return { name: version.name, description: version.description, ...(await versionContents([versionId])).get(versionId) }
}

async function expectCopyOf(copyId, chosenVersionId) {
  const versions = await db('CourseVersion').where({ courseId: copyId }).orderBy('versionNumber')
  expect(versions.map((v) => [v.versionNumber, v.publishedAt !== null, v.unpublishedAt])).toEqual([
    [1, true, null],
    [2, false, null],
  ])
  const chosen = await contentOf(chosenVersionId)
  for (const version of versions) expect(sameContent(await contentOf(version.id), chosen)).toBe(true)
  // Positions on the canvas are copied too (FR-003).
  const positions = async (id) => (await db('CourseStep').where({ courseVersionId: id }).orderBy('id')).map((s) => [s.positionX, s.positionY])
  expect(await positions(versions[1].id)).toEqual(await positions(chosenVersionId))
}

describe('POST /course-references/:courseId/copy', () => {
  it('makes an own copy of the chosen version, not the newer one', async () => {
    const response = await copyReference(agentB, course.courseId)
    expect(response.status).toBe(201)
    const copyId = response.body.courseId
    expect(copyId).not.toBe(course.courseId)

    const row = await db('Course').where({ id: copyId }).first()
    expect(row.parentCourseId).toBe(course.courseId)
    expect(row.visibility).toBe('private')
    expect(await db('CourseAccess').where({ courseId: copyId })).toEqual([])
    expect(await db('OrganisationCourse').where({ courseId: copyId })).toMatchObject([{ organisationId: b.id, isOwner: 1 }])
    expect(await db('OrganisationCourse').where({ organisationId: b.id, courseId: course.courseId })).toEqual([])
    await expectCopyOf(copyId, course.versionIds[0])
  })

  it('opens as a published own course with "Gebaseerd op"', async () => {
    const { courseId } = (await copyReference(agentB, course.courseId)).body
    const doc = (await agentB.get(`/api/organisation/courses/${courseId}`)).body
    expect(doc).toMatchObject({
      id: courseId,
      name: 'Redden',
      status: 'published',
      draftVersionNumber: 2,
      publication: { versionNumber: 1 },
      availability: { visibility: 'private', accessOrganisations: [] },
      receivers: [],
      basedOn: { courseName: 'Redden 2', ownerName: 'Zwembad A' },
    })
    const list = (await agentB.get('/api/organisation/courses')).body.courses
    expect(list).toEqual([expect.objectContaining({ id: courseId, status: 'published', basedOn: { courseName: 'Redden 2', ownerName: 'Zwembad A' } })])
    expect(await listReferences(agentB)).toEqual({ references: [], noticeCount: 0 })
  })

  it('copies the chosen version after "Huidige versie houden"', async () => {
    await keepVersion(agentB, course.courseId)
    const { courseId } = (await copyReference(agentB, course.courseId)).body
    await expectCopyOf(courseId, course.versionIds[0])
  })

  it.each([
    ['unpublished', () => unpublishLatest(course.courseId)],
    ['deleted', () => db('Course').where({ id: course.courseId }).update({ deletedAt: db.raw('UTC_TIMESTAMP()') })],
    ['restricted', () => db('Course').where({ id: course.courseId }).update({ visibility: 'private' })],
    ['owner deleted', () => db('Organisation').where({ id: a.id }).update({ deletedAt: db.raw('UTC_TIMESTAMP()') })],
  ])('also works when the original is %s (FR-001)', async (_label, change) => {
    await restrictVideo(x.id)
    await change()
    const response = await copyReference(agentB, course.courseId)
    expect(response.status).toBe(201)
    await expectCopyOf(response.body.courseId, course.versionIds[0])
  })

  it('gives 404 without a reference', async () => {
    const own = await publishedCourse({ organisationId: b.id, name: 'Eigen', versions: [{ first: y.id }] })
    const other = await publishedCourse({ organisationId: a.id, name: 'Ander', visibility: 'public', versions: [{ first: y.id }] })
    for (const id of [own.courseId, other.courseId, 999999]) {
      const response = await copyReference(agentB, id)
      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('not_found')
    }
    expect((await agentB.post('/api/organisation/course-references/abc/copy')).status).toBe(404)
    expect(await db('Course').whereNotNull('parentCourseId')).toEqual([])
  })

  it('gives 409 course_already_copied the second time', async () => {
    const { courseId } = (await copyReference(agentB, course.courseId)).body
    const again = await copyReference(agentB, course.courseId)
    expect(again.status).toBe(409)
    expect(again.body.error).toMatchObject({ code: 'course_already_copied', courseId })
    expect(again.body.error.message).toBe('Deze cursus is al aangepast. De aangepaste cursus staat bij je cursussen.')
  })

  it('keeps working after the owner publishes another version meanwhile', async () => {
    await publishNextVersion(course.courseId, { first: y.id })
    const { courseId } = (await copyReference(agentB, course.courseId)).body
    await expectCopyOf(courseId, course.versionIds[0])
  })
})
