import { expect } from 'vitest'

// Helpers for the course sharing tests (specs/009): a complete course of two video steps behind a
// start question, saved through the API, so publishing can succeed.

/** Saves a complete route in the draft of `courseId`: start question, A → `first`, B → `second`. */
export async function saveRoute(agent, courseId, { first, second = first, questionText = 'Wat doe je?', name = 'Cursus' }) {
  const url = `/api/organisation/courses/${courseId}`
  const doc = (await agent.get(url)).body
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
  const response = await agent.put(url).send({ draftVersionNumber: doc.draftVersionNumber, name, description: 'Beschrijving', steps })
  expect(response.status).toBe(200)
  return response.body
}

export const publish = (agent, courseId, body) => {
  const req = agent.post(`/api/organisation/courses/${courseId}/publish`)
  return body === undefined ? req : req.send(body)
}

export const changeAvailability = (agent, courseId, body) =>
  agent.put(`/api/organisation/courses/${courseId}/availability`).send(body)

export const library = async (agent) => {
  const response = await agent.get('/api/organisation/course-library')
  expect(response.status).toBe(200)
  return response.body.courses
}
