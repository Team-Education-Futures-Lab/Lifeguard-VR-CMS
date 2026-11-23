import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createCourseRow, createOrganisationRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'

// Saving from a draft that was published meanwhile (specs/006 research R14): publishing turns the
// draft into the published version, so an editor that still shows the old draft may not save into
// it. The save carries the number of the loaded draft; another number gives 409 draft_replaced.

const REPLACED = 'Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw om verder te werken.'

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

/** A complete route: start question, A → video 1, B → video 2 (new steps, keys only). */
const steps = (questionText = 'Wat doe je?') => [
  {
    key: 'q', stepType: 'question', isStart: true, positionX: 0, positionY: 0, questionText, feedback: null,
    answers: [
      { answerText: 'Ingrijpen', isCorrect: true, nextStepKey: 'v1' },
      { answerText: 'Afwachten', isCorrect: false, nextStepKey: 'v2' },
    ],
  },
  { key: 'v1', stepType: 'video', isStart: false, positionX: -130, positionY: 260, videoId: video.id, nextStepKey: null },
  { key: 'v2', stepType: 'video', isStart: false, positionX: 130, positionY: 260, videoId: video.id, nextStepKey: null },
]
const save = (draftVersionNumber, questionText) =>
  agent.put(url()).send({ draftVersionNumber, name: 'Cursus', description: 'D', steps: steps(questionText) })

const snapshot = async () => ({
  versions: await db('CourseVersion').where({ courseId: course.courseId }).orderBy('id'),
  steps: await db('CourseStep').orderBy('id'),
  answers: await db('Answer').orderBy('id'),
})

describe('the number of the loaded draft', () => {
  it('is required', async () => {
    const response = await agent.put(url()).send({ name: 'Cursus', description: 'D', steps: steps() })
    expect(response.status).toBe(400)
    expect(response.body.error.fields).toEqual({ draftVersionNumber: 'Laad de pagina opnieuw om verder te werken.' })
  })

  it('must be the number of the current draft, else 409 and nothing changes', async () => {
    const before = await snapshot()
    const response = await save(2)
    expect(response.status).toBe(409)
    expect(response.body.error).toEqual({ code: 'draft_replaced', message: REPLACED })
    expect(await snapshot()).toEqual(before)
  })

  it('saves as before with the right number', async () => {
    const response = await save(1)
    expect(response.status).toBe(200)
    expect(response.body.draftVersionNumber).toBe(1)
  })

  it('is refused after a publication', async () => {
    expect((await save(1)).status).toBe(200)
    expect((await agent.post(`${url()}/publish`)).status).toBe(200)
    const response = await save(1, 'Te laat')
    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('draft_replaced')
  })
})

describe('saving and publishing at the same time', () => {
  it('never gives 404 and never changes a published version', async () => {
    expect((await save(1, 'Ronde 0')).status).toBe(200)
    const questionOf = async (versionId) =>
      (await db('CourseStep').where({ courseVersionId: versionId, stepType: 'question' }).first('questionText')).questionText
    const seen = new Map() // published version id → its question text when first seen

    for (let round = 1; round <= 10; round++) {
      const number = (await agent.get(url())).body.draftVersionNumber
      const [saved, published] = await Promise.all([save(number, `Ronde ${round}`), agent.post(`${url()}/publish`)])
      expect([200, 409]).toContain(saved.status)
      if (saved.status === 409) expect(saved.body.error.code).toBe('draft_replaced')
      expect(published.status).toBe(200)

      const versions = await db('CourseVersion').where({ courseId: course.courseId }).whereNotNull('publishedAt')
      for (const version of versions) {
        const text = await questionOf(version.id)
        if (seen.has(version.id)) expect(text).toBe(seen.get(version.id))
        else seen.set(version.id, text)
      }
      // Every round has its own content, so the next round always publishes again: keep the draft
      // in step with what was saved.
      if (saved.status === 409) expect((await save(number + 1, `Ronde ${round}`)).status).toBe(200)
    }
    const numbers = (await db('CourseVersion').where({ courseId: course.courseId }).orderBy('versionNumber')).map((v) => v.versionNumber)
    expect(numbers).toEqual([...new Set(numbers)])
  })
})
