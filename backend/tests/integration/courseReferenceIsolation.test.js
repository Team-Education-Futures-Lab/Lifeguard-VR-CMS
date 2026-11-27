import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { getReference, keepVersion, publishNextVersion, removeReference, useNewVersion } from '../helpers/references.js'

// A receiver can never edit a taken-over course, and no organisation can see or change another
// organisation's references (specs/010 FR-008, FR-024, SC-003).

let a
let b
let c
let agentB
let agentC
let course

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C' })
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  agentC = (await agentWithSession({ organisationId: c.id })).agent
  const video = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  course = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: video.id }] })
  await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
  await publishNextVersion(course.courseId, { first: video.id })
})

describe('isolation', () => {
  it('refuses every owner route for a taken-over course (FR-008)', async () => {
    const url = `/api/organisation/courses/${course.courseId}`
    const steps = await db('CourseStep').where({ courseVersionId: course.versionIds[0] })
    const video = steps.find((step) => step.videoId)
    const before = await db('Course').where({ id: course.courseId }).first()
    const responses = [
      await agentB.get(url),
      await agentB.put(url).send({ draftVersionNumber: 3, name: 'Overgenomen', description: 'x', steps: [] }),
      await agentB.delete(url),
      await agentB.post(`${url}/publish`).send({}),
      await agentB.post(`${url}/unpublish`),
      await agentB.put(`${url}/availability`).send({ visibility: 'private' }),
      await agentB.get(`${url}/steps/${video.id}/videos/${video.videoId}/thumbnail`),
    ]
    for (const response of responses) expect(response.status).toBe(404)
    expect(await db('Course').where({ id: course.courseId }).first()).toEqual(before)
  })

  it('does not list a taken-over course among the own courses', async () => {
    const response = await agentB.get('/api/organisation/courses')
    expect(response.body.courses.map((row) => row.id)).not.toContain(course.courseId)
  })

  it('never shows or changes the reference of another organisation (FR-024)', async () => {
    for (const response of [
      await getReference(agentC, course.courseId),
      await useNewVersion(agentC, course.courseId),
      await keepVersion(agentC, course.courseId),
      await removeReference(agentC, course.courseId),
    ]) {
      expect(response.status).toBe(404)
    }
    expect(await db('OrganisationCourse').where({ organisationId: b.id, courseId: course.courseId }).first()).toMatchObject({
      courseVersionId: course.versionIds[0],
      declinedCourseVersionId: null,
    })
  })
})
