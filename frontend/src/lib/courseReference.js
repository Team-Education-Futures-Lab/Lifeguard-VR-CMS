// Customer-facing texts for courses taken over from the course library (specs/010 contracts/ui.md).
// The word "verwijzing" never appears in the interface (FR-023).

const WITHDRAWN = {
  unpublished: 'De eigenaar heeft deze cursus ingetrokken.',
  course_deleted: 'De eigenaar heeft deze cursus verwijderd.',
  no_access: 'De eigenaar deelt deze cursus niet meer met jullie.',
  owner_deleted: 'De eigenaar van deze cursus bestaat niet meer.',
}

/** Why no new versions come anymore, with the version the receiver keeps; '' when not withdrawn. */
export function withdrawnText(reference) {
  const reason = WITHDRAWN[reference?.withdrawn]
  return reason ? `${reason} Jullie houden versie ${reference.version.versionNumber}.` : ''
}

/** The notice, or the quiet text after "Huidige versie houden"; '' without a newer version. */
export function newVersionLabel(reference) {
  if (!reference?.newVersion) return ''
  const n = reference.newVersion.versionNumber
  return reference.notice ? `Nieuwe versie beschikbaar (versie ${n})` : `Nieuwere versie beschikbaar (versie ${n})`
}

/** For the owner: how many organisations took the course over (FR-019); '' for none. */
export function receiversSentence(count) {
  if (!count) return ''
  return count === 1
    ? '1 organisatie heeft deze cursus overgenomen en houdt haar huidige versie.'
    : `${count} organisaties hebben deze cursus overgenomen en houden hun huidige versie.`
}

/** In the restrict confirmation: the receivers that lose access (FR-019); '' for none. */
export function losingReceiversSentence(count) {
  if (!count) return ''
  return count === 1
    ? '1 daarvan heeft deze cursus overgenomen en houdt haar huidige versie.'
    : `${count} daarvan hebben deze cursus overgenomen en houden hun huidige versie.`
}

/** "Overgenomen door …" for the owner; '' without receivers. */
export function receiversList(receivers) {
  if (!receivers?.length) return ''
  const noun = receivers.length === 1 ? 'organisatie' : 'organisaties'
  return `Overgenomen door ${receivers.length} ${noun}: ${receivers.map((r) => r.name).join(', ')}`
}

/** The label of the notice counter in the navigation. */
export function noticeCountLabel(count) {
  return count === 1 ? '1 cursus met een nieuwe versie' : `${count} cursussen met een nieuwe versie`
}
