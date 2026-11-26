<script setup>
// The warning before sharing a course with videos that are not generally available (specs/009
// FR-009 – FR-011, contracts/ui.md § Waarschuwing). The server decides which videos; this dialog
// shows them and asks "Doorgaan" or "Annuleren".
import { onMounted, onBeforeUnmount } from 'vue'

defineProps({ videos: { type: Array, required: true } })
const emit = defineEmits(['continue', 'cancel'])

const onKey = (e) => e.key === 'Escape' && emit('cancel')
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop warning-backdrop" @mousedown.self="emit('cancel')">
      <div
        class="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label="Video's die niet algemeen beschikbaar zijn"
        data-test="shared-videos-warning"
        style="width: min(480px, 100%)"
      >
        <div class="modal-head"><h2>Video's die niet algemeen beschikbaar zijn</h2></div>
        <div class="modal-body">
          <p>
            In deze cursus zitten video's die je niet met iedereen hebt gedeeld. Organisaties waarmee je de cursus
            deelt, mogen deze video's binnen de cursus gebruiken als ze de cursus overnemen, ook als de video later
            wordt beperkt.
          </p>
          <ul class="videos">
            <li v-for="video in videos" :key="video.id" data-test="warning-video">{{ video.name }}</li>
          </ul>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" data-test="warning-cancel" @click="emit('cancel')">Annuleren</button>
          <button class="btn btn-primary" data-test="warning-continue" @click="emit('continue')">Doorgaan</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.warning-backdrop { z-index: 65; }
.modal-body p { margin: 0 0 10px; }
.videos { margin: 0; padding-left: 20px; display: grid; gap: 4px; max-height: 40vh; overflow: auto; }
</style>
