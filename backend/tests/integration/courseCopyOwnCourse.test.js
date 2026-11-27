import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { copyReference, questVersions } from '../helpers/references.js'
import { publish, saveRoute } from '../helpers/sharing.js'

// The copy works as any own course (specs/011 FR-011); the original never changes.

let b
let agentB
let video
let original
let copyId

beforeEach(async () => {
  await resetDatabase()
  const a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  video = await createVideoRow({ organisationId: b.id })
  const shared = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  original = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: shared.id }] })
  await createReferenceRow({ organisationId: b.id, courseId: original.courseId, courseVersionId: original.versionIds[0] })
  copyId = (await copyReference(agentB, original.courseId)).body.courseId
})

const originalRows = async () => ({
  course: await db('Course').where({ id: original.courseId }).first(),
  versions: await db('CourseVersion').where({ courseId: original.courseId }).orderBy('id'),
  steps: await db('CourseStep').whereIn('courseVersionId', original.versionIds).orderBy('id'),
})

describe('the copy as an own course', () => {
  it('saves, publishes, unpublishes and deletes; the Quest follows; the original never changes', async () => {
    const before = await originalRows()
    const url = `/api/organisation/courses/${copyId}`

    const saved = await saveRoute(agentB, copyId, { first: video.id, questionText: 'Anders?', name: 'Redden aangepast' })
    expect(saved.status).toBe('published_changed')

    const published = await publish(agentB, copyId)
    expect(published.status).toBe(200)
    expect(published.body).toMatchObject({ status: 'published', publication: { versionNumber: 2 }, draftVersionNumber: 3 })
    expect((await questVersions('BBBB2222')).get(copyId)).toBe(2)

    expect((await agentB.post(`${url}/unpublish`)).status).toBe(200)
    expect((await questVersions('BBBB2222')).has(copyId)).toBe(false)

    expect((await agentB.delete(url)).status).toBe(204)
    expect((await agentB.get(url)).status).toBe(404)
    expect((await agentB.get('/api/organisation/courses')).body.courses).toEqual([])
    expect(await originalRows()).toEqual(before)
  })
})
