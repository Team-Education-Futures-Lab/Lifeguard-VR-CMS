import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { ui } from '../src/lib/ui'
import { docs } from './editorHarness'
import { jsonResponse } from './helpers'
import { choose, mountCourseEditor, publication } from './publishHarness'

// "Publiceren" in the editor (specs/006 US1, US2, FR-003, FR-007, contracts/ui.md, verbeterronde V1, V4).

beforeEach(() => ui.toasts.splice(0))

/** A complete course: a video step that is start and end. */
const complete = () => docs.doc(docs.video({ isStart: true }))
const withStatus = (doc, status, versionNumber = 1) => ({ ...doc, status, publication: publication(versionNumber), lastPublishedVersionNumber: versionNumber })

const dialog = (wrapper) => wrapper.find('[data-test="publish-dialog"]')

describe('the confirmation (FR-003)', () => {
  it('says what happens the first time, and cancelling changes nothing', async () => {
    const { wrapper, calls } = await mountCourseEditor(complete())
    await choose(wrapper, 'publish')
    expect(dialog(wrapper).attributes('data-mode')).toBe('confirm')
    expect(dialog(wrapper).text()).toContain('Publiceren?')
    expect(dialog(wrapper).text()).toContain('De cursus wordt beschikbaar voor de VR-brillen van jullie organisatie.')
    expect(wrapper.get('[data-test="publish-confirm"]').text()).toBe('Publiceren')
    await wrapper.get('[data-test="publish-cancel"]').trigger('click')
    expect(dialog(wrapper).exists()).toBe(false)
    expect(calls.filter((c) => c.action === 'publish')).toEqual([])
  })

  it('speaks of publishing changes when the course is live', async () => {
    const { wrapper } = await mountCourseEditor(withStatus(complete(), 'published_changed', 3))
    await choose(wrapper, 'publish')
    expect(dialog(wrapper).text()).toContain('Wijzigingen publiceren?')
    expect(dialog(wrapper).text()).toContain('Ze vervangen wat daar nu staat (versie 3).')
    expect(wrapper.get('[data-test="publish-confirm"]').text()).toBe('Wijzigingen publiceren')
  })
})

describe('after publishing', () => {
  it('hands the new draft to the view, with "Gepubliceerd als versie 1"', async () => {
    const next = withStatus({ ...complete(), draftVersionNumber: 2 }, 'published')
    const { wrapper, calls } = await mountCourseEditor(complete(), { publish: () => jsonResponse(200, next) })
    await choose(wrapper, 'publish')
    await wrapper.get('[data-test="publish-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('published')).toEqual([[next, 'Gepubliceerd als versie 1']])
    // Publishing never saves: it works on the saved draft (verbeterronde V4).
    expect(calls.map((c) => c.action).filter((a) => a !== 'GET' && a !== 'organisations')).toEqual(['publish'])
  })

  it('shows the message it was given right away (after the view loaded the new draft)', async () => {
    const { wrapper } = await mountCourseEditor(withStatus(complete(), 'published'), {}, { notice: 'Gepubliceerd als versie 1' })
    expect(wrapper.get('[data-test="saved-flash"]').text()).toBe('Gepubliceerd als versie 1')
    expect(wrapper.get('[data-test="publication-status"]').attributes('data-status')).toBe('published')
  })

  it('shows an error and changes nothing when the request fails', async () => {
    const { wrapper } = await mountCourseEditor(complete(), {
      publish: () => jsonResponse(500, { error: { code: 'internal_error', message: 'Er ging iets mis.' } }),
    })
    await choose(wrapper, 'publish')
    await wrapper.get('[data-test="publish-confirm"]').trigger('click')
    await flushPromises()
    expect(ui.toasts.map((t) => t.message)).toContain('Publiceren is niet gelukt. Probeer het opnieuw.')
    expect(wrapper.emitted('published')).toBeUndefined()
  })
})

describe('"Nog niet klaar om te publiceren" (US2, FR-007, verbeterronde V1)', () => {
  const incomplete = () => docs.doc(docs.video({ isStart: true, videoId: null, video: null }))

  it('opens straight away with the messages of the editor, grouped as "nog te doen", without a request', async () => {
    const { wrapper, calls } = await mountCourseEditor(incomplete())
    await choose(wrapper, 'publish')
    expect(dialog(wrapper).attributes('data-mode')).toBe('issues')
    expect(dialog(wrapper).text()).toContain('Nog niet klaar om te publiceren')
    expect(dialog(wrapper).find('[data-group="videos"] [data-test="group-head"]').text()).toContain('Video-onderdelen zonder video')
    expect(dialog(wrapper).findAll('[data-test="todo-item"] .msg').map((i) => i.text())).toEqual(['Kies een video'])
    expect(calls.filter((c) => c.action === 'publish')).toEqual([])
  })

  it('closes and opens the step when a message is clicked', async () => {
    const { wrapper } = await mountCourseEditor(incomplete())
    await choose(wrapper, 'publish')
    await dialog(wrapper).get('[data-test="todo-item"]').trigger('click')
    expect(dialog(wrapper).exists()).toBe(false)
  })

  it('shows the messages of the server', async () => {
    const doc = complete()
    const stepId = doc.steps[0].id
    const { wrapper } = await mountCourseEditor(doc, {
      publish: () =>
        jsonResponse(422, {
          error: {
            code: 'course_incomplete',
            message: 'De cursus is nog niet klaar om te publiceren.',
            issues: [{ code: 'videoUnavailable', message: 'Video niet meer beschikbaar: kies een andere.', stepId }],
          },
        }),
    })
    await choose(wrapper, 'publish')
    await wrapper.get('[data-test="publish-confirm"]').trigger('click')
    await flushPromises()
    expect(dialog(wrapper).attributes('data-mode')).toBe('issues')
    expect(dialog(wrapper).get('[data-test="todo-item"]').text()).toContain('Video niet meer beschikbaar: kies een andere.')
    await wrapper.get('[data-test="publish-close"]').trigger('click')
    expect(dialog(wrapper).exists()).toBe(false)
  })
})

describe('an own copy of a taken-over course (specs/011 FR-012, FR-013)', () => {
  const copy = () => ({ ...complete(), basedOn: { courseName: 'Redden', ownerName: 'Brandweer Noord' } })

  it('shows "Gebaseerd op" in the header', async () => {
    const { wrapper } = await mountCourseEditor(copy())
    expect(wrapper.get('[data-test="editor-based-on"]').text()).toBe('Gebaseerd op Redden van Brandweer Noord')
  })

  it('has no availability choice and sends none', async () => {
    const { wrapper, calls } = await mountCourseEditor(copy(), { publish: () => jsonResponse(200, { ...copy(), status: 'published', publication: publication(1), lastPublishedVersionNumber: 1 }) })
    await choose(wrapper, 'publish')
    expect(dialog(wrapper).find('[data-test="copy-not-shared"]').text()).toBe('Een aangepaste cursus is alleen voor jouw organisatie en kan niet gedeeld worden.')
    expect(dialog(wrapper).find('input[type="radio"]').exists()).toBe(false)
    expect(dialog(wrapper).find('[data-test="library-note"]').exists()).toBe(false)
    await wrapper.get('[data-test="publish-confirm"]').trigger('click')
    await flushPromises()
    const [sent] = calls.filter((c) => c.action === 'publish')
    expect(sent.body?.visibility).toBeUndefined()
  })

  it('has no "Beschikbaarheid wijzigen" in the menu when live', async () => {
    const { wrapper } = await mountCourseEditor(withStatus(copy(), 'published', 1))
    await wrapper.get('[data-test="publish-menu"]').trigger('click')
    expect(wrapper.find('[data-test="change-availability"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="unpublish"]').exists()).toBe(true)
  })

  it('a normal course keeps the choice and the header has no "Gebaseerd op"', async () => {
    const { wrapper } = await mountCourseEditor(withStatus(complete(), 'published', 1))
    expect(wrapper.find('[data-test="editor-based-on"]').exists()).toBe(false)
    await wrapper.get('[data-test="publish-menu"]').trigger('click')
    expect(wrapper.find('[data-test="change-availability"]').exists()).toBe(true)
  })
})
