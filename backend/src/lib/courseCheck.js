// The completeness check on the server (specs/006 FR-005, FR-006, research R5). The same rules,
// codes and texts as the live check of the editor (frontend/src/lib/completeness.js, specs/005
// FR-010 – FR-016); a shared set of cases (tests/fixtures/course-check-cases.json) keeps the two
// equal. Pure: works on the draft document of contracts/api.md. Messages are customer-facing.

const LETTERS = ['A', 'B', 'C', 'D']

export const CHECK_MESSAGES = {
  empty: () => 'Voeg een onderdeel toe',
  noStart: () => 'Kies een startonderdeel',
  noEnd: () => 'De route heeft geen einde',
  unreachable: () => 'Niet bereikbaar vanaf de start',
  answerOpen: (letter) => `Antwoord ${letter} is nog niet verbonden`,
  neverEnds: () => 'Vanaf hier eindigt de route nooit',
  noVideo: () => 'Kies een video',
  videoUnavailable: () => 'Video niet meer beschikbaar: kies een andere.',
  noQuestion: () => 'Vul de vraag in',
  emptyAnswer: (letter) => `Antwoord ${letter} is leeg`,
}

/** The next steps of a step: the next step of a video, the connected answers of a question. */
function outgoing(step) {
  if (step.stepType === 'video') return step.nextStepId ? [step.nextStepId] : []
  return step.answers.filter((answer) => answer.nextStepId).map((answer) => answer.nextStepId)
}

/**
 * Checks a draft document. `libraryVideoIds`: the videos in the organisation's library;
 * `liveVideoIds`: the videos in the course's live version; `grantedVideoIds`: the videos an own copy
 * got from its original (specs/011 FR-014, research R4). A video outside the library is only
 * reported when neither the live version nor the original has it (FR-012, constitution V).
 * Returns the issues as [{ code, message, stepId?, answerId? }]; an empty list means the course
 * may be published.
 */
export function checkCourse(draft, { libraryVideoIds = new Set(), liveVideoIds = new Set(), grantedVideoIds = new Set() } = {}) {
  const issues = []
  const add = (code, stepId = null, answerId = null, letter = null) => {
    const issue = { code, message: CHECK_MESSAGES[code](letter) }
    if (stepId !== null) issue.stepId = stepId
    if (answerId !== null) issue.answerId = answerId
    issues.push(issue)
  }
  const steps = draft.steps ?? []

  if (steps.length === 0) {
    add('empty')
    return issues
  }

  // The rules of feature 004 per step (specs/005 FR-015, FR-013).
  for (const step of steps) {
    if (step.stepType === 'video') {
      if (!step.videoId) add('noVideo', step.id)
      else if (!libraryVideoIds.has(step.videoId) && !liveVideoIds.has(step.videoId) && !grantedVideoIds.has(step.videoId)) add('videoUnavailable', step.id)
      continue
    }
    if (!step.questionText?.trim()) add('noQuestion', step.id)
    step.answers.forEach((answer, i) => {
      if (!answer.answerText?.trim()) add('emptyAnswer', step.id, answer.id, LETTERS[i])
    })
    // All answers continue, or none (then the question is an end).
    if (step.answers.some((answer) => answer.nextStepId)) {
      step.answers.forEach((answer, i) => {
        if (!answer.nextStepId) add('answerOpen', step.id, answer.id, LETTERS[i])
      })
    }
  }

  // Without a start everything is unreachable: only ask for a start (specs/005 FR-010).
  const byId = new Map(steps.map((step) => [step.id, step]))
  const start = steps.find((step) => step.isStart)
  if (!start) {
    add('noStart')
    return issues
  }

  // Reachable from the start (specs/005 FR-012).
  const reach = new Set()
  const queue = [start.id]
  while (queue.length) {
    const id = queue.shift()
    const step = byId.get(id)
    if (!step || reach.has(id)) continue
    reach.add(id)
    queue.push(...outgoing(step))
  }
  for (const step of steps) if (!reach.has(step.id)) add('unreachable', step.id)

  // Steps from which an end can be reached: the ends, then backwards to a fixed point (FR-011, FR-014).
  const canEnd = new Set(steps.filter((step) => outgoing(step).length === 0).map((step) => step.id))
  if (![...canEnd].some((id) => reach.has(id))) add('noEnd')
  let changed = true
  while (changed) {
    changed = false
    for (const step of steps) {
      if (!canEnd.has(step.id) && outgoing(step).some((id) => canEnd.has(id))) {
        canEnd.add(step.id)
        changed = true
      }
    }
  }
  for (const id of reach) if (!canEnd.has(id)) add('neverEnds', id)

  return issues
}
