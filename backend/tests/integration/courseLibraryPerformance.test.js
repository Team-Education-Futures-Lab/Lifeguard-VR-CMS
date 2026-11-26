import { performance } from 'node:perf_hooks'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'

// Speed of the course library (specs/009 SC-006). Data is inserted in bulk to keep the setup fast.

let a
let agentB
let video

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  const b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  video = await createVideoRow({ organisationId: a.id, visibility: 'public' })
})

/** Inserts `count` public live courses of A, each with version 1 of four steps. */
async function bulkCourses(count) {
  const now = new Date('2026-11-20T10:00:00.000Z')
  const courseIds = []
  for (let i = 0; i < count; i++) {
    const [id] = await db('Course').insert({ createdAt: now, updatedAt: now, visibility: 'public' })
    courseIds.push(id)
  }
  await db('OrganisationCourse').insert(courseIds.map((courseId) => ({ organisationId: a.id, courseId, isOwner: true, addedAt: now })))
  await db('CourseVersion').insert(courseIds.map((courseId, i) => ({ courseId, versionNumber: 1, name: `Cursus ${i}`, description: 'Snel', publishedAt: now })))
  const versions = await db('CourseVersion').whereIn('courseId', courseIds).select('id')
  const steps = versions.flatMap((version) =>
    [0, 1, 2, 3].map((s) => ({ courseVersionId: version.id, isStart: s === 0, stepType: 'video', videoId: video.id, positionX: 0, positionY: 0 })),
  )
  await db.batchInsert('CourseStep', steps, 500)
}

describe('course library speed', () => {
  it('lists 200 shared courses within 2 seconds (SC-006)', async () => {
    await bulkCourses(200)
    const start = performance.now()
    const response = await agentB.get('/api/organisation/course-library')
    const ms = performance.now() - start
    expect(response.status).toBe(200)
    expect(response.body.courses).toHaveLength(200)
    expect(ms).toBeLessThan(2000)
  })
})
