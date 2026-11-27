import { db } from '../../db/knex.js'
import { withDeadlockRetry } from '../../lib/deadlockRetry.js'
import { courseAlreadyAdded, noNewerVersion, notFound, validationError } from '../../lib/errors.js'
import { referenceState } from '../../lib/courseReference.js'
import * as courses from '../courses/courseRepository.js'
import { libraryCoursesQuery } from '../courseLibrary/courseLibraryRepository.js'
import { thumbnailVideoId } from '../quest/questThumbnail.js'
import * as repo from './courseReferenceRepository.js'

// Courses taken over from the course library (specs/010 contracts/api.md). A receiver only ever
// sees a summary of its chosen version, plus number and date of a newer live version: never steps,
// answers, video ids, the draft or other versions (FR-007).

const toIso = (value) => new Date(value).toISOString()
const byName = (a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }) || a.courseId - b.courseId

/**
 * The reference objects of contracts/api.md § Gedeeld, in a fixed number of queries whatever the
 * number of references (research R10). Returns [{ reference, imageKey }]. `onlyCourseId` narrows
 * it to one course.
 */
async function loadReferences(organisationId, onlyCourseId = null, trx = db) {
  const query = repo.referencesQuery(organisationId, trx)
  if (onlyCourseId !== null) query.where('r.courseId', onlyCourseId)
  const rows = await query
  if (rows.length === 0) return []

  const courseIds = rows.map((row) => row.courseId)
  const chosen = await courses.versionsByIds(rows.map((row) => row.courseVersionId), trx)
  const live = await courses.liveVersions(courseIds, trx)
  // Access to new versions follows the course library (specs/009 FR-014, research R5).
  const inLibrary = new Set((await libraryCoursesQuery(organisationId, trx).whereIn('c.id', courseIds)).map((row) => row.id))

  const contents = await courses.versionContents([...chosen.keys()], trx)
  const videoIds = new Set()
  for (const { steps } of contents.values()) for (const step of steps) if (step.videoId) videoIds.add(step.videoId)
  const files = await courses.videoFiles([...videoIds], trx)

  const result = []
  for (const row of rows) {
    const version = chosen.get(row.courseVersionId)
    if (!version) continue // never happens: a reference always points to a published version
    const { steps, answers } = contents.get(version.id)
    const state = referenceState({
      chosen: version,
      live: live.get(row.courseId) ?? null,
      declinedVersionId: row.declinedCourseVersionId,
      courseDeleted: row.courseDeletedAt !== null,
      ownerDeleted: row.ownerDeletedAt !== null,
      hasAccess: inLibrary.has(row.courseId),
    })
    // The course image of the chosen version, also from a restricted video (research R11).
    const imageVideoId = thumbnailVideoId(steps, answers, files)
    const imageKey = imageVideoId ? (files.get(imageVideoId)?.thumbnailStorageKey ?? null) : null
    result.push({
      reference: {
        courseId: row.courseId,
        name: version.name,
        description: version.description ?? null,
        owner: { id: row.ownerId, name: row.ownerName },
        addedAt: toIso(row.addedAt),
        version: {
          versionNumber: version.versionNumber,
          publishedAt: toIso(version.publishedAt),
          stepCount: steps.length,
          videoCount: new Set(steps.filter((step) => step.videoId).map((step) => step.videoId)).size,
        },
        thumbnailUrl: imageKey ? `/api/organisation/course-references/${row.courseId}/thumbnail?v=${version.versionNumber}` : null,
        newVersion: state.newVersion
          ? { versionNumber: state.newVersion.versionNumber, publishedAt: toIso(state.newVersion.publishedAt) }
          : null,
        notice: state.notice,
        withdrawn: state.withdrawn,
      },
      imageKey,
      liveVersionId: state.newVersion?.id ?? null,
    })
  }
  return result
}

async function loadOne(organisationId, courseId, trx = db) {
  const [entry] = await loadReferences(organisationId, courseId, trx)
  if (!entry) throw notFound()
  return entry
}

/** The references of the organisation in the session, by name, with the number of notices (FR-006, FR-012). */
export async function listReferences(organisationId) {
  const references = (await loadReferences(organisationId)).map((entry) => entry.reference).sort(byName)
  return { references, noticeCount: references.filter((reference) => reference.notice).length }
}

export async function getReference(organisationId, courseId) {
  return (await loadOne(organisationId, courseId)).reference
}

/** The stored image of the chosen version; otherwise "not found" (research R11). */
export async function getReferenceThumbnailKey(organisationId, courseId) {
  const { imageKey } = await loadOne(organisationId, courseId)
  if (!imageKey) throw notFound()
  return imageKey
}

/** Locks the Course row so the owner cannot unpublish, delete or restrict meanwhile (research R8). */
function lockCourse(trx, courseId) {
  return trx('Course').where({ id: courseId }).forShare().first('id')
}

/**
 * "Toevoegen aan mijn organisatie" (FR-001 – FR-005): a reference to the live version, only when
 * the course is in the organisation's course library right now and is not its own. Anything not
 * available is "not found" (specs/009 FR-021).
 */
export async function addReference(organisationId, body = {}) {
  const courseId = body.courseId
  if (!Number.isInteger(courseId) || courseId < 1 || courseId > 4294967295) {
    throw validationError({ courseId: 'Laad de pagina opnieuw en probeer het nog eens.' })
  }
  return withDeadlockRetry(() =>
    db.transaction(async (trx) => {
      if (!(await lockCourse(trx, courseId))) throw notFound()
      const shared = await libraryCoursesQuery(organisationId, trx).where('c.id', courseId).first()
      if (!shared || shared.ownerId === organisationId) throw notFound()
      const live = (await courses.liveVersions([courseId], trx)).get(courseId)
      if (!live) throw notFound()
      if (await repo.hasOrganisationCourse(trx, organisationId, courseId)) throw courseAlreadyAdded()
      try {
        await repo.insertReference(trx, organisationId, courseId, live.id)
      } catch (err) {
        if (err?.code === 'ER_DUP_ENTRY') throw courseAlreadyAdded()
        throw err
      }
      return (await loadOne(organisationId, courseId, trx)).reference
    }),
  )
}

/** "Verwijderen uit mijn organisatie" (FR-009): only this organisation's reference row. */
export async function removeReference(organisationId, courseId) {
  if ((await repo.deleteReference(organisationId, courseId)) === 0) throw notFound()
}

/**
 * "Nieuwe versie gebruiken" (FR-014): the reference points to the live version of this moment.
 * Without a newer version to choose (already the live version, or withdrawn) 409 with the state.
 */
export function useNewVersion(organisationId, courseId) {
  return withDeadlockRetry(() =>
    db.transaction(async (trx) => {
      await lockCourse(trx, courseId)
      const entry = await loadOne(organisationId, courseId, trx)
      if (!entry.liveVersionId) throw noNewerVersion(entry.reference)
      await repo.setChosenVersion(trx, organisationId, courseId, entry.liveVersionId)
      return (await loadOne(organisationId, courseId, trx)).reference
    }),
  )
}

/** "Huidige versie houden" (FR-015): the notice for this live version goes away; nothing else changes. */
export function keepVersion(organisationId, courseId) {
  return db.transaction(async (trx) => {
    const entry = await loadOne(organisationId, courseId, trx)
    if (!entry.liveVersionId) return entry.reference
    await repo.setDeclinedVersion(trx, organisationId, courseId, entry.liveVersionId)
    return (await loadOne(organisationId, courseId, trx)).reference
  })
}
