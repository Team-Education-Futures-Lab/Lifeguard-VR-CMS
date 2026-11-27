import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { getReference, listReferences, publishNextVersion, unpublishLatest } from '../helpers/references.js'

// The receiver's view of its taken-over courses (specs/010 FR-006, FR-007, FR-011, FR-017).

let a
let b
let agentB
let restricted
let open
let course

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  restricted = await createVideoRow({ organisationId: a.id, name: 'Alleen A', visibility: 'private' })
  open = await createVideoRow({ organisationId: a.id, name: 'Open', visibility: 'public' })
  course = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: restricted.id }] })
  await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
})

describe('GET /course-references', () => {
  it('shows the summary of the chosen version, by name (FR-006, FR-007)', async () => {
    const other = await publishedCourse({ organisationId: a.id, name: 'Aanspoelen', visibility: 'public', versions: [{ first: open.id }] })
    await createReferenceRow({ organisationId: b.id, courseId: other.courseId, courseVersionId: other.versionIds[0] })
    await publishNextVersion(course.courseId, { first: open.id, name: 'Redden 2' })

    const { references, noticeCount } = await listReferences(agentB)
    expect(references.map((r) => r.name)).toEqual(['Aanspoelen', 'Redden'])
    const redden = references[1]
    expect(redden).toMatchObject({
      courseId: course.courseId,
      description: 'Beschrijving van Redden',
      owner: { id: a.id, name: 'Zwembad A' },
      version: { versionNumber: 1, stepCount: 3, videoCount: 1 },
      thumbnailUrl: `/api/organisation/course-references/${course.courseId}/thumbnail?v=1`,
      newVersion: { versionNumber: 2 },
      notice: true,
      withdrawn: null,
    })
    expect(Object.keys(redden).sort()).toEqual(
      ['addedAt', 'courseId', 'description', 'name', 'newVersion', 'notice', 'owner', 'thumbnailUrl', 'version', 'withdrawn'].sort(),
    )
    expect(noticeCount).toBe(1)
  })

  it('serves the image of the chosen version, also from a restricted video (research R11)', async () => {
    const response = await agentB.get(`/api/organisation/course-references/${course.courseId}/thumbnail?v=1`)
    expect(response.status).toBe(200)
  })

  it('does not put the videos of the course in the receiver’s video library', async () => {
    const response = await agentB.get('/api/organisation/videos')
    expect(response.status).toBe(200)
    expect(JSON.stringify(response.body)).not.toContain('Alleen A')
  })

  it('gives 404 for a course without a reference, and for an own course', async () => {
    const own = await publishedCourse({ organisationId: b.id, name: 'Eigen', versions: [{ first: open.id }] })
    for (const id of [own.courseId, 999999]) {
      expect((await getReference(agentB, id)).status).toBe(404)
      expect((await agentB.get(`/api/organisation/course-references/${id}/thumbnail`)).status).toBe(404)
    }
  })
})

describe('withdrawn (FR-017)', () => {
  const withdrawn = async () => (await getReference(agentB, course.courseId)).body

  it.each([
    ['unpublished', () => unpublishLatest(course.courseId)],
    ['course_deleted', () => db('Course').where({ id: course.courseId }).update({ deletedAt: new Date() })],
    ['no_access', () => db('Course').where({ id: course.courseId }).update({ visibility: 'private' })],
    ['no_access', () => db('Course').where({ id: course.courseId }).update({ visibility: 'selective' })],
    ['owner_deleted', () => db('Organisation').where({ id: a.id }).update({ deletedAt: new Date() })],
  ])('%s', async (reason, act) => {
    await publishNextVersion(course.courseId, { first: open.id })
    await act()
    const reference = await withdrawn()
    expect(reference).toMatchObject({ withdrawn: reason, newVersion: null, notice: false, version: { versionNumber: 1 } })
    expect(reference.owner.name).toBe('Zwembad A')
  })

  it('recovers: access again gives the notice for a newer live version', async () => {
    await db('Course').where({ id: course.courseId }).update({ visibility: 'private' })
    await publishNextVersion(course.courseId, { first: open.id })
    expect((await withdrawn()).withdrawn).toBe('no_access')

    await db('Course').where({ id: course.courseId }).update({ visibility: 'selective' })
    await db('CourseAccess').insert({ courseId: course.courseId, organisationId: b.id })
    expect(await withdrawn()).toMatchObject({ withdrawn: null, notice: true, newVersion: { versionNumber: 2 } })
  })
})
