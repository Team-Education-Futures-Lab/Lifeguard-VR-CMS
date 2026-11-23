import { db } from '../../db/knex.js'
import { visibleVideosQuery } from '../videos/videoRepository.js'

// Queries from specs/004 data-model.md. Every function takes the organisation id explicitly; it
// always comes from the session. Soft-deleted courses are excluded (constitution V).

function requireId(organisationId) {
  if (!organisationId) throw new Error('organisationId is required')
}

/**
 * The only definition of "courses this organisation may see and edit" (specs/004 research R2):
 * owned through OrganisationCourse, not deleted, joined with the draft (the version without
 * publishedAt). Every course route starts from this query.
 */
export function ownCoursesQuery(organisationId, trx = db) {
  requireId(organisationId)
  return trx('Course as c')
    .join('OrganisationCourse as oc', function joinOwner() {
      this.on('oc.courseId', '=', 'c.id').andOnVal('oc.organisationId', '=', organisationId).andOnVal('oc.isOwner', '=', true)
    })
    .join('CourseVersion as cv', function joinDraft() {
      this.on('cv.courseId', '=', 'c.id').andOnNull('cv.publishedAt')
    })
    .whereNull('c.deletedAt')
}

/** The course with its draft, or undefined. `forUpdate` locks the draft row inside a transaction. */
export function findOwnCourse(id, organisationId, trx = db, { forUpdate = false } = {}) {
  const query = ownCoursesQuery(organisationId, trx)
    .where('c.id', id)
    .select('c.id', 'c.updatedAt', 'cv.id as versionId', 'cv.versionNumber', 'cv.name', 'cv.description')
    .first()
  return forUpdate ? query.forUpdate() : query
}

/**
 * Whether the course exists, belongs to the organisation and is not deleted, regardless of its
 * draft. Used when the locked draft was published meanwhile (specs/006 research R14).
 */
export async function ownCourseExists(id, organisationId, trx = db) {
  requireId(organisationId)
  const row = await trx('Course as c')
    .join('OrganisationCourse as oc', function joinOwner() {
      this.on('oc.courseId', '=', 'c.id').andOnVal('oc.organisationId', '=', organisationId).andOnVal('oc.isOwner', '=', true)
    })
    .where('c.id', id)
    .whereNull('c.deletedAt')
    .first('c.id')
  return Boolean(row)
}

/** Own courses for the list: newest change first, with the number of steps of each kind (research R6). */
export function listOwnCourses(organisationId) {
  return ownCoursesQuery(organisationId)
    .leftJoin('CourseStep as s', 's.courseVersionId', 'cv.id')
    .groupBy('c.id', 'c.updatedAt', 'cv.id', 'cv.name', 'cv.description')
    .orderBy([
      { column: 'c.updatedAt', order: 'desc' },
      { column: 'c.id', order: 'desc' },
    ])
    .select(
      'c.id',
      'c.updatedAt',
      'cv.id as versionId',
      'cv.name',
      'cv.description',
      db.raw("COUNT(CASE WHEN s.stepType = 'video' THEN 1 END) AS videoStepCount"),
      db.raw("COUNT(CASE WHEN s.stepType = 'question' THEN 1 END) AS questionStepCount"),
    )
}

/**
 * A new course: Course, its owner row and the draft (version 1), all at the database clock
 * (specs/004 research R1). The draft starts with a small example of branching (specs/005 FR-028,
 * research R3): a start question with two answers, each leading to its own video step.
 */
export async function insertCourse(trx, organisationId, { name, description }) {
  requireId(organisationId)
  const now = db.raw('UTC_TIMESTAMP()')
  const [courseId] = await trx('Course').insert({ isSharedInLibrary: false, createdAt: now, updatedAt: now })
  await trx('OrganisationCourse').insert({ organisationId, courseId, isOwner: true, addedAt: now })
  const [courseVersionId] = await trx('CourseVersion').insert({ courseId, versionNumber: 1, name, description, publishedAt: null })
  const video = async (positionX) => {
    const [id] = await trx('CourseStep').insert({ courseVersionId, stepType: 'video', isStart: false, videoId: null, positionX, positionY: 260 })
    return id
  }
  const [questionId] = await trx('CourseStep').insert({
    courseVersionId,
    stepType: 'question',
    isStart: true,
    questionText: 'Wat doe je?',
    feedback: null,
    positionX: 0,
    positionY: 0,
  })
  const [left, right] = [await video(-130), await video(130)]
  await trx('Answer').insert([
    { courseStepId: questionId, answerText: 'Ik grijp in', isCorrect: true, sortOrder: 0, nextCourseStepId: left },
    { courseStepId: questionId, answerText: 'Ik wacht af', isCorrect: false, sortOrder: 1, nextCourseStepId: right },
  ])
  return courseId
}

/**
 * Per course, its published version with the highest versionNumber (specs/006 data-model.md),
 * whether or not it is still live. Map courseId → { id, courseId, versionNumber, name,
 * description, publishedAt, unpublishedAt }.
 */
export async function latestPublishedVersions(courseIds, trx = db) {
  if (courseIds.length === 0) return new Map()
  const rows = await trx('CourseVersion as cv')
    .whereIn('cv.courseId', courseIds)
    .whereNotNull('cv.publishedAt')
    .whereRaw(
      'cv.versionNumber = (SELECT MAX(x.versionNumber) FROM CourseVersion x WHERE x.courseId = cv.courseId AND x.publishedAt IS NOT NULL)',
    )
    .select('cv.id', 'cv.courseId', 'cv.versionNumber', 'cv.name', 'cv.description', 'cv.publishedAt', 'cv.unpublishedAt')
  return new Map(rows.map((row) => [row.courseId, row]))
}

/**
 * The only definition of "live", the version the Quests of the organisation can download
 * (specs/006 research R1): the published version with the highest versionNumber, unless it was
 * unpublished, of a course that is not deleted. The Quest API of a later feature uses this too.
 * Map courseId → version row (as latestPublishedVersions).
 */
export async function liveVersions(courseIds, trx = db) {
  if (courseIds.length === 0) return new Map()
  const latest = await latestPublishedVersions(courseIds, trx)
  if (latest.size === 0) return new Map()
  const active = new Set(
    (await trx('Course').whereIn('id', [...latest.keys()]).whereNull('deletedAt').select('id')).map((row) => row.id),
  )
  const live = new Map()
  for (const [courseId, version] of latest) {
    if (version.unpublishedAt === null && active.has(courseId)) live.set(courseId, version)
  }
  return live
}

/** Steps and answers of several versions in two queries: Map versionId → { steps, answers }. */
export async function versionContents(versionIds, trx = db) {
  const contents = new Map(versionIds.map((id) => [id, { steps: [], answers: [] }]))
  if (versionIds.length === 0) return contents
  const steps = await trx('CourseStep')
    .whereIn('courseVersionId', versionIds)
    .orderBy('id')
    .select('id', 'courseVersionId', 'stepType', 'isStart', 'videoId', 'questionText', 'feedback', 'nextCourseStepId')
  const versionOfStep = new Map(steps.map((step) => [step.id, step.courseVersionId]))
  for (const step of steps) contents.get(step.courseVersionId).steps.push(step)
  if (steps.length > 0) {
    const answers = await trx('Answer')
      .whereIn('courseStepId', steps.map((step) => step.id))
      .select('id', 'courseStepId', 'answerText', 'isCorrect', 'sortOrder', 'nextCourseStepId')
    for (const answer of answers) contents.get(versionOfStep.get(answer.courseStepId)).answers.push(answer)
  }
  return contents
}

/** The ids of the videos used in a version. */
export async function versionVideoIds(versionId, trx = db) {
  const rows = await trx('CourseStep').where({ courseVersionId: versionId }).whereNotNull('videoId').distinct('videoId')
  return new Set(rows.map((row) => row.videoId))
}

/** Puts the draft in the past: it becomes a published version (specs/006 research R3). */
export function freezeDraft(trx, versionId) {
  return trx('CourseVersion').where({ id: versionId }).whereNull('publishedAt').update({ publishedAt: db.raw('UTC_TIMESTAMP()') })
}

/** Sets or clears unpublishedAt of a published version (specs/006 FR-016, FR-017). */
export function setUnpublishedAt(trx, versionId, unpublished) {
  return trx('CourseVersion')
    .where({ id: versionId })
    .whereNotNull('publishedAt')
    .update({ unpublishedAt: unpublished ? db.raw('UTC_TIMESTAMP()') : null })
}

/**
 * A new draft as a copy of version `fromVersionId` (specs/006 research R3): the version row, the
 * steps in id order, their answers, and the connections through a map old id → new id, so they
 * point inside the new draft. Videos are copied as a reference. Returns the new version id.
 */
export async function copyVersionAsDraft(trx, fromVersionId, courseId, versionNumber) {
  const from = await trx('CourseVersion').where({ id: fromVersionId }).first('name', 'description')
  const [versionId] = await trx('CourseVersion').insert({
    courseId,
    versionNumber,
    name: from.name,
    description: from.description,
    publishedAt: null,
    unpublishedAt: null,
  })
  const steps = await trx('CourseStep').where({ courseVersionId: fromVersionId }).orderBy('id')
  const newId = new Map()
  for (const step of steps) {
    const [id] = await trx('CourseStep').insert({
      courseVersionId: versionId,
      isStart: step.isStart,
      stepType: step.stepType,
      description: step.description,
      feedback: step.feedback,
      videoId: step.videoId,
      questionText: step.questionText,
      nextCourseStepId: null,
      positionX: step.positionX,
      positionY: step.positionY,
    })
    newId.set(step.id, id)
  }
  for (const step of steps) {
    if (step.nextCourseStepId !== null) {
      await trx('CourseStep').where({ id: newId.get(step.id) }).update({ nextCourseStepId: newId.get(step.nextCourseStepId) })
    }
  }
  if (steps.length > 0) {
    const answers = await trx('Answer').whereIn('courseStepId', steps.map((step) => step.id)).orderBy('id')
    for (const answer of answers) {
      await trx('Answer').insert({
        courseStepId: newId.get(answer.courseStepId),
        answerText: answer.answerText,
        isCorrect: answer.isCorrect,
        sortOrder: answer.sortOrder,
        nextCourseStepId: answer.nextCourseStepId === null ? null : newId.get(answer.nextCourseStepId),
      })
    }
  }
  return versionId
}

export function listSteps(versionId, trx = db) {
  return trx('CourseStep')
    .where({ courseVersionId: versionId })
    .orderBy('id')
    .select('id', 'stepType', 'isStart', 'videoId', 'questionText', 'feedback', 'positionX', 'positionY', 'nextCourseStepId')
}

export function listAnswers(stepIds, trx = db) {
  if (stepIds.length === 0) return []
  return trx('Answer')
    .whereIn('courseStepId', stepIds)
    .orderBy(['courseStepId', 'sortOrder'])
    .select('id', 'courseStepId', 'answerText', 'isCorrect', 'sortOrder', 'nextCourseStepId')
}

/** Of `videoIds`, the ones in the organisation's library (the unchanged rule of specs/003 R1). */
export async function libraryVideoIds(organisationId, videoIds, trx = db) {
  if (videoIds.length === 0) return new Set()
  const rows = await visibleVideosQuery(organisationId, trx).clearSelect().whereIn('v.id', videoIds).select('v.id')
  return new Set(rows.map((row) => row.id))
}

/**
 * The videos of the video steps of a draft, by step id. No filter on Video.deletedAt or on
 * visibility: a video used in an own course keeps showing there (specs/004 FR-016, research R5a).
 * Only the fields the course may show are read.
 */
export async function stepVideos(versionId, trx = db) {
  const rows = await trx('CourseStep as s')
    .join('Video as v', 'v.id', 's.videoId')
    .where('s.courseVersionId', versionId)
    .select('s.id as stepId', 'v.id', 'v.name', 'v.durationSeconds', 'v.thumbnailStorageKey')
  return new Map(rows.map((row) => [row.stepId, row]))
}

/**
 * The thumbnail of the video in a video step of an own course's draft, or undefined. This is the
 * only place where a video outside the organisation's library is shown; the library rule itself
 * is not widened (specs/004 FR-016a, research R5a).
 */
export async function findStepVideoThumbnailKey(courseId, stepId, videoId, organisationId) {
  const row = await ownCoursesQuery(organisationId)
    .join('CourseStep as s', 's.courseVersionId', 'cv.id')
    .join('Video as v', 'v.id', 's.videoId')
    .where({ 'c.id': courseId, 's.id': stepId, 's.stepType': 'video', 's.videoId': videoId })
    .first('v.thumbnailStorageKey')
  return row?.thumbnailStorageKey ?? undefined
}

/**
 * Soft delete of an own course (constitution V, research R7): only Course gets deletedAt; the
 * version, steps, answers and owner row stay. Returns the number of courses changed (0 = unknown,
 * deleted or someone else's).
 */
export async function softDeleteOwnCourse(id, organisationId) {
  const course = await ownCoursesQuery(organisationId).where('c.id', id).first('c.id')
  if (!course) return 0
  return db('Course')
    .where({ id })
    .whereNull('deletedAt')
    .update({ deletedAt: db.raw('UTC_TIMESTAMP()'), updatedAt: db.raw('UTC_TIMESTAMP()') })
}

export function updateDraftFields(trx, versionId, { name, description }) {
  return trx('CourseVersion').where({ id: versionId }).update({ name, description })
}

export function touchCourse(trx, courseId) {
  return trx('Course').where({ id: courseId }).update({ updatedAt: db.raw('UTC_TIMESTAMP()') })
}

/** Removes steps and their answers (steps have no deletedAt in the ERD, research R7). */
export async function deleteSteps(trx, stepIds) {
  if (stepIds.length === 0) return
  await trx('Answer').whereIn('courseStepId', stepIds).del()
  await trx('CourseStep').whereIn('id', stepIds).del()
}

export function deleteAnswers(trx, answerIds) {
  if (answerIds.length === 0) return
  return trx('Answer').whereIn('id', answerIds).del()
}

export async function insertStep(trx, versionId, row) {
  const [id] = await trx('CourseStep').insert({ ...row, courseVersionId: versionId })
  return id
}

export function updateStep(trx, id, row) {
  return trx('CourseStep').where({ id }).update(row)
}

export async function insertAnswer(trx, courseStepId, row) {
  const [id] = await trx('Answer').insert({ ...row, courseStepId })
  return id
}

export function updateAnswer(trx, id, row) {
  return trx('Answer').where({ id }).update(row)
}

export function setStepNext(trx, id, nextCourseStepId) {
  return trx('CourseStep').where({ id }).update({ nextCourseStepId })
}

export function setAnswerNext(trx, id, nextCourseStepId) {
  return trx('Answer').where({ id }).update({ nextCourseStepId })
}
