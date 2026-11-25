import { db } from '../../db/knex.js'
import { liveVersions } from '../courses/courseRepository.js'

/**
 * The only definition of "which courses does this Quest see" (specs/007 FR-006, research R3).
 * The course list, the download and the video access check all start from this function.
 *
 * In this feature: the courses the organisation owns (OrganisationCourse.isOwner = true) that
 * have a live version (specs/006: published, not unpublished, course not deleted).
 *
 * For courses taken over from the course library (FR-12, FR-008) only this function changes:
 * allow OrganisationCourse rows with isOwner = false and let such a course point to the live
 * version of the original course (Course.parentCourseId). Callers stay the same.
 *
 * Returns Map courseId → live version row (see courseRepository.latestPublishedVersions).
 */
export async function questLiveVersions(organisationId, trx = db) {
  if (!organisationId) throw new Error('organisationId is required')
  const rows = await trx('OrganisationCourse').where({ organisationId, isOwner: true }).select('courseId')
  if (rows.length === 0) return new Map()
  return liveVersions(
    rows.map((row) => row.courseId),
    trx,
  )
}
