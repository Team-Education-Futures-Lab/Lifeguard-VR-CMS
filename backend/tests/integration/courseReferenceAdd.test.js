import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import {
  agentWithSession,
  createAdmin,
  createCourseRow,
  createOrganisationRow,
  createVideoRow,
  resetDatabase,
} from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { addReference } from '../helpers/references.js'
import { changeAvailability } from '../helpers/sharing.js'

// "Toevoegen aan mijn organisatie" (specs/010 FR-001 – FR-005, FR-020, research R8).

let a
let b
let agentA
let agentB
let video

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  agentA = (await agentWithSession({ organisationId: a.id })).agent
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  video = await createVideoRow({ organisationId: a.id, visibility: 'public' })
})

const shared = (options = {}) =>
  publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: video.id }], ...options })
const counts = async () => ({
  courses: (await db('Course').count('* as n').first()).n,
  versions: (await db('CourseVersion').count('* as n').first()).n,
  steps: (await db('CourseStep').count('* as n').first()).n,
})

describe('POST /course-references', () => {
  it('adds a reference to the live version, without copying anything (FR-003, SC-007)', async () => {
    const course = await shared({ versions: [{ first: video.id }, { first: video.id }] })
    const before = await counts()

    const response = await addReference(agentB, course.courseId)
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      courseId: course.courseId,
      name: 'Redden',
      owner: { id: a.id, name: 'Zwembad A' },
      version: { versionNumber: 2, stepCount: 3, videoCount: 1 },
      newVersion: null,
      notice: false,
      withdrawn: null,
    })
    expect(response.body.steps).toBeUndefined()

    const row = await db('OrganisationCourse').where({ organisationId: b.id, courseId: course.courseId }).first()
    expect(row).toMatchObject({ isOwner: 0, courseVersionId: course.versionIds[1], declinedCourseVersionId: null })
    expect(row.addedAt).toBeInstanceOf(Date)
    const version = await db('CourseVersion').where({ id: row.courseVersionId }).first()
    expect(version.courseId).toBe(course.courseId)
    expect(version.publishedAt).not.toBeNull()
    expect(await counts()).toEqual(before)
  })

  it('refuses unavailable courses with the same answer as an unknown course (FR-004)', async () => {
    const cases = [
      (await shared({ visibility: 'private' })).courseId,
      (await shared({ visibility: 'selective', accessOrganisationIds: [] })).courseId,
      (await shared({ deletedAt: new Date() })).courseId,
      (await shared({ versions: [{ first: video.id, unpublishedAt: new Date() }] })).courseId,
      (await createCourseRow({ organisationId: a.id, visibility: 'public' })).courseId,
      (await publishedCourse({ organisationId: b.id, name: 'Eigen', visibility: 'public', versions: [{ first: video.id }] })).courseId,
      999999,
    ]
    for (const id of cases) {
      const response = await addReference(agentB, id)
      expect(response.status, String(id)).toBe(404)
      expect(response.body).toEqual({ error: { code: 'not_found', message: 'Niet gevonden.' } })
    }
    expect(await db('OrganisationCourse').where({ organisationId: b.id, isOwner: false })).toEqual([])
  })

  it('accepts a selective course chosen for the organisation', async () => {
    const course = await shared({ visibility: 'selective', accessOrganisationIds: [b.id] })
    expect((await addReference(agentB, course.courseId)).status).toBe(201)
  })

  it('refuses a second time with course_already_added (FR-005)', async () => {
    const course = await shared()
    expect((await addReference(agentB, course.courseId)).status).toBe(201)
    const response = await addReference(agentB, course.courseId)
    expect(response.status).toBe(409)
    expect(response.body.error).toEqual({ code: 'course_already_added', message: 'Deze cursus staat al bij jullie cursussen.' })
  })

  it('refuses a missing or invalid courseId', async () => {
    for (const body of [{}, { courseId: '5' }, { courseId: 0 }, { courseId: 1.5 }]) {
      const response = await agentB.post('/api/organisation/course-references').send(body)
      expect(response.status, JSON.stringify(body)).toBe(400)
      expect(response.body.error.fields).toEqual({ courseId: 'Laad de pagina opnieuw en probeer het nog eens.' })
    }
  })

  it('never records a reference while the owner already shut the organisation out (research R8)', async () => {
    const course = await shared()
    for (let i = 0; i < 5; i++) {
      await db('OrganisationCourse').where({ organisationId: b.id, isOwner: false }).del()
      await db('Course').where({ id: course.courseId }).update({ visibility: 'public' })
      const [add, restrict] = await Promise.all([
        addReference(agentB, course.courseId),
        changeAvailability(agentA, course.courseId, { visibility: 'private' }),
      ])
      expect(restrict.status).toBe(200)
      expect([201, 404]).toContain(add.status)
      const row = await db('OrganisationCourse').where({ organisationId: b.id, isOwner: false }).first()
      expect(Boolean(row)).toBe(add.status === 201)
    }
  })

  it('is not for the administrator (FR-023)', async () => {
    const admin = await createAdmin()
    const { agent } = await agentWithSession({ administratorId: admin.id })
    const course = await shared()
    expect([401, 403]).toContain((await addReference(agent, course.courseId)).status)
  })
})
