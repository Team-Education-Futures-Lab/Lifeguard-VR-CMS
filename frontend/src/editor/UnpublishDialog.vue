<script setup>
// The confirmation before "Onpubliceren" (specs/006 FR-015, contracts/ui.md), in plain language.
// When the live version has a video that is no longer available, it says that publishing again
// needs another video (FR-012, constitution V).
import { onMounted, onBeforeUnmount } from 'vue'

defineProps({ hasUnavailableVideo: { type: Boolean, default: false } })
const emit = defineEmits(['confirm', 'cancel'])

const onKey = (e) => e.key === 'Escape' && emit('cancel')
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop unpublish-backdrop" @mousedown.self="emit('cancel')">
      <div class="modal" role="alertdialog" aria-modal="true" aria-label="Cursus onpubliceren?" data-test="unpublish-dialog" style="width: min(460px, 100%)">
        <div class="modal-head"><h2>Cursus onpubliceren?</h2></div>
        <div class="modal-body">
          <p>
            De cursus is daarna niet meer te downloaden op de VR-brillen. Brillen die hem al hebben, kunnen hem blijven
            gebruiken. Je concept en eerdere versies blijven bewaard.
          </p>
          <p v-if="hasUnavailableVideo" class="warn" data-test="unpublish-video-warning">
            Let op: een video in deze cursus is niet meer beschikbaar. Opnieuw publiceren kan pas met een andere video.
          </p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" data-test="unpublish-cancel" @click="emit('cancel')">Annuleren</button>
          <button class="btn btn-danger-solid" data-test="unpublish-confirm" @click="emit('confirm')">Onpubliceren</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.unpublish-backdrop { z-index: 60; }
.modal-body p { margin: 0 0 10px; }
.warn { color: var(--err); }
</style>
