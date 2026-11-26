<script setup>
// Course window over the course library (specs/009 FR-017, FR-018, contracts/ui.md § Details van
// een cursus): a summary of the live version. Another organisation only sees this summary and a
// "Sluiten" button; the owner also sees with whom the course is shared and can open the editor.
import { computed } from 'vue'
import { AVAILABILITY_LABEL, formatPublishedAt } from '../lib/publication'
import Modal from './Modal.vue'
import OwnerPill from './OwnerPill.vue'

const props = defineProps({ course: { type: Object, required: true } })
const emit = defineEmits(['close', 'filter-owner'])

const availabilityText = computed(() => {
  const c = props.course
  if (!c.owner.isOwn || !c.visibility) return ''
  if (c.visibility !== 'selective') return AVAILABILITY_LABEL[c.visibility]
  const names = (c.accessOrganisations ?? []).map((o) => o.name)
  return names.length > 0
    ? `Selectief beschikbaar: ${names.join(', ')}`
    : 'Selectief beschikbaar: geen organisaties meer gekozen. Alleen jouw organisatie ziet deze cursus.'
})
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`
</script>

<template>
  <Modal :title="course.name" width="560px" @close="emit('close')">
    <div class="view" data-test="library-details">
      <img v-if="course.thumbnailUrl" class="th" :src="course.thumbnailUrl" :alt="course.name" />
      <div v-else class="th placeholder" aria-hidden="true" />
      <p class="owner"><OwnerPill :owner="course.owner" subject="course" @filter="emit('filter-owner', $event)" /></p>
      <p v-if="course.description" class="description" data-test="details-description">{{ course.description }}</p>
      <dl class="facts">
        <dt>Versie</dt>
        <dd>{{ course.versionNumber }}</dd>
        <dt>Gepubliceerd op</dt>
        <dd>{{ formatPublishedAt(course.publishedAt) }}</dd>
        <dt>Onderdelen</dt>
        <dd>{{ plural(course.stepCount, 'onderdeel', 'onderdelen') }}</dd>
        <dt>Video's</dt>
        <dd>{{ plural(course.videoCount, 'video', "video's") }}</dd>
        <template v-if="availabilityText">
          <dt>Beschikbaarheid</dt>
          <dd data-test="details-availability">{{ availabilityText }}</dd>
        </template>
      </dl>
    </div>
    <template #foot>
      <RouterLink v-if="course.owner.isOwn" :to="`/courses/${course.id}`" class="btn" data-test="open-editor">Openen in de editor</RouterLink>
      <button type="button" class="btn btn-primary" data-test="details-close" @click="emit('close')">Sluiten</button>
    </template>
  </Modal>
</template>

<style scoped>
.view { display: grid; gap: 8px; }
.th { width: 100%; aspect-ratio: 2 / 1; object-fit: cover; border-radius: var(--r); background: var(--surface-2); }
.owner { margin: 0; }
/* Line breaks of the description are kept; it is never rendered as HTML. */
.description { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 4px 0 0; font-size: 0.9rem; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; }
</style>
