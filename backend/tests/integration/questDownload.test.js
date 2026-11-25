import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import {
  createCourseRow,
  createOrganisationRow,
  createVideoRow,
  resetDatabase,
  restrictVideo,
  softDeleteVideo,
} from '../helpers/testApp.js'
import { publishedCourse, questGet } from '../helpers/quest.js'

// Downloading the content of one live course (specs/007 US3, FR-011, FR-012, FR-013).

const CODE = 'QZ7K2M9X'
let a
let b
let own
let shared

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A', questLinkCode: CODE })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
  own = await createVideoRow({ organisationId: a.id, fileSizeBytes: 1000, durationSeconds: 60 })
  shared = await createVideoRow({ organisationId: b.id, fileSizeBytes: 2000, visibility: 'selective', accessOrganisationIds: [a.id] })
})

const download = (courseId, code = CODE) => questGet(`/courses/${courseId}`, code)

describe('GET /api/quest/v1/courses/:courseId', () => {
  it('gives exactly the live version, also after the draft changed', async () => {
    const course = await publishedCourse({ organisationId: a.id, name: 'Cursus', versions: [{ first: own.id, second: shared.id }] })
    await db('CourseVersion').where({ id: course.draftVersionId }).update({ name: 'Concept' })
    const { v1, v2, q } = course.routes[0]

    const res = await download(course.courseId)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      id: course.courseId,
      name: 'Cursus',
      description: 'Beschrijving van Cursus',
      versionNumber: 1,
      publishedAt: '2026-11-20T10:00:00.000Z',
      // specs/008: the route starts with a question whose answer A leads to `own`.
      thumbnailUrl: `/api/quest/v1/courses/${course.courseId}/thumbnail?v=1`,
      startStepId: q.id,
      steps: [
        { id: v1.id, type: 'video', videoId: own.id, nextStepId: null },
        { id: v2.id, type: 'video', videoId: shared.id, nextStepId: null },
        {
          id: q.id,
          type: 'question',
          questionText: 'Wat doe je eerst?',
          feedback: 'Goed gedaan',
          answers: [
            { id: q.answerIds[0], text: 'Alarmeren', isCorrect: true, nextStepId: v1.id },
            { id: q.answerIds[1], text: 'Springen', isCorrect: false, nextStepId: v2.id },
          ],
        },
      ],
      videos: [
        { id: own.id, fileSizeBytes: 1000, durationSeconds: 60, url: `/api/quest/v1/videos/${own.id}` },
        { id: shared.id, fileSizeBytes: 2000, durationSeconds: 95, url: `/api/quest/v1/videos/${shared.id}` },
      ],
    })
  })

  it('lists a video used twice once', async () => {
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: own.id, second: own.id }] })
    expect((await download(course.courseId)).body.videos.map((video) => video.id)).toEqual([own.id])
  })

  it('keeps a deleted or restricted video of the live version (FR-014)', async () => {
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: own.id, second: shared.id }] })
    await softDeleteVideo(own.id)
    await restrictVideo(shared.id)
    expect((await download(course.courseId)).body.videos.map((video) => video.id)).toEqual([own.id, shared.id])
  })

  it('matches the size in the list (SC-006)', async () => {
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: own.id, second: shared.id }] })
    const res = await download(course.courseId)
    const [row] = (await questGet('/courses', CODE)).body.courses
    const videoBytes = res.body.videos.reduce((sum, video) => sum + video.fileSizeBytes, 0)
    expect(row.downloadSizeBytes).toBe(videoBytes + Buffer.byteLength(res.text, 'utf8'))
  })

  it('is "not found" for anything the Quest does not see (FR-013)', async () => {
    const ofB = await publishedCourse({ organisationId: b.id, versions: [{ first: shared.id }] })
    const draft = await createCourseRow({ organisationId: a.id })
    const unpublished = await publishedCourse({ organisationId: a.id, versions: [{ first: own.id, unpublishedAt: new Date() }] })
    const deleted = await publishedCourse({ organisationId: a.id, versions: [{ first: own.id }], deletedAt: new Date() })
    for (const id of [ofB.courseId, draft.courseId, unpublished.courseId, deleted.courseId, 999999, 'abc', '0', '-1']) {
      const res = await download(id)
      expect(res.status, String(id)).toBe(404)
      expect(res.body.error.code).toBe('not_found')
    }
  })

  it('asks to link again without a link code', async () => {
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: own.id }] })
    const res = await download(course.courseId, null)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('relink_required')
  })
})
