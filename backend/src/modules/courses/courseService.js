import { db } from '../../db/knex.js'
import { courseIncomplete, courseNotLive, draftReplaced, notFound, sharedVideosWarning, validationError } from '../../lib/errors.js'
import { withDeadlockRetry } from '../../lib/deadlockRetry.js'
import { checkCourse } from '../../lib/courseCheck.js'
import { sameContent } from '../../lib/courseContent.js'
import { MESSAGES, validateCourseFields, validateDraft } from '../../lib/courseDraft.js'
import { sharedVideosWarning as videosToConfirm } from '../../lib/courseSharing.js'
import { parseOrganisationIds, validateAccessOrganisations, validateVisibility } from '../../lib/videoChoices.js'
import { receiversOf } from '../courseReferences/courseReferenceRepository.js'
import * as repo from './courseRepository.js'

// Courses and their draft (specs/004 contracts/api.md). Saving replaces the whole draft in one
// transaction (research R3): steps and answers with an id are updated, without an id inserted,
// and the ones missing from the request are deleted. The last save wins.

/**
 * The video of a video step: always name, duration and thumbnail, also when the video is no
 * longer in the library; `available` says whether it is (research R5a), `keptByLiveVersion`
 * whether the live version has it, so it may stay (specs/006 FR-012), `keptFromOriginal` whether
 * an own copy got it from its original (specs/011 FR-014). Nothing else of the video.
 */
function toStepVideo(courseId, stepId, row, library, liveVideoIds, grantedVideoIds) {
  return {
    id: row.id,
    name: row.name,
    durationSeconds: row.durationSeconds,
    thumbnailUrl: row.thumbnailStorageKey
      ? `/api/organisation/courses/${courseId}/steps/${stepId}/videos/${row.id}/thumbnail`
      : null,
    available: library.has(row.id),
    keptByLiveVersion: liveVideoIds.has(row.id),
    keptFromOriginal: grantedVideoIds.has(row.id),
  }
}

/**
 * The publication fields of courses (specs/006 contracts/api.md, research R4, R8): per course id
 * { status, publication, lastPublishedVersionNumber, liveVideoIds }. `courses` are rows with the
 * course `id`, the draft `versionId`, `name` and `description`.
 */
async function publicationInfo(courses, organisationId, trx = db) {
  const ids = courses.map((course) => course.id)
  const latest = await repo.latestPublishedVersions(ids, trx)
  const live = await repo.liveVersions(ids, trx)
  const contents = await repo.versionContents(
    [...courses.map((course) => course.versionId), ...[...live.values()].map((version) => version.id)],
    trx,
  )
  const liveVideos = new Map()
  for (const [courseId, version] of live) {
    liveVideos.set(courseId, new Set(contents.get(version.id).steps.filter((step) => step.videoId).map((step) => step.videoId)))
  }
  const library = await repo.libraryVideoIds(organisationId, [...new Set([...liveVideos.values()].flatMap((set) => [...set]))], trx)
  // Videos an own copy got from its original are not unavailable (specs/011 FR-014).
  const granted = await repo.grantedVideoIds(ids, trx)

  const info = new Map()
  for (const course of courses) {
    const version = live.get(course.id)
    const liveVideoIds = liveVideos.get(course.id) ?? new Set()
    const base = { lastPublishedVersionNumber: latest.get(course.id)?.versionNumber ?? null, liveVideoIds }
    if (!version) {
      info.set(course.id, { ...base, status: 'draft', publication: null })
      continue
    }
    const same = sameContent(
      { name: course.name, description: course.description, ...contents.get(course.versionId) },
      { name: version.name, description: version.description, ...contents.get(version.id) },
    )
    info.set(course.id, {
      ...base,
      status: same ? 'published' : 'published_changed',
      publication: {
        versionNumber: version.versionNumber,
        publishedAt: new Date(version.publishedAt).toISOString(),
        hasUnavailableVideo: [...liveVideoIds].some((id) => !library.has(id) && !granted.get(course.id)?.has(id)),
      },
    })
  }
  return info
}

/** The draft document of contracts/api.md (specs/004, 005 and 006). */
async function toDraftDocument(course, organisationId, trx) {
  const steps = await repo.listSteps(course.versionId, trx)
  const answers = await repo.listAnswers(steps.map((step) => step.id), trx)
  const videos = await repo.stepVideos(course.versionId, trx)
  const library = await repo.libraryVideoIds(organisationId, [...new Set([...videos.values()].map((row) => row.id))], trx)
  const info = (await publicationInfo([course], organisationId, trx)).get(course.id)
  const granted = (await repo.grantedVideoIds([course.id], trx)).get(course.id) ?? new Set()
  return {
    id: course.id,
    name: course.name,
    description: course.description,
    draftVersionNumber: course.versionNumber,
    status: info.status,
    publication: info.publication,
    lastPublishedVersionNumber: info.lastPublishedVersionNumber,
    availability: await repo.courseAvailability(course.id, trx),
    // Who took this course over (specs/010 FR-019); only the owner gets this document.
    receivers: (await receiversOf([course.id], trx)).get(course.id) ?? [],
    // "Gebaseerd op …" of an own copy (specs/011 FR-012); null for any other course.
    basedOn: (await repo.basedOnOf([course.id], trx)).get(course.id) ?? null,
    updatedAt: new Date(course.updatedAt).toISOString(),
    steps: steps.map((step) => {
      const base = {
        id: step.id,
        stepType: step.stepType,
        isStart: Boolean(step.isStart),
        positionX: step.positionX,
        positionY: step.positionY,
      }
      if (step.stepType === 'video') {
        const row = videos.get(step.id)
        return {
          ...base,
          videoId: step.videoId,
          video: row ? toStepVideo(course.id, step.id, row, library, info.liveVideoIds, granted) : null,
          nextStepId: step.nextCourseStepId ?? null,
        }
      }
      return {
        ...base,
        questionText: step.questionText ?? '',
        feedback: step.feedback,
        answers: answers
          .filter((answer) => answer.courseStepId === step.id)
          .map((answer) => ({
            id: answer.id,
            answerText: answer.answerText,
            isCorrect: Boolean(answer.isCorrect),
            nextStepId: answer.nextCourseStepId ?? null,
          })),
      }
    }),
  }
}

/** The course list of contracts/api.md, with the publication status of every course (specs/006 FR-019). */
export async function listCourses(organisationId) {
  const rows = await repo.listOwnCourses(organisationId)
  const info = await publicationInfo(rows, organisationId)
  const receivers = await receiversOf(rows.map((row) => row.id))
  const basedOn = await repo.basedOnOf(rows.map((row) => row.id))
  return rows.map((row) => {
    const { status, publication, lastPublishedVersionNumber } = info.get(row.id)
    return {
      id: row.id,
      name: row.name,
      updatedAt: new Date(row.updatedAt).toISOString(),
      videoStepCount: Number(row.videoStepCount),
      questionStepCount: Number(row.questionStepCount),
      status,
      publication,
      lastPublishedVersionNumber,
      visibility: row.visibility,
      receiverCount: receivers.get(row.id)?.length ?? 0,
      basedOn: basedOn.get(row.id) ?? null,
    }
  })
}

/** A new, empty draft for the organisation in the session (FR-001, FR-002). */
export async function createCourse(organisationId, body) {
  const fields = validateCourseFields(body)
  return withDeadlockRetry(() =>
    db.transaction(async (trx) => {
      const id = await repo.insertCourse(trx, organisationId, fields)
      return getDraft(id, organisationId, trx)
    }),
  )
}

export async function getDraft(courseId, organisationId, trx = db) {
  const course = await repo.findOwnCourse(courseId, organisationId, trx)
  if (!course) throw notFound()
  return toDraftDocument(course, organisationId, trx)
}

/**
 * A video may be put in a step when it is in the organisation's library. The one exception is the
 * video a saved step already has: it stays, also when it is no longer available (FR-014, FR-016,
 * research R5). So an unavailable video can never reach a new or another step.
 */
async function checkVideos(steps, storedSteps, organisationId, trx) {
  const storedVideo = new Map(storedSteps.map((step) => [step.id, step.videoId]))
  const wanted = steps.filter((step) => step.stepType === 'video' && step.videoId !== null)
  const library = await repo.libraryVideoIds(organisationId, [...new Set(wanted.map((step) => step.videoId))], trx)
  const fields = {}
  steps.forEach((step, i) => {
    if (step.stepType !== 'video' || step.videoId === null || library.has(step.videoId)) return
    if (step.id !== undefined && storedVideo.get(step.id) === step.videoId) return
    fields[`steps.${i}.videoId`] = MESSAGES.video
  })
  if (Object.keys(fields).length > 0) throw validationError(fields)
}

/**
 * The thumbnail of the video in a step of an own course (FR-016a), only while the step still has
 * that video; 404 for anything else.
 */
export async function getStepVideoThumbnailKey(courseId, stepId, videoId, organisationId) {
  const key = await repo.findStepVideoThumbnailKey(courseId, stepId, videoId, organisationId)
  if (!key) throw notFound()
  return key
}

/** Soft deletes an own course (FR-006); 404 when it is not visible to the organisation. */
export async function deleteCourse(courseId, organisationId) {
  if ((await repo.softDeleteOwnCourse(courseId, organisationId)) === 0) throw notFound()
}

/**
 * Checks that every id in the request belongs to this draft and that no step changes its kind.
 * Returns the stored steps and answers by id, for the update below.
 */
function checkIds(steps, storedSteps, storedAnswers) {
  const fields = {}
  const stepById = new Map(storedSteps.map((step) => [step.id, step]))
  steps.forEach((step, i) => {
    if (step.id === undefined) return
    const stored = stepById.get(step.id)
    if (!stored) {
      fields[`steps.${i}.id`] = MESSAGES.stepId
      return
    }
    if (stored.stepType !== step.stepType) {
      fields[`steps.${i}.stepType`] = MESSAGES.kindChanged
      return
    }
    for (const [j, answer] of (step.answers ?? []).entries()) {
      if (answer.id === undefined) continue
      const owner = storedAnswers.find((row) => row.id === answer.id)?.courseStepId
      if (owner !== step.id) fields[`steps.${i}.answers.${j}.id`] = MESSAGES.answerId
    }
  })
  if (Object.keys(fields).length > 0) throw validationError(fields)
}

// Connections are written afterwards, once every step has an id (specs/005 research R1).
const stepRow = (step) =>
  step.stepType === 'video'
    ? { stepType: 'video', isStart: step.isStart, positionX: step.positionX, positionY: step.positionY, videoId: step.videoId, questionText: null, feedback: null, nextCourseStepId: null }
    : { stepType: 'question', isStart: step.isStart, positionX: step.positionX, positionY: step.positionY, videoId: null, questionText: step.questionText, feedback: step.feedback, nextCourseStepId: null }

/** Saves the answers of a question step; returns their ids in request order. */
async function saveAnswers(trx, stepId, answers, storedAnswers) {
  const keep = new Set(answers.filter((answer) => answer.id !== undefined).map((answer) => answer.id))
  await repo.deleteAnswers(
    trx,
    storedAnswers.filter((row) => row.courseStepId === stepId && !keep.has(row.id)).map((row) => row.id),
  )
  const ids = []
  for (const [sortOrder, answer] of answers.entries()) {
    const row = { answerText: answer.answerText, isCorrect: answer.isCorrect, sortOrder, nextCourseStepId: null }
    if (answer.id === undefined) ids.push(await repo.insertAnswer(trx, stepId, row))
    else {
      await repo.updateAnswer(trx, answer.id, row)
      ids.push(answer.id)
    }
  }
  return ids
}

/** Points steps and answers to their next step, now that every key has an id (research R1). */
async function saveConnections(trx, steps, stepIds, answerIds) {
  const idByKey = new Map(steps.map((step, i) => [step.key, stepIds[i]]))
  for (const [i, step] of steps.entries()) {
    if (step.stepType === 'video' && step.nextStepKey !== null) {
      await repo.setStepNext(trx, stepIds[i], idByKey.get(step.nextStepKey))
    }
    for (const [j, answer] of (step.answers ?? []).entries()) {
      if (answer.nextStepKey !== null) await repo.setAnswerNext(trx, answerIds[i][j], idByKey.get(answer.nextStepKey))
    }
  }
}

/**
 * "Opslaan als concept": all or nothing (FR-009). Returns the saved draft document. Saves of
 * different courses can deadlock on the foreign-key index of CourseStep.nextCourseStepId; the whole
 * transaction is then run again (lib/deadlockRetry.js).
 */
export async function saveDraft(courseId, organisationId, body) {
  const draft = validateDraft(body)
  await withDeadlockRetry(() => saveDraftTransaction(courseId, organisationId, draft))
  // The document is read after the commit: the transaction stays short, so saves of different
  // courses overlap less (lib/deadlockRetry.js). The last save wins, as before.
  return getDraft(courseId, organisationId)
}

/**
 * Locks the draft of an own course for the rest of the transaction. Locking the draft row makes
 * saves and publications of the same course run one after the other. Returns the course with its
 * draft; `null` when the course is there but the locked draft was published meanwhile (specs/006
 * research R14); throws not found for an unknown, deleted or someone else's course.
 */
async function lockDraft(courseId, organisationId, trx) {
  const course = await repo.findOwnCourse(courseId, organisationId, trx, { forUpdate: true })
  if (course) return course
  if (!(await repo.ownCourseExists(courseId, organisationId, trx))) throw notFound()
  return null
}

/** As lockDraft, but takes the new draft when the old one was published meanwhile. */
async function lockCurrentDraft(courseId, organisationId, trx) {
  const course = (await lockDraft(courseId, organisationId, trx)) ?? (await lockDraft(courseId, organisationId, trx))
  if (!course) throw notFound()
  return course
}

function saveDraftTransaction(courseId, organisationId, draft) {
  return db.transaction(async (trx) => {
    const course = await lockDraft(courseId, organisationId, trx)
    // The editor works on a draft that was published since: its ids now belong to the published
    // version, which never changes (specs/006 FR-004, research R14).
    if (!course || course.versionNumber !== draft.draftVersionNumber) throw draftReplaced()
    const storedSteps = await repo.listSteps(course.versionId, trx)
    const storedAnswers = await repo.listAnswers(storedSteps.map((step) => step.id), trx)
    checkIds(draft.steps, storedSteps, storedAnswers)
    await checkVideos(draft.steps, storedSteps, organisationId, trx)

    const keep = new Set(draft.steps.filter((step) => step.id !== undefined).map((step) => step.id))
    await repo.deleteSteps(trx, storedSteps.filter((step) => !keep.has(step.id)).map((step) => step.id))
    const stepIds = []
    const answerIds = []
    for (const step of draft.steps) {
      let stepId = step.id
      if (stepId === undefined) stepId = await repo.insertStep(trx, course.versionId, stepRow(step))
      else await repo.updateStep(trx, stepId, stepRow(step))
      stepIds.push(stepId)
      answerIds.push(step.stepType === 'question' ? await saveAnswers(trx, stepId, step.answers, storedAnswers) : [])
    }
    await saveConnections(trx, draft.steps, stepIds, answerIds)

    await repo.updateDraftFields(trx, course.versionId, draft)
    await repo.touchCourse(trx, course.id)
  })
}

/** The content of a version for sameContent (research R4). */
async function contentOf(version, trx) {
  const contents = await repo.versionContents([version.id], trx)
  return { name: version.name, description: version.description, ...contents.get(version.id) }
}

/**
 * Publishes the saved draft (specs/006 FR-001 – FR-010, FR-012, FR-017, research R3), all or
 * nothing. The server checks the course itself; an incomplete course gives 422 with the messages
 * and nothing changes. Then, against the latest published version:
 * - same content and live: nothing to do (a second click, research R9);
 * - same content but unpublished: that version goes live again, with its number and date;
 * - otherwise the draft itself becomes the published version and a copy is the new draft.
 * Returns the (new) draft document.
 */
export async function publishCourse(courseId, organisationId, body = {}) {
  const choices = parseSharingChoices(body, { required: false })
  return withDeadlockRetry(() =>
    db.transaction(async (trx) => {
      const course = await lockCurrentDraft(courseId, organisationId, trx)
      const chosen = await resolveAvailability(choices, course, organisationId, trx)
      const doc = await toDraftDocument(course, organisationId, trx)
      const videoSteps = doc.steps.filter((step) => step.video)
      const issues = checkCourse(doc, {
        libraryVideoIds: new Set(videoSteps.filter((step) => step.video.available).map((step) => step.videoId)),
        liveVideoIds: new Set(videoSteps.filter((step) => step.video.keptByLiveVersion).map((step) => step.videoId)),
        grantedVideoIds: new Set(videoSteps.filter((step) => step.video.keptFromOriginal).map((step) => step.videoId)),
      })
      if (issues.length > 0) throw courseIncomplete(issues)

      const latest = (await repo.latestPublishedVersions([course.id], trx)).get(course.id)
      const live = (await repo.liveVersions([course.id], trx)).get(course.id)
      const draft = { id: course.versionId, name: course.name, description: course.description }
      const same = latest && sameContent(await contentOf(draft, trx), await contentOf(latest, trx))

      // The content that goes live: the draft, or the last published version when it is the same
      // (specs/006 FR-017). Sharing it may need the owner's confirmation (specs/009 FR-009).
      await checkSharingWarning(trx, {
        ownerId: organisationId,
        before: { live: Boolean(live), ...chosen.current },
        after: { live: true, ...chosen.next },
        contentVersionId: same ? latest.id : course.versionId,
        previousVersionId: live?.id ?? null,
        acknowledgedVideoIds: choices.acknowledgedVideoIds,
      })

      // Content and availability are saved together, or not at all (specs/009 FR-002, research R8).
      await repo.setCourseAvailability(trx, course.id, chosen.next)
      if (same) {
        if (latest.unpublishedAt === null) return getDraft(course.id, organisationId, trx)
        await repo.setUnpublishedAt(trx, latest.id, false)
      } else {
        await repo.freezeDraft(trx, course.versionId)
        await repo.copyVersionAsDraft(trx, course.versionId, course.id, course.versionNumber + 1)
      }
      await repo.touchCourse(trx, course.id)
      return getDraft(course.id, organisationId, trx)
    }),
  )
}

/**
 * Takes the live version off the Quests (specs/006 FR-015, FR-016): it gets unpublishedAt. The
 * draft and every published version stay. Without a live version nothing changes. Returns the
 * draft document.
 */
export function unpublishCourse(courseId, organisationId) {
  return withDeadlockRetry(() =>
    db.transaction(async (trx) => {
      const course = await lockCurrentDraft(courseId, organisationId, trx)
      const live = (await repo.liveVersions([course.id], trx)).get(course.id)
      if (live) {
        await repo.setUnpublishedAt(trx, live.id, true)
        await repo.touchCourse(trx, course.id)
      }
      return getDraft(course.id, organisationId, trx)
    }),
  )
}

/**
 * The sharing fields of a request (specs/009 contracts/api.md): `visibility`,
 * `accessOrganisationIds` (only for 'selective') and `acknowledgedVideoIds`. Checks the form of
 * the values; whether the organisations exist is checked in resolveAvailability. Without
 * `visibility` (only allowed when not `required`) the current availability stays.
 */
function parseSharingChoices(body, { required }) {
  const fields = {}
  const result = { visibility: undefined, accessOrganisationIds: [], acknowledgedVideoIds: [] }
  if (body.visibility !== undefined || required) {
    try {
      result.visibility = validateVisibility(body.visibility)
    } catch (err) {
      Object.assign(fields, err.fields)
    }
  }
  if (result.visibility === 'selective') {
    try {
      result.accessOrganisationIds = parseOrganisationIds(body.accessOrganisationIds)
    } catch (err) {
      Object.assign(fields, err.fields)
    }
  }
  try {
    result.acknowledgedVideoIds = parseOrganisationIds(body.acknowledgedVideoIds)
  } catch {
    fields.acknowledgedVideoIds = 'Laad de pagina opnieuw en probeer het nog eens.'
  }
  if (Object.keys(fields).length > 0) throw validationError(fields)
  return result
}

/**
 * The current and the new availability of a course, as { visibility, accessOrganisationIds }.
 * The chosen organisations must be active and not the owner (specs/009 FR-003). An own copy of a
 * taken-over course (parentCourseId) is never shared: anything but 'private' is refused before
 * anything changes (specs/011 FR-013, research R5).
 */
async function resolveAvailability(choices, course, organisationId, trx) {
  if (course.parentCourseId && choices.visibility !== undefined && choices.visibility !== 'private') {
    throw validationError({ visibility: 'Een aangepaste cursus kan niet gedeeld worden.' })
  }
  const stored = await repo.courseAvailability(course.id, trx)
  const current = { visibility: stored.visibility, accessOrganisationIds: stored.accessOrganisations.map((o) => o.id) }
  if (choices.visibility === undefined) return { current, next: current }
  if (choices.visibility !== 'selective') return { current, next: { visibility: choices.visibility, accessOrganisationIds: [] } }
  const ids = await validateAccessOrganisations(choices.accessOrganisationIds, organisationId, trx)
  return { current, next: { visibility: 'selective', accessOrganisationIds: ids } }
}

/**
 * Refuses with 409 shared_videos_warning when sharing needs a confirmation that the request does
 * not hold for every video (specs/009 FR-009 – FR-012, research R3). Nothing has changed yet.
 */
async function checkSharingWarning(trx, { ownerId, before, after, contentVersionId, previousVersionId, acknowledgedVideoIds }) {
  if (!after.live || after.visibility === 'private') return
  const videos = videosToConfirm({
    before,
    after,
    contentVideos: await repo.contentVideoRows(contentVersionId, trx),
    previousVideoIds: previousVersionId ? [...(await repo.versionVideoIds(previousVersionId, trx))] : [],
    allOrganisationIds: await repo.activeOrganisationIds(ownerId, trx),
  })
  const confirmed = new Set(acknowledgedVideoIds)
  if (videos.some((video) => !confirmed.has(video.id))) throw sharedVideosWarning(videos)
}

/**
 * "Beschikbaarheid wijzigen" (specs/009 FR-006, research R9): who sees a live course in the course
 * library, without publishing again. Versions, status and Course.updatedAt stay. Returns the draft
 * document.
 */
export async function changeAvailability(courseId, organisationId, body = {}) {
  const choices = parseSharingChoices(body, { required: true })
  return withDeadlockRetry(() =>
    db.transaction(async (trx) => {
      const course = await lockCurrentDraft(courseId, organisationId, trx)
      const chosen = await resolveAvailability(choices, course, organisationId, trx)
      const live = (await repo.liveVersions([course.id], trx)).get(course.id)
      if (!live) throw courseNotLive()
      await checkSharingWarning(trx, {
        ownerId: organisationId,
        before: { live: true, ...chosen.current },
        after: { live: true, ...chosen.next },
        contentVersionId: live.id,
        previousVersionId: live.id,
        acknowledgedVideoIds: choices.acknowledgedVideoIds,
      })
      await repo.setCourseAvailability(trx, course.id, chosen.next)
      return getDraft(course.id, organisationId, trx)
    }),
  )
}
