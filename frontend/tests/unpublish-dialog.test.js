import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { ui } from '../src/lib/ui'
import { docs } from './editorHarness'
import { jsonResponse } from './helpers'
import { choose, mountCourseEditor, openMenu, publication } from './publishHarness'

// "Onpubliceren" in the editor (specs/006 US4, FR-015 – FR-017, contracts/ui.md).

beforeEach(() => ui.toasts.splice(0))

const complete = () => docs.doc(docs.video({ isStart: true }))
const published = (extra = {}) => ({ ...complete(), status: 'published', publication: { ...publication(2), ...extra }, lastPublishedVersionNumber: 2 })
const dialog = (wrapper) => wrapper.find('[data-test="unpublish-dialog"]')

describe('"Onpubliceren" in the publish menu', () => {
  it('is only there with a live version', async () => {
    const draft = (await mountCourseEditor(complete())).wrapper
    await openMenu(draft)
    expect(draft.find('[data-test="unpublish"]').exists()).toBe(false)
    const live = (await mountCourseEditor(published())).wrapper
    await openMenu(live)
    expect(live.find('[data-test="unpublish"]').exists()).toBe(true)
  })
})

describe('the confirmation (FR-015)', () => {
  it('says what happens, and cancelling changes nothing', async () => {
    const { wrapper, calls } = await mountCourseEditor(published())
    await choose(wrapper, 'unpublish')
    expect(dialog(wrapper).attributes('role')).toBe('alertdialog')
    expect(dialog(wrapper).text()).toContain('Cursus onpubliceren?')
    expect(dialog(wrapper).text()).toContain('De cursus is daarna niet meer te downloaden op de VR-brillen.')
    expect(dialog(wrapper).text()).toContain('Brillen die hem al hebben, kunnen hem blijven gebruiken.')
    expect(dialog(wrapper).find('[data-test="unpublish-video-warning"]').exists()).toBe(false)
    await wrapper.get('[data-test="unpublish-cancel"]').trigger('click')
    expect(dialog(wrapper).exists()).toBe(false)
    expect(calls.filter((c) => c.action === 'unpublish')).toEqual([])
  })

  it('warns about a video that is no longer available', async () => {
    const { wrapper } = await mountCourseEditor(published({ hasUnavailableVideo: true }))
    await choose(wrapper, 'unpublish')
    expect(dialog(wrapper).get('[data-test="unpublish-video-warning"]').text()).toBe('Let op: een video in deze cursus is niet meer beschikbaar. Opnieuw publiceren kan pas met een andere video.')
  })
})

describe('after unpublishing', () => {
  it('shows the course as a draft (verbeterronde V6: no extra line)', async () => {
    const after = { ...complete(), status: 'draft', publication: null, lastPublishedVersionNumber: 2 }
    const { wrapper } = await mountCourseEditor(published(), { unpublish: () => jsonResponse(200, after) })
    await choose(wrapper, 'unpublish')
    await wrapper.get('[data-test="unpublish-confirm"]').trigger('click')
    await flushPromises()
    const status = wrapper.get('[data-test="publication-status"]')
    expect(status.attributes('data-status')).toBe('draft')
    expect(status.text()).toBe('Concept')
    expect(wrapper.get('[data-test="saved-flash"]').text()).toBe('Cursus is niet meer gepubliceerd')
    expect(wrapper.get('[data-test="publish-menu"]').text()).toBe('Publiceren')
  })

  it('puts the same version back with its own message (FR-017)', async () => {
    const draft = { ...complete(), status: 'draft', publication: null, lastPublishedVersionNumber: 2 }
    const back = { ...draft, status: 'published', publication: publication(2) }
    const { wrapper } = await mountCourseEditor(draft, { publish: () => jsonResponse(200, back) })
    await choose(wrapper, 'publish')
    await wrapper.get('[data-test="publish-confirm"]').trigger('click')
    await flushPromises()
    // Same draft (same number): the editor stays and only the status changes.
    expect(wrapper.emitted('published')).toBeUndefined()
    expect(wrapper.get('[data-test="saved-flash"]').text()).toBe('Versie 2 staat weer op de VR-brillen')
    expect(wrapper.get('[data-test="publication-status"]').attributes('data-status')).toBe('published')
  })

  it('shows the warning for a video that is no longer available once the live version is gone (FR-012, FR-013)', async () => {
    const gone = { id: 17, name: 'Zwembad', durationSeconds: 60, thumbnailUrl: '/t/17', available: false }
    const step = docs.video({ isStart: true, video: { ...gone, keptByLiveVersion: true } })
    const doc = { ...docs.doc(step), status: 'published', publication: { ...publication(2), hasUnavailableVideo: true }, lastPublishedVersionNumber: 2 }
    const after = { ...docs.doc({ ...step, video: { ...gone, keptByLiveVersion: false } }), status: 'draft', publication: null, lastPublishedVersionNumber: 2 }
    const { wrapper } = await mountCourseEditor(doc, { unpublish: () => jsonResponse(200, after) })
    expect(wrapper.find('[data-test="complete"]').exists()).toBe(true)
    await choose(wrapper, 'unpublish')
    await wrapper.get('[data-test="unpublish-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="todo"]').text()).toBe('1 nog te doen')
  })
})
