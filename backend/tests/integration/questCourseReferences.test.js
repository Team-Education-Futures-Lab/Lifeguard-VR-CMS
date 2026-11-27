import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase, restrictVideo, softDeleteVideo } from '../helpers/testApp.js'
import { publishedCourse, questGet } from '../helpers/quest.js'
import { copyReference, publishNextVersion, questVersions, unpublishLatest } from '../helpers/references.js'

// Taken-over courses on the Quest (specs/010 FR-010, FR-011, FR-021, research R6): the chosen
// version, whatever the owner does.

let a
let b

let shown
let hidden
let course

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A', questLinkCode: 'AAAA2222' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
  await createOrganisationRow({ name: 'Zwembad C', loginCode: 'ZWEMBAD-C', questLinkCode: 'CCCC2222' })
  shown = await createVideoRow({ organisationId: a.id, name: 'Alleen A', visibility: 'private' })
  hidden = await createVideoRow({ organisationId: a.id, name: 'Nieuw', visibility: 'public' })
  course = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: shown.id }] })
  await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
})

const status = async (path, code = 'BBBB2222') => (await questGet(path, code)).status

describe('Quest API with a taken-over course', () => {
  it('lists the chosen version for the receiver only (FR-010)', async () => {
    const own = await publishedCourse({ organisationId: b.id, name: 'Eigen', versions: [{ first: hidden.id }] })
    const versions = await questVersions('BBBB2222')
    expect(versions.get(course.courseId)).toBe(1)
    expect(versions.get(own.courseId)).toBe(1)
    expect((await questVersions('CCCC2222')).has(course.courseId)).toBe(false)
    expect((await questVersions('AAAA2222')).get(course.courseId)).toBe(1)
  })

  it('serves content, image and a restricted video of the chosen version', async () => {
    const content = await questGet(`/courses/${course.courseId}`, 'BBBB2222')
    expect(content.status).toBe(200)
    expect(content.body).toMatchObject({ id: course.courseId, versionNumber: 1, name: 'Redden' })
    expect(await status(`/courses/${course.courseId}/thumbnail`)).toBe(200)
    expect(await status(`/videos/${shown.id}`)).toBe(200)
    expect(await status(`/courses/${course.courseId}`, 'CCCC2222')).toBe(404)
  })

  it('keeps the chosen version when the owner publishes a newer one (US3)', async () => {
    await publishNextVersion(course.courseId, { first: hidden.id })
    expect((await questVersions('BBBB2222')).get(course.courseId)).toBe(1)
    expect((await questVersions('AAAA2222')).get(course.courseId)).toBe(2)
    // A video only in the version that B did not choose stays unavailable (US5 scenario 4).
    expect(await status(`/videos/${hidden.id}`)).toBe(404)
    expect(await status(`/videos/${shown.id}`)).toBe(200)
  })

  it.each([
    ['unpublished', () => unpublishLatest(course.courseId)],
    ['deleted', () => db('Course').where({ id: course.courseId }).update({ deletedAt: new Date() })],
    ['restricted', () => db('Course').where({ id: course.courseId }).update({ visibility: 'private' })],
    ['owner deleted', () => db('Organisation').where({ id: a.id }).update({ deletedAt: new Date() })],
  ])('keeps the chosen version when the course is %s (FR-011)', async (_name, act) => {
    await act()
    expect((await questVersions('BBBB2222')).get(course.courseId)).toBe(1)
    expect(await status(`/courses/${course.courseId}`)).toBe(200)
    expect(await status(`/courses/${course.courseId}/thumbnail`)).toBe(200)
    expect(await status(`/videos/${shown.id}`)).toBe(200)
  })

  it('keeps a deleted or restricted video of the chosen version downloadable (FR-021)', async () => {
    await restrictVideo(shown.id)
    await softDeleteVideo(shown.id)
    expect(await status(`/videos/${shown.id}`)).toBe(200)
  })
})

describe('Quest API after "Aanpassen" (specs/011 FR-018, SC-007)', () => {
  it('lists the copy instead of the original, with the same content and a restricted video', async () => {
    const agentB = (await agentWithSession({ organisationId: b.id })).agent
    const before = (await questGet(`/courses/${course.courseId}`, 'BBBB2222')).body
    await restrictVideo(shown.id)
    const response = await copyReference(agentB, course.courseId)
    expect(response.status).toBe(201)
    const copyId = response.body.courseId
    const versions = await questVersions('BBBB2222')
    expect(versions.has(course.courseId)).toBe(false)
    expect(versions.get(copyId)).toBe(1)
    const after = (await questGet(`/courses/${copyId}`, 'BBBB2222')).body
    // Same shape and content; only the id (and the step ids) differ.
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort())
    expect(after).toMatchObject({ id: copyId, versionNumber: 1, name: before.name, description: before.description })
    expect(after.steps.length).toBe(before.steps.length)
    expect(await status(`/videos/${shown.id}`)).toBe(200)
    expect(await status(`/courses/${copyId}/thumbnail`)).toBe(200)
    expect(await status(`/courses/${course.courseId}`)).toBe(404)
  })
})
