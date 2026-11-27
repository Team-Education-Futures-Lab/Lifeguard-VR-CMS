import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { library } from '../helpers/sharing.js'
import { addReference } from '../helpers/references.js'

// What the owner sees of the receivers, and what the library shows a receiver (specs/010 FR-001,
// FR-018, FR-019, Clarifications).

let a
let b
let c
let agentA
let agentB
let course

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Albatros C', loginCode: 'ALBATROS-C' })
  agentA = (await agentWithSession({ organisationId: a.id })).agent
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  const video = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  course = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: video.id }] })
})

describe('the owner sees the receivers', () => {
  beforeEach(async () => {
    await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
    await createReferenceRow({ organisationId: c.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
  })

  it('in the course library, the draft document and the course list', async () => {
    const [own] = await library(agentA)
    expect(own.receivers).toEqual([{ id: c.id, name: 'Albatros C' }, { id: b.id, name: 'Zwembad B' }])
    expect(own.takenOver).toBeUndefined()

    const doc = await agentA.get(`/api/organisation/courses/${course.courseId}`)
    expect(doc.body.receivers).toEqual([{ id: c.id, name: 'Albatros C' }, { id: b.id, name: 'Zwembad B' }])
    const list = await agentA.get('/api/organisation/courses')
    expect(list.body.courses.find((row) => row.id === course.courseId).receiverCount).toBe(2)
  })

  it('without deleted receivers', async () => {
    await db('Organisation').where({ id: c.id }).update({ deletedAt: new Date() })
    const [own] = await library(agentA)
    expect(own.receivers).toEqual([{ id: b.id, name: 'Zwembad B' }])
    const list = await agentA.get('/api/organisation/courses')
    expect(list.body.courses[0].receiverCount).toBe(1)
  })

  it('never shows the receivers to another organisation', async () => {
    const [shared] = await library(agentB)
    expect(shared.receivers).toBeUndefined()
    expect(shared.takenOver).toBe(true)
  })

  it('deleting the course keeps it, its versions and the references (FR-018)', async () => {
    expect((await agentA.delete(`/api/organisation/courses/${course.courseId}`)).status).toBe(204)
    expect((await db('Course').where({ id: course.courseId }).first()).deletedAt).not.toBeNull()
    expect(await db('CourseVersion').where({ courseId: course.courseId })).toHaveLength(2)
    expect(await db('OrganisationCourse').where({ courseId: course.courseId, isOwner: false })).toHaveLength(2)
    expect((await agentA.get('/api/organisation/courses')).body.courses).toEqual([])
    expect(await library(agentA)).toEqual([])
  })
})

describe('takenOver in the course library (FR-001)', () => {
  it('turns true after adding, only for that organisation', async () => {
    const agentC = (await agentWithSession({ organisationId: c.id })).agent
    expect((await library(agentB))[0].takenOver).toBe(false)
    await addReference(agentB, course.courseId)
    expect((await library(agentB))[0].takenOver).toBe(true)
    expect((await library(agentC))[0].takenOver).toBe(false)
    const one = await agentB.get(`/api/organisation/course-library/${course.courseId}`)
    expect(one.body.takenOver).toBe(true)
  })
})
