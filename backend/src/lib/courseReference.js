// The state of a course reference (specs/010 research R4, data-model.md § Toestand). The only place
// that decides about the notice, a newer version to choose and why no new versions come anymore.
// Pure: every input is passed in, nothing is read from the database.

/**
 * `chosen`: the chosen version row ({ id, versionNumber, publishedAt }); `live`: the live version
 * row of the owner or null; `declinedVersionId`: the live version the receiver chose to keep its
 * current version for, or null; `courseDeleted`, `ownerDeleted`: soft deleted; `hasAccess`: the
 * course is in the receiver's course library (specs/009 FR-014).
 *
 * Returns { withdrawn, newVersion, notice }:
 * - withdrawn: null | 'owner_deleted' | 'course_deleted' | 'unpublished' | 'no_access', in that order;
 * - newVersion: { id, versionNumber, publishedAt } when a newer live version can be chosen, else null;
 * - notice: whether the receiver gets the notice (FR-012), false for a version it chose to skip.
 */
export function referenceState({ chosen, live, declinedVersionId, courseDeleted, ownerDeleted, hasAccess }) {
  let withdrawn = null
  if (ownerDeleted) withdrawn = 'owner_deleted'
  else if (courseDeleted) withdrawn = 'course_deleted'
  else if (!live) withdrawn = 'unpublished'
  else if (!hasAccess) withdrawn = 'no_access'

  if (withdrawn !== null || live.versionNumber <= chosen.versionNumber) {
    return { withdrawn, newVersion: null, notice: false }
  }
  const newVersion = { id: live.id, versionNumber: live.versionNumber, publishedAt: live.publishedAt }
  return { withdrawn: null, newVersion, notice: live.id !== declinedVersionId }
}
