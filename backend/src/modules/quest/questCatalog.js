import { db } from '../../db/knex.js'
import { liveVersions, versionsByIds } from '../courses/courseRepository.js'
import { referencesQuery } from '../courseReferences/courseReferenceRepository.js'

/**
 * The only definition of "which courses does this Quest see" (specs/007 FR-006, research R3).
 * The course list, the download and the video access check all start from this function.
 *
 * - The courses the organisation owns (OrganisationCourse.isOwner = true) that have a live
 *   version (specs/006: published, not unpublished, course not deleted). An own copy of a
 *   taken-over course (specs/011, parentCourseId) is one of them; its reference is gone.
 * - Plus every course it took over from the course library (specs/010, FR-12 part 2): the chosen
 *   version of its reference (OrganisationCourse.isOwner = false, courseVersionId). Deliberately
 *   not filtered on the course being deleted, unpublished or restricted, or on its owner: the
 *   receiver keeps its chosen version until it removes it or chooses another (FR-011).
 *
 * Sharing alone does not put a course on the Quests of other organisations (specs/009 FR-026).
 * An organisation is never owner and receiver of the same course, so the keys never clash.
 *
 * Returns Map courseId → version row (see courseRepository.latestPublishedVersions).
 */
export async function questLiveVersions(organisationId, trx = db) {
  if (!organisationId) throw new Error('organisationId is required')
  const owned = await trx('OrganisationCourse').where({ organisationId, isOwner: true }).select('courseId')
  const result = owned.length > 0 ? await liveVersions(owned.map((row) => row.courseId), trx) : new Map()

  const references = await referencesQuery(organisationId, trx)
  if (references.length > 0) {
    const chosen = await versionsByIds(references.map((row) => row.courseVersionId), trx)
    for (const row of references) {
      const version = chosen.get(row.courseVersionId)
      if (version) result.set(row.courseId, version)
    }
  }
  return result
}
