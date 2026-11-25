import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { agentWithSession, app, createOrganisationRow, resetDatabase } from '../helpers/testApp.js'
import { questGet } from '../helpers/quest.js'

// The Quest API and the CMS are separate (specs/007 FR-003, research R6).

let a

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A', questLinkCode: 'QZ7K2M9X' })
})

describe('Quest API and CMS', () => {
  it('a CMS session gives no access to the Quest API', async () => {
    const { agent } = await agentWithSession({ organisationId: a.id })
    const res = await agent.get('/api/quest/v1/organisation')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('relink_required')
  })

  it('a link code gives no access to the CMS', async () => {
    const res = await request(app).get('/api/organisation').set('Authorization', 'Bearer QZ7K2M9X')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('not_authenticated')
  })

  it('an unknown Quest route is a JSON 404 for a linked Quest, never a CSRF refusal', async () => {
    const get = await questGet('/onbekend', 'QZ7K2M9X')
    expect(get.status).toBe(404)
    expect(get.body.error.code).toBe('not_found')
    const post = await request(app).post('/api/quest/v1/onbekend').set('Authorization', 'Bearer QZ7K2M9X')
    expect(post.status).toBe(404)
  })

  it('an unknown Quest route without a link code asks to link again', async () => {
    const res = await questGet('/onbekend', null)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('relink_required')
  })
})
