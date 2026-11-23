import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PublicationStatus from '../src/components/PublicationStatus.vue'
import { formatPublishedAt, statusLabel } from '../src/lib/publication'

// The publication status as text (specs/006 FR-018, FR-019, contracts/ui.md § Status, research R13).

const TZ = { timeZone: 'Europe/Amsterdam' }
const publication = { versionNumber: 2, publishedAt: '2026-11-23T13:05:00.000Z', hasUnavailableVideo: false }

describe('formatPublishedAt', () => {
  it('writes date and time in Dutch', () => {
    expect(formatPublishedAt('2026-11-23T13:05:00.000Z', TZ)).toBe('23 november 2026 om 14:05')
  })
})

describe('statusLabel', () => {
  it('a course that was never published', () => {
    expect(statusLabel({ status: 'draft', publication: null, lastPublishedVersionNumber: null }, TZ)).toEqual({ title: 'Concept', detail: '', dot: '' })
  })

  it('a course that was published before is just a draft (verbeterronde V6)', () => {
    expect(statusLabel({ status: 'draft', publication: null, lastPublishedVersionNumber: 2 }, TZ)).toEqual({ title: 'Concept', detail: '', dot: '' })
  })

  it('a published course', () => {
    expect(statusLabel({ status: 'published', publication, lastPublishedVersionNumber: 2 }, TZ)).toEqual({
      title: 'Gepubliceerd',
      detail: 'Versie 2 · 23 november 2026 om 14:05',
      dot: 'live',
    })
  })

  it('a published course with changes', () => {
    expect(statusLabel({ status: 'published_changed', publication, lastPublishedVersionNumber: 2 }, TZ)).toEqual({
      title: 'Gepubliceerd · wijzigingen nog niet gepubliceerd',
      detail: 'Op de Quest: versie 2 · 23 november 2026 om 14:05',
      dot: 'changed',
    })
  })
})

describe('PublicationStatus', () => {
  it('shows the status as text, with the API value as data-status', () => {
    const wrapper = mount(PublicationStatus, { props: { status: 'published', publication, lastPublishedVersionNumber: 2 } })
    const root = wrapper.get('[data-test="publication-status"]')
    expect(root.attributes('data-status')).toBe('published')
    expect(root.text()).toContain('Gepubliceerd')
    expect(wrapper.get('[data-test="publication-detail"]').text()).toMatch(/^Versie 2 · /)
  })

  it('has no detail line for a course that was never published', () => {
    const wrapper = mount(PublicationStatus, { props: { status: 'draft' } })
    expect(wrapper.text()).toBe('Concept')
    expect(wrapper.find('[data-test="publication-detail"]').exists()).toBe(false)
  })
})
