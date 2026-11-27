import { expect } from 'vitest'
import { db } from '../../src/db/knex.js'
import { createPublishedVersionRow, createStepRow } from './testApp.js'
import { questGet, route } from './quest.js'

// Helpers for the course reference tests (specs/010).

const BASE = '/api/organisation/course-references'

export const addReference = (agent, courseId) => agent.post(BASE).send({ courseId })
export const getReference = (agent, courseId) => agent.get(`${BASE}/${courseId}`)
export const removeReference = (agent, courseId) => agent.delete(`${BASE}/${courseId}`)
export const useNewVersion = (agent, courseId) => agent.post(`${BASE}/${courseId}/update`)
export const keepVersion = (agent, courseId) => agent.post(`${BASE}/${courseId}/keep`)

export async function listReferences(agent) {
  const response = await agent.get(BASE)
  expect(response.status).toBe(200)
  return response.body
}

/** The Quest's course list as Map courseId → versionNumber. */
export async function questVersions(code) {
  const response = await questGet('/courses', code)
  expect(response.status).toBe(200)
  return new Map(response.body.courses.map((course) => [course.id, course.versionNumber]))
}

/**
 * Publishes a new version of a course directly (as publishCourse would): a published version with
 * the next number and a route over `first`/`second`. Returns its id.
 */
export async function publishNextVersion(courseId, { first, second = first, name, publishedAt = new Date() }) {
  const { max } = await db('CourseVersion').where({ courseId }).whereNotNull('publishedAt').max('versionNumber as max').first()
  const versionNumber = (max ?? 0) + 1
  // Keep the draft one number above the newest published version.
  await db('CourseVersion').where({ courseId }).whereNull('publishedAt').update({ versionNumber: versionNumber + 1 })
  const id = await createPublishedVersionRow({ courseId, versionNumber, name: name ?? `Versie ${versionNumber}`, publishedAt })
  await route(id, { first, second })
  return id
}

/** Unpublishes the live (highest) version of a course, as the owner would. */
export async function unpublishLatest(courseId) {
  const { max } = await db('CourseVersion').where({ courseId }).whereNotNull('publishedAt').max('versionNumber as max').first()
  await db('CourseVersion').where({ courseId, versionNumber: max }).update({ unpublishedAt: db.raw('UTC_TIMESTAMP()') })
}

export { createStepRow }
