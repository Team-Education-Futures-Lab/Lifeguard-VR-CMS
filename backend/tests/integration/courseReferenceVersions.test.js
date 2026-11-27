import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { keepVersion, listReferences, publishNextVersion, questVersions, unpublishLatest, useNewVersion } from '../helpers/references.js'
import { changeAvailability, publish, saveRoute } from '../helpers/sharing.js'

// New versions: the notice and choosing the version (specs/010 FR-012 – FR-016, research R8).

let a
let b
let agentA
let agentB
let video
let course

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
  agentA = (await agentWithSession({ organisationId: a.id })).agent
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  video = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  course = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: video.id }] })
  await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
})

const state = async () => (await listReferences(agentB)).references[0]
const row = () => db('OrganisationCourse').where({ organisationId: b.id, courseId: course.courseId }).first()

describe('notice', () => {
  it('appears after a new published version; the Quest keeps the old one (FR-012)', async () => {
    expect((await state()).notice).toBe(false)
    await publishNextVersion(course.courseId, { first: video.id })
    const { references, noticeCount } = await listReferences(agentB)
    expect(references[0]).toMatchObject({ notice: true, newVersion: { versionNumber: 2 }, version: { versionNumber: 1 } })
    expect(noticeCount).toBe(1)
    expect((await questVersions('BBBB2222')).get(course.courseId)).toBe(1)
  })

  it('does not come from a draft, an availability change or republishing the same version (FR-016)', async () => {
    await saveRoute(agentA, course.courseId, { first: video.id, name: 'Concept' })
    await changeAvailability(agentA, course.courseId, { visibility: 'selective', accessOrganisationIds: [b.id] })
    expect((await state()).notice).toBe(false)
    await unpublishLatest(course.courseId)
    await db('CourseVersion').where({ id: course.versionIds[0] }).update({ unpublishedAt: null })
    expect((await state()).notice).toBe(false)
  })

  it('names only the newest version after two publications; update chooses it', async () => {
    await publishNextVersion(course.courseId, { first: video.id })
    const third = await publishNextVersion(course.courseId, { first: video.id })
    expect((await state()).newVersion.versionNumber).toBe(3)
    const response = await useNewVersion(agentB, course.courseId)
    expect(response.status).toBe(200)
    expect((await row()).courseVersionId).toBe(third)
  })
})

describe('POST /update and /keep', () => {
  it('keep: the notice goes, the newer version stays visible; an even newer one gives a notice again (FR-015)', async () => {
    const second = await publishNextVersion(course.courseId, { first: video.id })
    const kept = await keepVersion(agentB, course.courseId)
    expect(kept.status).toBe(200)
    expect(kept.body).toMatchObject({ notice: false, newVersion: { versionNumber: 2 }, version: { versionNumber: 1 } })
    expect((await row()).declinedCourseVersionId).toBe(second)
    expect((await listReferences(agentB)).noticeCount).toBe(0)

    await publishNextVersion(course.courseId, { first: video.id })
    expect((await state())).toMatchObject({ notice: true, newVersion: { versionNumber: 3 } })
  })

  it('update: the live version of this moment, the declined version is forgotten, the Quest follows (FR-014)', async () => {
    const second = await publishNextVersion(course.courseId, { first: video.id })
    await keepVersion(agentB, course.courseId)
    const response = await useNewVersion(agentB, course.courseId)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ version: { versionNumber: 2 }, newVersion: null, notice: false })
    expect(await row()).toMatchObject({ courseVersionId: second, declinedCourseVersionId: null })
    const version = await db('CourseVersion').where({ id: second }).first()
    expect(version.courseId).toBe(course.courseId)
    expect(version.publishedAt).not.toBeNull()
    expect((await questVersions('BBBB2222')).get(course.courseId)).toBe(2)
  })

  it('update without a newer version or when withdrawn: 409 with the state, nothing changes', async () => {
    let response = await useNewVersion(agentB, course.courseId)
    expect(response.status).toBe(409)
    expect(response.body.error).toMatchObject({ code: 'no_newer_version', message: 'Er is geen nieuwere versie om te gebruiken.', reference: { courseId: course.courseId } })

    await publishNextVersion(course.courseId, { first: video.id })
    await db('Course').where({ id: course.courseId }).update({ visibility: 'private' })
    response = await useNewVersion(agentB, course.courseId)
    expect(response.status).toBe(409)
    expect(response.body.error.reference.withdrawn).toBe('no_access')
    expect((await row()).courseVersionId).toBe(course.versionIds[0])
  })

  it('keep without a newer version changes nothing', async () => {
    const response = await keepVersion(agentB, course.courseId)
    expect(response.status).toBe(200)
    expect((await row()).declinedCourseVersionId).toBeNull()
  })

  it('never chooses a version after the owner shut the organisation out (research R8)', async () => {
    for (let i = 0; i < 5; i++) {
      await db('OrganisationCourse').where({ organisationId: b.id, courseId: course.courseId }).update({ courseVersionId: course.versionIds[0] })
      await db('Course').where({ id: course.courseId }).update({ visibility: 'public' })
      await saveRoute(agentA, course.courseId, { first: video.id, name: `Versie ${i}` })
      expect((await publish(agentA, course.courseId)).status).toBe(200)
      const [update, restrict] = await Promise.all([
        useNewVersion(agentB, course.courseId),
        changeAvailability(agentA, course.courseId, { visibility: 'private' }),
      ])
      expect(restrict.status).toBe(200)
      expect([200, 409]).toContain(update.status)
      const chosen = (await row()).courseVersionId
      expect(chosen === course.versionIds[0]).toBe(update.status === 409)
    }
  })
})
