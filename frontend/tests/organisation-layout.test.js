import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import OrganisationLayout from '../src/components/OrganisationLayout.vue'
import { jsonResponse } from './helpers'

// The counter of new versions next to "Cursussen" (specs/010 FR-012, contracts/ui.md § Teller).

const ref = (courseId, notice) => ({ courseId, name: `Cursus ${courseId}`, notice, newVersion: notice ? { versionNumber: 2 } : null })

function mockApi(references) {
  globalThis.fetch.mockImplementation(async (url) => {
    if (url === '/api/organisation/course-references') return jsonResponse(200, { references, noticeCount: references.filter((r) => r.notice).length })
    return jsonResponse(404, { error: { code: 'not_found', message: 'Niet gevonden.' } })
  })
}

async function mountLayout() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)', component: { template: '<div />' } }] })
  await router.push('/courses')
  const wrapper = mount(OrganisationLayout, {
    global: { plugins: [router], stubs: { UploadIndicator: true, UploadRejectedDialog: true, OrgLogo: true } },
  })
  await flushPromises()
  return wrapper
}

describe('the notice counter', () => {
  it('shows the number of courses with a notice, with a label', async () => {
    mockApi([ref(1, true), ref(2, true), ref(3, false)])
    const wrapper = await mountLayout()
    const count = wrapper.get('[data-test="notice-count"]')
    expect(count.text()).toBe('2')
    expect(count.attributes('aria-label')).toBe('2 cursussen met een nieuwe versie')
  })

  it('uses the singular for one course', async () => {
    mockApi([ref(1, true)])
    const wrapper = await mountLayout()
    expect(wrapper.get('[data-test="notice-count"]').attributes('aria-label')).toBe('1 cursus met een nieuwe versie')
  })

  it('is not there without notices', async () => {
    mockApi([ref(3, false)])
    const wrapper = await mountLayout()
    expect(wrapper.find('[data-test="notice-count"]').exists()).toBe(false)
  })
})
