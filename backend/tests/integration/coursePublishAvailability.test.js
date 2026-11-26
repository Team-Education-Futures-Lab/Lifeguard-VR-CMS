import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import {
  agentWithSession,
  createCourseRow,
  createOrganisationRow,
  createPublishedVersionRow,
  createVideoRow,
  resetDatabase,
  softDeleteVideo,
} from '../helpers/testApp.js'
import { publish, saveRoute } from '../helpers/sharing.js'

// Publishing with an availability (specs/009 FR-001 – FR-005, FR-009 – FR-012, research R3, R4, R8).

let a
let b
let c
let agent
let course
let open
let open2

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C' })
  agent = (await agentWithSession({ organisationId: a.id })).agent
  open = await createVideoRow({ organisationId: a.id, name: 'Open', visibility: 'public' })
  open2 = await createVideoRow({ organisationId: a.id, name: 'Open 2', visibility: 'public' })
  course = await createCourseRow({ organisationId: a.id })
})

const versionCount = async () => Number((await db('CourseVersion').where({ courseId: course.courseId }).count({ n: '*' }))[0].n)
const access = async () => (await db('CourseAccess').where({ courseId: course.courseId }).orderBy('organisationId')).map((row) => row.organisationId)
const visibility = async () => (await db('Course').where({ id: course.courseId }).first()).visibility

describe('choosing the availability when publishing', () => {
  it('saves "public" together with the published version', async () => {
    await saveRoute(agent, course.courseId, { first: open.id, second: open2.id })
    const response = await publish(agent, course.courseId, { visibility: 'public' })
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('published')
    expect(response.body.availability).toEqual({ visibility: 'public', accessOrganisations: [] })
    expect(await visibility()).toBe('public')
  })

  it('saves the chosen organisations for "selective" and drops them for another choice', async () => {
    await saveRoute(agent, course.courseId, { first: open.id })
    let response = await publish(agent, course.courseId, { visibility: 'selective', accessOrganisationIds: [b.id] })
    expect(response.status).toBe(200)
    expect(response.body.availability).toEqual({ visibility: 'selective', accessOrganisations: [{ id: b.id, name: 'Zwembad B' }] })
    expect(await access()).toEqual([b.id])

    await saveRoute(agent, course.courseId, { first: open.id, questionText: 'Anders' })
    response = await publish(agent, course.courseId, { visibility: 'private' })
    expect(response.status).toBe(200)
    expect(await visibility()).toBe('private')
    expect(await access()).toEqual([])
  })

  it('keeps the current availability without a body', async () => {
    await saveRoute(agent, course.courseId, { first: open.id })
    await publish(agent, course.courseId, { visibility: 'public' })
    await saveRoute(agent, course.courseId, { first: open.id, questionText: 'Anders' })
    const response = await publish(agent, course.courseId)
    expect(response.status).toBe(200)
    expect(response.body.publication.versionNumber).toBe(2)
    expect(await visibility()).toBe('public')
  })

  it.each([
    [{ visibility: 'x' }, 'visibility', 'Kies een beschikbaarheid.'],
    [{ visibility: 'selective', accessOrganisationIds: [] }, 'accessOrganisationIds', 'Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’.'],
    [{ visibility: 'selective', accessOrganisationIds: ['abc'] }, 'accessOrganisationIds', 'Kies alleen organisaties uit de lijst.'],
  ])('refuses %j and changes nothing', async (body, field, message) => {
    await saveRoute(agent, course.courseId, { first: open.id })
    const before = await versionCount()
    const response = await publish(agent, course.courseId, body)
    expect(response.status).toBe(400)
    expect(response.body.error.fields[field]).toBe(message)
    expect(await versionCount()).toBe(before)
    expect(await visibility()).toBe('private')
  })

  it.each([
    ['the own organisation', () => a.id],
    ['an unknown organisation', () => 999999],
    ['a deleted organisation', () => c.id],
  ])('refuses %s in the list', async (_label, id) => {
    await db('Organisation').where({ id: c.id }).update({ deletedAt: new Date() })
    await saveRoute(agent, course.courseId, { first: open.id })
    const before = await versionCount()
    const response = await publish(agent, course.courseId, { visibility: 'selective', accessOrganisationIds: [id()] })
    expect(response.status).toBe(400)
    expect(response.body.error.fields.accessOrganisationIds).toBe('Kies alleen organisaties uit de lijst.')
    expect(await versionCount()).toBe(before)
    expect(await access()).toEqual([])
  })

  it('changes nothing when the course is incomplete', async () => {
    const response = await publish(agent, course.courseId, { visibility: 'public' })
    expect(response.status).toBe(422)
    expect(await visibility()).toBe('private')
  })

  it('gives courses published before this feature "private" (FR-005)', async () => {
    await db('CourseVersion').where({ id: course.versionId }).update({ versionNumber: 2 })
    await createPublishedVersionRow({ courseId: course.courseId, versionNumber: 1 })
    const response = await agent.get(`/api/organisation/courses/${course.courseId}`)
    expect(response.body.availability.visibility).toBe('private')
  })
})

describe('the warning about restricted videos', () => {
  let own
  let chosen
  let fromB

  beforeEach(async () => {
    own = await createVideoRow({ organisationId: a.id, name: 'Eigen', visibility: 'private' })
    chosen = await createVideoRow({ organisationId: a.id, name: 'Selectief', visibility: 'selective', accessOrganisationIds: [b.id] })
    fromB = await createVideoRow({ organisationId: b.id, name: 'Van B', visibility: 'selective', accessOrganisationIds: [a.id] })
  })

  it('refuses sharing for the first time until every restricted video is confirmed', async () => {
    await saveRoute(agent, course.courseId, { first: own.id, second: chosen.id })
    let response = await publish(agent, course.courseId, { visibility: 'public' })
    expect(response.status).toBe(409)
    expect(response.body.error).toEqual({
      code: 'shared_videos_warning',
      message: "Deze cursus bevat video's die niet algemeen beschikbaar zijn.",
      videos: [
        { id: own.id, name: 'Eigen' },
        { id: chosen.id, name: 'Selectief' },
      ],
    })
    expect(await versionCount()).toBe(1)
    expect(await visibility()).toBe('private')

    response = await publish(agent, course.courseId, { visibility: 'public', acknowledgedVideoIds: [own.id] })
    expect(response.status).toBe(409)

    response = await publish(agent, course.courseId, { visibility: 'public', acknowledgedVideoIds: [own.id, chosen.id] })
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('published')
    expect(await visibility()).toBe('public')
  })

  it('gives no warning when the course is not shared', async () => {
    await saveRoute(agent, course.courseId, { first: own.id, second: chosen.id })
    const response = await publish(agent, course.courseId, { visibility: 'private' })
    expect(response.status).toBe(200)
  })

  it('warns only about new restricted videos in a new version of a shared course', async () => {
    await saveRoute(agent, course.courseId, { first: own.id, second: open.id })
    expect((await publish(agent, course.courseId, { visibility: 'public', acknowledgedVideoIds: [own.id] })).status).toBe(200)

    await saveRoute(agent, course.courseId, { first: own.id, second: open.id, questionText: 'Anders' })
    expect((await publish(agent, course.courseId, { visibility: 'public' })).status).toBe(200)

    await saveRoute(agent, course.courseId, { first: own.id, second: chosen.id, questionText: 'Nog anders' })
    const response = await publish(agent, course.courseId, { visibility: 'public' })
    expect(response.status).toBe(409)
    expect(response.body.error.videos).toEqual([{ id: chosen.id, name: 'Selectief' }])
  })

  it('counts a deleted video in the live version and a video shared with the owner', async () => {
    await saveRoute(agent, course.courseId, { first: open.id, second: fromB.id })
    expect((await publish(agent, course.courseId, { visibility: 'private' })).status).toBe(200)
    await softDeleteVideo(open.id)
    await saveRoute(agent, course.courseId, { first: open.id, second: fromB.id, questionText: 'Anders' })
    const response = await publish(agent, course.courseId, { visibility: 'public' })
    expect(response.status).toBe(409)
    expect(response.body.error.videos).toEqual([
      { id: open.id, name: 'Open' },
      { id: fromB.id, name: 'Van B' },
    ])
  })

  it('warns about every restricted video again after unpublishing (sharing again)', async () => {
    await saveRoute(agent, course.courseId, { first: own.id, second: open.id })
    expect((await publish(agent, course.courseId, { visibility: 'public', acknowledgedVideoIds: [own.id] })).status).toBe(200)
    expect((await agent.post(`/api/organisation/courses/${course.courseId}/unpublish`)).status).toBe(200)
    const response = await publish(agent, course.courseId, { visibility: 'public' })
    expect(response.status).toBe(409)
    expect(response.body.error.videos).toEqual([{ id: own.id, name: 'Eigen' }])
  })

  it('checks completeness before the warning', async () => {
    await saveRoute(agent, course.courseId, { first: own.id, second: null })
    const response = await publish(agent, course.courseId, { visibility: 'public' })
    expect(response.status).toBe(422)
  })

  it('refuses acknowledgedVideoIds that are not whole numbers', async () => {
    await saveRoute(agent, course.courseId, { first: open.id })
    const response = await publish(agent, course.courseId, { visibility: 'public', acknowledgedVideoIds: ['x'] })
    expect(response.status).toBe(400)
    expect(response.body.error.fields).toHaveProperty('acknowledgedVideoIds')
  })
})
