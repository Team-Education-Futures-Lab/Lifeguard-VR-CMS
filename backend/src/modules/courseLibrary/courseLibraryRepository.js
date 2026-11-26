import { db } from '../../db/knex.js'

// The central course library (specs/009 data-model.md, research R2). The organisation id is
// always passed explicitly and always comes from the session.

/**
 * The only definition of "courses in the course library of this organisation": original (no
 * parentCourseId), not deleted, owner not deleted, shared ('public', or 'selective' with a
 * CourseAccess row for the organisation), or shared by the organisation itself. Whether the
 * course has a live version is decided afterwards by courseRepository.liveVersions. The list, the
 * details and the thumbnail all start from this query.
 */
export function libraryCoursesQuery(organisationId, trx = db) {
  if (!organisationId) throw new Error('organisationId is required')
  return trx('Course as c')
    .join('OrganisationCourse as oc', function joinOwner() {
      this.on('oc.courseId', '=', 'c.id').andOnVal('oc.isOwner', '=', true)
    })
    .join('Organisation as o', 'o.id', 'oc.organisationId')
    .leftJoin('CourseAccess as a', function joinAccess() {
      this.on('a.courseId', '=', 'c.id').andOnVal('a.organisationId', '=', organisationId)
    })
    .whereNull('c.deletedAt')
    .whereNull('c.parentCourseId')
    .whereNull('o.deletedAt')
    .whereNot('c.visibility', 'private')
    .where((query) =>
      query
        .where('oc.organisationId', organisationId)
        .orWhere('c.visibility', 'public')
        .orWhere((selective) => selective.where('c.visibility', 'selective').whereNotNull('a.courseId')),
    )
    .select('c.id', 'c.visibility', 'o.id as ownerId', 'o.name as ownerName')
}
