import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import TakenOverCourseDialog from '../src/components/TakenOverCourseDialog.vue'
import { ui } from '../src/lib/ui'
import { useCourseReferences } from '../src/stores/courseReferences'
import { jsonResponse } from './helpers'

// The window of a taken-over course (specs/010 US2, US3, US4, contracts/ui.md).

const REFERENCE = {
  courseId: 31,
  name: 'Redden in open water',
  description: 'Stroming.\nGolven.',
  owner: { id: 4, name: 'Brandweer Noord' },
  addedAt: '2026-11-25T10:00:00.000Z',
  version: { versionNumber: 2, publishedAt: '2026-11-20T09:12:00.000Z', stepCount: 14, videoCount: 6 },
  thumbnailUrl: '/api/organisation/course-references/31/thumbnail?v=2',
  newVersion: null,
  notice: false,
  withdrawn: null,
}
const WITH_NOTICE = { ...REFERENCE, newVersion: { versionNumber: 3, publishedAt: '2026-11-27T08:00:00.000Z' }, notice: true }

let calls
function mockApi(handlers = {}) {
  calls = []
  globalThis.fetch.mockImplementation(async (url, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ url, method })
    const key = url.endsWith('/update') ? 'update' : url.endsWith('/keep') ? 'keep' : url.endsWith('/copy') ? 'copy' : method === 'DELETE' ? 'delete' : 'other'
    return handlers[key] ? handlers[key]() : jsonResponse(404, { error: { code: 'not_found', message: 'Niet gevonden.' } })
  })
}

beforeEach(() => {
  ui.toasts.splice(0)
  ui.confirm = null
})

async function mountDialog(reference) {
  const wrapper = mount(TakenOverCourseDialog, { props: { reference }, global: { stubs: { teleport: true } } })
  await flushPromises()
  return wrapper
}
async function answerConfirm(yes) {
  await flushPromises()
  ui.confirm.resolve(yes)
  await flushPromises()
}

describe('TakenOverCourseDialog', () => {
  it('shows the summary of the chosen version, never a way to the editor', async () => {
    mockApi()
    const wrapper = await mountDialog(REFERENCE)
    const text = wrapper.text()
    expect(text).toContain('Overgenomen van Brandweer Noord')
    expect(text).toContain('Stroming.')
    expect(text).toContain("14 onderdelen")
    expect(text).toContain('Toegevoegd op')
    expect(wrapper.get('[data-test="chosen-version"]').text()).toBe('2')
    expect(wrapper.find('a[href^="/courses/"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="version-choice"]').exists()).toBe(false)
  })

  it('removes the course after the confirmation (US2)', async () => {
    mockApi({ delete: () => new Response(null, { status: 204 }) })
    const store = useCourseReferences()
    store.replace(REFERENCE)
    const wrapper = await mountDialog(REFERENCE)
    await wrapper.get('[data-test="remove-reference"]').trigger('click')
    expect(ui.confirm.body).toContain('De cursus van Brandweer Noord zelf blijft bestaan.')
    expect(ui.confirm.body).not.toContain('niet opnieuw toevoegen')
    await answerConfirm(false)
    expect(calls.filter((c) => c.method === 'DELETE')).toEqual([])

    await wrapper.get('[data-test="remove-reference"]').trigger('click')
    await answerConfirm(true)
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1)
    expect(ui.toasts.map((t) => t.message)).toContain('Cursus verwijderd uit jouw cursussen')
    expect(wrapper.emitted('removed')).toEqual([[31]])
    expect(store.references).toEqual([])
  })

  it('says it cannot be added again when withdrawn (US2 scenario 7)', async () => {
    mockApi()
    const wrapper = await mountDialog({ ...REFERENCE, withdrawn: 'no_access' })
    await wrapper.get('[data-test="remove-reference"]').trigger('click')
    expect(ui.confirm.body).toContain('Je kunt hem daarna niet opnieuw toevoegen, omdat hij niet meer in de cursusbibliotheek staat.')
  })

  it('offers both choices with the notice; keeping hides the second button (US3)', async () => {
    mockApi({ keep: () => jsonResponse(200, { ...WITH_NOTICE, notice: false }) })
    const wrapper = await mountDialog(WITH_NOTICE)
    const block = wrapper.get('[data-test="version-choice"]')
    expect(block.text()).toContain('Jullie VR-brillen gebruiken versie 2')
    expect(block.text()).toContain('versie 3')
    await wrapper.get('[data-test="keep-version"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="keep-version"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="use-new-version"]').exists()).toBe(true)
  })

  it('uses the new version with a toast', async () => {
    const updated = { ...REFERENCE, version: { ...REFERENCE.version, versionNumber: 3 } }
    mockApi({ update: () => jsonResponse(200, updated) })
    const wrapper = await mountDialog(WITH_NOTICE)
    await wrapper.get('[data-test="use-new-version"]').trigger('click')
    await flushPromises()
    expect(ui.toasts.map((t) => t.message)).toContain('Jullie VR-brillen krijgen versie 3 bij de volgende synchronisatie.')
    expect(wrapper.get('[data-test="chosen-version"]').text()).toBe('3')
    expect(wrapper.find('[data-test="version-choice"]').exists()).toBe(false)
  })

  it('takes over the state from no_newer_version without an error', async () => {
    const withdrawn = { ...REFERENCE, withdrawn: 'unpublished' }
    mockApi({
      update: () => jsonResponse(409, { error: { code: 'no_newer_version', message: 'Er is geen nieuwere versie om te gebruiken.', reference: withdrawn } }),
    })
    const wrapper = await mountDialog(WITH_NOTICE)
    await wrapper.get('[data-test="use-new-version"]').trigger('click')
    await flushPromises()
    expect(ui.toasts).toEqual([])
    expect(wrapper.get('[data-test="withdrawn"]').text()).toBe('De eigenaar heeft deze cursus ingetrokken. Jullie houden versie 2.')
  })

  it('shows the explanation instead of the choice when withdrawn (US4)', async () => {
    mockApi()
    const wrapper = await mountDialog({ ...WITH_NOTICE, newVersion: null, notice: false, withdrawn: 'course_deleted' })
    expect(wrapper.get('[data-test="withdrawn"]').text()).toBe('De eigenaar heeft deze cursus verwijderd. Jullie houden versie 2.')
    expect(wrapper.find('[data-test="version-choice"]').exists()).toBe(false)
  })

  describe('Aanpassen (specs/011 US1)', () => {
    it.each([null, 'unpublished', 'course_deleted', 'no_access', 'owner_deleted'])('is offered when withdrawn = %s, and with a notice', async (withdrawn) => {
      mockApi()
      const wrapper = await mountDialog({ ...WITH_NOTICE, withdrawn })
      expect(wrapper.get('[data-test="copy-reference"]').text()).toBe('Aanpassen')
    })

    it('asks first; cancelling calls nothing', async () => {
      mockApi()
      const wrapper = await mountDialog(REFERENCE)
      await wrapper.get('[data-test="copy-reference"]').trigger('click')
      expect(ui.confirm.title).toBe('Deze cursus zelf aanpassen?')
      expect(ui.confirm.body).toContain('versie 2 van “Redden in open water”')
      expect(ui.confirm.confirmLabel).toBe('Aanpassen')
      expect([ui.confirm.title, ui.confirm.body, wrapper.text()].join(' ').toLowerCase()).not.toContain('verwijzing')
      await answerConfirm(false)
      expect(calls.filter((c) => c.url.endsWith('/copy'))).toEqual([])
    })

    it('makes the copy, removes the course from the store and emits the copy id', async () => {
      let resolve
      mockApi({ copy: () => new Promise((r) => { resolve = () => r(jsonResponse(201, { courseId: 87 })) }) })
      const store = useCourseReferences()
      store.replace(REFERENCE)
      const wrapper = await mountDialog(REFERENCE)
      await wrapper.get('[data-test="copy-reference"]').trigger('click')
      await answerConfirm(true)
      expect(wrapper.get('[data-test="copy-reference"]').attributes('disabled')).toBeDefined()
      resolve()
      await flushPromises()
      expect(calls.filter((c) => c.url.endsWith('/copy') && c.method === 'POST')).toHaveLength(1)
      expect(wrapper.emitted('copied')).toEqual([[87]])
      expect(store.references).toEqual([])
      expect(ui.toasts.map((t) => t.message)).toContain('Je eigen kopie is klaar. Je kunt hem nu aanpassen.')
    })

    it('reports course_already_copied and asks for a reload', async () => {
      const message = 'Deze cursus is al aangepast. De aangepaste cursus staat bij je cursussen.'
      mockApi({ copy: () => jsonResponse(409, { error: { code: 'course_already_copied', message, courseId: 87 } }) })
      const wrapper = await mountDialog(REFERENCE)
      await wrapper.get('[data-test="copy-reference"]').trigger('click')
      await answerConfirm(true)
      expect(ui.toasts.map((t) => t.message)).toContain(message)
      expect(wrapper.emitted('stale')).toEqual([[31]])
    })

    it('reports a course that is gone (404)', async () => {
      mockApi()
      const wrapper = await mountDialog(REFERENCE)
      await wrapper.get('[data-test="copy-reference"]').trigger('click')
      await answerConfirm(true)
      expect(ui.toasts.map((t) => t.message)).toContain('Deze cursus staat niet meer bij jouw cursussen.')
      expect(wrapper.emitted('stale')).toEqual([[31]])
    })
  })
})
