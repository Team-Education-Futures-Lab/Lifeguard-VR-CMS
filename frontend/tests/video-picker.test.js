import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VideoPicker from '../src/editor/VideoPicker.vue'
import { docs, mountEditor } from './editorHarness'

// Searching in the video picker of the course editor, and long names that stay readable
// (specs/004 FR-014b, verbeterronde usability-test).

vi.mock('../src/api/videos', () => ({ listVideos: vi.fn() }))
const { listVideos } = await import('../src/api/videos')

const LONG_NAME = 'Verdrinkingsgevaar bij het speeleiland - recreatiebad (kijkrichting links)'
const library = [
  { id: 1, name: 'Kind onder water - peuterbad', description: null, durationSeconds: 30, thumbnailUrl: '/t/1', owner: { id: 1, name: 'Eigen org', isOwn: true } },
  { id: 2, name: LONG_NAME, description: 'Oefensituatie voor toezichthouders', durationSeconds: 40, thumbnailUrl: '/t/2', owner: { id: 2, name: 'Yonder sport en beweging', isOwn: false } },
  { id: 3, name: 'Café-scène bij het buitenbad', description: null, durationSeconds: 50, thumbnailUrl: '/t/3', owner: { id: 3, name: 'Zwembad veenendaal', isOwn: false } },
]

let harness

async function mountPicker() {
  harness = mountEditor(docs.doc(docs.video({ videoId: null, video: null })), {
    component: VideoPicker,
    props: (course) => ({ node: course.nodes[0] }),
  })
  await flushPromises()
  return harness.wrapper
}

const names = (wrapper) => wrapper.findAll('[data-test="video-option"] .name').map((n) => n.text())

beforeEach(() => listVideos.mockResolvedValue(library))
afterEach(() => harness?.wrapper.unmount())

describe('video picker search', () => {
  it('shows a search field and every video while the field is empty', async () => {
    const wrapper = await mountPicker()
    expect(wrapper.find('[data-test="video-search"]').exists()).toBe(true)
    expect(names(wrapper)).toHaveLength(3)
  })

  it('filters on name, description and owner, without case or accents', async () => {
    const wrapper = await mountPicker()
    const search = wrapper.find('[data-test="video-search"]')

    await search.setValue('PEUTERBAD')
    expect(names(wrapper)).toEqual(['Kind onder water - peuterbad'])

    await search.setValue('toezichthouders')
    expect(names(wrapper)).toEqual([LONG_NAME])

    await search.setValue('veenendaal')
    expect(names(wrapper)).toEqual(['Café-scène bij het buitenbad'])

    await search.setValue('cafe')
    expect(names(wrapper)).toEqual(['Café-scène bij het buitenbad'])
  })

  it('says so when nothing matches', async () => {
    const wrapper = await mountPicker()
    await wrapper.find('[data-test="video-search"]').setValue('glijbaan')
    expect(names(wrapper)).toEqual([])
    expect(wrapper.find('[data-test="video-search-empty"]').text()).toContain('glijbaan')
  })

  it('shows the full name, also as tooltip, and chooses the found video', async () => {
    const wrapper = await mountPicker()
    await wrapper.find('[data-test="video-search"]').setValue('speeleiland')
    const option = wrapper.find('[data-test="video-option"]')
    expect(option.find('.name').text()).toBe(LONG_NAME)
    expect(option.attributes('title')).toBe(LONG_NAME)

    await option.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="video-search"]').exists()).toBe(false)
    expect(wrapper.find('.current .name').text()).toBe(LONG_NAME)
  })

  it('has no search field when the library is empty', async () => {
    listVideos.mockResolvedValue([])
    const wrapper = await mountPicker()
    expect(wrapper.find('[data-test="video-search"]').exists()).toBe(false)
  })
})
