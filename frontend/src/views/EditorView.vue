<script setup>
// Loads the draft of a course and shows the editor (specs/004 contracts/ui.md § Editor). After a
// publication the draft is a new copy with new ids (specs/006 research R14): the editor starts
// again on that draft, with a fresh undo history.
import { ref, watch } from 'vue'
import { getCourse } from '../api/courses'
import CourseEditor from '../editor/CourseEditor.vue'

const props = defineProps({ id: String })
const doc = ref(null)
const notice = ref('')
const state = ref('loading') // loading | ready | missing | error

function onPublished(next, message) {
  notice.value = message
  doc.value = next
}

async function load() {
  state.value = 'loading'
  try {
    doc.value = await getCourse(props.id)
    state.value = 'ready'
  } catch (error) {
    state.value = error.status === 404 ? 'missing' : 'error'
  }
}
watch(() => props.id, load, { immediate: true })
</script>

<template>
  <div v-if="state === 'loading'" class="page"><p class="muted">Cursus laden…</p></div>
  <div v-else-if="state === 'missing'" class="page">
    <h1>Cursus niet gevonden</h1>
    <RouterLink to="/courses">Terug naar cursussen</RouterLink>
  </div>
  <div v-else-if="state === 'error'" class="page">
    <p>De cursus kon niet worden geladen.</p>
    <button class="btn" @click="load">Opnieuw</button>
  </div>
  <CourseEditor v-else :key="`${doc.id}-${doc.draftVersionNumber}`" :doc="doc" :notice="notice" @published="onPublished" />
</template>
