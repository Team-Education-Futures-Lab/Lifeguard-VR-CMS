import request from 'supertest'
import { db } from '../../src/db/knex.js'
import { app, createCourseRow, createPublishedVersionRow, createStepRow } from './testApp.js'

// Helpers for the Quest API tests (specs/007). The Quest sends no cookies and no CSRF header,
// only its link code as Bearer.

/** GET on the Quest API with the link code as Bearer (or no header when `code` is null). */
export function questGet(path, code) {
  const req = request(app).get(`/api/quest/v1${path}`)
  return code === null ? req : req.set('Authorization', `Bearer ${code}`)
}

export function questLink(linkCode) {
  return request(app).post('/api/quest/v1/link').send(linkCode === undefined ? {} : { linkCode })
}

/**
 * A small route in a version: a start question (feedback "Goed gedaan") whose answer A goes to
 * video step 1 and answer B to video step 2; both video steps are ends.
 */
export async function route(versionId, { first, second = first, questionText = 'Wat doe je eerst?' }) {
  const v1 = await createStepRow({ versionId, videoId: first, positionX: 100, positionY: 50 })
  const v2 = await createStepRow({ versionId, videoId: second, positionX: 400, positionY: 50 })
  const q = await createStepRow({ versionId, stepType: 'question', questionText, feedback: 'Goed gedaan', isStart: true })
  await db('Answer').where({ id: q.answerIds[0] }).update({ nextCourseStepId: v1.id })
  await db('Answer').where({ id: q.answerIds[1] }).update({ nextCourseStepId: v2.id })
  return { v1, v2, q }
}

/**
 * A course with published versions 1..n (each with `route`, per version options in `versions`)
 * and a draft with number n + 1. The last version is live unless it has `unpublishedAt`.
 * Returns { courseId, draftVersionId, versionIds, routes }.
 */
export async function publishedCourse({ organisationId, name = 'Testcursus', versions, deletedAt = null }) {
  const course = await createCourseRow({ organisationId, name: `${name} (concept)`, deletedAt })
  await db('CourseVersion').where({ id: course.versionId }).update({ versionNumber: versions.length + 1 })
  const versionIds = []
  const routes = []
  for (const [i, options] of versions.entries()) {
    const id = await createPublishedVersionRow({
      courseId: course.courseId,
      versionNumber: i + 1,
      name: options.name ?? name,
      description: options.description ?? `Beschrijving van ${name}`,
      publishedAt: options.publishedAt ?? new Date(`2026-11-2${i}T10:00:00.000Z`),
      unpublishedAt: options.unpublishedAt ?? null,
    })
    routes.push(await route(id, options))
    versionIds.push(id)
  }
  return { courseId: course.courseId, draftVersionId: course.versionId, versionIds, routes }
}
