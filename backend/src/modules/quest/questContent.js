// The course content a Quest downloads (specs/007 contracts/quest-api.md, research R4). The list
// and the download both build it here, so downloadSizeBytes always matches what is sent (FR-010).

export function videoUrl(id) {
  return `/api/quest/v1/videos/${id}`
}

const toIso = (value) => (value instanceof Date ? value.toISOString() : new Date(value).toISOString())

/**
 * `version`: a CourseVersion row; `steps`/`answers`: from versionContents; `videosById`: Map
 * videoId → { id, fileSizeBytes, durationSeconds } (courseRepository.videoFiles). Editor-only
 * fields (positions, step description, version ids) are left out. Feedback belongs to the
 * question, not to an answer (specs/007 Clarifications).
 */
export function buildQuestContent(version, { steps, answers }, videosById) {
  const answersByStep = new Map()
  for (const answer of [...answers].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!answersByStep.has(answer.courseStepId)) answersByStep.set(answer.courseStepId, [])
    answersByStep.get(answer.courseStepId).push({
      id: answer.id,
      text: answer.answerText,
      isCorrect: Boolean(answer.isCorrect),
      nextStepId: answer.nextCourseStepId ?? null,
    })
  }

  const sortedSteps = [...steps].sort((a, b) => a.id - b.id)
  const videoIds = []
  const questSteps = sortedSteps.map((step) => {
    if (step.stepType === 'video') {
      if (step.videoId !== null && !videoIds.includes(step.videoId)) videoIds.push(step.videoId)
      return { id: step.id, type: 'video', videoId: step.videoId, nextStepId: step.nextCourseStepId ?? null }
    }
    return {
      id: step.id,
      type: 'question',
      questionText: step.questionText ?? '',
      feedback: step.feedback ?? null,
      answers: answersByStep.get(step.id) ?? [],
    }
  })

  return {
    id: version.courseId,
    name: version.name,
    description: version.description,
    versionNumber: version.versionNumber,
    publishedAt: toIso(version.publishedAt),
    startStepId: sortedSteps.find((step) => step.isStart)?.id ?? null,
    steps: questSteps,
    videos: videoIds.map((id) => {
      const video = videosById.get(id)
      return {
        id,
        fileSizeBytes: Number(video?.fileSizeBytes ?? 0),
        durationSeconds: video?.durationSeconds ?? null,
        url: videoUrl(id),
      }
    }),
  }
}

/** The number of bytes of the content as sent by res.json (UTF-8 JSON, no spacing). */
export function questContentBytes(content) {
  return Buffer.byteLength(JSON.stringify(content), 'utf8')
}

/** What the Quest downloads for a course: every video once plus the content (FR-010). */
export function downloadSizeBytes(content) {
  return content.videos.reduce((sum, video) => sum + video.fileSizeBytes, 0) + questContentBytes(content)
}
