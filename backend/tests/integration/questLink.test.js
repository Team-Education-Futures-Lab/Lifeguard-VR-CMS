import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { createOrganisationRow, resetDatabase } from '../helpers/testApp.js'
import { questGet, questLink } from '../helpers/quest.js'

// Linking a Quest with the quest link code (specs/007 US1, FR-001, FR-002, FR-004).

let a

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A', questLinkCode: 'QZ7K2M9X' })
  await createOrganisationRow({ name: 'Weg', loginCode: 'WEG', questLinkCode: 'DDDD4444', deletedAt: new Date() })
})

describe('POST /api/quest/v1/link', () => {
  it('links with a valid code, case-insensitive and trimmed, without a CSRF header', async () => {
    const res = await questLink(' qz7k2m9x ')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ linkCode: 'QZ7K2M9X', organisation: { id: a.id, name: 'Zwembad A' } })
  })

  it('refuses every invalid code with one and the same answer (FR-002)', async () => {
    const answers = []
    for (const code of ['ZWEMBAD-A', 'ABCD1234', 'DDDD4444', undefined, 123, 'Q'.repeat(60)]) {
      const res = await questLink(code)
      expect(res.status, String(code)).toBe(401)
      answers.push(res.body)
    }
    for (const body of answers) {
      expect(body).toEqual({
        error: { code: 'invalid_link_code', message: 'Deze koppelcode klopt niet. Controleer de code in het CMS.' },
      })
    }
  })
})

describe('GET /api/quest/v1/organisation', () => {
  it('works with the link code as Bearer, also lower-case with spaces', async () => {
    expect((await questGet('/organisation', 'QZ7K2M9X')).body).toEqual({ organisation: { id: a.id, name: 'Zwembad A' } })
    const res = await questGet('/organisation', null).set('Authorization', 'bearer  qz7k2m9x ')
    expect(res.status).toBe(200)
  })

  it('asks to link again without, with a wrong or with an unknown code (FR-004)', async () => {
    for (const req of [
      questGet('/organisation', null),
      questGet('/organisation', null).set('Authorization', 'Basic QZ7K2M9X'),
      questGet('/organisation', 'ABCD1234'),
      questGet('/organisation', 'DDDD4444'),
    ]) {
      const res = await req
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('relink_required')
    }
  })

  it('stops working once the organisation is deleted', async () => {
    await db('Organisation').where({ id: a.id }).update({ deletedAt: new Date() })
    const res = await questGet('/organisation', 'QZ7K2M9X')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('relink_required')
  })
})
