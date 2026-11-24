import { Router } from 'express'
import { notFound } from '../../lib/errors.js'
import { getOrganisationId } from '../../middleware/requireOrganisation.js'
import { findActiveById } from '../organisations/organisationRepository.js'
import { renewQuestLinkCode } from '../organisations/organisationService.js'

export const organisationSelfRoutes = Router()

organisationSelfRoutes.get('/', async (req, res) => {
  const organisation = await findActiveById(getOrganisationId(req))
  if (!organisation) throw notFound()
  res.json({ id: organisation.id, name: organisation.name, loginCode: organisation.loginCode })
})

// The quest link code of the own organisation (specs/007 contracts/organisation-api.md). The id
// always comes from the session (FR-019).
organisationSelfRoutes.get('/quest-link', async (req, res) => {
  const organisation = await findActiveById(getOrganisationId(req))
  if (!organisation) throw notFound()
  res.json({ questLinkCode: organisation.questLinkCode })
})

organisationSelfRoutes.post('/quest-link/renew', async (req, res) => {
  res.json(await renewQuestLinkCode(getOrganisationId(req)))
})
