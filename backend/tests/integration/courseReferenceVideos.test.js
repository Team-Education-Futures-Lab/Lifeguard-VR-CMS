import { beforeEach, describe, expect, it } from 'vitest'
import { access } from 'node:fs/promises'
import { runVideoFileCleanup } from '../../src/jobs/videoFileCleanup.js'
import * as videoStorage from '../../src/lib/videoStorage.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase, restrictVideo, softDeleteVideo } from '../helpers/testApp.js'
import { publishedCourse, questGet } from '../helpers/quest.js'
import { publishNextVersion, useNewVersion } from '../helpers/references.js'

// Videos of a chosen version stay in use (specs/010 FR-021, SC-005, research R7).

let a
let b
let agentB
let x
let y
let course

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  x = await createVideoRow({ organisationId: a.id, name: 'X', visibility: 'public' })
  y = await createVideoRow({ organisationId: a.id, name: 'Y', visibility: 'public' })
  course = await publishedCourse({ organisationId: a.id, name: 'Redden', visibility: 'public', versions: [{ first: x.id }] })
  await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
})

const status = async (id) => (await questGet(`/videos/${id}`, 'BBBB2222')).status

describe('videos of a chosen version', () => {
  it('stay downloadable and on disk when the owner replaces and deletes them', async () => {
    await publishNextVersion(course.courseId, { first: y.id })
    await softDeleteVideo(x.id)
    await runVideoFileCleanup()
    await expect(access(videoStorage.getPath(x.storageKey))).resolves.toBeUndefined()
    expect(await status(x.id)).toBe(200)
  })

  it('stay downloadable when the owner restricts them (FR-14)', async () => {
    await restrictVideo(x.id)
    expect(await status(x.id)).toBe(200)
  })

  it('follow the chosen version: after switching, only the new version counts (US5 scenario 3, 4)', async () => {
    await publishNextVersion(course.courseId, { first: y.id })
    expect(await status(y.id)).toBe(404)
    expect((await useNewVersion(agentB, course.courseId)).status).toBe(200)
    expect(await status(y.id)).toBe(200)
    expect(await status(x.id)).toBe(404)
  })
})
