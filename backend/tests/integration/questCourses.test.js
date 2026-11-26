import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { createCourseRow, createOrganisationRow, createVideoRow, resetDatabase, softDeleteVideo } from '../helpers/testApp.js'
import { publishedCourse, questGet } from '../helpers/quest.js'

// The list of courses a Quest can download (specs/007 US2, FR-007, FR-009, FR-010, SC-004).

const CODE = 'QZ7K2M9X'
let a
let b
let small
let large

beforeEach(async () => {
  await resetDatabase()
  a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A', questLinkCode: CODE })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B', questLinkCode: 'BBBB2222' })
  small = await createVideoRow({ organisationId: a.id, fileSizeBytes: 1000 })
  large = await createVideoRow({ organisationId: a.id, fileSizeBytes: 5000 })
})

const list = async (code = CODE) => (await questGet('/courses', code)).body.courses

describe('GET /api/quest/v1/courses', () => {
  it('shows exactly the live courses of the own organisation (SC-004)', async () => {
    await createCourseRow({ organisationId: a.id, name: 'Alleen concept' })
    const live = await publishedCourse({ organisationId: a.id, name: 'Gepubliceerd', versions: [{ first: small.id }] })
    await publishedCourse({ organisationId: a.id, name: 'Onpubliceerd', versions: [{ first: small.id, unpublishedAt: new Date() }] })
    await publishedCourse({ organisationId: a.id, name: 'Verwijderd', versions: [{ first: small.id }], deletedAt: new Date() })
    await publishedCourse({ organisationId: b.id, name: 'Van B', versions: [{ first: small.id }] })

    const courses = await list()
    expect(courses.map((course) => course.id)).toEqual([live.courseId])
    expect(Object.keys(courses[0]).sort()).toEqual([
      'description',
      'downloadSizeBytes',
      'id',
      'name',
      'publishedAt',
      'thumbnailUrl',
      'versionNumber',
    ])
    // specs/008 FR-006: the address carries the version number of the live version.
    expect(courses[0].thumbnailUrl).toBe(`/api/quest/v1/courses/${live.courseId}/thumbnail?v=1`)
    expect(courses[0]).toMatchObject({
      name: 'Gepubliceerd',
      description: 'Beschrijving van Gepubliceerd',
      versionNumber: 1,
      publishedAt: '2026-11-20T10:00:00.000Z',
    })
  })

  it('shows the live version, not the changed draft, and the newest version number', async () => {
    const course = await publishedCourse({
      organisationId: a.id,
      name: 'Cursus',
      versions: [{ first: small.id }, { first: large.id, name: 'Cursus v2' }],
    })
    await db('CourseVersion').where({ id: course.draftVersionId }).update({ name: 'Nog niet gepubliceerd' })
    const [row] = await list()
    expect(row).toMatchObject({ id: course.courseId, name: 'Cursus v2', versionNumber: 2, publishedAt: '2026-11-21T10:00:00.000Z' })
  })

  it('is empty for an organisation without live courses', async () => {
    await publishedCourse({ organisationId: a.id, versions: [{ first: small.id }] })
    expect(await list('BBBB2222')).toEqual([])
  })

  it('sorts on name, case-insensitive', async () => {
    for (const name of ['beta', 'Alfa', 'Gamma']) await publishedCourse({ organisationId: a.id, name, versions: [{ first: small.id }] })
    expect((await list()).map((course) => course.name)).toEqual(['Alfa', 'beta', 'Gamma'])
  })

  it('counts every video once plus the content, also a deleted video (FR-010, SC-006)', async () => {
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: small.id, second: large.id }] })
    await softDeleteVideo(large.id)
    const [row] = await list()
    const download = await questGet(`/courses/${course.courseId}`, CODE)
    expect(download.status).toBe(200)
    expect(row.downloadSizeBytes).toBe(1000 + 5000 + Buffer.byteLength(download.text, 'utf8'))
  })

  it('counts a video used twice only once', async () => {
    const course = await publishedCourse({ organisationId: a.id, versions: [{ first: small.id, second: small.id }] })
    const [row] = await list()
    const download = await questGet(`/courses/${course.courseId}`, CODE)
    expect(row.downloadSizeBytes).toBe(1000 + Buffer.byteLength(download.text, 'utf8'))
  })

  it('does not show courses that another organisation shares in the course library (specs/009 FR-026)', async () => {
    const videoOfB = await createVideoRow({ organisationId: b.id, visibility: 'public' })
    const shared = await publishedCourse({ organisationId: b.id, visibility: 'public', versions: [{ first: videoOfB.id }] })
    expect(await list()).toEqual([])
    expect((await questGet(`/courses/${shared.courseId}`, CODE)).status).toBe(404)
  })

  it('asks to link again without a link code', async () => {
    const res = await questGet('/courses', null)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('relink_required')
  })
})
