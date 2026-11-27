import { Router } from 'express'
import { notFound } from '../../lib/errors.js'
import { sendStoredFile } from '../../lib/sendStoredFile.js'
import { getOrganisationId } from '../../middleware/requireOrganisation.js'
import * as service from './courseLibraryService.js'

// Course library routes (specs/009 contracts/api.md). Mounted under /api/organisation, after
// requireOrganisation; the organisation id always comes from getOrganisationId(req). Which courses
// an organisation may see is decided in one place: courseLibraryRepository.libraryCoursesQuery.
export const courseLibraryRoutes = Router()

/** A positive integer id from the URL; anything else is "not found". */
function idParam(raw) {
  if (!/^[1-9]\d{0,9}$/.test(raw)) throw notFound()
  return Number(raw)
}

courseLibraryRoutes.get('/course-library', async (req, res) => {
  res.json({ courses: await service.listLibraryCourses(getOrganisationId(req)) })
})

courseLibraryRoutes.get('/course-library/:id', async (req, res) => {
  res.json(await service.getLibraryCourse(idParam(req.params.id), getOrganisationId(req)))
})

// Access check only; nginx delivers the bytes via X-Accel-Redirect (constitution III).
courseLibraryRoutes.get('/course-library/:id/thumbnail', async (req, res) => {
  const key = await service.getLibraryThumbnailKey(idParam(req.params.id), getOrganisationId(req))
  await sendStoredFile(res, key, { contentType: 'image/jpeg', cacheControl: 'private, max-age=3600' })
})
