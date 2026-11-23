import { performance } from 'node:perf_hooks'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { sameContent } from '../../src/lib/courseContent.js'
import { agentWithSession, createCourseRow, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'

// Publishing a course (specs/006 US1–US3, FR-001 – FR-010, FR-017 – FR-020, research R3, R4, R9):
// the draft itself becomes the published version and a copy becomes the new draft.

let agent
let course
let video

beforeEach(async () => {
  await resetDatabase()
  const a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  agent = (await agentWithSession({ organisationId: a.id })).agent
  video = await createVideoRow({ organisationId: a.id })
  course = await createCourseRow({ organisationId: a.id })
})

const url = () => `/api/organisation/courses/${course.courseId}`
const publish = () => agent.post(`${url()}/publish`)
const current = async () => (await agent.get(url())).body

/** A complete route (new steps, keys only): start question, A → video 1, B → video 2. */
function route({ questionText = 'Wat doe je?', shift = 0, answerB = 'v2' } = {}) {
  return [
    {
      key: 'q', stepType: 'question', isStart: true, positionX: shift, positionY: 0, questionText, feedback: 'Goed gedaan.',
      answers: [
        { answerText: 'Ingrijpen', isCorrect: true, nextStepKey: 'v1' },
        { answerText: 'Afwachten', isCorrect: false, nextStepKey: answerB },
      ],
    },
    { key: 'v1', stepType: 'video', isStart: false, positionX: shift - 130, positionY: 260, videoId: video.id, nextStepKey: null },
    { key: 'v2', stepType: 'video', isStart: false, positionX: shift + 130, positionY: 260, videoId: video.id, nextStepKey: null },
  ]
}
async function save(steps, name = 'Redding') {
  const { draftVersionNumber } = await current()
  const response = await agent.put(url()).send({ draftVersionNumber, name, description: 'Diep bad', steps })
  expect(response.status).toBe(200)
  return response.body
}

/** Versions of the course with their steps and answers, as stored. */
async function versions() {
  const rows = await db('CourseVersion').where({ courseId: course.courseId }).orderBy('versionNumber')
  const result = []
  for (const row of rows) {
    const steps = await db('CourseStep').where({ courseVersionId: row.id }).orderBy('id')
    const answers = steps.length ? await db('Answer').whereIn('courseStepId', steps.map((s) => s.id)).orderBy('id') : []
    result.push({ ...row, steps, answers })
  }
  return result
}

describe('publishing a complete course (US1)', () => {
  it('fixes the draft as version 1 and continues with a copy as draft 2', async () => {
    await save(route())
    const before = await versions()
    const response = await publish()
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      status: 'published',
      publication: { versionNumber: 1, hasUnavailableVideo: false },
      lastPublishedVersionNumber: 1,
      draftVersionNumber: 2,
    })
    expect(Date.parse(response.body.publication.publishedAt)).not.toBeNaN()

    const [published, draft] = await versions()
    // The draft row itself became version 1, with the same steps and answers.
    expect(published).toMatchObject({ id: before[0].id, versionNumber: 1, unpublishedAt: null })
    expect(published.publishedAt).not.toBeNull()
    expect(published.steps).toEqual(before[0].steps)
    expect(published.answers).toEqual(before[0].answers)
    // The new draft is a copy with new ids and the same content, connections inside itself.
    expect(draft).toMatchObject({ versionNumber: 2, publishedAt: null, name: 'Redding', description: 'Diep bad' })
    expect(draft.steps.map((s) => s.id).some((id) => published.steps.some((p) => p.id === id))).toBe(false)
    expect(sameContent(draft, published)).toBe(true)
    const ownIds = new Set(draft.steps.map((s) => s.id))
    for (const next of [...draft.steps, ...draft.answers].map((row) => row.nextCourseStepId).filter(Boolean)) {
      expect(ownIds.has(next)).toBe(true)
    }
    expect(draft.steps.map((s) => [s.positionX, s.positionY, s.videoId, Boolean(s.isStart)])).toEqual(
      published.steps.map((s) => [s.positionX, s.positionY, s.videoId, Boolean(s.isStart)]),
    )
    // The document returned is the new draft, with its own ids.
    expect(response.body.steps.map((s) => s.id).sort()).toEqual([...ownIds].sort())
  })

  it('never changes the published version when the draft is edited', async () => {
    await save(route())
    await publish()
    const [published] = await versions()
    await save(route({ questionText: 'Iets anders' }), 'Nieuwe naam')
    const [after] = await versions()
    expect(after).toEqual(published)
  })

  it('moves the course to the top of the list (updatedAt)', async () => {
    await save(route())
    await db('Course').where({ id: course.courseId }).update({ updatedAt: new Date('2026-01-01T00:00:00Z') })
    await publish()
    const row = await db('Course').where({ id: course.courseId }).first()
    expect(row.updatedAt.getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00Z').getTime())
  })
})

describe('an incomplete course is not published (US2, FR-005, FR-006)', () => {
  it('gives 422 with the messages and the real ids, and changes nothing', async () => {
    const saved = await save(route({ answerB: null }).slice(0, 2))
    const before = await versions()
    const response = await publish()
    expect(response.status).toBe(422)
    const question = saved.steps.find((s) => s.stepType === 'question')
    expect(response.body.error).toEqual({
      code: 'course_incomplete',
      message: 'De cursus is nog niet klaar om te publiceren.',
      issues: [{ code: 'answerOpen', message: 'Antwoord B is nog niet verbonden', stepId: question.id, answerId: question.answers[1].id }],
    })
    expect(await versions()).toEqual(before)
  })

  it('reports several problems at once', async () => {
    const steps = route()
    steps[0].questionText = ''
    steps[1].videoId = null
    steps[0].isStart = true
    const saved = await save(steps)
    const response = await publish()
    expect(response.status).toBe(422)
    const byCode = Object.fromEntries(response.body.error.issues.map((i) => [i.code, i]))
    expect(byCode.noQuestion.stepId).toBe(saved.steps.find((s) => s.stepType === 'question').id)
    expect(byCode.noVideo.message).toBe('Kies een video')
  })

  it('keeps the previous version live when the changed draft is incomplete', async () => {
    await save(route())
    await publish()
    await save(route({ answerB: null }).slice(0, 2))
    expect((await publish()).status).toBe(422)
    const doc = await current()
    expect(doc).toMatchObject({ status: 'published_changed', publication: { versionNumber: 1 } })
  })
})

describe('changes and publishing again (US3)', () => {
  beforeEach(async () => {
    await save(route())
    expect((await publish()).status).toBe(200)
  })

  it('shows changes that are not published yet, but not for positions only', async () => {
    expect((await save(route({ shift: 500 }))).status).toBe('published')
    expect((await save(route({ questionText: 'Wat doe je nu?' }))).status).toBe('published_changed')
    expect((await save(route())).status).toBe('published')
  })

  it('publishes a new version that replaces the previous one', async () => {
    await save(route({ questionText: 'Wat doe je nu?' }))
    const response = await publish()
    expect(response.body).toMatchObject({ status: 'published', publication: { versionNumber: 2 }, draftVersionNumber: 3 })
    const [v1, v2, draft] = await versions()
    expect([v1.versionNumber, v2.versionNumber, draft.versionNumber]).toEqual([1, 2, 3])
    expect(v1.publishedAt).not.toBeNull()
    expect(v1.steps.find((s) => s.stepType === 'question').questionText).toBe('Wat doe je?')
    expect(v2.steps.find((s) => s.stepType === 'question').questionText).toBe('Wat doe je nu?')
    expect(draft.publishedAt).toBeNull()
  })

  it('does nothing when there is nothing new (research R9)', async () => {
    const before = await versions()
    const response = await publish()
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'published', publication: { versionNumber: 1 }, draftVersionNumber: 2 })
    expect(await versions()).toEqual(before)
  })

  it('makes exactly one version from 20 publications at the same time (SC-006)', async () => {
    await save(route({ questionText: 'Tegelijk' }))
    const responses = await Promise.all(Array.from({ length: 20 }, () => publish()))
    expect(responses.map((r) => r.status)).toEqual(responses.map(() => 200))
    const numbers = (await versions()).map((v) => v.versionNumber)
    expect(numbers).toEqual([1, 2, 3])
    expect((await current()).publication.versionNumber).toBe(2)
  })
})

describe('a course with 50 steps (SC-003)', () => {
  it('is published and unpublished within 3 seconds each', async () => {
    const steps = []
    for (let i = 1; i <= 25; i++) {
      steps.push({
        key: `q${i}`, stepType: 'question', isStart: i === 1, positionX: 0, positionY: i * 600, questionText: `Vraag ${i}`, feedback: null,
        answers: [
          { answerText: 'Ja', isCorrect: true, nextStepKey: `v${i}` },
          { answerText: 'Nee', isCorrect: false, nextStepKey: `v${i}` },
        ],
      })
      steps.push({ key: `v${i}`, stepType: 'video', isStart: false, positionX: 0, positionY: i * 600 + 300, videoId: video.id, nextStepKey: i < 25 ? `q${i + 1}` : null })
    }
    await save(steps)
    let start = performance.now()
    expect((await publish()).status).toBe(200)
    expect(performance.now() - start).toBeLessThan(3000)
    start = performance.now()
    expect((await agent.post(`${url()}/unpublish`)).status).toBe(200)
    expect(performance.now() - start).toBeLessThan(3000)
    const [published, draft] = await versions()
    expect(published.steps).toHaveLength(50)
    expect(sameContent(published, draft)).toBe(true)
  })
})
