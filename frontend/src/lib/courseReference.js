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

/** The confirmation of "Toevoegen aan mijn organisatie" (specs/010, text changed by specs/011). */
export function addConfirmationBody(course) {
  const owner = course.owner.name
  return `“${course.name}” van ${owner} komt bij jouw cursussen en wordt te downloaden op de VR-brillen. De cursus blijft van ${owner}. Wil je hem aanpassen, dan maak je later een eigen kopie. Komt er een nieuwe versie, dan kies je zelf of je die gebruikt.`
}

/** "Aanpassen" (specs/011 contracts/ui.md § Bevestiging aanpassen): the confirmDialog options. */
export function copyConfirmation(reference) {
  const owner = reference.owner.name
  return {
    title: 'Deze cursus zelf aanpassen?',
    body:
      `Je krijgt een eigen kopie van versie ${reference.version.versionNumber} van “${reference.name}”. Die kun je zelf aanpassen en publiceren. ` +
      `De kopie krijgt geen nieuwe versies meer van ${owner}, en de cursus van ${owner} verandert niet. ` +
      'De VR-brillen krijgen de kopie als nieuwe cursus en downloaden hem de volgende keer opnieuw. Tot je publiceert staat dezelfde inhoud erop. ' +
      'Dit kun je niet ongedaan maken.',
    confirmLabel: 'Aanpassen',
  }
}

/** "Gebaseerd op …" of a copy (specs/011 FR-012); '' for any other course. */
export function basedOnText(basedOn) {
  return basedOn ? `Gebaseerd op ${basedOn.courseName} van ${basedOn.ownerName}` : ''
}

/** In the course library: the organisation already has an own copy (specs/011 FR-021). */
export const HAS_COPY_HINT = 'Jullie hebben al een aangepaste kopie van deze cursus.'

/** In the publish dialog of a copy (specs/011 FR-013). */
export const COPY_NOT_SHARED = 'Een aangepaste cursus is alleen voor jouw organisatie en kan niet gedeeld worden.'

/** Toasts around "Aanpassen" (specs/011 contracts/ui.md). */
export const COPY_DONE = 'Je eigen kopie is klaar. Je kunt hem nu aanpassen.'
export const COPY_GONE = 'Deze cursus staat niet meer bij jouw cursussen.'

/** The label of the notice counter in the navigation. */
export function noticeCountLabel(count) {
  return count === 1 ? '1 cursus met een nieuwe versie' : `${count} cursussen met een nieuwe versie`
}
