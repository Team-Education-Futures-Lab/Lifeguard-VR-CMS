import { describe, expect, it } from 'vitest'
import { sameContent } from '../../src/lib/courseContent.js'

// "Inhoudelijk gelijk" (specs/006 FR-018, research R4): everything that publishing fixes, without
// ids and without positions on the canvas.

/** A version as courseContent expects it: name, description, steps and answers as stored. */
function version(offset = 0, change = () => {}) {
  const id = (n) => n + offset
  const v = {
    name: 'Cursus',
    description: 'Beschrijving',
    steps: [
      { id: id(1), stepType: 'question', isStart: true, videoId: null, questionText: 'Wat doe je?', feedback: 'Goed zo', nextCourseStepId: null, positionX: 0, positionY: 0 },
      { id: id(2), stepType: 'video', isStart: false, videoId: 7, questionText: null, feedback: null, nextCourseStepId: id(3), positionX: -130, positionY: 260 },
      { id: id(3), stepType: 'video', isStart: false, videoId: 8, questionText: null, feedback: null, nextCourseStepId: null, positionX: 130, positionY: 260 },
    ],
    answers: [
      { id: id(101), courseStepId: id(1), answerText: 'Ik grijp in', isCorrect: true, sortOrder: 0, nextCourseStepId: id(2) },
      { id: id(102), courseStepId: id(1), answerText: 'Ik wacht af', isCorrect: false, sortOrder: 1, nextCourseStepId: id(3) },
    ],
  }
  change(v)
  return v
}

describe('sameContent', () => {
  it('is true for a version and its copy with other ids', () => {
    expect(sameContent(version(), version(1000))).toBe(true)
  })

  it('ignores positions on the canvas', () => {
    expect(sameContent(version(), version(0, (v) => { v.steps[1].positionX = 999; v.steps[0].positionY = -50 }))).toBe(true)
  })

  it('ignores the order in which answers are listed (sortOrder counts)', () => {
    expect(sameContent(version(), version(0, (v) => v.answers.reverse()))).toBe(true)
  })

  it.each([
    ['name', (v) => (v.name = 'Andere naam')],
    ['description', (v) => (v.description = 'Andere beschrijving')],
    ['question text', (v) => (v.steps[0].questionText = 'Wat nu?')],
    ['feedback', (v) => (v.steps[0].feedback = null)],
    ['answer text', (v) => (v.answers[1].answerText = 'Ik roep hulp')],
    ['correct answer', (v) => { v.answers[0].isCorrect = false; v.answers[1].isCorrect = true }],
    ['video', (v) => (v.steps[2].videoId = 9)],
    ['start step', (v) => { v.steps[0].isStart = false; v.steps[1].isStart = true }],
    ['connection of a video', (v) => (v.steps[1].nextCourseStepId = null)],
    ['connection of an answer', (v) => (v.answers[1].nextCourseStepId = v.steps[1].id)],
  ])('is false when the %s differs', (_name, change) => {
    expect(sameContent(version(), version(0, change))).toBe(false)
  })

  it('compares connections by position, not by id', () => {
    // Same ids shifted: step 2 points to step 3 in both, although the ids differ.
    const a = version(0)
    const b = version(50)
    expect(b.steps[1].nextCourseStepId).toBe(53)
    expect(sameContent(a, b)).toBe(true)
  })

  it('is false when a step is added', () => {
    expect(sameContent(version(), version(0, (v) => v.steps.push({ id: 4, stepType: 'video', isStart: false, videoId: null, questionText: null, feedback: null, nextCourseStepId: null, positionX: 0, positionY: 0 })))).toBe(false)
  })
})
