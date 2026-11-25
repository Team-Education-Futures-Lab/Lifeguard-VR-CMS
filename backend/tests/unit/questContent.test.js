import { describe, expect, it } from 'vitest'
import { buildQuestContent, downloadSizeBytes, questContentBytes } from '../../src/modules/quest/questContent.js'

// The content a Quest downloads (specs/007 contracts/quest-api.md, research R4).

const version = {
  id: 7,
  courseId: 345,
  versionNumber: 3,
  name: 'Verdrinkingsherkenning 🛟',
  description: 'Herken de signalen van een drenkeling, ook bij café-zwemmers.',
  publishedAt: new Date('2026-11-20T14:02:11.000Z'),
  unpublishedAt: null,
}

const step = (row) => ({ courseVersionId: 7, description: 'x', positionX: 10, positionY: 20, isStart: false, videoId: null, questionText: null, feedback: null, nextCourseStepId: null, ...row })

const steps = [
  step({ id: 12, stepType: 'video', videoId: 77, nextCourseStepId: null }),
  step({ id: 10, stepType: 'video', videoId: 77, nextCourseStepId: 11, isStart: true }),
  step({ id: 11, stepType: 'question', questionText: 'Wat doe je eerst?', feedback: 'Eerst alarmeren.' }),
  step({ id: 13, stepType: 'video', videoId: 78, nextCourseStepId: null }),
]
const answers = [
  { id: 502, courseStepId: 11, answerText: 'Springen', isCorrect: 0, sortOrder: 1, nextCourseStepId: 13 },
  { id: 501, courseStepId: 11, answerText: 'Alarm slaan', isCorrect: 1, sortOrder: 0, nextCourseStepId: 12 },
]
const videos = new Map([
  [77, { id: 77, storageKey: 'videos/1/a.mp4', thumbnailStorageKey: 'thumbnails/1/a.jpg', fileSizeBytes: 1000, durationSeconds: 95 }],
  [78, { id: 78, storageKey: 'videos/1/b.mp4', thumbnailStorageKey: 'thumbnails/1/b.jpg', fileSizeBytes: 2000, durationSeconds: null }],
])

describe('buildQuestContent', () => {
  const content = buildQuestContent(version, { steps, answers }, videos)

  it('has the shape of the contract', () => {
    expect(content).toEqual({
      id: 345,
      name: version.name,
      description: version.description,
      versionNumber: 3,
      publishedAt: '2026-11-20T14:02:11.000Z',
      thumbnailUrl: '/api/quest/v1/courses/345/thumbnail?v=3',
      startStepId: 10,
      steps: [
        { id: 10, type: 'video', videoId: 77, nextStepId: 11 },
        {
          id: 11,
          type: 'question',
          questionText: 'Wat doe je eerst?',
          feedback: 'Eerst alarmeren.',
          answers: [
            { id: 501, text: 'Alarm slaan', isCorrect: true, nextStepId: 12 },
            { id: 502, text: 'Springen', isCorrect: false, nextStepId: 13 },
          ],
        },
        { id: 12, type: 'video', videoId: 77, nextStepId: null },
        { id: 13, type: 'video', videoId: 78, nextStepId: null },
      ],
      videos: [
        { id: 77, fileSizeBytes: 1000, durationSeconds: 95, url: '/api/quest/v1/videos/77' },
        { id: 78, fileSizeBytes: 2000, durationSeconds: null, url: '/api/quest/v1/videos/78' },
      ],
    })
  })

  it('puts thumbnailUrl directly after publishedAt (specs/008 contract)', () => {
    const keys = Object.keys(content)
    expect(keys[keys.indexOf('publishedAt') + 1]).toBe('thumbnailUrl')
  })

  it('gives thumbnailUrl null when no video on the route has a thumbnail (specs/008 FR-004)', () => {
    const withoutThumbnails = new Map([...videos].map(([id, video]) => [id, { ...video, thumbnailStorageKey: null }]))
    expect(buildQuestContent(version, { steps, answers }, withoutThumbnails).thumbnailUrl).toBeNull()
  })

  it('leaves out editor-only fields and storage keys', () => {
    const json = JSON.stringify(content)
    for (const field of ['positionX', 'positionY', 'courseVersionId', 'isStart', 'storageKey', 'StorageKey', 'description":"x']) {
      expect(json).not.toContain(field)
    }
  })

  it('gives a question without feedback null', () => {
    const plain = buildQuestContent(version, { steps: [step({ id: 1, stepType: 'question', questionText: 'Q', isStart: true })], answers: [] }, new Map())
    expect(plain.steps[0].feedback).toBeNull()
    expect(plain.videos).toEqual([])
  })
})

describe('download size', () => {
  const content = buildQuestContent(version, { steps, answers }, videos)

  it('counts the UTF-8 bytes of the JSON', () => {
    expect(questContentBytes(content)).toBe(Buffer.byteLength(JSON.stringify(content), 'utf8'))
    expect(questContentBytes(content)).toBeGreaterThan(JSON.stringify(content).length)
  })

  it('is every video once plus the content (FR-010)', () => {
    expect(downloadSizeBytes(content)).toBe(3000 + questContentBytes(content))
  })
})
