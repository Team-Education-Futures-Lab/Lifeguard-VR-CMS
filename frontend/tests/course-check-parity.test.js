import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkCourse } from '../src/lib/completeness'
import { toEditor } from '../src/lib/courseMapping'

// The editor check and the server check give the same messages (specs/006 FR-006, research R5): the
// same cases run through backend/src/lib/courseCheck.js in backend/tests/unit/courseCheck.test.js.

const CASES = JSON.parse(
  readFileSync(path.resolve(process.cwd(), '../backend/tests/fixtures/course-check-cases.json'), 'utf8'),
)

const key = (issue) => `${issue.code}:${issue.nodeId ?? ''}:${issue.answerId ?? ''}`

describe('editor check = server check', () => {
  it.each(CASES.map((c) => [c.name, c]))('%s', (_name, testCase) => {
    const { course, stepVideos } = toEditor(testCase.draft)
    const actual = checkCourse(course, stepVideos).issues.map(key).sort()
    const expected = testCase.expected
      .map(({ code, step, answer }) => {
        const s = step === undefined ? undefined : testCase.draft.steps[step]
        return key({
          code,
          nodeId: s ? `s${s.id}` : null,
          answerId: answer === undefined ? null : `a${s.answers[answer].id}`,
        })
      })
      .sort()
    expect(actual).toEqual(expected)
  })
})
