import multer from 'multer'
import { AppError } from '../lib/errors.js'

function send(res, status, code, message, fields, issues, videos, reference) {
  const error = { code, message }
  if (fields) error.fields = fields
  if (issues) error.issues = issues
  if (videos) error.videos = videos
  if (reference) error.reference = reference
  res.status(status).json({ error })
}

export function notFoundHandler(_req, res) {
  send(res, 404, 'not_found', 'Niet gevonden.')
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    // validation_failed always has `fields`; a conflict names the field that is taken (contracts/api.md).
    // course_incomplete lists the messages of the completeness check (specs/006 contracts/api.md);
    // shared_videos_warning lists the videos the owner must confirm (specs/009 contracts/api.md);
    // no_newer_version carries the current state of the reference (specs/010 contracts/api.md).
    return send(res, err.status, err.code, err.message, err.code === 'validation_failed' ? err.fields ?? {} : err.fields, err.issues, err.videos, err.reference)
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return send(res, 413, 'logo_too_large', 'Het logo mag maximaal 2 MB zijn.')
    }
    return send(res, 400, 'invalid_logo', 'Upload één afbeelding in het veld "logo".')
  }
  if (err?.type === 'entity.parse.failed') {
    return send(res, 400, 'invalid_json', 'Het verzoek kon niet worden gelezen.')
  }
  if (err?.type === 'entity.too.large') {
    return send(res, 413, 'payload_too_large', 'Het verzoek is te groot.')
  }
  console.error('Unhandled error:', err)
  send(res, 500, 'internal_error', 'Er ging iets mis. Probeer het later opnieuw.')
}
