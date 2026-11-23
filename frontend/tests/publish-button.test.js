import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { docs } from './editorHarness'
import { jsonResponse } from './helpers'
import { mountCourseEditor, openMenu, publication } from './publishHarness'

// The publish menu next to the status (specs/006 FR-019, FR-020, verbeterronde V2–V5), and a save
// from a draft that was published meanwhile (research R14).

const complete = () => docs.doc(docs.video({ isStart: true }))
const withStatus = (doc, status) => ({ ...doc, status, publication: publication(1), lastPublishedVersionNumber: 1 })
const publishItem = (wrapper) => wrapper.get('[data-test="publish"]')

describe('the publish menu', () => {
  it('says "Publiceren" while the course is not live, and has no "Onpubliceren"', async () => {
    const { wrapper } = await mountCourseEditor(complete())
    expect(wrapper.get('[data-test="publish-menu"]').text()).toBe('Publiceren')
    await openMenu(wrapper)
    expect(publishItem(wrapper).text()).toBe('Publiceren')
    expect(publishItem(wrapper).attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="unpublish"]').exists()).toBe(false)
  })

  it('says "Wijzigingen publiceren" once the course is live, with "Onpubliceren"', async () => {
    const { wrapper } = await mountCourseEditor(withStatus(complete(), 'published_changed'))
    expect(wrapper.get('[data-test="publish-menu"]').text()).toBe('Wijzigingen publiceren')
    await openMenu(wrapper)
    expect(publishItem(wrapper).attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-test="unpublish"]').text()).toBe('Onpubliceren')
  })

  it('greys out publishing when there is nothing new, and says why in the menu only (V3)', async () => {
    const { wrapper } = await mountCourseEditor(withStatus(complete(), 'published'))
    expect(wrapper.find('[data-test="publish-reason"]').exists()).toBe(false)
    await openMenu(wrapper)
    expect(publishItem(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-test="publish-reason"]').text()).toBe('Er is niets nieuws om te publiceren')
    expect(publishItem(wrapper).attributes('aria-describedby')).toBe('publish-reason')
  })

  it('asks to save first when there are unsaved changes (V4)', async () => {
    const { wrapper, calls } = await mountCourseEditor(withStatus(complete(), 'published_changed'))
    wrapper.vm.$.setupState.course.name = 'Andere naam'
    await flushPromises()
    await openMenu(wrapper)
    expect(publishItem(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-test="publish-reason"]').text()).toBe('Sla eerst je wijzigingen op')
    expect(calls.filter((c) => c.action === 'publish' || c.action === 'PUT')).toEqual([])
  })

  it('sits next to the status, before the editing buttons (V5)', async () => {
    const { wrapper } = await mountCourseEditor(complete())
    const bar = wrapper.get('.publication-bar')
    expect(bar.find('[data-test="publication-status"]').exists()).toBe(true)
    expect(bar.find('[data-test="publish-menu"]').exists()).toBe(true)
  })
})

describe('the status in the editor (FR-019)', () => {
  it('follows the answer of a save, without reloading', async () => {
    const doc = withStatus(complete(), 'published')
    const { wrapper } = await mountCourseEditor(doc, { PUT: () => jsonResponse(200, { ...doc, name: 'Andere naam', status: 'published_changed' }) })
    expect(wrapper.get('[data-test="publication-status"]').attributes('data-status')).toBe('published')
    wrapper.vm.$.setupState.course.name = 'Andere naam'
    await flushPromises()
    await wrapper.get('[data-test="save"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="publication-status"]').attributes('data-status')).toBe('published_changed')
    expect(wrapper.get('[data-test="publication-status"]').text()).toContain('Op de Quest: versie 1')
  })
})

describe('a draft that was published meanwhile (research R14)', () => {
  it('shows the message of the server and offers to reload the page', async () => {
    const message = 'Deze cursus is intussen gepubliceerd. Laad de pagina opnieuw om verder te werken.'
    const { wrapper } = await mountCourseEditor(complete(), { PUT: () => jsonResponse(409, { error: { code: 'draft_replaced', message } }) })
    wrapper.vm.$.setupState.course.name = 'Andere naam'
    await flushPromises()
    await wrapper.get('[data-test="save"]').trigger('click')
    await flushPromises()
    const dialog = wrapper.get('[data-test="draft-replaced"]')
    expect(dialog.attributes('role')).toBe('alertdialog')
    expect(dialog.text()).toContain('Cursus is intussen gepubliceerd')
    expect(dialog.text()).toContain(message)
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    await wrapper.get('[data-test="reload"]').trigger('click')
    expect(reload).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
