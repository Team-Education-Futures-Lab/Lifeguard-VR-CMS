<script setup>
// The dialogs around publishing (specs/006 contracts/ui.md): the confirmation in plain language
// (FR-003, NFR-03), and "Nog niet klaar om te publiceren" with the messages that keep the course
// from being published, in the same grouped list as "nog te doen" (FR-007, verbeterronde V1).
// A message about a step opens that step.
// The confirmation also asks who sees the course in the course library (specs/009 FR-002,
// contracts/ui.md § Bevestiging publiceren). Restricting a live course asks first (FR-007).
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import AvailabilityPicker, { isAvailabilityValid } from '../components/AvailabilityPicker.vue'
import { audience, confirmationText, countLosingAccess } from '../lib/videoAccess'
import { losingReceiversSentence } from '../lib/courseReference'
import IssueGroups from './IssueGroups.vue'

const props = defineProps({
  // 'confirm' | 'issues'
  mode: { type: String, default: 'confirm' },
  // The number of the live version, or null when the course is not live.
  liveVersionNumber: { type: Number, default: null },
  issues: { type: Array, default: () => [] },
  // The stored availability of the course: { visibility, accessOrganisations: [{ id, name }] }.
  availability: { type: Object, default: () => ({ visibility: 'private', accessOrganisations: [] }) },
  // The other active organisations, for "Selectief beschikbaar".
  organisations: { type: Array, default: () => [] },
  // The organisations that took the course over (specs/010 FR-019): [{ id, name }].
  receivers: { type: Array, default: () => [] },
  // A choice to start from instead of the stored availability (back from the warning, contracts/ui.md).
  initialChoice: { type: Object, default: null },
})
const emit = defineEmits(['confirm', 'cancel', 'open-step'])

const hasLive = computed(() => props.liveVersionNumber !== null)
const action = computed(() => (hasLive.value ? 'Wijzigingen publiceren' : 'Publiceren'))
const title = computed(() => (props.mode === 'issues' ? 'Nog niet klaar om te publiceren' : `${action.value}?`))

const current = computed(() => ({
  visibility: props.availability.visibility,
  accessOrganisationIds: props.availability.accessOrganisations.map((o) => o.id),
}))
const choice = ref({ ...(props.initialChoice ?? current.value) })
const valid = computed(() => isAvailabilityValid(choice.value))
// How many organisations would no longer see a live course (specs/009 FR-007).
const losing = computed(() =>
  hasLive.value ? countLosingAccess(current.value, choice.value, props.organisations.map((o) => o.id)) : 0,
)
// The receivers that lose access by this choice keep their version (specs/010 FR-019).
const losingReceivers = computed(() => {
  const after = audience(choice.value, props.organisations.map((o) => o.id))
  return props.receivers.filter((r) => !after.has(r.id)).length
})
const askRestrict = ref(false)

function confirm() {
  if (!valid.value) return
  if (losing.value > 0 && !askRestrict.value) {
    askRestrict.value = true
    return
  }
  const { visibility, accessOrganisationIds } = choice.value
  emit('confirm', { visibility, accessOrganisationIds: visibility === 'selective' ? accessOrganisationIds : [] })
}

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
      <div class="modal" role="alertdialog" aria-modal="true" :aria-label="title" data-test="publish-dialog" :data-mode="mode" style="width: min(480px, 100%)">
        <div class="modal-head"><h2>{{ title }}</h2></div>

        <div v-if="mode === 'confirm' && askRestrict" class="modal-body">
          <p data-test="restrict-question">{{ confirmationText(losing, 'course') }}</p>
          <p v-if="losingReceivers" data-test="restrict-receivers">{{ losingReceiversSentence(losingReceivers) }}</p>
        </div>

        <div v-else-if="mode === 'confirm'" class="modal-body">
          <p v-if="hasLive">
            De wijzigingen komen op de VR-brillen van jullie organisatie. Ze vervangen wat daar nu staat (versie {{ liveVersionNumber }}).
          </p>
          <p v-else>De cursus wordt beschikbaar voor de VR-brillen van jullie organisatie.</p>
          <AvailabilityPicker v-model="choice" :organisations="organisations" subject="course" id-prefix="publish" />
          <p v-if="choice.visibility === 'public'" class="muted small library-note" data-test="library-note">
            De cursus komt ook in de cursusbibliotheek, voor alle organisaties.
          </p>
          <p v-else-if="choice.visibility === 'selective'" class="muted small library-note" data-test="library-note">
            De cursus komt ook in de cursusbibliotheek, voor de gekozen organisaties.
          </p>
        </div>

        <div v-else class="modal-body issues">
          <p class="muted small">Los deze punten eerst op. Klik op een punt om het onderdeel te openen.</p>
          <IssueGroups :issues="issues" @pick="pick" />
        </div>

        <div class="modal-foot">
          <template v-if="mode === 'confirm' && askRestrict">
            <button class="btn btn-ghost" data-test="restrict-cancel" @click="askRestrict = false">Annuleren</button>
            <button class="btn btn-primary" data-test="restrict-confirm" @click="confirm">Wijzigen</button>
          </template>
          <template v-else-if="mode === 'confirm'">
            <button class="btn btn-ghost" data-test="publish-cancel" @click="emit('cancel')">Annuleren</button>
            <button class="btn btn-primary" data-test="publish-confirm" :disabled="!valid" @click="confirm">{{ action }}</button>
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
.modal-body .library-note { margin: 8px 0 0; }
.issues { display: grid; gap: 6px; max-height: 60vh; overflow: auto; }
.issues p { margin: 0 0 4px; }
</style>
