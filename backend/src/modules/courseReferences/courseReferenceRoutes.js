import { Router } from 'express'
import { notFound } from '../../lib/errors.js'
import { sendStoredFile } from '../../lib/sendStoredFile.js'
import { getOrganisationId } from '../../middleware/requireOrganisation.js'
import * as service from './courseReferenceService.js'

// Courses taken over from the course library (specs/010 contracts/api.md). Mounted under
// /api/organisation, after requireOrganisation; the organisation id always comes from
// getOrganisationId(req). Which references an organisation has is decided in one place:
// courseReferenceRepository.referencesQuery. The id in the URL is the id of the original course.
export const courseReferenceRoutes = Router()

/** A positive integer id from the URL; anything else is "not found". */
function idParam(raw) {
  if (!/^[1-9]\d{0,9}$/.test(raw)) throw notFound()
  return Number(raw)
}
const courseId = (req) => idParam(req.params.courseId)

courseReferenceRoutes.get('/course-references', async (req, res) => {
  res.json(await service.listReferences(getOrganisationId(req)))
})

// Only courseId is read; the organisation always comes from the session.
courseReferenceRoutes.post('/course-references', async (req, res) => {
  const { courseId: id } = req.body ?? {}
  res.status(201).json(await service.addReference(getOrganisationId(req), { courseId: id }))
})

courseReferenceRoutes.get('/course-references/:courseId', async (req, res) => {
  res.json(await service.getReference(getOrganisationId(req), courseId(req)))
})

courseReferenceRoutes.delete('/course-references/:courseId', async (req, res) => {
  await service.removeReference(getOrganisationId(req), courseId(req))
  res.status(204).end()
})

// "Nieuwe versie gebruiken": always the live version of this moment; no body is read.
courseReferenceRoutes.post('/course-references/:courseId/update', async (req, res) => {
  res.json(await service.useNewVersion(getOrganisationId(req), courseId(req)))
})

// "Huidige versie houden"; no body is read.
courseReferenceRoutes.post('/course-references/:courseId/keep', async (req, res) => {
  res.json(await service.keepVersion(getOrganisationId(req), courseId(req)))
})

// "Aanpassen" (specs/011): an own copy of the chosen version; { courseId } of the copy. No body is read.
courseReferenceRoutes.post('/course-references/:courseId/copy', async (req, res) => {
  res.status(201).json(await service.copyReference(getOrganisationId(req), courseId(req)))
})

// Access check only; nginx delivers the bytes via X-Accel-Redirect (constitution III). `v` is ignored.
courseReferenceRoutes.get('/course-references/:courseId/thumbnail', async (req, res) => {
  const key = await service.getReferenceThumbnailKey(getOrganisationId(req), courseId(req))
  await sendStoredFile(res, key, { contentType: 'image/jpeg', cacheControl: 'private, max-age=3600' })
})
