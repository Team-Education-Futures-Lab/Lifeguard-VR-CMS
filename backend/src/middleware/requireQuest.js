import { isValidQuestLinkCode, normalizeQuestLinkCode } from '../lib/codes.js'
import { relinkRequired } from '../lib/errors.js'
import { findActiveByQuestLinkCode } from '../modules/organisations/organisationRepository.js'

/**
 * Access for the Quest app (specs/007 research R1): the quest link code itself is the key, sent
 * as `Authorization: Bearer <code>`. Only that header is read, never cookies, so a CMS session
 * gives no access here and a quest link code gives no access to the CMS (FR-003). Renewing the
 * code or deleting the organisation makes the stored code invalid at once (FR-004). The header
 * is never logged.
 */
export async function requireQuest(req, _res, next) {
  const match = /^Bearer\s+(.+)$/i.exec(req.get('Authorization') ?? '')
  const code = normalizeQuestLinkCode(match?.[1])
  if (!isValidQuestLinkCode(code)) return next(relinkRequired())

  const organisation = await findActiveByQuestLinkCode(code)
  if (!organisation) return next(relinkRequired())

  req.quest = { organisationId: organisation.id, organisationName: organisation.name }
  next()
}

/** The organisation of the linked Quest; it only comes from the link code, never from input. */
export function getQuestOrganisationId(req) {
  const id = req.quest?.organisationId
  if (!id) throw new Error('getQuestOrganisationId called without a linked Quest')
  return id
}
