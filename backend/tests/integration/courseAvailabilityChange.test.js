import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createCourseRow, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { changeAvailability, library, publish, saveRoute } from '../helpers/sharing.js'

// "Beschikbaarheid wijzigen" of a live course (specs/009 FR-006, FR-008, research R9).

let a
let b
let c
let agentA
let agentB
let agentC
let course
let open
let own

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C' })
  agentA = (await agentWithSession({ organisationId: a.id })).agent
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  agentC = (await agentWithSession({ organisationId: c.id })).agent
  open = await createVideoRow({ organisationId: a.id, name: 'Open', visibility: 'public' })
  own = await createVideoRow({ organisationId: a.id, name: 'Eigen', visibility: 'private' })
  course = await createCourseRow({ organisationId: a.id })
})

const ids = (courses) => courses.map((row) => row.id)

describe('PUT /courses/:id/availability', () => {
  it('restricts a live public course to B without a new version', async () => {
    await saveRoute(agentA, course.courseId, { first: open.id })
    const published = (await publish(agentA, course.courseId, { visibility: 'public' })).body
    const updatedAt = (await db('Course').where({ id: course.courseId }).first()).updatedAt
    const versions = await db('CourseVersion').where({ courseId: course.courseId }).count({ n: '*' })

    const response = await changeAvailability(agentA, course.courseId, { visibility: 'selective', accessOrganisationIds: [b.id] })
    expect(response.status).toBe(200)
    expect(response.body.availability).toEqual({ visibility: 'selective', accessOrganisations: [{ id: b.id, name: 'Zwembad B' }] })
    expect(response.body.status).toBe(published.status)
    expect(response.body.publication).toEqual(published.publication)
    expect((await db('Course').where({ id: course.courseId }).first()).updatedAt).toEqual(updatedAt)
    expect(await db('CourseVersion').where({ courseId: course.courseId }).count({ n: '*' })).toEqual(versions)

    expect(ids(await library(agentB))).toEqual([course.courseId])
    expect(ids(await library(agentC))).toEqual([])
  })

  it('refuses a course without a live version', async () => {
    const response = await changeAvailability(agentA, course.courseId, { visibility: 'public' })
    expect(response.status).toBe(409)
    expect(response.body.error).toMatchObject({ code: 'course_not_live', message: 'Publiceer de cursus eerst.' })

    await saveRoute(agentA, course.courseId, { first: open.id })
    await publish(agentA, course.courseId, { visibility: 'private' })
    await agentA.post(`/api/organisation/courses/${course.courseId}/unpublish`)
    expect((await changeAvailability(agentA, course.courseId, { visibility: 'public' })).status).toBe(409)
  })

  it.each([[{}], [{ visibility: 'x' }]])('refuses %j', async (body) => {
    await saveRoute(agentA, course.courseId, { first: open.id })
    await publish(agentA, course.courseId, { visibility: 'private' })
    const response = await changeAvailability(agentA, course.courseId, body)
    expect(response.status).toBe(400)
    expect(response.body.error.fields.visibility).toBe('Kies een beschikbaarheid.')
  })

  it('warns when the audience grows and the live version has a restricted video', async () => {
    await saveRoute(agentA, course.courseId, { first: own.id, second: open.id })
    await publish(agentA, course.courseId, { visibility: 'private' })
    let response = await changeAvailability(agentA, course.courseId, { visibility: 'public' })
    expect(response.status).toBe(409)
    expect(response.body.error.videos).toEqual([{ id: own.id, name: 'Eigen' }])
    expect((await db('Course').where({ id: course.courseId }).first()).visibility).toBe('private')

    response = await changeAvailability(agentA, course.courseId, { visibility: 'public', acknowledgedVideoIds: [own.id] })
    expect(response.status).toBe(200)
    expect(ids(await library(agentC))).toEqual([course.courseId])
  })

  it('does not warn when restricting', async () => {
    await saveRoute(agentA, course.courseId, { first: own.id, second: open.id })
    await publish(agentA, course.courseId, { visibility: 'public', acknowledgedVideoIds: [own.id] })
    const response = await changeAvailability(agentA, course.courseId, { visibility: 'selective', accessOrganisationIds: [b.id] })
    expect(response.status).toBe(200)
  })

  it('refuses the course of another organisation as not found', async () => {
    await saveRoute(agentA, course.courseId, { first: open.id })
    await publish(agentA, course.courseId, { visibility: 'public' })
    const response = await changeAvailability(agentB, course.courseId, { visibility: 'private' })
    expect(response.status).toBe(404)
    expect((await db('Course').where({ id: course.courseId }).first()).visibility).toBe('public')
  })
})
