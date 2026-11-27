import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminLoginView from '../src/views/AdminLoginView.vue'
import LoginView from '../src/views/LoginView.vue'
import { jsonResponse, mockSession, routerAt } from './helpers'

// The two login pages link to each other, and an organisation starts at its courses (backlog,
// manual test of 2026-11-27: no start page with three buttons anymore).

async function mountAt(component, path) {
  mockSession('none')
  const router = await routerAt(path)
  const wrapper = mount(component, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('login pages', () => {
  it('the organisation login links to the administrator login', async () => {
    const { wrapper, router } = await mountAt(LoginView, '/login')
    const link = wrapper.get('[data-test="admin-login-link"]')
    expect(link.text()).toBe('Inloggen als beheerder')
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin/login')
  })

  it('the administrator login links back to the organisation login', async () => {
    const { wrapper } = await mountAt(AdminLoginView, '/admin/login')
    expect(wrapper.get('[data-test="organisation-login-link"]').attributes('href')).toBe('/login')
  })

  it('an organisation goes to its courses after logging in', async () => {
    const { wrapper, router } = await mountAt(LoginView, '/login')
    globalThis.fetch.mockImplementation(async (url) =>
      url === '/api/auth/organisation/login'
        ? new Response(null, { status: 204 })
        : url === '/api/auth/me'
          ? jsonResponse(200, { role: 'organisation', organisation: { id: 1, name: 'Zwembad A' } })
          : jsonResponse(200, {}),
    )
    await wrapper.get('#login-code').setValue('ZWEMBAD-A')
    await wrapper.get('#login-password').setValue('wachtwoord-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/courses')
  })
})

describe('the start route', () => {
  it('sends a logged-in organisation from / to /courses', async () => {
    mockSession('organisation')
    const router = await routerAt('/')
    expect(router.currentRoute.value.path).toBe('/courses')
  })
})
