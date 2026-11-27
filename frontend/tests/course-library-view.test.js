import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { getLibraryCourse, listLibraryCourses } from '../src/api/courseLibrary'
import { ui } from '../src/lib/ui'
import { jsonResponse } from './helpers'
import CourseLibraryView from '../src/views/CourseLibraryView.vue'

// The course library page and its course window (specs/009 US2, US5, contracts/ui.md).

vi.mock('../src/api/courseLibrary', () => ({ listLibraryCourses: vi.fn(), getLibraryCourse: vi.fn() }))

const OWN = { id: 3, name: 'Zwembad A', isOwn: true }
const OTHER = { id: 4, name: 'Brandweer Noord', isOwn: false }

const COURSES = [
  {
    id: 11, name: 'Redden in open water', description: 'Stroming en golven.\nVoor gevorderden.', owner: OTHER,
    versionNumber: 3, publishedAt: '2026-11-20T09:12:00.000Z', stepCount: 14, videoCount: 6,
    thumbnailUrl: '/api/organisation/course-library/11/thumbnail',
  },
  {
    id: 12, name: 'Duiken', description: null, owner: OWN, versionNumber: 1, publishedAt: '2026-11-22T10:00:00.000Z',
    stepCount: 1, videoCount: 1, thumbnailUrl: null, visibility: 'selective', accessOrganisations: [{ id: 4, name: 'Brandweer Noord' }],
  },
]

beforeEach(() => {
  vi.mocked(listLibraryCourses).mockReset().mockResolvedValue(COURSES)
  vi.mocked(getLibraryCourse).mockReset().mockImplementation(async (id) => COURSES.find((c) => c.id === id))
  ui.toasts.length = 0
})

async function mountView() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)', component: { template: '<div />' } }] })
  await router.push('/course-library')
  const wrapper = mount(CourseLibraryView, { global: { plugins: [router], stubs: { Teleport: true } } })
  await flushPromises()
  return wrapper
}
const cards = (wrapper) => wrapper.findAll('[data-test="library-course"]')

describe('the course library', () => {
  it('shows each course with image, name, owner, version, date and counts', async () => {
    const wrapper = await mountView()
    const [first, second] = cards(wrapper)
    expect(first.text()).toContain('Duiken')
    expect(first.get('[data-test="owner"]').text()).toBe('Eigen')
    expect(first.find('[data-test="placeholder"]').exists()).toBe(true)
    expect(first.text()).toContain('1 onderdeel · 1 video')
    expect(second.get('img').attributes('src')).toBe('/api/organisation/course-library/11/thumbnail')
    expect(second.get('[data-test="owner"]').text()).toBe('Brandweer Noord')
    expect(second.text()).toContain('Versie 3')
    expect(second.text()).toContain("14 onderdelen · 6 video's")
    expect(second.get('[data-test="description"]').text()).toContain('Stroming en golven.')
  })

  it('filters on the organisation of a clicked pill, and the label clears it', async () => {
    const wrapper = await mountView()
    await cards(wrapper)[1].get('[data-test="owner"]').trigger('click')
    expect(wrapper.get('[data-test="owner-filter"]').text()).toContain('Organisatie: Brandweer Noord')
    expect(cards(wrapper)).toHaveLength(1)
    await wrapper.get('[data-test="owner-filter"]').trigger('click')
    expect(cards(wrapper)).toHaveLength(2)
  })

  it('says when nothing is found, and clears search and filters', async () => {
    const wrapper = await mountView()
    await wrapper.get('[data-test="search"]').setValue('bestaat niet')
    expect(wrapper.get('[data-test="no-results"]').text()).toContain('Geen cursussen gevonden')
    await wrapper.get('[data-test="clear-filters"]').trigger('click')
    expect(cards(wrapper)).toHaveLength(2)
  })

  it('says when there are no shared courses yet', async () => {
    vi.mocked(listLibraryCourses).mockResolvedValue([])
    const wrapper = await mountView()
    expect(wrapper.get('[data-test="library-empty"]').text()).toBe('Er zijn nog geen gedeelde cursussen.')
  })

  it('keeps search and filters after the course window was opened and closed', async () => {
    const wrapper = await mountView()
    await wrapper.get('[data-test="search"]').setValue('redden')
    await wrapper.get('[data-test="ownership-others"]').trigger('click')
    await cards(wrapper)[0].get('button.open').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="library-details"]').exists()).toBe(true)
    await wrapper.get('[data-test="details-close"]').trigger('click')
    expect(wrapper.find('[data-test="library-details"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="search"]').element.value).toBe('redden')
    expect(wrapper.get('[data-test="ownership-others"]').attributes('aria-pressed')).toBe('true')
    expect(cards(wrapper)).toHaveLength(1)
  })

  it('removes a course that is no longer available, with a message (US5)', async () => {
    vi.mocked(getLibraryCourse).mockRejectedValue(Object.assign(new Error('Niet gevonden.'), { status: 404 }))
    const wrapper = await mountView()
    await cards(wrapper)[1].get('button.open').trigger('click')
    await flushPromises()
    expect(ui.toasts.map((t) => t.message)).toEqual(['Deze cursus is niet meer beschikbaar.'])
    expect(wrapper.find('[data-test="library-details"]').exists()).toBe(false)
    expect(cards(wrapper)).toHaveLength(1)
  })
})

describe('the course window', () => {
  it('shows another organisation only the summary and "Sluiten"', async () => {
    const wrapper = await mountView()
    await cards(wrapper)[1].get('button.open').trigger('click')
    await flushPromises()
    const details = wrapper.get('[data-test="library-details"]')
    expect(details.get('[data-test="details-description"]').text()).toBe('Stroming en golven.\nVoor gevorderden.')
    expect(details.text()).toContain('14 onderdelen')
    expect(details.find('[data-test="details-availability"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="open-editor"]').exists()).toBe(false)
  })

  it('shows the owner the availability and a way to the editor', async () => {
    const wrapper = await mountView()
    await cards(wrapper)[0].get('button.open').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="details-availability"]').text()).toBe('Selectief beschikbaar: Brandweer Noord')
    expect(wrapper.get('[data-test="open-editor"]').attributes('href')).toBe('/courses/12')
  })
})

// Adding a course to the own organisation (specs/010 US1) and the receivers for the owner (FR-019).
describe('taking over a course', () => {
  const openWindow = async (wrapper, name) => {
    await cards(wrapper).find((card) => card.text().includes(name)).get('button.open').trigger('click')
    await flushPromises()
  }
  const answer = async (yes) => {
    await flushPromises()
    ui.confirm.resolve(yes)
    await flushPromises()
  }
  const posts = () => globalThis.fetch.mock.calls.filter(([url, options]) => url === '/api/organisation/course-references' && options?.method === 'POST')

  it('adds a course of another organisation after the confirmation', async () => {
    globalThis.fetch.mockImplementation(async () => jsonResponse(201, { courseId: 11, name: 'Redden in open water', notice: false }))
    const wrapper = await mountView()
    await openWindow(wrapper, 'Redden in open water')
    await wrapper.get('[data-test="add-course"]').trigger('click')
    expect(ui.confirm.title).toBe('Cursus toevoegen aan jouw organisatie?')
    expect(ui.confirm.body).toContain('van Brandweer Noord komt bij jouw cursussen en wordt te downloaden op de VR-brillen')
    // Changed by specs/011: a taken-over course can be adapted as an own copy.
    expect(ui.confirm.body).toContain('De cursus blijft van Brandweer Noord. Wil je hem aanpassen, dan maak je later een eigen kopie.')
    expect(ui.confirm.body.toLowerCase()).not.toContain('verwijzing')
    await answer(false)
    expect(posts()).toEqual([])

    await wrapper.get('[data-test="add-course"]').trigger('click')
    await answer(true)
    expect(JSON.parse(posts()[0][1].body)).toEqual({ courseId: 11 })
    expect(ui.toasts.map((t) => t.message)).toContain('Cursus toegevoegd aan jouw cursussen')
    expect(wrapper.find('[data-test="add-course"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="course-added"]').length).toBeGreaterThan(0)
  })

  it('shows the hint when the organisation already has an own copy (specs/011 FR-021)', async () => {
    vi.mocked(getLibraryCourse).mockImplementation(async (id) => ({ ...COURSES.find((c) => c.id === id), hasCopy: id === 11 }))
    const wrapper = await mountView()
    await openWindow(wrapper, 'Redden in open water')
    expect(wrapper.get('[data-test="has-copy-hint"]').text()).toBe('Jullie hebben al een aangepaste kopie van deze cursus.')
    expect(wrapper.find('[data-test="add-course"]').exists()).toBe(true)
    expect(wrapper.text().toLowerCase()).not.toContain('verwijzing')
  })

  it('shows no hint without an own copy', async () => {
    const wrapper = await mountView()
    await openWindow(wrapper, 'Redden in open water')
    expect(wrapper.find('[data-test="has-copy-hint"]').exists()).toBe(false)
  })

  it('reloads the library when the course is no longer available', async () => {
    globalThis.fetch.mockImplementation(async () => jsonResponse(404, { error: { code: 'not_found', message: 'Niet gevonden.' } }))
    const wrapper = await mountView()
    await openWindow(wrapper, 'Redden in open water')
    await wrapper.get('[data-test="add-course"]').trigger('click')
    await answer(true)
    expect(ui.toasts.map((t) => t.message)).toContain('Deze cursus is niet meer beschikbaar.')
    expect(vi.mocked(listLibraryCourses)).toHaveBeenCalledTimes(2)
  })

  it('shows "Toegevoegd" instead of the button for a course already taken over', async () => {
    const taken = COURSES.map((c) => (c.id === 11 ? { ...c, takenOver: true } : c))
    vi.mocked(listLibraryCourses).mockResolvedValue(taken)
    vi.mocked(getLibraryCourse).mockImplementation(async (id) => taken.find((c) => c.id === id))
    const wrapper = await mountView()
    expect(cards(wrapper)[1].find('[data-test="course-added"]').exists()).toBe(true)
    await openWindow(wrapper, 'Redden in open water')
    expect(wrapper.find('[data-test="add-course"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="view-taken-over"]').exists()).toBe(true)
  })

  it('shows the owner who took a course over, and no button', async () => {
    const own = COURSES.map((c) => (c.id === 12 ? { ...c, receivers: [{ id: 4, name: 'Brandweer Noord' }] } : c))
    vi.mocked(getLibraryCourse).mockImplementation(async (id) => own.find((c) => c.id === id))
    const wrapper = await mountView()
    await openWindow(wrapper, 'Duiken')
    expect(wrapper.get('[data-test="details-receivers"]').text()).toBe('1 organisatie: Brandweer Noord')
    expect(wrapper.find('[data-test="add-course"]').exists()).toBe(false)
  })
})
