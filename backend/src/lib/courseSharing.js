// The warning about restricted videos when a course is shared (specs/009 FR-009, FR-010,
// research R4). Pure functions: the service loads the rows, this decides which videos the owner
// must confirm. This is the only definition of that rule.

/**
 * A video that is not generally available: selective or own organisation only, soft deleted, or
 * of an owner that was deleted. A video of another organisation that is shared selectively with
 * the course owner counts too (its visibility is 'selective').
 */
export function isRestrictedVideo(video) {
  return video.visibility !== 'public' || Boolean(video.deletedAt) || Boolean(video.ownerDeleted)
}

/**
 * The organisations (besides the owner) that see a course in the course library: nobody without a
 * live version or with 'private', everyone with 'public', the chosen ones with 'selective'.
 */
export function audience({ live, visibility, accessOrganisationIds = [] }, allOrganisationIds) {
  if (!live || visibility === 'private') return new Set()
  if (visibility === 'public') return new Set(allOrganisationIds)
  return new Set(accessOrganisationIds)
}

/** True when `after` reaches an organisation that `before` does not. */
export function isWider(before, after, allOrganisationIds) {
  const was = audience(before, allOrganisationIds)
  for (const id of audience(after, allOrganisationIds)) if (!was.has(id)) return true
  // 'public' reaches organisations created later as well, so going public is always wider.
  return after.live && after.visibility === 'public' && !(before.live && before.visibility === 'public')
}

/**
 * The videos the owner must confirm before sharing, as [{ id, name }] in the order of
 * `contentVideos` (each once):
 * - nobody sees the course afterwards: none;
 * - the audience grows (first time shared, or more organisations): every restricted video;
 * - otherwise: the restricted videos that were not in the previous live version.
 *
 * `before`/`after`: { live, visibility, accessOrganisationIds }. `contentVideos`: rows with
 * { id, name, visibility, deletedAt, ownerDeleted } of the content that will be shared.
 * `previousVideoIds`: ids of the videos in the current live version (empty without one).
 */
export function sharedVideosWarning({ before, after, contentVideos, previousVideoIds = [], allOrganisationIds = [] }) {
  if (!after.live || after.visibility === 'private') return []
  if (after.visibility === 'selective' && audience(after, allOrganisationIds).size === 0) return []
  const wider = isWider(before, after, allOrganisationIds)
  const previous = new Set(previousVideoIds)
  const seen = new Set()
  const result = []
  for (const video of contentVideos) {
    if (seen.has(video.id)) continue
    seen.add(video.id)
    if (!isRestrictedVideo(video)) continue
    if (!wider && previous.has(video.id)) continue
    result.push({ id: video.id, name: video.name })
  }
  return result
}
