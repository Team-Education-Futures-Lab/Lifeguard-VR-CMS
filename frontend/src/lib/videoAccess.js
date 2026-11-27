// How many organisations lose access when the availability of a video or a course changes
// (specs/003 research R6, FR-017a; specs/009 FR-007). `allOrganisationIds` are the other active
// organisations.

/** The organisations (besides the owner) that can see a video with this availability. */
export function audience(value, allOrganisationIds) {
  if (value.visibility === 'public') return new Set(allOrganisationIds)
  if (value.visibility === 'selective') return new Set(value.accessOrganisationIds ?? [])
  return new Set()
}

export function countLosingAccess(current, next, allOrganisationIds) {
  const after = audience(next, allOrganisationIds)
  let lost = 0
  for (const id of audience(current, allOrganisationIds)) if (!after.has(id)) lost++
  return lost
}

/**
 * The confirmation text before restricting (customer-facing, so Dutch). `noun` is 'video' or
 * 'course' (specs/009 FR-007): a course is seen in the course library.
 */
export function confirmationText(count, noun = 'video') {
  const what = noun === 'course' ? 'deze cursus daarna niet meer zien in de cursusbibliotheek' : 'deze video daarna niet meer zien'
  return count === 1 ? `1 organisatie kan ${what}.` : `${count} organisaties kunnen ${what}.`
}
