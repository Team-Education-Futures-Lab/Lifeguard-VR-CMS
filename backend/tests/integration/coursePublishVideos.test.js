import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import {
  agentWithSession,
  createCourseRow,
  createOrganisationRow,
  createVideoRow,
  resetDatabase,
  restrictVideo,
  softDeleteVideo,
} from '../helpers/testApp.js'

// A video that its owner deleted or restricted (specs/006 FR-012, FR-013, SC-008, constitution V):
// it keeps working in a published course, also in a new version of it; a course that is not
// published must choose another video first.

let agent
let course
let shared
let own

beforeEach(async () => {
  await resetDatabase()
  const a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  const b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  agent = (await agentWithSession({ organisationId: a.id })).agent
  shared = await createVideoRow({ organisationId: b.id, name: 'Van B', visibility: 'selective', accessOrganisationIds: [a.id] })
  own = await createVideoRow({ organisationId: a.id, name: 'Eigen' })
  course = await createCourseRow({ organisationId: a.id })
})

const url = () => `/api/organisation/courses/${course.courseId}`
const current = async () => (await agent.get(url())).body
const publish = () => agent.post(`${url()}/publish`)

/** Saves a route: start question, A → video 1 (`first`), B → video 2 (`second`). Keeps ids. */
async function save({ first = shared.id, second = own.id, questionText = 'Wat doe je?' } = {}) {
  const doc = await current()
  const byType = (type) => doc.steps.filter((s) => s.stepType === type)
  const [q] = byType('question')
  const [v1, v2] = byType('video')
  const steps = [
    {
      key: 'q', ...(q ? { id: q.id } : {}), stepType: 'question', isStart: true, positionX: 0, positionY: 0, questionText, feedback: null,
      answers: [
        { ...(q ? { id: q.answers[0].id } : {}), answerText: 'Ingrijpen', isCorrect: true, nextStepKey: 'v1' },
        { ...(q ? { id: q.answers[1].id } : {}), answerText: 'Afwachten', isCorrect: false, nextStepKey: 'v2' },
      ],
    },
    { key: 'v1', ...(v1 ? { id: v1.id } : {}), stepType: 'video', isStart: false, positionX: -130, positionY: 260, videoId: first, nextStepKey: null },
    { key: 'v2', ...(v2 ? { id: v2.id } : {}), stepType: 'video', isStart: false, positionX: 130, positionY: 260, videoId: second, nextStepKey: null },
  ]
  const response = await agent.put(url()).send({ draftVersionNumber: doc.draftVersionNumber, name: 'Cursus', description: 'D', steps })
  expect(response.status).toBe(200)
  return response.body
}

const videoStepOf = (doc, videoId) => doc.steps.find((s) => s.videoId === videoId)

describe.each([
  ['deleted', (id) => softDeleteVideo(id)],
  ['restricted', (id) => restrictVideo(id)],
])('a video the owner %s', (_name, takeAway) => {
  it('stays in a published course and goes along in its next version', async () => {
    await save()
    expect((await publish()).status).toBe(200)
    await takeAway(shared.id)
    const doc = await save({ questionText: 'Nieuwe vraag' })
    expect(videoStepOf(doc, shared.id).video).toMatchObject({ available: false, keptByLiveVersion: true })
    const response = await publish()
    expect(response.status).toBe(200)
    expect(response.body.publication.versionNumber).toBe(2)
    const v2 = await db('CourseVersion').where({ courseId: course.courseId, versionNumber: 2 }).first()
    expect((await db('CourseStep').where({ courseVersionId: v2.id }).whereNotNull('videoId').pluck('videoId')).sort()).toEqual([shared.id, own.id].sort())
  })

  it('stops a course without a live version, with the message at that step', async () => {
    const saved = await save()
    await takeAway(shared.id)
    const response = await publish()
    expect(response.status).toBe(422)
    expect(response.body.error.issues).toEqual([
      { code: 'videoUnavailable', message: 'Video niet meer beschikbaar: kies een andere.', stepId: videoStepOf(saved, shared.id).id },
    ])
    expect(videoStepOf(await current(), shared.id).video).toMatchObject({ available: false, keptByLiveVersion: false })
  })
})

describe('the rule is about the video, not the step', () => {
  it('allows the video in another step than in the live version', async () => {
    await save({ first: shared.id, second: own.id })
    await publish()
    await softDeleteVideo(shared.id)
    // In the draft the two video steps swap their videos (directly in the database: the editor
    // cannot pick a deleted video for another step), and the question changes.
    const draft = await db('CourseVersion').where({ courseId: course.courseId }).whereNull('publishedAt').first()
    const [v1, v2] = await db('CourseStep').where({ courseVersionId: draft.id, stepType: 'video' }).orderBy('id')
    await db('CourseStep').where({ id: v1.id }).update({ videoId: own.id })
    await db('CourseStep').where({ id: v2.id }).update({ videoId: shared.id })
    await db('CourseStep').where({ courseVersionId: draft.id, stepType: 'question' }).update({ questionText: 'Anders' })
    const response = await publish()
    expect(response.status).toBe(200)
    expect(response.body.publication.versionNumber).toBe(2)
  })
})
