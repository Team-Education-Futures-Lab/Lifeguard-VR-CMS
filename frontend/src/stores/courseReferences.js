import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { listReferences } from '../api/courseReferences'

/**
 * The courses the organisation took over from the course library, and the number of notices for
 * the counter in the navigation (specs/010 research R10). Loaded when the CMS opens and when the
 * course overview loads; no polling.
 */
export const useCourseReferences = defineStore('courseReferences', () => {
  const references = ref([])
  const loaded = ref(false)
  const noticeCount = computed(() => references.value.filter((reference) => reference.notice).length)

  async function load() {
    try {
      references.value = (await listReferences()).references
      loaded.value = true
    } catch {
      // The counter stays as it was; the course overview shows its own error.
    }
    return references.value
  }

  function replace(reference) {
    const i = references.value.findIndex((r) => r.courseId === reference.courseId)
    if (i === -1) references.value = [...references.value, reference]
    else references.value = references.value.map((r, j) => (j === i ? reference : r))
  }

  function remove(courseId) {
    references.value = references.value.filter((r) => r.courseId !== courseId)
  }

  function reset() {
    references.value = []
    loaded.value = false
  }

  return { references, loaded, noticeCount, load, replace, add: replace, remove, reset }
})
