import { db } from '../../db/knex.js'

// Course references (specs/010 data-model.md, research R1, R3). A reference is an
// OrganisationCourse row with isOwner = false that points to one published version of the
// original course (courseVersionId). The organisation id is always passed explicitly and always
// comes from the session.

/**
 * The only definition of "the references of this organisation" (research R3): its
 * OrganisationCourse rows with isOwner = false. Deliberately not filtered on Course.deletedAt or a
 * deleted owner: the receiver keeps its chosen version (FR-011, FR-018). Every reference route and
 * questCatalog start from this query.
 */
export function referencesQuery(organisationId, trx = db) {
  if (!organisationId) throw new Error('organisationId is required')
  return trx('OrganisationCourse as r')
    .join('Course as c', 'c.id', 'r.courseId')
    .join('OrganisationCourse as owner', function joinOwner() {
      this.on('owner.courseId', '=', 'r.courseId').andOnVal('owner.isOwner', '=', true)
    })
    .join('Organisation as o', 'o.id', 'owner.organisationId')
    .where('r.organisationId', organisationId)
    .where('r.isOwner', false)
    .select(
      'r.courseId',
      'r.addedAt',
      'r.courseVersionId',
      'r.declinedCourseVersionId',
      'c.deletedAt as courseDeletedAt',
      'o.id as ownerId',
      'o.name as ownerName',
      'o.deletedAt as ownerDeletedAt',
    )
}

/** Whether the organisation has any row (owner or reference) for the course. */
export async function hasOrganisationCourse(trx, organisationId, courseId) {
  return Boolean(await trx('OrganisationCourse').where({ organisationId, courseId }).first('courseId'))
}

/** A new reference to `courseVersionId` (FR-003); addedAt at the database clock. */
export function insertReference(trx, organisationId, courseId, courseVersionId) {
  return trx('OrganisationCourse').insert({
    organisationId,
    courseId,
    isOwner: false,
    addedAt: db.raw('UTC_TIMESTAMP()'),
    courseVersionId,
    declinedCourseVersionId: null,
  })
}

/** "Nieuwe versie gebruiken" (FR-014): the chosen version changes, a declined version is forgotten. */
export function setChosenVersion(trx, organisationId, courseId, courseVersionId) {
  return trx('OrganisationCourse')
    .where({ organisationId, courseId, isOwner: false })
    .update({ courseVersionId, declinedCourseVersionId: null })
}

/** "Huidige versie houden" (FR-015): remembers the live version the receiver skipped. */
export function setDeclinedVersion(trx, organisationId, courseId, courseVersionId) {
  return trx('OrganisationCourse')
    .where({ organisationId, courseId, isOwner: false })
    .update({ declinedCourseVersionId: courseVersionId })
}

/** "Verwijderen uit mijn organisatie" (FR-009): only the reference row. Returns the number removed. */
export function deleteReference(organisationId, courseId) {
  if (!organisationId) throw new Error('organisationId is required')
  return db('OrganisationCourse').where({ organisationId, courseId, isOwner: false }).del()
}

/**
 * The only definition of "the receivers of a course" (FR-019): the organisations that are not
 * deleted with a reference to it. Map courseId → [{ id, name }] by name. Only for the owner.
 */
export async function receiversOf(courseIds, trx = db) {
  const result = new Map()
  if (courseIds.length === 0) return result
  const rows = await trx('OrganisationCourse as r')
    .join('Organisation as o', 'o.id', 'r.organisationId')
    .whereIn('r.courseId', courseIds)
    .where('r.isOwner', false)
    .whereNull('o.deletedAt')
    .orderBy(['o.name', 'o.id'])
    .select('r.courseId', 'o.id', 'o.name')
  for (const row of rows) {
    if (!result.has(row.courseId)) result.set(row.courseId, [])
    result.get(row.courseId).push({ id: row.id, name: row.name })
  }
  return result
}
