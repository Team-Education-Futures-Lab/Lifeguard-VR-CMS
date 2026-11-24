import { isValidQuestLinkCode, normalizeQuestLinkCode } from '../../lib/codes.js'
import { invalidLinkCode, notFound } from '../../lib/errors.js'
import { isVideoInVersions, versionContents, videoFiles } from '../courses/courseRepository.js'
import { findActiveByQuestLinkCode } from '../organisations/organisationRepository.js'
import { questLiveVersions } from './questCatalog.js'
import { buildQuestContent, downloadSizeBytes } from './questContent.js'

// The Quest API (specs/007 contracts/quest-api.md). Which courses a Quest sees comes only from
// questLiveVersions (FR-006).

/**
 * Checks a link code (FR-001, FR-002). Every failure gets the same answer, so it cannot be told
 * whether a code ever existed. No throttling (specs/007 Clarifications).
 */
export async function link(rawCode) {
  const linkCode = normalizeQuestLinkCode(rawCode)
  const organisation = isValidQuestLinkCode(linkCode) ? await findActiveByQuestLinkCode(linkCode) : undefined
  if (!organisation) throw invalidLinkCode()
  return { linkCode, organisation: { id: organisation.id, name: organisation.name } }
}

/** Content of several live versions in a fixed number of queries (research R4). */
async function buildContents(versions) {
  const contents = await versionContents(versions.map((version) => version.id))
  const videoIds = new Set()
  for (const { steps } of contents.values()) {
    for (const step of steps) if (step.videoId !== null) videoIds.add(step.videoId)
  }
  const videos = await videoFiles([...videoIds])
  return versions.map((version) => buildQuestContent(version, contents.get(version.id), videos))
}

const byName = (a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }) || a.id - b.id

/** The live courses of the Quest's organisation (FR-009, FR-010). */
export async function listCourses(organisationId) {
  const versions = [...(await questLiveVersions(organisationId)).values()]
  const contents = await buildContents(versions)
  const courses = contents.map((content) => ({
    id: content.id,
    name: content.name,
    description: content.description,
    versionNumber: content.versionNumber,
    publishedAt: content.publishedAt,
    downloadSizeBytes: downloadSizeBytes(content),
  }))
  return { courses: courses.sort(byName) }
}

/** The full content of one live course; anything the Quest does not see is "not found" (FR-013). */
export async function getCourse(organisationId, courseId) {
  const version = (await questLiveVersions(organisationId)).get(courseId)
  if (!version) throw notFound()
  const [content] = await buildContents([version])
  return content
}

/**
 * The storage key of a video the Quest may download: it must be in a live version the Quest
 * sees, also when the owner deleted or restricted it (FR-014). Otherwise "not found".
 */
export async function getVideoKey(organisationId, videoId) {
  const versionIds = [...(await questLiveVersions(organisationId)).values()].map((version) => version.id)
  if (!(await isVideoInVersions(videoId, versionIds))) throw notFound()
  const video = (await videoFiles([videoId])).get(videoId)
  if (!video) throw notFound()
  return video.storageKey
}
