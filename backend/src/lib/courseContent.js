// The content of a course version as the Quest sees it (specs/006 FR-004, FR-018, research R4):
// name, description, steps, answers, connections and the start step. Ids and positions on the
// canvas are left out, so a published version and the draft copied from it have the same content.
// Nothing is stored; two versions are compared when needed.

/**
 * The canonical content of a version: `steps` and `answers` as stored (CourseStep and Answer
 * rows). Steps in id order; a connection is the index of the next step in that order.
 */
export function canonicalContent({ name, description, steps, answers }) {
  const ordered = [...steps].sort((a, b) => a.id - b.id)
  const index = new Map(ordered.map((step, i) => [step.id, i]))
  const next = (id) => (id === null || id === undefined ? null : index.get(id) ?? null)
  return {
    name,
    description,
    steps: ordered.map((step) => ({
      stepType: step.stepType,
      isStart: Boolean(step.isStart),
      videoId: step.videoId ?? null,
      questionText: step.questionText ?? null,
      feedback: step.feedback ?? null,
      next: step.stepType === 'video' ? next(step.nextCourseStepId) : null,
      answers: answers
        .filter((answer) => answer.courseStepId === step.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((answer) => ({ answerText: answer.answerText, isCorrect: Boolean(answer.isCorrect), next: next(answer.nextCourseStepId) })),
    })),
  }
}

/** True when two versions have the same content (research R4). */
export function sameContent(a, b) {
  return JSON.stringify(canonicalContent(a)) === JSON.stringify(canonicalContent(b))
}
