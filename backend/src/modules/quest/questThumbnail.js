// The image of a course on the Quest (specs/008 FR-002–FR-004, research R1). It is not stored:
// it is the thumbnail of a video in the live version, chosen here from the same rows the course
// content is built from, so the image can never come from another version than the content.

/**
 * The id of the video whose thumbnail is the course image, or null.
 *
 * Breadth-first from the start step: the first video step whose video has a thumbnail wins.
 * A question queues the next steps of its answers in order A–D (sortOrder), so the nearest video
 * wins and, at equal distance, the one behind the earlier answer. A video step without a video or
 * without a thumbnail is passed through. Every step is visited once, so a loop ends; steps that
 * cannot be reached from the start never count.
 *
 * `steps` and `answers` as from courseRepository.versionContents; `videosById`: Map videoId →
 * { thumbnailStorageKey } (courseRepository.videoFiles).
 */
export function thumbnailVideoId(steps, answers, videosById) {
  const start = steps.find((step) => step.isStart)
  if (!start) return null

  const stepsById = new Map(steps.map((step) => [step.id, step]))
  const answersByStep = new Map()
  for (const answer of [...answers].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!answersByStep.has(answer.courseStepId)) answersByStep.set(answer.courseStepId, [])
    answersByStep.get(answer.courseStepId).push(answer)
  }

  const queue = [start.id]
  const visited = new Set(queue)
  const enqueue = (stepId) => {
    if (stepId === null || stepId === undefined || visited.has(stepId) || !stepsById.has(stepId)) return
    visited.add(stepId)
    queue.push(stepId)
  }

  while (queue.length > 0) {
    const step = stepsById.get(queue.shift())
    if (step.stepType === 'video') {
      if (step.videoId !== null && videosById.get(step.videoId)?.thumbnailStorageKey) return step.videoId
      enqueue(step.nextCourseStepId)
    } else {
      for (const answer of answersByStep.get(step.id) ?? []) enqueue(answer.nextCourseStepId)
    }
  }
  return null
}
