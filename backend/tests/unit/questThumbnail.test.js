import { describe, expect, it } from 'vitest'
import { thumbnailVideoId } from '../../src/modules/quest/questThumbnail.js'

// Which video gives a course its image on the Quest (specs/008 FR-002–FR-004, research R1):
// breadth-first from the start step, answers in order A–D, every step once.

const video = (id, nextCourseStepId = null, extra = {}) => ({ id, stepType: 'video', isStart: false, videoId: id * 10, nextCourseStepId, ...extra })
const question = (id, extra = {}) => ({ id, stepType: 'question', isStart: false, videoId: null, nextCourseStepId: null, ...extra })
const answer = (courseStepId, sortOrder, nextCourseStepId) => ({ id: courseStepId * 100 + sortOrder, courseStepId, sortOrder, nextCourseStepId })
const videosWithThumbnail = (...ids) => new Map(ids.map((id) => [id, { id, thumbnailStorageKey: `thumbnails/1/${id}.jpg` }]))

describe('thumbnailVideoId', () => {
  it('takes the video of the start step (FR-002)', () => {
    const steps = [video(1, 2, { isStart: true }), video(2)]
    expect(thumbnailVideoId(steps, [], videosWithThumbnail(10, 20))).toBe(10)
  })

  it('takes the nearest video when the course starts with a question (FR-003)', () => {
    // A → question 3 → video 4 (distance 2); B → video 5 (distance 1): B wins.
    const steps = [question(1, { isStart: true }), question(3), video(4), video(5)]
    const answers = [answer(1, 0, 3), answer(1, 1, 5), answer(3, 0, 4)]
    expect(thumbnailVideoId(steps, answers, videosWithThumbnail(40, 50))).toBe(50)
  })

  it('takes the nearest video also when it is behind answer A', () => {
    // A → video 4 (distance 1); B → question 3 → video 5 (distance 2): A wins.
    const steps = [question(1, { isStart: true }), question(3), video(4), video(5)]
    const answers = [answer(1, 0, 4), answer(1, 1, 3), answer(3, 0, 5)]
    expect(thumbnailVideoId(steps, answers, videosWithThumbnail(40, 50))).toBe(40)
  })

  it('takes the earlier answer when two videos are equally far, whatever the input order', () => {
    const steps = [question(1, { isStart: true }), video(4), video(5)]
    const answers = [answer(1, 1, 5), answer(1, 0, 4)]
    expect(thumbnailVideoId(steps, answers, videosWithThumbnail(40, 50))).toBe(40)
  })

  it('stops on a loop and visits every step once', () => {
    // Start video without thumbnail → question → answer back to the start.
    const steps = [video(1, 2, { isStart: true }), question(2)]
    const answers = [answer(2, 0, 1), answer(2, 1, 1)]
    expect(thumbnailVideoId(steps, answers, new Map([[10, { id: 10, thumbnailStorageKey: null }]]))).toBeNull()
  })

  it('ignores steps that cannot be reached from the start', () => {
    const steps = [question(1, { isStart: true }), video(9)]
    const answers = [answer(1, 0, null), answer(1, 1, null)]
    expect(thumbnailVideoId(steps, answers, videosWithThumbnail(90))).toBeNull()
  })

  it('gives null without any video step (FR-004)', () => {
    const steps = [question(1, { isStart: true }), question(2)]
    expect(thumbnailVideoId(steps, [answer(1, 0, 2)], new Map())).toBeNull()
  })

  it('skips a video without a thumbnail and goes on along the route', () => {
    const steps = [video(1, 2, { isStart: true }), video(2)]
    const videos = new Map([
      [10, { id: 10, thumbnailStorageKey: null }],
      [20, { id: 20, thumbnailStorageKey: 'thumbnails/1/20.jpg' }],
    ])
    expect(thumbnailVideoId(steps, [], videos)).toBe(20)
  })

  it('skips a video step without a video and follows its next step', () => {
    const steps = [video(1, 2, { isStart: true, videoId: null }), video(2)]
    expect(thumbnailVideoId(steps, [], videosWithThumbnail(20))).toBe(20)
  })

  it('gives null when there is no start step', () => {
    expect(thumbnailVideoId([video(1)], [], videosWithThumbnail(10))).toBeNull()
  })

  it('skips a video that is missing from the video data', () => {
    const steps = [video(1, 2, { isStart: true }), video(2)]
    expect(thumbnailVideoId(steps, [], videosWithThumbnail(20))).toBe(20)
  })

  it('treats isStart stored as 1 like true', () => {
    expect(thumbnailVideoId([video(1, null, { isStart: 1 })], [], videosWithThumbnail(10))).toBe(10)
  })
})
