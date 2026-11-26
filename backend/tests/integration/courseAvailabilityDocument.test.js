import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createCourseRow, createOrganisationRow, resetDatabase } from '../helpers/testApp.js'

// The availability in the documents of own courses (specs/009 research R10, contracts/api.md).

let a
let b
let c
let agent

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Brandweer C', loginCode: 'BRANDWEER-C' })
  agent = (await agentWithSession({ organisationId: a.id })).agent
})

describe('availability in the course documents', () => {
  it('is "private" without organisations for a new course', async () => {
    const created = await agent.post('/api/organisation/courses').send({ name: 'Nieuw', description: 'Een nieuwe cursus' })
    expect(created.status).toBe(201)
    expect(created.body.availability).toEqual({ visibility: 'private', accessOrganisations: [] })
    expect((await db('Course').where({ id: created.body.id }).first()).visibility).toBe('private')
  })

  it('lists the chosen active organisations by name for "selective"', async () => {
    const course = await createCourseRow({ organisationId: a.id, visibility: 'selective', accessOrganisationIds: [b.id, c.id] })
    const response = await agent.get(`/api/organisation/courses/${course.courseId}`)
    expect(response.body.availability).toEqual({
      visibility: 'selective',
      accessOrganisations: [
        { id: c.id, name: 'Brandweer C' },
        { id: b.id, name: 'Zwembad B' },
      ],
    })
  })

  it('leaves out organisations that were deleted', async () => {
    const course = await createCourseRow({ organisationId: a.id, visibility: 'selective', accessOrganisationIds: [b.id, c.id] })
    await db('Organisation').where({ id: c.id }).update({ deletedAt: new Date() })
    const response = await agent.get(`/api/organisation/courses/${course.courseId}`)
    expect(response.body.availability.accessOrganisations).toEqual([{ id: b.id, name: 'Zwembad B' }])
  })

  it('gives the visibility of every course in the list', async () => {
    await createCourseRow({ organisationId: a.id, name: 'Eén', visibility: 'public' })
    await createCourseRow({ organisationId: a.id, name: 'Twee' })
    const response = await agent.get('/api/organisation/courses')
    const byName = Object.fromEntries(response.body.courses.map((course) => [course.name, course.visibility]))
    expect(byName).toEqual({ Eén: 'public', Twee: 'private' })
  })
})
