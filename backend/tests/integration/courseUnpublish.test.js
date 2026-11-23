import { stat } from 'node:fs/promises'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { runVideoFileCleanup } from '../../src/jobs/videoFileCleanup.js'
import { liveVersions } from '../../src/modules/courses/courseRepository.js'
import * as videoStorage from '../../src/lib/videoStorage.js'
import { agentWithSession, createCourseRow, createOrganisationRow, createVideoRow, resetDatabase, softDeleteVideo } from '../helpers/testApp.js'

// Unpublishing, putting the last version back and deleting a published course (specs/006 US4,
// FR-014, FR-016, FR-017, FR-021, research R1, R10, R11).

let agent
let course
let own
let shared

beforeEach(async () => {
  await resetDatabase()
  const a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  const b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  agent = (await agentWithSession({ organisationId: a.id })).agent
  own = await createVideoRow({ organisationId: a.id })
  shared = await createVideoRow({ organisationId: b.id, visibility: 'selective', accessOrganisationIds: [a.id] })
  course = await createCourseRow({ organisationId: a.id })
})

const url = () => `/api/organisation/courses/${course.courseId}`
const current = async () => (await agent.get(url())).body
const publish = () => agent.post(`${url()}/publish`)
const unpublish = () => agent.post(`${url()}/unpublish`)
const versions = () => db('CourseVersion').where({ courseId: course.courseId }).orderBy('versionNumber')

async function save(videoId = own.id, questionText = 'Wat doe je?') {
  const { draftVersionNumber } = await current()
  const steps = [
    {
      key: 'q', stepType: 'question', isStart: true, positionX: 0, positionY: 0, questionText, feedback: null,
      answers: [
        { answerText: 'Ingrijpen', isCorrect: true, nextStepKey: 'v' },
        { answerText: 'Afwachten', isCorrect: false, nextStepKey: 'v' },
      ],
    },
    { key: 'v', stepType: 'video', isStart: false, positionX: 0, positionY: 260, videoId, nextStepKey: null },
  ]
  expect((await agent.put(url()).send({ draftVersionNumber, name: 'Cursus', description: 'D', steps })).status).toBe(200)
}

describe('unpublishing (FR-016)', () => {
  beforeEach(async () => {
    await save()
    await publish()
    await save(own.id, 'Tweede')
    await publish()
  })

  it('takes the live version away and keeps the draft and all versions', async () => {
    const before = await versions()
    const response = await unpublish()
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'draft', publication: null, lastPublishedVersionNumber: 2, draftVersionNumber: 3 })
    const after = await versions()
    expect(after.map((v) => v.versionNumber)).toEqual([1, 2, 3])
    expect(after[1].unpublishedAt).not.toBeNull()
    expect(after[0].unpublishedAt).toBeNull()
    expect(after.map(({ unpublishedAt: _unpublished, ...rest }) => rest)).toEqual(before.map(({ unpublishedAt: _unpublished, ...rest }) => rest))
    expect((await liveVersions([course.courseId])).size).toBe(0)
  })

  it('changes nothing the second time', async () => {
    await unpublish()
    const before = await versions()
    expect((await unpublish()).status).toBe(200)
    expect(await versions()).toEqual(before)
  })

  it('puts the same version back when nothing changed (FR-017)', async () => {
    const [, v2] = await versions()
    await unpublish()
    const response = await publish()
    expect(response.body).toMatchObject({ status: 'published', publication: { versionNumber: 2 }, draftVersionNumber: 3 })
    const after = await versions()
    expect(after).toHaveLength(3)
    expect(after[1]).toMatchObject({ id: v2.id, versionNumber: 2, unpublishedAt: null })
    expect(after[1].publishedAt).toEqual(v2.publishedAt)
  })

  it('publishes a new version when something changed meanwhile', async () => {
    await unpublish()
    await save(own.id, 'Derde')
    const response = await publish()
    expect(response.body).toMatchObject({ status: 'published', publication: { versionNumber: 3 }, draftVersionNumber: 4 })
  })
})

describe('a video that is no longer available', () => {
  it('is reported before unpublishing, and blocks publishing again afterwards', async () => {
    await save(shared.id)
    await publish()
    await softDeleteVideo(shared.id)
    expect((await current()).publication.hasUnavailableVideo).toBe(true)
    await unpublish()
    const response = await publish()
    expect(response.status).toBe(422)
    expect(response.body.error.issues.map((i) => i.code)).toEqual(['videoUnavailable'])
  })

  it('is not removed from disk while a live version uses it (FR-014)', async () => {
    await save(shared.id)
    await publish()
    // The draft no longer uses it; only the live version does.
    await save(own.id, 'Andere video')
    await softDeleteVideo(shared.id)
    await runVideoFileCleanup()
    await expect(stat(videoStorage.getPath(shared.storageKey))).resolves.toBeTruthy()
    await expect(stat(videoStorage.getPath(shared.thumbnailStorageKey))).resolves.toBeTruthy()
  })
})

describe('deleting a published course (FR-021)', () => {
  it('takes it off the Quests and keeps its versions', async () => {
    await save()
    await publish()
    expect((await liveVersions([course.courseId])).size).toBe(1)
    expect((await agent.delete(url())).status).toBe(204)
    expect((await agent.get('/api/organisation/courses')).body.courses).toEqual([])
    expect(await versions()).toHaveLength(2)
    expect((await liveVersions([course.courseId])).size).toBe(0)
  })
})
