import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkCourse, CHECK_MESSAGES } from '../../src/lib/courseCheck.js'

// The completeness check on the server (specs/006 FR-005, FR-006, FR-012, research R5, R6). The cases
// are shared with the frontend (frontend/tests/course-check-parity.test.js), so the editor and the
// server always give the same messages.

const CASES = JSON.parse(readFileSync(new URL('../fixtures/course-check-cases.json', import.meta.url), 'utf8'))

/** The expected issues of a case, with the real step and answer ids, sorted. */
function expectedIssues(testCase) {
  return testCase.expected
    .map(({ code, step, answer }) => {
      const s = step === undefined ? undefined : testCase.draft.steps[step]
      return {
        code,
        stepId: s?.id ?? null,
        answerId: answer === undefined ? null : s.answers[answer].id,
      }
    })
    .sort(byKey)
}

const key = (issue) => `${issue.code}:${issue.stepId ?? ''}:${issue.answerId ?? ''}`
const byKey = (a, b) => key(a).localeCompare(key(b))

describe('checkCourse with the shared cases', () => {
  it.each(CASES.map((c) => [c.name, c]))('%s', (_name, testCase) => {
    const issues = checkCourse(testCase.draft, {
      libraryVideoIds: new Set(testCase.libraryVideoIds),
      liveVideoIds: new Set(testCase.liveVideoIds),
    })
    const actual = issues
      .map(({ code, stepId, answerId }) => ({ code, stepId: stepId ?? null, answerId: answerId ?? null }))
      .sort(byKey)
    expect(actual).toEqual(expectedIssues(testCase))
  })

  it('covers every message code at least once', () => {
    const codes = new Set(CASES.flatMap((c) => c.expected.map((e) => e.code)))
    expect([...codes].sort()).toEqual(Object.keys(CHECK_MESSAGES).sort())
  })
})

describe('the messages', () => {
  it('are the texts of the editor (data-model.md § Meldingen)', () => {
    expect(CHECK_MESSAGES.empty()).toBe('Voeg een onderdeel toe')
    expect(CHECK_MESSAGES.noStart()).toBe('Kies een startonderdeel')
    expect(CHECK_MESSAGES.noEnd()).toBe('De route heeft geen einde')
    expect(CHECK_MESSAGES.unreachable()).toBe('Niet bereikbaar vanaf de start')
    expect(CHECK_MESSAGES.answerOpen('B')).toBe('Antwoord B is nog niet verbonden')
    expect(CHECK_MESSAGES.neverEnds()).toBe('Vanaf hier eindigt de route nooit')
    expect(CHECK_MESSAGES.noVideo()).toBe('Kies een video')
    expect(CHECK_MESSAGES.videoUnavailable()).toBe('Video niet meer beschikbaar: kies een andere.')
    expect(CHECK_MESSAGES.noQuestion()).toBe('Vul de vraag in')
    expect(CHECK_MESSAGES.emptyAnswer('A')).toBe('Antwoord A is leeg')
  })

  it('carry the answer letter', () => {
    const testCase = CASES.find((c) => c.name === 'answer without a next step')
    const [issue] = checkCourse(testCase.draft, { libraryVideoIds: new Set(testCase.libraryVideoIds), liveVideoIds: new Set() })
    expect(issue.message).toBe('Antwoord B is nog niet verbonden')
  })
})
