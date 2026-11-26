import { beforeEach, describe, expect, it } from 'vitest'
import { agentWithSession, createAdmin, createOrganisationRow, createVideoRow, newAgent, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'

// What the course library never gives away (specs/009 FR-016, FR-018, FR-021, FR-022, FR-028,
// SC-002, research R6).

let a
let b
let c
let agentA
let agentB
let agentC
let privateVideo
let publicVideo

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  c = await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C' })
  agentA = (await agentWithSession({ organisationId: a.id })).agent
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  agentC = (await agentWithSession({ organisationId: c.id })).agent
  privateVideo = await createVideoRow({ organisationId: a.id, name: 'Eigen', visibility: 'private' })
  publicVideo = await createVideoRow({ organisationId: a.id, name: 'Open', visibility: 'public' })
})

const course = (visibility, first, accessOrganisationIds = []) =>
  publishedCourse({ organisationId: a.id, name: `Cursus ${visibility}`, visibility, accessOrganisationIds, versions: [{ first }] })
const url = (id, suffix = '') => `/api/organisation/course-library/${id}${suffix}`

describe('course library isolation', () => {
  it('is only for organisations (FR-028)', async () => {
    const shared = await course('public', publicVideo.id)
    const admin = (await agentWithSession({ administratorId: (await createAdmin()).id })).agent
    for (const path of ['/api/organisation/course-library', url(shared.courseId), url(shared.courseId, '/thumbnail')]) {
      expect((await admin.get(path)).status, path).toBe(403)
      expect((await newAgent().get(path)).status, path).toBe(401)
    }
  })

  it('answers "not found" for every course that is not available, the same as for an unknown id', async () => {
    const own = await course('private', publicVideo.id)
    const selective = await course('selective', publicVideo.id, [b.id])
    const unknown = await agentC.get(url(999999))
    expect(unknown.status).toBe(404)
    for (const path of [url(own.courseId), url(own.courseId, '/thumbnail'), url(selective.courseId), url(selective.courseId, '/thumbnail'), url('abc')]) {
      const response = await agentC.get(path)
      expect(response.status, path).toBe(404)
      expect(response.body, path).toEqual(unknown.body)
    }
  })

  it('never gives the content, the draft or with whom the course is shared', async () => {
    const shared = await course('selective', publicVideo.id, [b.id, c.id])
    const response = await agentB.get(url(shared.courseId))
    expect(response.status).toBe(200)
    for (const key of ['steps', 'answers', 'videoId', 'videoIds', 'draftVersionNumber', 'status', 'visibility', 'accessOrganisations']) {
      expect(response.body, key).not.toHaveProperty(key)
    }
  })

  it('hides the course image when it comes from a video the viewer cannot see (research R6)', async () => {
    const hidden = await course('public', privateVideo.id)
    const [forB] = (await agentB.get('/api/organisation/course-library')).body.courses
    expect(forB.thumbnailUrl).toBeNull()
    expect((await agentB.get(url(hidden.courseId, '/thumbnail'))).status).toBe(404)

    const [forA] = (await agentA.get('/api/organisation/course-library')).body.courses
    expect(forA.thumbnailUrl).toBe(`/api/organisation/course-library/${hidden.courseId}/thumbnail`)
    expect((await agentA.get(url(hidden.courseId, '/thumbnail'))).status).toBe(200)
  })

  it('shows the course image of a public video', async () => {
    const shared = await course('public', publicVideo.id)
    const response = await agentB.get(url(shared.courseId, '/thumbnail'))
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toBe('image/jpeg')
    expect(response.headers['cache-control']).toBe('private, max-age=3600')
  })

  it('keeps a shared course closed for editing by others (FR-022)', async () => {
    const shared = await course('public', publicVideo.id)
    const path = `/api/organisation/courses/${shared.courseId}`
    expect((await agentB.get(path)).status).toBe(404)
    expect((await agentB.put(path).send({ draftVersionNumber: 2, name: 'X', description: 'Door B', steps: [] })).status).toBe(404)
    expect((await agentB.delete(path)).status).toBe(404)
    expect((await agentB.post(`${path}/publish`)).status).toBe(404)
    expect((await agentB.post(`${path}/unpublish`)).status).toBe(404)
  })
})
