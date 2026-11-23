<script setup>
// The publication status of a course, in the course list and in the editor (specs/006 FR-019,
// contracts/ui.md § Status). Always as text: the dot is never the only signal.
import { computed } from 'vue'
import { statusLabel } from '../lib/publication'

const props = defineProps({
  status: { type: String, default: 'draft' },
  publication: { type: Object, default: null },
  // A row of the course list: title and detail on one line where there is room.
  compact: { type: Boolean, default: false },
})

const label = computed(() => statusLabel(props))
</script>

<template>
  <span class="publication" :class="{ compact }" data-test="publication-status" :data-status="status">
    <span class="status" :class="label.dot">{{ label.title }}</span>
    <span v-if="label.detail" class="detail" data-test="publication-detail">{{ label.detail }}</span>
  </span>
</template>

<style scoped>
.publication { display: inline-flex; flex-direction: column; gap: 1px; min-width: 0; }
.publication.compact { flex-direction: row; flex-wrap: wrap; align-items: baseline; column-gap: 10px; }
.detail { font-size: 0.78rem; color: var(--muted); padding-left: 13px; white-space: nowrap; }
.compact .detail { padding-left: 0; }
</style>
