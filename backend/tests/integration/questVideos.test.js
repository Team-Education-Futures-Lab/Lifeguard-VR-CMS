import { beforeEach, describe, expect, it } from 'vitest'
import {
  createCourseRow,
  createOrganisationRow,
  createStepRow,
  createVideoRow,
  resetDatabase,
  restrictVideo,
  softDeleteVideo,
} from '../helpers/testApp.js'
import { publishedCourse, questGet } from '../helpers/quest.js'

// Video access for the Quest (specs/007 FR-014, FR-015, FR-016, constitution III). Without nginx
// (tests) sendStoredFile sends the file itself; createVideoRow writes the 5 bytes "video".

const CODE = 'QZ7K2M9X'
let a
let b
let live

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A', questLinkCode: CODE })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
  live = await createVideoRow({ organisationId: a.id })
})

const video = (id, code = CODE) => questGet(`/videos/${id}`, code).buffer(true).parse((res, done) => {
  const chunks = []
  res.on('data', (chunk) => chunks.push(chunk))
  res.on('end', () => done(null, Buffer.concat(chunks)))
})

async function expectNotFound(id) {
  const res = await questGet(`/videos/${id}`, CODE)
  expect(res.status, String(id)).toBe(404)
  expect(res.body.error.code).toBe('not_found')
}

describe('GET /api/quest/v1/videos/:videoId', () => {
  it('delivers a video of a live course', async () => {
    await publishedCourse({ organisationId: a.id, versions: [{ first: live.id }] })
    const res = await video(live.id)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('video/mp4')
    expect(res.headers['cache-control']).toBe('private, max-age=0, must-revalidate')
    expect(res.body.toString()).toBe('video')
  })

  it('resumes with a Range request (FR-015, SC-008)', async () => {
    await publishedCourse({ organisationId: a.id, versions: [{ first: live.id }] })
    const res = await video(live.id).set('Range', 'bytes=2-')
    expect(res.status).toBe(206)
    expect(res.body.toString()).toBe('deo')
  })

  it('keeps delivering a deleted or restricted video of a live version (FR-014)', async () => {
    const shared = await createVideoRow({ organisationId: b.id, visibility: 'selective', accessOrganisationIds: [a.id] })
    await publishedCourse({ organisationId: a.id, versions: [{ first: live.id, second: shared.id }] })
    await softDeleteVideo(live.id)
    await restrictVideo(shared.id)
    expect((await video(live.id)).status).toBe(200)
    expect((await video(shared.id)).status).toBe(200)
  })

  it('refuses a video that is in no live version the Quest sees', async () => {
    const inDraft = await createVideoRow({ organisationId: a.id })
    const inOldVersion = await createVideoRow({ organisationId: a.id })
    const libraryOnly = await createVideoRow({ organisationId: a.id })
    const ofB = await createVideoRow({ organisationId: b.id })
    const inUnpublished = await createVideoRow({ organisationId: a.id })
    const inDeleted = await createVideoRow({ organisationId: a.id })

    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: inOldVersion.id }, { first: live.id }] })
    await createStepRow({ versionId: course.draftVersionId, videoId: inDraft.id })
    await publishedCourse({ organisationId: b.id, versions: [{ first: ofB.id }] })
    await publishedCourse({ organisationId: a.id, versions: [{ first: inUnpublished.id, unpublishedAt: new Date() }] })
    await publishedCourse({ organisationId: a.id, versions: [{ first: inDeleted.id }], deletedAt: new Date() })
    await createCourseRow({ organisationId: a.id })

    for (const id of [inDraft.id, inOldVersion.id, libraryOnly.id, ofB.id, inUnpublished.id, inDeleted.id, 999999, 'abc', '0']) {
      await expectNotFound(id)
    }
    expect((await video(live.id)).status).toBe(200)
  })

  it('is not usable without a valid link code (FR-016)', async () => {
    await publishedCourse({ organisationId: a.id, versions: [{ first: live.id }] })
    for (const code of [null, 'BBBB2222', 'ABCD1234']) {
      const res = await questGet(`/videos/${live.id}`, code)
      expect(res.status, String(code)).toBe(code === 'BBBB2222' ? 404 : 401)
    }
  })
})
