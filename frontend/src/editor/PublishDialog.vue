<script setup>
// The dialogs around publishing (specs/006 contracts/ui.md): the confirmation in plain language
// (FR-003, NFR-03), and "Nog niet klaar om te publiceren" with the messages that keep the course
// from being published, in the same grouped list as "nog te doen" (FR-007, verbeterronde V1).
// A message about a step opens that step.
import { computed, onMounted, onBeforeUnmount } from 'vue'
import IssueGroups from './IssueGroups.vue'

const props = defineProps({
  // 'confirm' | 'issues'
  mode: { type: String, default: 'confirm' },
  // The number of the live version, or null when the course is not live.
  liveVersionNumber: { type: Number, default: null },
  issues: { type: Array, default: () => [] },
})
const emit = defineEmits(['confirm', 'cancel', 'open-step'])

const hasLive = computed(() => props.liveVersionNumber !== null)
const action = computed(() => (hasLive.value ? 'Wijzigingen publiceren' : 'Publiceren'))
const title = computed(() => (props.mode === 'issues' ? 'Nog niet klaar om te publiceren' : `${action.value}?`))

function pick(issue) {
  emit('cancel')
  if (issue.nodeId) emit('open-step', issue.nodeId)
}

const onKey = (e) => e.key === 'Escape' && emit('cancel')
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop publish-backdrop" @mousedown.self="emit('cancel')">
      <div class="modal" role="alertdialog" aria-modal="true" :aria-label="title" data-test="publish-dialog" :data-mode="mode" style="width: min(440px, 100%)">
        <div class="modal-head"><h2>{{ title }}</h2></div>

        <div v-if="mode === 'confirm'" class="modal-body">
          <p v-if="hasLive">
            De wijzigingen komen op de VR-brillen van jullie organisatie. Ze vervangen wat daar nu staat (versie {{ liveVersionNumber }}).
          </p>
          <p v-else>De cursus wordt beschikbaar voor de VR-brillen van jullie organisatie.</p>
        </div>

        <div v-else class="modal-body issues">
          <p class="muted small">Los deze punten eerst op. Klik op een punt om het onderdeel te openen.</p>
          <IssueGroups :issues="issues" @pick="pick" />
        </div>

        <div class="modal-foot">
          <template v-if="mode === 'confirm'">
            <button class="btn btn-ghost" data-test="publish-cancel" @click="emit('cancel')">Annuleren</button>
            <button class="btn btn-primary" data-test="publish-confirm" @click="emit('confirm')">{{ action }}</button>
          </template>
          <button v-else class="btn btn-primary" data-test="publish-close" @click="emit('cancel')">Sluiten</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.publish-backdrop { z-index: 60; }
.modal-body p { margin: 0 0 10px; }
.issues { display: grid; gap: 6px; max-height: 60vh; overflow: auto; }
.issues p { margin: 0 0 4px; }
</style>
