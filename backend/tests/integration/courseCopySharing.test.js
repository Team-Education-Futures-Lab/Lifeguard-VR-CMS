import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { copyReference } from '../helpers/references.js'
import { changeAvailability, library, publish, saveRoute } from '../helpers/sharing.js'

// An own copy is never shared and never in the course library (specs/011 FR-013, SC-006, research R5).

let a
let b
let c
let agentA
let agentB
let agentC
let video
let copyId

const REFUSED = { visibility: 'Een aangepaste cursus kan niet gedeeld worden.' }

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C' })
  agentA = (await agentWithSession({ organisationId: a.id })).agent
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  agentC = (await agentWithSession({ organisationId: c.id })).agent
  video = await createVideoRow({ organisationId: b.id, visibility: 'private' })
  const shared = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  const original = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: shared.id }] })
  await createReferenceRow({ organisationId: b.id, courseId: original.courseId, courseVersionId: original.versionIds[0] })
  copyId = (await copyReference(agentB, original.courseId)).body.courseId
})

const state = async () => ({
  course: await db('Course').where({ id: copyId }).first('visibility', 'updatedAt'),
  versions: await db('CourseVersion').where({ courseId: copyId }).orderBy('id').select('id', 'versionNumber', 'publishedAt', 'unpublishedAt'),
  access: await db('CourseAccess').where({ courseId: copyId }),
})

describe('sharing an own copy', () => {
  it.each(['public', 'selective'])('publishing with %s is refused and changes nothing', async (visibility) => {
    const body = { visibility, accessOrganisationIds: visibility === 'selective' ? [c.id] : [] }
    await saveRoute(agentB, copyId, { first: video.id, name: 'Redden aangepast' })
    const before = await state()
    const response = await publish(agentB, copyId, body)
    expect(response.status).toBe(400)
    expect(response.body.error).toMatchObject({ code: 'validation_failed', fields: REFUSED })
    expect(await state()).toEqual(before)
  })

  it('publishing without visibility or with private works and stays private', async () => {
    await saveRoute(agentB, copyId, { first: video.id, name: 'Redden aangepast' })
    const response = await publish(agentB, copyId)
    expect(response.status).toBe(200)
    expect(response.body.publication.versionNumber).toBe(2)
    expect(response.body.availability.visibility).toBe('private')
    await saveRoute(agentB, copyId, { first: video.id, name: 'Redden aangepast 2' })
    expect((await publish(agentB, copyId, { visibility: 'private' })).status).toBe(200)
  })

  it('changing the availability is refused, except private', async () => {
    const response = await changeAvailability(agentB, copyId, { visibility: 'public' })
    expect(response.status).toBe(400)
    expect(response.body.error.fields).toEqual(REFUSED)
    expect((await changeAvailability(agentB, copyId, { visibility: 'private' })).status).toBe(200)
    expect((await db('Course').where({ id: copyId }).first()).visibility).toBe('private')
  })

  it('is in no course library, also after publishing', async () => {
    await saveRoute(agentB, copyId, { first: video.id, name: 'Redden aangepast' })
    await publish(agentB, copyId)
    // Even when the row would say otherwise, the library leaves copies out (specs/009 FR-014 d).
    await db('Course').where({ id: copyId }).update({ visibility: 'public' })
    for (const agent of [agentA, agentB, agentC]) {
      expect((await library(agent)).map((course) => course.id)).not.toContain(copyId)
      expect((await agent.get(`/api/organisation/course-library/${copyId}`)).status).toBe(404)
    }
  })

  it('an ordinary own course can still be shared', async () => {
    const own = (await agentB.post('/api/organisation/courses').send({ name: 'Eigen', description: 'Beschrijving' })).body
    await saveRoute(agentB, own.id, { first: video.id })
    const response = await publish(agentB, own.id, { visibility: 'public', accessOrganisationIds: [], acknowledgedVideoIds: [video.id] })
    expect(response.status).toBe(200)
    expect(response.body.availability.visibility).toBe('public')
  })
})
