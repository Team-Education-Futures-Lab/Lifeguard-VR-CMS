import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import CoursesView from '../src/views/CoursesView.vue'
import { ui } from '../src/lib/ui'
import { jsonResponse } from './helpers'

// The course list (specs/004 US1, contracts/ui.md § Cursussen).

const COURSE = {
  id: 12,
  name: 'Redding in het diepe bad',
  updatedAt: new Date().toISOString(),
  videoStepCount: 1,
  questionStepCount: 2,
  status: 'draft',
  visibility: 'private',
}

/** Answers the API calls of the view; `post` handles POST /courses. */
function mockApi({ courses = [], post } = {}) {
  globalThis.fetch.mockImplementation(async (url, options = {}) => {
    if (url === '/api/organisation/courses' && (options.method ?? 'GET') === 'GET') return jsonResponse(200, { courses })
    if (url === '/api/organisation/courses' && options.method === 'POST') return post(JSON.parse(options.body))
    if (url.startsWith('/api/organisation/courses/') && options.method === 'DELETE') return new Response(null, { status: 204 })
    return jsonResponse(404, { error: { code: 'not_found', message: 'Niet gevonden.' } })
  })
}

async function mountView() {
  const Blank = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/courses', component: CoursesView },
      { path: '/courses/:id', component: Blank },
    ],
  })
  await router.push('/courses')
  const wrapper = mount(CoursesView, { global: { plugins: [router], stubs: { teleport: true } }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router }
}

const posts = () => globalThis.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')

describe('CoursesView', () => {
  it('shows the empty state with a button for the first course', async () => {
    mockApi()
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Er zijn nog geen cursussen.')
    expect(wrapper.text()).toContain('Maak de eerste cursus')
    wrapper.unmount()
  })

  it('shows each course with its counts and the status Concept', async () => {
    mockApi({ courses: [COURSE] })
    const { wrapper } = await mountView()
    const row = wrapper.find('.row')
    expect(row.text()).toContain('Redding in het diepe bad')
    expect(row.text()).toContain('1 video · 2 vragen')
    expect(row.text()).toContain('Concept')
    expect(row.text()).not.toContain('te doen')
    wrapper.unmount()
  })

  it('shows a load error with a retry button', async () => {
    globalThis.fetch.mockResolvedValue(jsonResponse(500, { error: { code: 'internal_error', message: 'Er ging iets mis.' } }))
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('De cursussen konden niet worden geladen.')
    mockApi({ courses: [COURSE] })
    await wrapper.findAll('button').find((b) => b.text() === 'Opnieuw').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Redding in het diepe bad')
    wrapper.unmount()
  })

  it('does not create a course with empty fields and marks them', async () => {
    mockApi({ post: () => jsonResponse(201, {}) })
    const { wrapper } = await mountView()
    await wrapper.findAll('button').find((b) => b.text().includes('Nieuwe cursus')).trigger('click')
    await wrapper.find('form#new-course').trigger('submit')
    await flushPromises()
    expect(posts()).toHaveLength(0)
    expect(wrapper.find('[data-test="create-error"]').text()).toBe('Vul een naam en een beschrijving in.')
    expect(wrapper.find('[data-test="course-name"]').classes()).toContain('invalid')
    expect(wrapper.find('[data-test="course-description"]').classes()).toContain('invalid')
    wrapper.unmount()
  })

  it('creates the course and opens the editor', async () => {
    mockApi({ post: (body) => jsonResponse(201, { id: 31, ...body, status: 'draft', steps: [] }) })
    const { wrapper, router } = await mountView()
    await wrapper.findAll('button').find((b) => b.text().includes('Nieuwe cursus')).trigger('click')
    await wrapper.find('[data-test="course-name"]').setValue('  Nieuwe cursus  ')
    await wrapper.find('[data-test="course-description"]').setValue('Uitleg')
    await wrapper.find('form#new-course').trigger('submit')
    await flushPromises()
    expect(JSON.parse(posts()[0][1].body)).toEqual({ name: 'Nieuwe cursus', description: 'Uitleg' })
    expect(router.currentRoute.value.path).toBe('/courses/31')
    wrapper.unmount()
  })

  it('shows the counters and the server message for a name that is too long', async () => {
    mockApi({
      post: () =>
        jsonResponse(400, {
          error: { code: 'validation_failed', message: 'Controleer de ingevulde gegevens.', fields: { name: 'De naam mag maximaal 255 tekens lang zijn.' } },
        }),
    })
    const { wrapper } = await mountView()
    await wrapper.findAll('button').find((b) => b.text().includes('Nieuwe cursus')).trigger('click')
    expect(wrapper.find('[data-test="course-name-counter"]').text()).toBe('255 tekens over')
    expect(wrapper.find('[data-test="course-description-counter"]').text()).toBe('1000 tekens over')
    await wrapper.find('[data-test="course-name"]').setValue('Naam')
    await wrapper.find('[data-test="course-description"]').setValue('Uitleg')
    await wrapper.find('form#new-course').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-test="create-error"]').text()).toBe('De naam mag maximaal 255 tekens lang zijn.')
    wrapper.unmount()
  })
})

describe('deleting a course (US5)', () => {
  it('asks first and only deletes after confirming', async () => {
    mockApi({ courses: [COURSE] })
    const { wrapper } = await mountView()
    const deletes = () => globalThis.fetch.mock.calls.filter(([, options]) => options?.method === 'DELETE')

    await wrapper.find('button[title="Verwijderen"]').trigger('click')
    expect(ui.confirm).toMatchObject({ title: 'Cursus verwijderen?', body: '“Redding in het diepe bad” wordt verwijderd.', confirmLabel: 'Verwijderen' })
    ui.confirm.resolve(false)
    await flushPromises()
    expect(deletes()).toHaveLength(0)
    expect(wrapper.find('.row').exists()).toBe(true)

    await wrapper.find('button[title="Verwijderen"]').trigger('click')
    ui.confirm.resolve(true)
    await flushPromises()
    expect(deletes()[0][0]).toBe('/api/organisation/courses/12')
    expect(wrapper.find('.row').exists()).toBe(false)
    expect(ui.toasts.at(-1).message).toBe('Cursus verwijderd')
    wrapper.unmount()
  })
})

// The publication status per course (specs/006 US5, FR-018, FR-019, FR-021).
describe('CoursesView: publication status', () => {
  const publication = (versionNumber) => ({ versionNumber, publishedAt: '2026-11-23T13:05:00.000Z', hasUnavailableVideo: false })
  const rowsOf = (wrapper) => wrapper.findAll('.row')

  it('shows draft, published and published with changes as text, with version and date', async () => {
    mockApi({
      courses: [
        { ...COURSE, id: 1, name: 'Nooit', status: 'draft', publication: null, lastPublishedVersionNumber: null },
        { ...COURSE, id: 2, name: 'Eerder', status: 'draft', publication: null, lastPublishedVersionNumber: 2 },
        { ...COURSE, id: 3, name: 'Live', status: 'published', publication: publication(2), lastPublishedVersionNumber: 2 },
        { ...COURSE, id: 4, name: 'Gewijzigd', status: 'published_changed', publication: publication(1), lastPublishedVersionNumber: 1 },
      ],
    })
    const { wrapper } = await mountView()
    const statuses = rowsOf(wrapper).map((row) => row.get('[data-test="publication-status"]'))
    expect(statuses.map((s) => s.attributes('data-status'))).toEqual(['draft', 'draft', 'published', 'published_changed'])
    expect(statuses[0].text()).toBe('Concept')
    expect(statuses[1].text()).toBe('Concept')
    expect(statuses[2].text()).toContain('Gepubliceerd')
    expect(statuses[2].text()).toMatch(/Versie 2 · \d+ november 2026 om \d\d:05/)
    expect(statuses[3].text()).toContain('Gepubliceerd · wijzigingen nog niet gepubliceerd')
    expect(statuses[3].text()).toContain('Op de Quest: versie 1')
    wrapper.unmount()
  })

  it('says that a published course also goes off the VR headsets when it is deleted', async () => {
    mockApi({ courses: [{ ...COURSE, status: 'published', publication: publication(1), lastPublishedVersionNumber: 1 }] })
    const { wrapper } = await mountView()
    await wrapper.find('button[title="Verwijderen"]').trigger('click')
    expect(ui.confirm.body).toBe(
      '“Redding in het diepe bad” wordt verwijderd. Deze cursus is gepubliceerd. Na verwijderen is hij niet meer te downloaden op de VR-brillen.',
    )
    ui.confirm.resolve(false)
    wrapper.unmount()
  })
})

// Who sees a course in the course library (specs/009 contracts/ui.md § Status en overzicht, FR-025).
describe('CoursesView: availability', () => {
  const publication = { versionNumber: 1, publishedAt: '2026-11-23T13:05:00.000Z', hasUnavailableVideo: false }

  it('shows the availability of a published course as text, and nothing for a draft', async () => {
    mockApi({
      courses: [
        { ...COURSE, id: 1, name: 'Concept', visibility: 'public' },
        { ...COURSE, id: 2, name: 'Eigen', status: 'published', publication, visibility: 'private' },
        { ...COURSE, id: 3, name: 'Algemeen', status: 'published', publication, visibility: 'public' },
        { ...COURSE, id: 4, name: 'Selectief', status: 'published_changed', publication, visibility: 'selective' },
      ],
    })
    const { wrapper } = await mountView()
    const labels = wrapper.findAll('.row').map((row) => row.find('[data-test="course-availability"]'))
    expect(labels[0].exists()).toBe(false)
    expect(labels.slice(1).map((label) => label.text())).toEqual(['Alleen eigen organisatie', 'Algemeen beschikbaar', 'Selectief beschikbaar'])
    wrapper.unmount()
  })

  it('says that a shared course also leaves the course library when it is deleted', async () => {
    mockApi({ courses: [{ ...COURSE, status: 'published', publication, visibility: 'public' }] })
    const { wrapper } = await mountView()
    await wrapper.find('button[title="Verwijderen"]').trigger('click')
    expect(ui.confirm.body).toContain('Andere organisaties zien hem dan ook niet meer in de cursusbibliotheek.')
    ui.confirm.resolve(false)
    wrapper.unmount()
  })
})

// Taken-over courses in the overview (specs/010 US2 – US4, contracts/ui.md § Cursusoverzicht).
describe('taken-over courses', () => {
  const REF = {
    courseId: 31,
    name: 'Redden in open water',
    description: null,
    owner: { id: 4, name: 'Brandweer Noord' },
    addedAt: '2026-11-25T10:00:00.000Z',
    version: { versionNumber: 2, publishedAt: '2026-11-20T09:12:00.000Z', stepCount: 3, videoCount: 1 },
    thumbnailUrl: '/api/organisation/course-references/31/thumbnail?v=2',
    newVersion: null,
    notice: false,
    withdrawn: null,
  }

  function mockWithReferences({ courses = [], references = [] } = {}) {
    globalThis.fetch.mockImplementation(async (url, options = {}) => {
      if (url === '/api/organisation/courses' && (options.method ?? 'GET') === 'GET') return jsonResponse(200, { courses })
      if (url === '/api/organisation/course-references') return jsonResponse(200, { references, noticeCount: references.filter((r) => r.notice).length })
      if (url.startsWith('/api/organisation/courses/') && options.method === 'DELETE') return new Response(null, { status: 204 })
      return jsonResponse(404, { error: { code: 'not_found', message: 'Niet gevonden.' } })
    })
  }

  it('shows them under their own heading, without edit or delete buttons', async () => {
    mockWithReferences({ courses: [COURSE], references: [REF] })
    const { wrapper } = await mountView()
    expect(wrapper.get('[data-test="taken-over-section"]').text()).toBe('Overgenomen cursussen')
    const row = wrapper.get('[data-test="taken-over-row"]')
    expect(row.get('[data-test="taken-over-pill"]').text()).toBe('Overgenomen van Brandweer Noord')
    expect(row.text()).toContain('Op de Quest: versie 2')
    expect(row.get('img').attributes('src')).toBe(REF.thumbnailUrl)
    expect(row.find('a[href^="/courses/"]').exists()).toBe(false)
    expect(row.find('[title="Verwijderen"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('has no heading without taken-over courses, and the empty state points to the course library', async () => {
    mockWithReferences()
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-test="taken-over-section"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="library-hint"]').text()).toContain('Cursusbibliotheek')
    wrapper.unmount()
  })

  it('opens the window on a click', async () => {
    mockWithReferences({ references: [REF] })
    const { wrapper } = await mountView()
    await wrapper.get('[data-test="taken-over-row"] button').trigger('click')
    expect(wrapper.find('[data-test="taken-over-details"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the notice, the quiet text after keeping, and the explanation (US3, US4)', async () => {
    mockWithReferences({
      references: [
        { ...REF, courseId: 1, name: 'A', newVersion: { versionNumber: 3 }, notice: true },
        { ...REF, courseId: 2, name: 'B', newVersion: { versionNumber: 3 }, notice: false },
        { ...REF, courseId: 3, name: 'C', withdrawn: 'no_access' },
      ],
    })
    const { wrapper } = await mountView()
    const [a, b, c] = wrapper.findAll('[data-test="taken-over-row"]')
    expect(a.get('[data-test="new-version-notice"]').text()).toBe('Nieuwe versie beschikbaar (versie 3)')
    expect(b.get('[data-test="newer-version"]').text()).toBe('Nieuwere versie beschikbaar (versie 3)')
    expect(b.find('[data-test="new-version-notice"]').exists()).toBe(false)
    expect(c.get('[data-test="withdrawn"]').text()).toBe('De eigenaar deelt deze cursus niet meer met jullie. Jullie houden versie 2.')
    wrapper.unmount()
  })

  it('names the receivers when the owner deletes a course they took over (FR-019)', async () => {
    mockWithReferences({ courses: [{ ...COURSE, status: 'published', publication: { versionNumber: 1, publishedAt: '2026-11-20T09:12:00.000Z' }, visibility: 'public', receiverCount: 2 }] })
    const { wrapper } = await mountView()
    await wrapper.get('[title="Verwijderen"]').trigger('click')
    await flushPromises()
    expect(ui.confirm.body).toContain('2 organisaties hebben deze cursus overgenomen en houden hun huidige versie.')
    ui.confirm.resolve(false)
    await flushPromises()
    wrapper.unmount()
  })
})
