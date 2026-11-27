// Errors that the error handler turns into the JSON error format from contracts/api.md.
// `message` is shown to the customer and is therefore Dutch; `code` is English.
export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const validationError = (fields) =>
  new AppError(400, 'validation_failed', 'Controleer de ingevulde gegevens.', fields)

export const notFound = () => new AppError(404, 'not_found', 'Niet gevonden.')

export const conflict = (fields) =>
  new AppError(409, 'conflict', 'Deze gegevens zijn al in gebruik.', fields)

/** A save from a draft that was published meanwhile (specs/006 research R14). */
export const draftReplaced = () =>
  new AppError(409, 'draft_replaced', 'Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw om verder te werken.')

/** A course that is not complete cannot be published (specs/006 FR-006); `issues` lists why. */
export function courseIncomplete(issues) {
  const error = new AppError(422, 'course_incomplete', 'De cursus is nog niet klaar om te publiceren.')
  error.issues = issues
  return error
}

/** Sharing a course with restricted videos needs the owner's confirmation (specs/009 FR-009, FR-012). */
export function sharedVideosWarning(videos) {
  const error = new AppError(409, 'shared_videos_warning', "Deze cursus bevat video's die niet algemeen beschikbaar zijn.")
  error.videos = videos
  return error
}

/** Changing the availability needs a live version (specs/009 FR-006, research R9). */
export const courseNotLive = () => new AppError(409, 'course_not_live', 'Publiceer de cursus eerst.')

/** The organisation already took over this course (specs/010 FR-005). */
export const courseAlreadyAdded = () =>
  new AppError(409, 'course_already_added', 'Deze cursus staat al bij jullie cursussen.')

/** "Nieuwe versie gebruiken" without a newer version to choose (specs/010 FR-014); `reference` is the current state. */
export function noNewerVersion(reference) {
  const error = new AppError(409, 'no_newer_version', 'Er is geen nieuwere versie om te gebruiken.')
  error.reference = reference
  return error
}

export const notAuthenticated = () =>
  new AppError(401, 'not_authenticated', 'Je bent niet ingelogd.')

export const sessionExpired = () =>
  new AppError(401, 'session_expired', 'Je sessie is verlopen. Log opnieuw in.')

export const forbidden = () =>
  new AppError(403, 'forbidden', 'Je hebt geen toegang tot deze pagina.')

export const invalidCredentials = (message) => new AppError(401, 'invalid_credentials', message)

/** A quest link code that belongs to no active organisation (specs/007 FR-002, research R7). */
export const invalidLinkCode = () =>
  new AppError(401, 'invalid_link_code', 'Deze koppelcode klopt niet. Controleer de code in het CMS.')

/** No, an unknown or a renewed link code in the Authorization header (specs/007 FR-004). */
export const relinkRequired = () =>
  new AppError(401, 'relink_required', 'Deze Quest is niet meer gekoppeld. Koppel opnieuw met de koppelcode.')
