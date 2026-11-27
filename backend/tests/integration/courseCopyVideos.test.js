import { access } from 'node:fs/promises'
import { beforeEach, describe, expect, it } from 'vitest'
import { runVideoFileCleanup } from '../../src/jobs/videoFileCleanup.js'
import * as videoStorage from '../../src/lib/videoStorage.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase, restrictVideo, softDeleteVideo } from '../helpers/testApp.js'
import { publishedCourse, questGet } from '../helpers/quest.js'
import { copyReference } from '../helpers/references.js'
import { publish } from '../helpers/sharing.js'

// Videos a copy got from its original (specs/011 FR-014 – FR-017, SC-005; data-model.md § Meegekregen
// video's; research R4). X is only shared inside the course (not in B's library), Y is public.

let a
let b
let agentB
let x
let y
let own
let copyId

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  x = await createVideoRow({ organisationId: a.id, name: 'Alleen in de cursus', visibility: 'private' })
  y = await createVideoRow({ organisationId: a.id, name: 'Openbaar', visibility: 'public' })
  own = await createVideoRow({ organisationId: b.id, name: 'Eigen video' })
  const original = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: x.id, second: y.id }] })
  await createReferenceRow({ organisationId: b.id, courseId: original.courseId, courseVersionId: original.versionIds[0] })
  copyId = (await copyReference(agentB, original.courseId)).body.courseId
})

/** Saves the route of the draft (as helpers/sharing.js saveRoute) and returns the response. */
async function putRoute(courseId, { first, second, questionText = 'Wat doe je?' }) {
  const url = `/api/organisation/courses/${courseId}`
  const doc = (await agentB.get(url)).body
  const [q] = doc.steps.filter((s) => s.stepType === 'question')
  const [v1, v2] = doc.steps.filter((s) => s.stepType === 'video')
  const steps = [
    {
      key: 'q', id: q.id, stepType: 'question', isStart: true, positionX: 0, positionY: 0, questionText, feedback: null,
      answers: [
        { id: q.answers[0].id, answerText: 'Ingrijpen', isCorrect: true, nextStepKey: 'v1' },
        { id: q.answers[1].id, answerText: 'Afwachten', isCorrect: false, nextStepKey: 'v2' },
      ],
    },
    { key: 'v1', id: v1.id, stepType: 'video', isStart: false, positionX: -130, positionY: 260, videoId: first, nextStepKey: null },
    { key: 'v2', id: v2.id, stepType: 'video', isStart: false, positionX: 130, positionY: 260, videoId: second, nextStepKey: null },
  ]
  return agentB.put(url).send({ draftVersionNumber: doc.draftVersionNumber, name: doc.name, description: 'Beschrijving', steps })
}

const draft = async () => (await agentB.get(`/api/organisation/courses/${copyId}`)).body
const unpublish = () => agentB.post(`/api/organisation/courses/${copyId}/unpublish`)
const exists = (key) => access(videoStorage.getPath(key)).then(() => true, () => false)

describe('videos from the original in the copy', () => {
  it('are marked keptFromOriginal, and do not count as unavailable for the status', async () => {
    const doc = await draft()
    const video = (id) => doc.steps.find((s) => s.videoId === id).video
    expect(video(x.id)).toMatchObject({ available: false, keptFromOriginal: true })
    expect(video(y.id)).toMatchObject({ available: true, keptFromOriginal: true })
    expect(doc.publication.hasUnavailableVideo).toBe(false)
    const list = (await agentB.get('/api/organisation/courses')).body.courses
    expect(list[0].publication.hasUnavailableVideo).toBe(false)
  })

  it('a normal course never has keptFromOriginal', async () => {
    const course = (await agentB.post('/api/organisation/courses').send({ name: 'Eigen', description: 'Beschrijving' })).body
    expect((await putRoute(course.id, { first: own.id, second: own.id })).status).toBe(200)
    const doc = (await agentB.get(`/api/organisation/courses/${course.id}`)).body
    expect(doc.steps.filter((s) => s.video).every((s) => s.video.keptFromOriginal === false)).toBe(true)
  })

  it('stay usable after the owner restricts them, also after unpublishing (FR-014)', async () => {
    expect((await putRoute(copyId, { first: x.id, second: y.id, questionText: 'Anders?' })).status).toBe(200)
    expect((await publish(agentB, copyId)).status).toBe(200)
    await restrictVideo(x.id)
    await restrictVideo(y.id)
    expect((await unpublish()).status).toBe(200)
    expect((await putRoute(copyId, { first: x.id, second: y.id, questionText: 'Nog anders?' })).status).toBe(200)
    const response = await publish(agentB, copyId)
    expect(response.status).toBe(200)
    expect(response.body.publication.versionNumber).toBe(3)
    // The Quest of B downloads the restricted video (FR-017).
    expect((await questGet(`/videos/${x.id}`, 'BBBB2222')).status).toBe(200)
  })

  it('a soft-deleted one works while live, and must be replaced after unpublishing (FR-015)', async () => {
    await softDeleteVideo(y.id)
    expect((await putRoute(copyId, { first: x.id, second: y.id, questionText: 'Anders?' })).status).toBe(200)
    expect((await publish(agentB, copyId)).status).toBe(200)
    expect((await unpublish()).status).toBe(200)
    expect((await putRoute(copyId, { first: x.id, second: y.id, questionText: 'Nog anders?' })).status).toBe(200)
    const refused = await publish(agentB, copyId)
    expect(refused.status).toBe(422)
    expect(refused.body.error.code).toBe('course_incomplete')
    expect(refused.body.error.issues.map((issue) => issue.message)).toContain('Video niet meer beschikbaar: kies een andere.')
    // With an own video instead it can be published again.
    expect((await putRoute(copyId, { first: x.id, second: own.id, questionText: 'Nog anders?' })).status).toBe(200)
    expect((await publish(agentB, copyId)).status).toBe(200)
  })

  it('cannot go into another step, back into the same step, or another course (FR-016)', async () => {
    // Into the other step.
    let response = await putRoute(copyId, { first: x.id, second: x.id })
    expect(response.status).toBe(400)
    expect(Object.keys(response.body.error.fields)).toEqual(['steps.2.videoId'])
    // Out of its step and back in (US3 scenario 4).
    expect((await putRoute(copyId, { first: own.id, second: y.id })).status).toBe(200)
    response = await putRoute(copyId, { first: x.id, second: y.id })
    expect(response.status).toBe(400)
    expect(Object.keys(response.body.error.fields)).toEqual(['steps.1.videoId'])
    // Into another course of B.
    const course = (await agentB.post('/api/organisation/courses').send({ name: 'Eigen', description: 'Beschrijving' })).body
    response = await putRoute(course.id, { first: x.id, second: own.id })
    expect(response.status).toBe(400)
  })

  it('are not in the video library of B', async () => {
    const ids = (await agentB.get('/api/organisation/videos')).body.videos.map((v) => v.id)
    expect(ids).not.toContain(x.id)
  })

  it('keep their files when soft-deleted, as long as a version of the copy has them', async () => {
    await softDeleteVideo(x.id)
    await runVideoFileCleanup()
    expect([await exists(x.storageKey), await exists(x.thumbnailStorageKey)]).toEqual([true, true])
    expect((await questGet(`/videos/${x.id}`, 'BBBB2222')).status).toBe(200)
  })
})
