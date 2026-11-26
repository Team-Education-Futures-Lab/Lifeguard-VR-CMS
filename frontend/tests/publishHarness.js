import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import CourseEditor from '../src/editor/CourseEditor.vue'
import { editorStubs } from './editorStubs'
import { jsonResponse } from './helpers'

// Mounts the course editor with an API stand-in for the publishing tests (specs/006, 009). `routes`
// maps 'PUT', 'publish', 'unpublish', 'availability' and 'organisations' to a function that returns
// a Response; every call is recorded.

export const publication = (versionNumber = 1) => ({
  versionNumber,
  publishedAt: '2026-11-23T13:05:00.000Z',
  hasUnavailableVideo: false,
})

/** The other organisations, for "Selectief beschikbaar" (specs/009). */
export const ORGANISATIONS = [
  { id: 4, name: 'Brandweer Noord' },
  { id: 5, name: 'Zwembad B' },
  { id: 6, name: 'Zwembad C' },
]

export async function mountCourseEditor(doc, routes = {}, props = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)', component: { template: '<div />' } }] })
  await router.push(`/courses/${doc.id}`)
  const calls = []
  globalThis.fetch.mockImplementation(async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const action = url.endsWith('/publish')
      ? 'publish'
      : url.endsWith('/unpublish')
        ? 'unpublish'
        : url.endsWith('/availability')
          ? 'availability'
          : url === '/api/organisation/organisations'
            ? 'organisations'
            : method
    calls.push({ action, body: options.body ? JSON.parse(options.body) : undefined })
    if (routes[action]) return routes[action](options.body ? JSON.parse(options.body) : undefined)
    if (action === 'organisations') return jsonResponse(200, { organisations: ORGANISATIONS })
    return jsonResponse(200, doc)
  })
  const wrapper = mount(CourseEditor, {
    props: { doc, ...props },
    global: { plugins: [router], stubs: { ...editorStubs, CanvasEditor: true, OverviewList: true, teleport: true } },
  })
  await flushPromises()
  return { wrapper, calls }
}

/** Opens the publish menu next to the status (verbeterronde V2). */
export async function openMenu(wrapper) {
  await wrapper.get('[data-test="publish-menu"]').trigger('click')
}

/** Chooses an item of the publish menu: 'publish', 'unpublish' or 'change-availability'. */
export async function choose(wrapper, item) {
  await openMenu(wrapper)
  await wrapper.get(`[data-test="${item}"]`).trigger('click')
  // The publish and availability dialogs open after the organisations are loaded (specs/009).
  await flushPromises()
}
