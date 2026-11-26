import { performance } from 'node:perf_hooks'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { questGet } from '../helpers/quest.js'

// Speed of the Quest API (specs/007 SC-002, SC-003). Data is inserted in bulk to keep the setup fast.

const CODE = 'QZ7K2M9X'
let a
let video

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A', questLinkCode: CODE })
  video = await createVideoRow({ organisationId: a.id })
})

/** Inserts `count` live courses, each with version 1 published and the given steps per version. */
async function bulkCourses(count, stepsPerVersion) {
  const now = new Date('2026-11-20T10:00:00.000Z')
  const courseIds = []
  for (let i = 0; i < count; i++) {
    const [id] = await db('Course').insert({ createdAt: now, updatedAt: now })
    courseIds.push(id)
  }
  await db('OrganisationCourse').insert(courseIds.map((courseId) => ({ organisationId: a.id, courseId, isOwner: true, addedAt: now })))
  await db('CourseVersion').insert(courseIds.map((courseId, i) => ({ courseId, versionNumber: 1, name: `Cursus ${i}`, description: 'Snel', publishedAt: now })))
  const versions = await db('CourseVersion').whereIn('courseId', courseIds).select('id', 'courseId')
  const steps = []
  for (const version of versions) {
    for (let s = 0; s < stepsPerVersion; s++) {
      const question = s % 2 === 1
      steps.push({
        courseVersionId: version.id,
        isStart: s === 0,
        stepType: question ? 'question' : 'video',
        videoId: question ? null : video.id,
        questionText: question ? `Vraag ${s}` : null,
        positionX: 0,
        positionY: 0,
      })
    }
  }
  await db.batchInsert('CourseStep', steps, 500)
  const questionIds = (await db('CourseStep').whereIn('courseVersionId', versions.map((v) => v.id)).where({ stepType: 'question' }).select('id')).map((row) => row.id)
  const answers = questionIds.flatMap((courseStepId) =>
    [0, 1, 2, 3].map((sortOrder) => ({ courseStepId, answerText: `Antwoord ${sortOrder}`, isCorrect: sortOrder === 0, sortOrder })),
  )
  if (answers.length > 0) await db.batchInsert('Answer', answers, 500)
  return courseIds
}

async function timed(request) {
  const start = performance.now()
  const res = await request
  return { res, ms: performance.now() - start }
}

describe('Quest API speed', () => {
  it('lists 100 live courses within 2 seconds (SC-002)', async () => {
    await bulkCourses(100, 2)
    const { res, ms } = await timed(questGet('/courses', CODE))
    expect(res.status).toBe(200)
    expect(res.body.courses).toHaveLength(100)
    expect(ms).toBeLessThan(2000)
  })

  it('downloads a course of 50 steps within 2 seconds (SC-003)', async () => {
    const [courseId] = await bulkCourses(1, 50)
    const { res, ms } = await timed(questGet(`/courses/${courseId}`, CODE))
    expect(res.status).toBe(200)
    expect(res.body.steps).toHaveLength(50)
    expect(ms).toBeLessThan(2000)
  })
})
