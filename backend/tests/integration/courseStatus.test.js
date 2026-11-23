import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import {
  agentWithSession,
  createCourseRow,
  createOrganisationRow,
  createPublishedVersionRow,
  createStepRow,
  createVideoRow,
  resetDatabase,
  restrictVideo,
} from '../helpers/testApp.js'

// The publication status in the course list and the draft document (specs/006 FR-018, FR-019,
// contracts/api.md, research R1, R4, R8). Published versions are inserted directly here; the
// routes that publish are tested in coursePublish.test.js.

let a
let b
let agent
let course
let ownVideo
let sharedVideo

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  agent = (await agentWithSession({ organisationId: a.id })).agent
  ownVideo = await createVideoRow({ organisationId: a.id, name: 'Eigen video' })
  sharedVideo = await createVideoRow({ organisationId: b.id, name: 'Van B', visibility: 'selective', accessOrganisationIds: [a.id] })
  course = await createCourseRow({ organisationId: a.id })
})

/** A small route in a version: a start question with A → video 1 and B → video 2. */
async function route(versionId, { questionText = 'Wat doe je?', videoId = ownVideo.id, x = 0 } = {}) {
  const v1 = await createStepRow({ versionId, videoId, positionX: x })
  const v2 = await createStepRow({ versionId, videoId: ownVideo.id, positionX: x + 300 })
  const q = await createStepRow({ versionId, stepType: 'question', questionText, isStart: true })
  await db('Answer').where({ id: q.answerIds[0] }).update({ nextCourseStepId: v1.id })
  await db('Answer').where({ id: q.answerIds[1] }).update({ nextCourseStepId: v2.id })
  return { v1, v2, q }
}

/** Gives the course published versions 1..n (as data) and makes the draft number n + 1. */
async function publish(versions) {
  await db('CourseVersion').where({ id: course.versionId }).update({ versionNumber: versions.length + 1 })
  const ids = []
  for (const [i, options] of versions.entries()) {
    const id = await createPublishedVersionRow({ courseId: course.courseId, versionNumber: i + 1, unpublishedAt: options.unpublishedAt ?? null })
    await route(id, options)
    ids.push(id)
  }
  return ids
}

const listRow = async () => (await agent.get('/api/organisation/courses')).body.courses.find((row) => row.id === course.courseId)
const draftDoc = async () => (await agent.get(`/api/organisation/courses/${course.courseId}`)).body

describe('a course that was never published', () => {
  it('is a draft without publication, in the list and in the document', async () => {
    await route(course.versionId)
    expect(await listRow()).toMatchObject({ status: 'draft', publication: null, lastPublishedVersionNumber: null })
    expect(await draftDoc()).toMatchObject({ status: 'draft', publication: null, lastPublishedVersionNumber: null, draftVersionNumber: 1 })
  })
})

describe('a published course', () => {
  it('is published when the draft has the same content as the highest published version', async () => {
    await publish([{ questionText: 'Oud' }, {}])
    await route(course.versionId)
    const publication = { versionNumber: 2, publishedAt: '2026-11-20T10:00:00.000Z', hasUnavailableVideo: false }
    expect(await listRow()).toMatchObject({ status: 'published', publication, lastPublishedVersionNumber: 2 })
    expect(await draftDoc()).toMatchObject({ status: 'published', publication, lastPublishedVersionNumber: 2, draftVersionNumber: 3 })
  })

  it('stays published when only positions on the canvas differ', async () => {
    await publish([{}])
    await route(course.versionId, { x: 777 })
    expect((await listRow()).status).toBe('published')
  })

  it('is published with changes when the content differs', async () => {
    await publish([{}])
    await route(course.versionId, { questionText: 'Wat doe je nu?' })
    expect(await listRow()).toMatchObject({ status: 'published_changed', publication: { versionNumber: 1 } })
    expect((await draftDoc()).status).toBe('published_changed')
  })

  it('is a draft again when the highest published version was unpublished, also when a lower one was not', async () => {
    await publish([{}, { unpublishedAt: new Date('2026-11-21T10:00:00.000Z') }])
    await route(course.versionId)
    expect(await listRow()).toMatchObject({ status: 'draft', publication: null, lastPublishedVersionNumber: 2 })
    expect(await draftDoc()).toMatchObject({ status: 'draft', publication: null, lastPublishedVersionNumber: 2 })
  })
})

describe('videos and the live version', () => {
  it('marks a video of the draft that is in the live version', async () => {
    await publish([{ videoId: sharedVideo.id }])
    await route(course.versionId, { videoId: sharedVideo.id })
    const steps = (await draftDoc()).steps.filter((step) => step.video)
    expect(steps.map((step) => [step.videoId, step.video.keptByLiveVersion])).toEqual([
      [sharedVideo.id, true],
      [ownVideo.id, true],
    ])
  })

  it('marks nothing without a live version', async () => {
    await publish([{ videoId: sharedVideo.id, unpublishedAt: new Date() }])
    await route(course.versionId, { videoId: sharedVideo.id })
    expect((await draftDoc()).steps.filter((step) => step.video).every((step) => step.video.keptByLiveVersion === false)).toBe(true)
  })

  it('tells when the live version has a video that is no longer available', async () => {
    await publish([{ videoId: sharedVideo.id }])
    await route(course.versionId, { videoId: sharedVideo.id })
    expect((await listRow()).publication.hasUnavailableVideo).toBe(false)
    await restrictVideo(sharedVideo.id)
    expect((await listRow()).publication.hasUnavailableVideo).toBe(true)
    expect((await draftDoc()).publication.hasUnavailableVideo).toBe(true)
  })
})
