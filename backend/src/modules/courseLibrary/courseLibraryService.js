import { db } from '../../db/knex.js'
import { notFound } from '../../lib/errors.js'
import * as courses from '../courses/courseRepository.js'
import { receiversOf } from '../courseReferences/courseReferenceRepository.js'
import { thumbnailVideoId } from '../quest/questThumbnail.js'
import { libraryCoursesQuery } from './courseLibraryRepository.js'

// The course library (specs/009 contracts/api.md, research R6, R7). Everything another
// organisation sees comes from the live version, and is only a summary: never steps, answers,
// video ids, the draft or older versions (FR-016, FR-018).

/**
 * The courses of the library with everything the list shows, in a fixed number of queries,
 * whatever the number of courses (SC-006). `onlyId` narrows it to one course.
 */
async function loadLibrary(organisationId, onlyId = null, trx = db) {
  const query = libraryCoursesQuery(organisationId, trx)
  if (onlyId !== null) query.where('c.id', onlyId)
  const rows = await query
  const live = await courses.liveVersions(rows.map((row) => row.id), trx)
  const shown = rows.filter((row) => live.has(row.id))
  if (shown.length === 0) return []

  const contents = await courses.versionContents(shown.map((row) => live.get(row.id).id), trx)
  const imageVideo = new Map()
  const allVideoIds = new Set()
  for (const row of shown) {
    for (const step of contents.get(live.get(row.id).id).steps) if (step.videoId) allVideoIds.add(step.videoId)
  }
  const files = await courses.videoFiles([...allVideoIds], trx)
  for (const row of shown) {
    const { steps, answers } = contents.get(live.get(row.id).id)
    imageVideo.set(row.id, thumbnailVideoId(steps, answers, files))
  }
  // The course image may come from a restricted video: only show it when the viewer sees that
  // video in its own video library, or owns the course (research R6).
  const visibleImages = await courses.libraryVideoIds(organisationId, [...new Set([...imageVideo.values()].filter(Boolean))], trx)
  // Only the owner sees with whom an own course is shared (FR-004).
  const ownIds = shown.filter((row) => row.ownerId === organisationId).map((row) => row.id)
  const accessByCourse = await courses.accessOrganisationsOf(
    shown.filter((row) => row.ownerId === organisationId && row.visibility === 'selective').map((row) => row.id),
    trx,
  )
  // Only the owner sees who took a course over (specs/010 FR-019); others see whether they did.
  const receiversByCourse = await receiversOf(ownIds, trx)
  const takenOver = new Set(
    (
      await trx('OrganisationCourse')
        .where({ organisationId, isOwner: false })
        .whereIn('courseId', shown.map((row) => row.id))
        .select('courseId')
    ).map((row) => row.courseId),
  )

  const result = []
  for (const row of shown) {
    const version = live.get(row.id)
    const { steps } = contents.get(version.id)
    const isOwn = row.ownerId === organisationId
    const videoId = imageVideo.get(row.id)
    const imageKey = videoId && (isOwn || visibleImages.has(videoId)) ? files.get(videoId)?.thumbnailStorageKey : null
    const course = {
      id: row.id,
      name: version.name,
      description: version.description ?? null,
      owner: { id: row.ownerId, name: row.ownerName, isOwn },
      versionNumber: version.versionNumber,
      publishedAt: new Date(version.publishedAt).toISOString(),
      stepCount: steps.length,
      videoCount: new Set(steps.filter((step) => step.videoId).map((step) => step.videoId)).size,
      thumbnailUrl: imageKey ? `/api/organisation/course-library/${row.id}/thumbnail` : null,
    }
    if (isOwn) {
      course.visibility = row.visibility
      course.accessOrganisations = accessByCourse.get(row.id) ?? []
      course.receivers = receiversByCourse.get(row.id) ?? []
    } else {
      course.takenOver = takenOver.has(row.id)
    }
    result.push({ course, imageKey })
  }
  result.sort((a, b) => Date.parse(b.course.publishedAt) - Date.parse(a.course.publishedAt) || b.course.id - a.course.id)
  return result
}

/** The course library of the organisation in the session, newest publication first. */
export async function listLibraryCourses(organisationId) {
  return (await loadLibrary(organisationId)).map((entry) => entry.course)
}

/** One course of the library; anything else is "not found" (FR-021). */
export async function getLibraryCourse(id, organisationId) {
  const [entry] = await loadLibrary(organisationId, id)
  if (!entry) throw notFound()
  return entry.course
}

/** The stored course image, with the same rule as thumbnailUrl; otherwise "not found". */
export async function getLibraryThumbnailKey(id, organisationId) {
  const [entry] = await loadLibrary(organisationId, id)
  if (!entry?.imageKey) throw notFound()
  return entry.imageKey
}
