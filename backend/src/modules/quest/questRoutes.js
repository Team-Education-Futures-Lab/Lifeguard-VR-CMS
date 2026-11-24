import { Router } from 'express'
import { notFound } from '../../lib/errors.js'
import { sendStoredFile } from '../../lib/sendStoredFile.js'
import { notFoundHandler } from '../../middleware/errorHandler.js'
import { getQuestOrganisationId, requireQuest } from '../../middleware/requireQuest.js'
import * as service from './questService.js'

// Quest API v1 (specs/007 contracts/quest-api.md), mounted on /api/quest/v1 before the cookie
// session and the CSRF check: the Quest uses no cookies, only its link code as Bearer (research
// R1, R6). Everything after /link requires a valid link code.
export const questRoutes = Router()

/** A positive integer id from the URL; anything else is "not found". */
function idParam(raw) {
  if (!/^[1-9]\d{0,9}$/.test(raw)) throw notFound()
  return Number(raw)
}

questRoutes.post('/link', async (req, res) => {
  res.json(await service.link(req.body?.linkCode))
})

questRoutes.use(requireQuest)

questRoutes.get('/organisation', (req, res) => {
  res.json({ organisation: { id: req.quest.organisationId, name: req.quest.organisationName } })
})

questRoutes.get('/courses', async (req, res) => {
  res.json(await service.listCourses(getQuestOrganisationId(req)))
})

questRoutes.get('/courses/:courseId', async (req, res) => {
  res.json(await service.getCourse(getQuestOrganisationId(req), idParam(req.params.courseId)))
})

// Access check only; nginx delivers the bytes and answers Range requests (constitution III,
// research R5).
questRoutes.get('/videos/:videoId', async (req, res) => {
  const key = await service.getVideoKey(getQuestOrganisationId(req), idParam(req.params.videoId))
  await sendStoredFile(res, key, { contentType: 'video/mp4', cacheControl: 'private, max-age=0, must-revalidate' })
})

// An unknown route under /api/quest/v1 is a JSON 404 and never falls through to the CSRF check.
questRoutes.use(notFoundHandler)
