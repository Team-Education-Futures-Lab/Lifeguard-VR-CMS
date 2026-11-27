import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import AvailabilityPicker from '../src/components/AvailabilityPicker.vue'
import SharedVideosWarningDialog from '../src/components/SharedVideosWarningDialog.vue'
import { ui } from '../src/lib/ui'
import { docs } from './editorHarness'
import { jsonResponse } from './helpers'
import { choose, mountCourseEditor, openMenu, publication } from './publishHarness'

// Sharing a course from the editor (specs/009 US1, US3, US4, US5, contracts/ui.md).

beforeEach(() => ui.toasts.splice(0))

const complete = (availability) => ({ ...docs.doc(docs.video({ isStart: true })), ...(availability ? { availability } : {}) })
const live = (availability, status = 'published_changed') => ({
  ...complete(availability),
  status,
  publication: publication(2),
  lastPublishedVersionNumber: 2,
})
const PUBLIC = { visibility: 'public', accessOrganisations: [] }
const dialog = (wrapper) => wrapper.find('[data-test="publish-dialog"]')
const confirmPublish = async (wrapper) => {
  await wrapper.get('[data-test="publish-confirm"]').trigger('click')
  await flushPromises()
}
const warning = { error: { code: 'shared_videos_warning', message: "Deze cursus bevat video's die niet algemeen beschikbaar zijn.", videos: [{ id: 7, name: 'Eigen video' }, { id: 9, name: 'Van B' }] } }

describe('AvailabilityPicker', () => {
  it('speaks of a course in the course library with subject "course", and of a video otherwise', () => {
    const value = { visibility: 'private', accessOrganisationIds: [] }
    const course = mount(AvailabilityPicker, { props: { modelValue: value, idPrefix: 'c', subject: 'course' } })
    expect(course.text()).toContain('Alle organisaties zien deze cursus in de cursusbibliotheek.')
    expect(course.text()).toContain('Alleen jouw organisatie gebruikt deze cursus. Hij staat niet in de cursusbibliotheek.')
    const video = mount(AvailabilityPicker, { props: { modelValue: value, idPrefix: 'v' } })
    expect(video.text()).toContain('Alle organisaties kunnen deze video zien.')
  })
})

describe('choosing the availability when publishing (US1)', () => {
  it('preselects "Alleen eigen organisatie" for a course that was never published and sends the choice', async () => {
    const { wrapper, calls } = await mountCourseEditor(complete())
    await choose(wrapper, 'publish')
    expect(dialog(wrapper).get('[data-test="visibility-private"]').element.checked).toBe(true)
    expect(dialog(wrapper).find('[data-test="library-note"]').exists()).toBe(false)
    await dialog(wrapper).get('[data-test="visibility-public"]').setValue(true)
    expect(dialog(wrapper).get('[data-test="library-note"]').text()).toBe('De cursus komt ook in de cursusbibliotheek, voor alle organisaties.')
    await confirmPublish(wrapper)
    expect(calls.find((c) => c.action === 'publish').body).toEqual({ visibility: 'public', accessOrganisationIds: [] })
  })

  it('preselects the stored availability with its organisations', async () => {
    const { wrapper } = await mountCourseEditor(complete({ visibility: 'selective', accessOrganisations: [{ id: 5, name: 'Zwembad B' }] }))
    await choose(wrapper, 'publish')
    expect(dialog(wrapper).get('[data-test="visibility-selective"]').element.checked).toBe(true)
    expect(dialog(wrapper).get('[data-test="organisation-5"]').element.checked).toBe(true)
    expect(dialog(wrapper).get('[data-test="library-note"]').text()).toBe('De cursus komt ook in de cursusbibliotheek, voor de gekozen organisaties.')
  })

  it('cannot publish "Selectief beschikbaar" without an organisation', async () => {
    const { wrapper } = await mountCourseEditor(complete())
    await choose(wrapper, 'publish')
    await dialog(wrapper).get('[data-test="visibility-selective"]').setValue(true)
    expect(dialog(wrapper).get('[data-test="no-organisation"]').text()).toBe('Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’.')
    expect(wrapper.get('[data-test="publish-confirm"]').attributes('disabled')).toBeDefined()
  })

  it('asks first when organisations lose a live shared course, and "Annuleren" sends nothing', async () => {
    const { wrapper, calls } = await mountCourseEditor(live(PUBLIC))
    await choose(wrapper, 'publish')
    await dialog(wrapper).get('[data-test="visibility-selective"]').setValue(true)
    await dialog(wrapper).get('[data-test="organisation-5"]').setValue(true)
    await confirmPublish(wrapper)
    expect(wrapper.get('[data-test="restrict-question"]').text()).toBe('2 organisaties kunnen deze cursus daarna niet meer zien in de cursusbibliotheek.')
    await wrapper.get('[data-test="restrict-cancel"]').trigger('click')
    expect(calls.filter((c) => c.action === 'publish')).toEqual([])
    await confirmPublish(wrapper)
    await wrapper.get('[data-test="restrict-confirm"]').trigger('click')
    await flushPromises()
    expect(calls.find((c) => c.action === 'publish').body).toEqual({ visibility: 'selective', accessOrganisationIds: [5] })
  })
})

describe('the warning about restricted videos (US3)', () => {
  it('lists the videos, says what it means, and is an alert dialog', () => {
    const wrapper = mount(SharedVideosWarningDialog, { props: { videos: warning.error.videos }, global: { stubs: { teleport: true } } })
    const box = wrapper.get('[data-test="shared-videos-warning"]')
    expect(box.attributes('role')).toBe('alertdialog')
    expect(box.text()).toContain("Video's die niet algemeen beschikbaar zijn")
    expect(box.text()).toContain('mogen deze video\'s binnen de cursus gebruiken als ze de cursus overnemen')
    expect(wrapper.findAll('[data-test="warning-video"]').map((li) => li.text())).toEqual(['Eigen video', 'Van B'])
  })

  it('"Doorgaan" sends the same choice again with the videos confirmed', async () => {
    let first = true
    const { wrapper, calls } = await mountCourseEditor(complete(), {
      publish: () => {
        if (first) {
          first = false
          return jsonResponse(409, warning)
        }
        return jsonResponse(200, { ...live(PUBLIC, 'published'), draftVersionNumber: 2 })
      },
    })
    await choose(wrapper, 'publish')
    await dialog(wrapper).get('[data-test="visibility-public"]').setValue(true)
    await confirmPublish(wrapper)
    expect(wrapper.findAll('[data-test="warning-video"]')).toHaveLength(2)
    await wrapper.get('[data-test="warning-continue"]').trigger('click')
    await flushPromises()
    expect(calls.filter((c) => c.action === 'publish').map((c) => c.body)).toEqual([
      { visibility: 'public', accessOrganisationIds: [] },
      { visibility: 'public', accessOrganisationIds: [], acknowledgedVideoIds: [7, 9] },
    ])
    expect(wrapper.emitted('published')).toHaveLength(1)
  })

  it('"Annuleren" goes back to the confirmation with the choice still filled in', async () => {
    const { wrapper, calls } = await mountCourseEditor(complete(), { publish: () => jsonResponse(409, warning) })
    await choose(wrapper, 'publish')
    await dialog(wrapper).get('[data-test="visibility-public"]').setValue(true)
    await confirmPublish(wrapper)
    await wrapper.get('[data-test="warning-cancel"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="shared-videos-warning"]').exists()).toBe(false)
    expect(dialog(wrapper).get('[data-test="visibility-public"]').element.checked).toBe(true)
    expect(calls.filter((c) => c.action === 'publish')).toHaveLength(1)
  })
})

describe('"Beschikbaarheid wijzigen" (US4)', () => {
  it('is in the menu only with a live version, also with unsaved changes', async () => {
    const draft = (await mountCourseEditor(complete())).wrapper
    await openMenu(draft)
    expect(draft.find('[data-test="change-availability"]').exists()).toBe(false)
    const { wrapper } = await mountCourseEditor(live(PUBLIC))
    wrapper.vm.$.setupState.course.name = 'Andere naam'
    await flushPromises()
    await openMenu(wrapper)
    expect(wrapper.get('[data-test="change-availability"]').attributes('disabled')).toBeUndefined()
  })

  it('asks before restricting, saves, and keeps the status', async () => {
    const saved = { ...live({ visibility: 'selective', accessOrganisations: [{ id: 5, name: 'Zwembad B' }] }) }
    const { wrapper, calls } = await mountCourseEditor(live(PUBLIC), { availability: () => jsonResponse(200, saved) })
    await choose(wrapper, 'change-availability')
    const box = () => wrapper.get('[data-test="availability-dialog"]')
    expect(box().get('[data-test="visibility-public"]').element.checked).toBe(true)
    await box().get('[data-test="visibility-selective"]').setValue(true)
    await box().get('[data-test="organisation-5"]').setValue(true)
    await wrapper.get('[data-test="availability-save"]').trigger('click')
    expect(wrapper.get('[data-test="restrict-question"]').text()).toBe('2 organisaties kunnen deze cursus daarna niet meer zien in de cursusbibliotheek.')
    await wrapper.get('[data-test="restrict-confirm"]').trigger('click')
    await flushPromises()
    expect(calls.find((c) => c.action === 'availability').body).toEqual({ visibility: 'selective', accessOrganisationIds: [5], acknowledgedVideoIds: [] })
    expect(wrapper.find('[data-test="availability-dialog"]').exists()).toBe(false)
    expect(ui.toasts.map((t) => t.message)).toContain('Beschikbaarheid opgeslagen')
    expect(wrapper.get('[data-test="publication-status"]').attributes('data-status')).toBe('published_changed')
  })

  it('shows the warning when sharing more, and "Doorgaan" confirms the videos', async () => {
    let first = true
    const { wrapper, calls } = await mountCourseEditor(live(), {
      availability: () => {
        if (first) {
          first = false
          return jsonResponse(409, warning)
        }
        return jsonResponse(200, live(PUBLIC))
      },
    })
    await choose(wrapper, 'change-availability')
    await wrapper.get('[data-test="availability-dialog"]').get('[data-test="visibility-public"]').setValue(true)
    await wrapper.get('[data-test="availability-save"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="warning-continue"]').trigger('click')
    await flushPromises()
    expect(calls.filter((c) => c.action === 'availability').map((c) => c.body.acknowledgedVideoIds)).toEqual([[], [7, 9]])
    expect(wrapper.find('[data-test="availability-dialog"]').exists()).toBe(false)
  })
})

describe('unpublishing a shared course (US5)', () => {
  it('says that other organisations no longer see it in the course library', async () => {
    const shared = (await mountCourseEditor(live(PUBLIC, 'published'))).wrapper
    await choose(shared, 'unpublish')
    expect(shared.get('[data-test="unpublish-library-note"]').text()).toBe('Andere organisaties zien hem dan ook niet meer in de cursusbibliotheek.')
    const own = (await mountCourseEditor(live(undefined, 'published'))).wrapper
    await choose(own, 'unpublish')
    expect(own.find('[data-test="unpublish-library-note"]').exists()).toBe(false)
  })
})

// The organisations that took the course over (specs/010 FR-019).
describe('receivers of a taken-over course', () => {
  const RECEIVERS = [{ id: 4, name: 'Brandweer Noord' }, { id: 5, name: 'Zwembad B' }]
  const withReceivers = (availability, status) => ({ ...live(availability, status), receivers: RECEIVERS })

  it('are named in the publish menu', async () => {
    const { wrapper } = await mountCourseEditor(withReceivers(PUBLIC))
    await openMenu(wrapper)
    expect(wrapper.get('[data-test="menu-receivers"]').text()).toBe('Overgenomen door 2 organisaties: Brandweer Noord, Zwembad B')
    const none = (await mountCourseEditor(live(PUBLIC))).wrapper
    await openMenu(none)
    expect(none.find('[data-test="menu-receivers"]').exists()).toBe(false)
  })

  it('are counted when unpublishing', async () => {
    const { wrapper } = await mountCourseEditor(withReceivers(PUBLIC, 'published'))
    await choose(wrapper, 'unpublish')
    expect(wrapper.get('[data-test="unpublish-receivers"]').text()).toBe('2 organisaties hebben deze cursus overgenomen en houden hun huidige versie.')
  })

  it('are counted in the restrict confirmation, only those that lose access', async () => {
    const { wrapper } = await mountCourseEditor(withReceivers(PUBLIC))
    await choose(wrapper, 'change-availability')
    const box = () => wrapper.get('[data-test="availability-dialog"]')
    await box().get('[data-test="visibility-selective"]').setValue(true)
    await box().get('[data-test="organisation-5"]').setValue(true)
    await wrapper.get('[data-test="availability-save"]').trigger('click')
    expect(wrapper.get('[data-test="restrict-receivers"]').text()).toBe('1 daarvan heeft deze cursus overgenomen en houdt haar huidige versie.')
  })

  it('are counted in the restrict confirmation when publishing', async () => {
    const { wrapper } = await mountCourseEditor(withReceivers(PUBLIC))
    await choose(wrapper, 'publish')
    await dialog(wrapper).get('[data-test="visibility-private"]').setValue(true)
    await confirmPublish(wrapper)
    expect(wrapper.get('[data-test="restrict-receivers"]').text()).toBe('2 daarvan hebben deze cursus overgenomen en houden hun huidige versie.')
  })
})
