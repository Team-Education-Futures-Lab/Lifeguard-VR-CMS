import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/knex.js'
import { sameContent } from '../../src/lib/courseContent.js'
import { versionContents } from '../../src/modules/courses/courseRepository.js'
import { agentWithSession, createOrganisationRow, createReferenceRow, createVideoRow, resetDatabase } from '../helpers/testApp.js'
import { publishedCourse } from '../helpers/quest.js'
import { copyReference, removeReference, useNewVersion } from '../helpers/references.js'

// "Aanpassen" at the same time as itself and as other actions on the same reference
// (specs/011 FR-005, FR-006, SC-004, Edge Cases; research R3).

let b
let agentB
let course

beforeEach(async () => {
  await resetDatabase()
  const a = await createOrganisationRow({ name: 'Zwembad A', loginCode: 'ZWEMBAD-A' })
  b = await createOrganisationRow({ name: 'Zwembad B', loginCode: 'ZWEMBAD-B' })
  agentB = (await agentWithSession({ organisationId: b.id })).agent
  const video = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  const other = await createVideoRow({ organisationId: a.id, visibility: 'public' })
  course = await publishedCourse({
    organisationId: a.id,
    name: 'Redden',
    visibility: 'public',
    versions: [{ first: video.id }, { first: other.id, questionText: 'Versie twee?' }],
  })
  await createReferenceRow({ organisationId: b.id, courseId: course.courseId, courseVersionId: course.versionIds[0] })
})

const copies = () => db('Course').where({ parentCourseId: course.courseId })
const reference = () => db('OrganisationCourse').where({ organisationId: b.id, courseId: course.courseId }).first()

describe('concurrent "Aanpassen"', () => {
  it('10 requests at once give exactly one copy', async () => {
    const responses = await Promise.all(Array.from({ length: 10 }, () => copyReference(agentB, course.courseId)))
    const created = responses.filter((r) => r.status === 201)
    expect(created).toHaveLength(1)
    const copyId = created[0].body.courseId
    for (const r of responses.filter((r) => r.status !== 201)) {
      expect(r.status).toBe(409)
      expect(r.body.error).toMatchObject({ code: 'course_already_copied', courseId: copyId })
    }
    expect(await copies()).toHaveLength(1)
    expect(await reference()).toBeUndefined()
  })

  it('together with removing: either a copy or nothing, never both or a reference left', async () => {
    const [copy, removed] = await Promise.all([copyReference(agentB, course.courseId), removeReference(agentB, course.courseId)])
    expect(await reference()).toBeUndefined()
    const made = await copies()
    if (copy.status === 201) {
      expect(made).toHaveLength(1)
      expect(removed.status).toBe(404)
    } else {
      expect(copy.status).toBe(404)
      expect(removed.status).toBe(204)
      expect(made).toEqual([])
    }
  })

  it('together with "Nieuwe versie gebruiken": the copy is one whole version', async () => {
    const [copy, update] = await Promise.all([copyReference(agentB, course.courseId), useNewVersion(agentB, course.courseId)])
    expect(copy.status).toBe(201)
    // Never an internal error: either it switched first, or the reference was already gone.
    expect([200, 404]).toContain(update.status)
    expect(await reference()).toBeUndefined()
    const [first] = await db('CourseVersion').where({ courseId: copy.body.courseId, versionNumber: 1 })
    const content = async (id) => {
      const v = await db('CourseVersion').where({ id }).first()
      return { name: v.name, description: v.description, ...(await versionContents([id])).get(id) }
    }
    const copied = await content(first.id)
    const matches = [sameContent(copied, await content(course.versionIds[0])), sameContent(copied, await content(course.versionIds[1]))]
    expect(matches.filter(Boolean)).toHaveLength(1)
  })
})
