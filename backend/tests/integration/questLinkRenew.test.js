import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../src/db/knex.js'
import { isValidQuestLinkCode } from '../../src/lib/codes.js'
import { agentWithSession, app, createAdmin, createOrganisationRow, resetDatabase } from '../helpers/testApp.js'
import { questGet, questLink } from '../helpers/quest.js'

// The first generated code is taken, so renewing has to skip it (T026). The real generator is
// used for everything else.
const codes = vi.hoisted(() => ({ queue: [] }))
vi.mock('../../src/lib/codes.js', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, generateQuestLinkCode: () => codes.queue.shift() ?? original.generateQuestLinkCode() }
})

// Seeing and renewing the quest link code in the CMS (specs/007 US4, FR-017, FR-018, FR-019).

let a
let b
let agent

beforeEach(async () => {
  await resetDatabase()
  codes.queue = []
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A', questLinkCode: 'QZ7K2M9X' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
  agent = (await agentWithSession({ organisationId: a.id })).agent
})

const renew = (client = agent) => client.post('/api/organisation/quest-link/renew')

describe('GET /api/organisation/quest-link', () => {
  it('shows the own code', async () => {
    const res = await agent.get('/api/organisation/quest-link')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ questLinkCode: 'QZ7K2M9X' })
  })

  it('is only for an organisation session', async () => {
    const admin = await createAdmin()
    const { agent: adminAgent } = await agentWithSession({ administratorId: admin.id })
    expect((await adminAgent.get('/api/organisation/quest-link')).status).toBe(403)
    expect((await request(app).get('/api/organisation/quest-link')).status).toBe(401)
  })
})

describe('POST /api/organisation/quest-link/renew', () => {
  it('makes a new code; the old one stops working at once (FR-004, SC-005)', async () => {
    const res = await renew()
    expect(res.status).toBe(200)
    const fresh = res.body.questLinkCode
    expect(isValidQuestLinkCode(fresh)).toBe(true)
    expect(fresh).not.toBe('QZ7K2M9X')
    expect((await agent.get('/api/organisation/quest-link')).body.questLinkCode).toBe(fresh)

    const oldLink = await questLink('QZ7K2M9X')
    expect(oldLink.status).toBe(401)
    expect(oldLink.body.error.code).toBe('invalid_link_code')
    const oldKey = await questGet('/courses', 'QZ7K2M9X')
    expect(oldKey.status).toBe(401)
    expect(oldKey.body.error.code).toBe('relink_required')

    expect((await questLink(fresh)).status).toBe(200)
    expect((await questGet('/courses', fresh)).status).toBe(200)
  })

  it('only changes the own code, whatever the body says (FR-019)', async () => {
    await agent.post('/api/organisation/quest-link/renew').send({ organisationId: b.id, questLinkCode: 'AAAA1111' })
    const rowB = await db('Organisation').where({ id: b.id }).first('questLinkCode')
    expect(rowB.questLinkCode).toBe('BBBB2222')
    const rowA = await db('Organisation').where({ id: a.id }).first('questLinkCode')
    expect(rowA.questLinkCode).not.toBe('AAAA1111')
  })

  it('needs the CSRF header', async () => {
    // The CSRF check runs before the session, so no cookie is needed to see the refusal.
    const res = await request(app).post('/api/organisation/quest-link/renew')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('csrf_header_missing')
  })

  it('skips a code that is already in use, also by a deleted organisation (T026)', async () => {
    await createOrganisationRow({ name: 'Weg', loginCode: 'WEG', questLinkCode: 'DDDD4444', deletedAt: new Date() })
    codes.queue = ['DDDD4444', 'BBBB2222', 'EEEE5555']
    const res = await renew()
    expect(res.body).toEqual({ questLinkCode: 'EEEE5555' })
  })
})
