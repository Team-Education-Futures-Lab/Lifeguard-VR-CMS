<script setup>
// "Beschikbaarheid wijzigen" of a live course (specs/009 FR-006, FR-007, contracts/ui.md
// § Beschikbaarheid wijzigen): who sees it in the course library, without publishing again.
// Restricting asks first how many organisations lose it; a warning about restricted videos
// (409 shared_videos_warning) asks "Doorgaan" before the request is sent again.
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import AvailabilityPicker, { isAvailabilityValid } from '../components/AvailabilityPicker.vue'
import SharedVideosWarningDialog from '../components/SharedVideosWarningDialog.vue'
import { confirmationText, countLosingAccess } from '../lib/videoAccess'
import { toast } from '../lib/ui'

const props = defineProps({
  availability: { type: Object, required: true },
  organisations: { type: Array, default: () => [] },
  // (choices) => Promise<draft document>
  save: { type: Function, required: true },
})
const emit = defineEmits(['saved', 'cancel'])

const current = computed(() => ({
  visibility: props.availability.visibility,
  accessOrganisationIds: props.availability.accessOrganisations.map((o) => o.id),
}))
const choice = ref({ ...current.value })
const valid = computed(() => isAvailabilityValid(choice.value))
const losing = computed(() => countLosingAccess(current.value, choice.value, props.organisations.map((o) => o.id)))
const askRestrict = ref(false)
const warning = ref(null) // the videos of a 409 shared_videos_warning
const busy = ref(false)

const choices = () => ({
  visibility: choice.value.visibility,
  accessOrganisationIds: choice.value.visibility === 'selective' ? choice.value.accessOrganisationIds : [],
})

async function send(acknowledgedVideoIds = []) {
  busy.value = true
  try {
    const doc = await props.save({ ...choices(), acknowledgedVideoIds })
    warning.value = null
    toast('Beschikbaarheid opgeslagen')
    emit('saved', doc)
  } catch (error) {
    if (error.code === 'shared_videos_warning') warning.value = error.videos
    else if (error.status !== 401) toast(error.status === 400 || error.status === 409 ? error.message : 'Opslaan is niet gelukt. Probeer het opnieuw.')
  } finally {
    busy.value = false
  }
}

function onSave() {
  if (!valid.value) return
  if (losing.value > 0 && !askRestrict.value) {
    askRestrict.value = true
    return
  }
  send()
}

const onKey = (e) => e.key === 'Escape' && !warning.value && emit('cancel')
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop availability-backdrop" @mousedown.self="emit('cancel')">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Beschikbaarheid wijzigen" data-test="availability-dialog" style="width: min(480px, 100%)">
        <div class="modal-head"><h2>Beschikbaarheid wijzigen</h2></div>
        <div v-if="askRestrict" class="modal-body">
          <p data-test="restrict-question">{{ confirmationText(losing, 'course') }}</p>
        </div>
        <div v-else class="modal-body">
          <AvailabilityPicker v-model="choice" :organisations="organisations" subject="course" id-prefix="change-availability" />
        </div>
        <div class="modal-foot">
          <template v-if="askRestrict">
            <button class="btn btn-ghost" data-test="restrict-cancel" @click="askRestrict = false">Annuleren</button>
            <button class="btn btn-primary" data-test="restrict-confirm" :disabled="busy" @click="onSave">Wijzigen</button>
          </template>
          <template v-else>
            <button class="btn btn-ghost" data-test="availability-cancel" @click="emit('cancel')">Annuleren</button>
            <button class="btn btn-primary" data-test="availability-save" :disabled="!valid || busy" @click="onSave">Opslaan</button>
          </template>
        </div>
      </div>
    </div>
    <SharedVideosWarningDialog
      v-if="warning"
      :videos="warning"
      @cancel="warning = null; askRestrict = false"
      @continue="send(warning.map((video) => video.id))"
    />
  </Teleport>
</template>

<style scoped>
.availability-backdrop { z-index: 60; }
.modal-body p { margin: 0 0 10px; }
</style>
