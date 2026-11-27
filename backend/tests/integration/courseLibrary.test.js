import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createCourseRow, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { library, publish, saveRoute } from '../helpers/sharing.js'

// The central course library (specs/009 FR-013 – FR-017, FR-023, FR-024, SC-001, SC-004).

let a
let b
let c
let agentA
let agentB
let agentC
let video
let other

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C' })
  agentA = (await agentWithSession({ organisationId: a.id })).agent
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  agentC = (await agentWithSession({ organisationId: c.id })).agent
  video = await createVideoRow({ organisationId: a.id, name: 'Open', visibility: 'public' })
  other = await createVideoRow({ organisationId: a.id, name: 'Open 2', visibility: 'public' })
})

const live = (name, options = {}) =>
  publishedCourse({ organisationId: a.id, name, versions: [{ first: video.id, second: other.id }], ...options })
const names = (courses) => courses.map((course) => course.name).sort()

describe('GET /course-library', () => {
  it('shows exactly the courses that are available to each organisation (SC-001)', async () => {
    await live('Algemeen', { visibility: 'public' })
    await live('Selectief', { visibility: 'selective', accessOrganisationIds: [b.id] })
    await live('Eigen', { visibility: 'private' })
    await createCourseRow({ organisationId: a.id, name: 'Concept', visibility: 'public' })
    await live('Onpubliceerd', {
      visibility: 'public',
      versions: [{ first: video.id, unpublishedAt: new Date('2026-11-25T10:00:00.000Z') }],
    })
    await live('Verwijderd', { visibility: 'public', deletedAt: new Date() })
    const original = await live('Origineel', { visibility: 'private' })
    await live('Kopie', { visibility: 'public', parentCourseId: original.courseId })

    expect(names(await library(agentB))).toEqual(['Algemeen', 'Selectief'])
    expect(names(await library(agentC))).toEqual(['Algemeen'])
    const own = await library(agentA)
    expect(names(own)).toEqual(['Algemeen', 'Selectief'])
    expect(own.every((course) => course.owner.isOwn)).toBe(true)
    expect(own.find((course) => course.name === 'Selectief')).toMatchObject({
      visibility: 'selective',
      accessOrganisations: [{ id: b.id, name: 'Zwembad B' }],
    })
  })

  it('leaves out the courses of a deleted owner', async () => {
    await live('Algemeen', { visibility: 'public' })
    await db('Organisation').where({ id: a.id }).update({ deletedAt: new Date() })
    expect(await library(agentB)).toEqual([])
  })

  it('describes the live version, not a changed draft', async () => {
    const course = await live('Live naam', {
      visibility: 'public',
      versions: [
        { first: video.id, publishedAt: new Date('2026-11-20T10:00:00.000Z') },
        { first: video.id, second: other.id, name: 'Live naam', publishedAt: new Date('2026-11-21T10:00:00.000Z') },
      ],
    })
    await db('CourseVersion').where({ id: course.draftVersionId }).update({ name: 'Nieuwe naam in concept' })
    const [row] = await library(agentB)
    expect(row).toEqual({
      id: course.courseId,
      name: 'Live naam',
      description: 'Beschrijving van Live naam',
      owner: { id: a.id, name: 'Zwembad A', isOwn: false },
      versionNumber: 2,
      publishedAt: '2026-11-21T10:00:00.000Z',
      stepCount: 3,
      videoCount: 2,
      thumbnailUrl: `/api/organisation/course-library/${course.courseId}/thumbnail`,
      takenOver: false,
    })
    expect((await agentB.get(`/api/organisation/course-library/${course.courseId}`)).body).toEqual(row)
  })

  it('puts the newest publication first', async () => {
    await live('Oud', { visibility: 'public', versions: [{ first: video.id, publishedAt: new Date('2026-11-01T10:00:00.000Z') }] })
    await live('Nieuw', { visibility: 'public', versions: [{ first: video.id, publishedAt: new Date('2026-11-10T10:00:00.000Z') }] })
    expect((await library(agentB)).map((course) => course.name)).toEqual(['Nieuw', 'Oud'])
  })
})

describe('leaving the library (FR-023, FR-024, SC-004)', () => {
  let course

  beforeEach(async () => {
    course = await createCourseRow({ organisationId: a.id })
    await saveRoute(agentA, course.courseId, { first: video.id })
    expect((await publish(agentA, course.courseId, { visibility: 'public' })).status).toBe(200)
    expect((await library(agentB)).map((row) => row.id)).toEqual([course.courseId])
  })

  it('leaves after unpublishing, keeps its availability, and comes back after publishing again', async () => {
    await agentA.post(`/api/organisation/courses/${course.courseId}/unpublish`)
    expect(await library(agentB)).toEqual([])
    expect((await agentB.get(`/api/organisation/course-library/${course.courseId}`)).status).toBe(404)
    expect((await agentA.get(`/api/organisation/courses/${course.courseId}`)).body.availability.visibility).toBe('public')

    expect((await publish(agentA, course.courseId, { visibility: 'public' })).status).toBe(200)
    expect((await library(agentB)).map((row) => row.id)).toEqual([course.courseId])
  })

  it('leaves after deleting', async () => {
    expect((await agentA.delete(`/api/organisation/courses/${course.courseId}`)).status).toBe(204)
    expect(await library(agentB)).toEqual([])
    expect((await agentB.get(`/api/organisation/course-library/${course.courseId}`)).status).toBe(404)
  })
})
