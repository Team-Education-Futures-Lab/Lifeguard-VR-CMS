import { access, writeFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import * as videoStorage from '../../src/lib/videoStorage.js'
import {
  createCourseRow,
  createOrganisationRow,
  createPublishedVersionRow,
  createStepRow,
  createVideoRow,
  resetDatabase,
  restrictVideo,
  softDeleteVideo,
} from '../helpers/testApp.js'
import { publishedCourse, questGet, route } from '../helpers/quest.js'

// The image of a course for the Quest (specs/008). Without nginx (tests) sendStoredFile sends the
// file itself. createVideoRow gives every video the same JPEG, so each video here gets its own
// bytes, to see which thumbnail comes back.

const CODE = 'QZ7K2M9X'
let a
let b

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A', questLinkCode: CODE })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
})

/** A video whose thumbnail file holds `thumb-<label>`. */
async function videoWithThumbnail(label, options = {}) {
  const video = await createVideoRow({ organisationId: a.id, ...options })
  await writeFile(videoStorage.getPath(video.thumbnailStorageKey), Buffer.from(`thumb-${label}`))
  return video
}

/** A course with an empty live version 1 and an empty draft 2: { courseId, versionId, draftVersionId }. */
async function liveCourse(organisationId = a.id) {
  const course = await createCourseRow({ organisationId })
  await db('CourseVersion').where({ id: course.versionId }).update({ versionNumber: 2 })
  const versionId = await createPublishedVersionRow({ courseId: course.courseId, versionNumber: 1 })
  return { courseId: course.courseId, versionId, draftVersionId: course.versionId }
}

/** A live course whose start step is a video step. Returns its id. */
async function videoFirstCourse(videoId, organisationId = a.id) {
  const { courseId, versionId } = await liveCourse(organisationId)
  await createStepRow({ versionId, videoId, isStart: true })
  return courseId
}

const thumbnail = (path, code = CODE) =>
  questGet(path, code)
    .buffer(true)
    .parse((res, done) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => done(null, Buffer.concat(chunks)))
    })

const thumbnailPath = (courseId, query = '') => `/courses/${courseId}/thumbnail${query}`
const list = async () => (await questGet('/courses', CODE)).body.courses
const listed = async (courseId) => (await list()).find((course) => course.id === courseId)

async function expectNotFound(path, code = CODE) {
  const res = await questGet(path, code)
  expect(res.status, path).toBe(404)
  expect(res.body).toEqual({ error: { code: 'not_found', message: expect.any(String) } })
  return res.body
}

describe('Quest course thumbnail – list and fetch', () => {
  it('gives the address with the version number in the list (FR-006)', async () => {
    const x = await videoWithThumbnail('x')
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: x.id }] })
    expect((await listed(course.courseId)).thumbnailUrl).toBe(`/api/quest/v1/courses/${course.courseId}/thumbnail?v=1`)
  })

  it('delivers the thumbnail of the start video as JPEG (FR-002, FR-010, FR-014)', async () => {
    const x = await videoWithThumbnail('x')
    const courseId = await videoFirstCourse(x.id)
    const res = await thumbnail((await listed(courseId)).thumbnailUrl.replace('/api/quest/v1', ''))
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('image/jpeg')
    expect(res.headers['cache-control']).toBe('private, max-age=0, must-revalidate')
    expect(res.body.toString()).toBe('thumb-x')
  })

  it('takes the nearest video when the course starts with a question (FR-003)', async () => {
    const y = await videoWithThumbnail('y')
    const z = await videoWithThumbnail('z')
    const course = await liveCourse()
    const { versionId } = course
    const vy = await createStepRow({ versionId, videoId: y.id })
    const vz = await createStepRow({ versionId, videoId: z.id })
    const between = await createStepRow({ versionId, stepType: 'question' })
    const start = await createStepRow({ versionId, stepType: 'question', isStart: true })
    // A → question → Y (two steps), B → Z (one step).
    await db('Answer').where({ id: start.answerIds[0] }).update({ nextCourseStepId: between.id })
    await db('Answer').where({ id: start.answerIds[1] }).update({ nextCourseStepId: vz.id })
    await db('Answer').where({ id: between.answerIds[0] }).update({ nextCourseStepId: vy.id })

    const res = await thumbnail(thumbnailPath(course.courseId, '?v=1'))
    expect(res.status).toBe(200)
    expect(res.body.toString()).toBe('thumb-z')
  })

  it('gives null and not_found for a course without a video (FR-004)', async () => {
    const course = await liveCourse()
    await createStepRow({ versionId: course.versionId, stepType: 'question', isStart: true })

    expect((await listed(course.courseId)).thumbnailUrl).toBeNull()
    await expectNotFound(thumbnailPath(course.courseId, '?v=1'))
  })

  it('asks to link again without a valid link code (FR-011)', async () => {
    const courseId = await videoFirstCourse((await videoWithThumbnail('x')).id)
    for (const code of [null, 'ZZZZ9999']) {
      const res = await questGet(thumbnailPath(courseId), code)
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('relink_required')
    }
  })

  it('answers not_found the same way for every course the Quest does not see (FR-012)', async () => {
    const ofB = await videoFirstCourse((await videoWithThumbnail('b')).id, b.id)
    const bodies = []
    for (const id of [ofB, 999999, 'abc', 0]) bodies.push(await expectNotFound(thumbnailPath(id)))
    expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1)
  })

  it('gives two courses with the same first video their own address and the same image', async () => {
    const x = await videoWithThumbnail('x')
    const first = await videoFirstCourse(x.id)
    const second = await videoFirstCourse(x.id)
    const urls = [(await listed(first)).thumbnailUrl, (await listed(second)).thumbnailUrl]
    expect(urls[0]).not.toBe(urls[1])
    for (const id of [first, second]) expect((await thumbnail(thumbnailPath(id))).body.toString()).toBe('thumb-x')
  })
})

describe('Quest course thumbnail – live version only', () => {
  const bytes = async (path, code = CODE) => {
    const res = await thumbnail(path, code)
    expect(res.status, path).toBe(200)
    return res.body.toString()
  }

  it('ignores the draft (FR-001)', async () => {
    const x = await videoWithThumbnail('x')
    const y = await videoWithThumbnail('y')
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: x.id }] })
    // The draft from createCourseRow is empty; give it a route that ends at Y.
    await route(course.draftVersionId, { first: y.id })

    expect((await listed(course.courseId)).thumbnailUrl).toMatch(/\?v=1$/)
    expect(await bytes(thumbnailPath(course.courseId))).toBe('thumb-x')
  })

  it('follows a new live version, with a new address (FR-006, US2 scenario 2)', async () => {
    const x = await videoWithThumbnail('x')
    const y = await videoWithThumbnail('y')
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: x.id }, { first: y.id }] })

    expect((await listed(course.courseId)).thumbnailUrl).toBe(`/api/quest/v1/courses/${course.courseId}/thumbnail?v=2`)
    expect(await bytes(thumbnailPath(course.courseId, '?v=2'))).toBe('thumb-y')
  })

  it('ignores an old, wrong or missing v (FR-010)', async () => {
    const x = await videoWithThumbnail('x')
    const y = await videoWithThumbnail('y')
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: x.id }, { first: y.id }] })
    for (const query of ['?v=1', '?v=99', '?v=abc', '']) {
      expect(await bytes(thumbnailPath(course.courseId, query))).toBe('thumb-y')
    }
  })

  it('keeps the image when the owner deletes or restricts the video (FR-005, SC-006)', async () => {
    const x = await videoWithThumbnail('x', { visibility: 'public' })
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: x.id }] })
    await restrictVideo(x.id)
    expect(await bytes(thumbnailPath(course.courseId))).toBe('thumb-x')
    await softDeleteVideo(x.id)
    expect(await bytes(thumbnailPath(course.courseId))).toBe('thumb-x')
  })

  it('keeps the image of a video from the library of another organisation', async () => {
    const shared = await createVideoRow({ organisationId: b.id, visibility: 'selective', accessOrganisationIds: [a.id] })
    await writeFile(videoStorage.getPath(shared.thumbnailStorageKey), Buffer.from('thumb-shared'))
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: shared.id }] })
    expect(await bytes(thumbnailPath(course.courseId))).toBe('thumb-shared')
    await restrictVideo(shared.id)
    await softDeleteVideo(shared.id)
    expect(await bytes(thumbnailPath(course.courseId))).toBe('thumb-shared')
  })

  it('is gone for the Quest after unpublishing', async () => {
    const x = await videoWithThumbnail('x')
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: x.id, unpublishedAt: new Date() }] })
    await expectNotFound(thumbnailPath(course.courseId))
    expect(await listed(course.courseId)).toBeUndefined()
  })

  it('is gone for the Quest after deleting, but the file stays for the library (FR-005a)', async () => {
    const x = await videoWithThumbnail('x')
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: x.id }], deletedAt: new Date() })
    await expectNotFound(thumbnailPath(course.courseId))
    expect(await listed(course.courseId)).toBeUndefined()
    await expect(access(videoStorage.getPath(x.thumbnailStorageKey))).resolves.toBeUndefined()
  })

  it('refuses the old link code after a new one is made (FR-011)', async () => {
    const x = await videoWithThumbnail('x')
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: x.id }] })
    await db('Organisation').where({ id: a.id }).update({ questLinkCode: 'NNNN3333' })
    const res = await questGet(thumbnailPath(course.courseId), CODE)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('relink_required')
    expect(await bytes(thumbnailPath(course.courseId), 'NNNN3333')).toBe('thumb-x')
  })
})

describe('Quest course thumbnail – content', () => {
  it('has the same thumbnailUrl in the content as in the list, and the image does not count in the size (FR-007, FR-009)', async () => {
    const x = await videoWithThumbnail('x', { fileSizeBytes: 1000 })
    const withImage = await publishedCourse({ organisationId: a.id, name: 'Met afbeelding', versions: [{ first: x.id }] })
    const withoutImage = await liveCourse()
    await createStepRow({ versionId: withoutImage.versionId, stepType: 'question', isStart: true })

    for (const courseId of [withImage.courseId, withoutImage.courseId]) {
      const entry = await listed(courseId)
      const res = await questGet(`/courses/${courseId}`, CODE)
      expect(res.status).toBe(200)
      expect(res.body.thumbnailUrl).toBe(entry.thumbnailUrl)
      const videoBytes = res.body.videos.reduce((sum, video) => sum + video.fileSizeBytes, 0)
      expect(entry.downloadSizeBytes).toBe(videoBytes + Buffer.byteLength(res.text, 'utf8'))
      expect(res.body.videos.map((video) => video.url)).not.toContain(entry.thumbnailUrl)
    }
    expect((await listed(withImage.courseId)).thumbnailUrl).not.toBeNull()
    expect((await listed(withoutImage.courseId)).thumbnailUrl).toBeNull()
  })
})

describe('Quest course thumbnail – speed', () => {
  it('delivers an image within 1 second (SC-005)', async () => {
    const x = await videoWithThumbnail('x')
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: x.id }] })
    const started = performance.now()
    const res = await thumbnail(thumbnailPath(course.courseId))
    expect(res.status).toBe(200)
    expect(performance.now() - started).toBeLessThan(1000)
  })
})
