<script setup>
// One button with a menu for publishing, next to the status (specs/006 verbeterronde V2, V3, V5).
// The button says what it does: "Publiceren" while the course is not on the VR headsets,
// "Wijzigingen publiceren" once it is. The menu has that action and "Onpubliceren" (only when
// live). Publishing works on the saved draft only (verbeterronde V4): with unsaved changes, or with
// nothing new, the action is greyed out and says why, in the menu and not permanently in the bar.
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useEditor } from './context'
import Icon from '../components/Icon.vue'

const emit = defineEmits(['publish', 'unpublish'])
const ed = useEditor()
const open = ref(false)
const root = ref(null)

const live = computed(() => Boolean(ed.publication.publication))
const label = computed(() => (live.value ? 'Wijzigingen publiceren' : 'Publiceren'))
/** Why the action cannot be used now, or '' when it can. */
const reason = computed(() => {
  if (ed.dirty) return 'Sla eerst je wijzigingen op'
  if (ed.publication.status === 'published') return 'Er is niets nieuws om te publiceren'
  return ''
})
const busy = computed(() => ed.publishing || ed.saving)

function choose(action) {
  open.value = false
  emit(action)
}
const close = (e) => root.value && !root.value.contains(e.target) && (open.value = false)
const onKey = (e) => e.key === 'Escape' && (open.value = false)
onMounted(() => {
  window.addEventListener('mousedown', close)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', close)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="publish-menu">
    <button
      class="btn trigger"
      data-test="publish-menu"
      aria-haspopup="menu"
      :aria-expanded="open"
      :disabled="busy"
      @click="open = !open"
    >
      {{ ed.publishing ? 'Bezig…' : label }}<Icon name="down" :size="14" />
    </button>
    <div v-if="open" class="pop" role="menu" data-test="publish-menu-list">
      <button
        class="item"
        role="menuitem"
        data-test="publish"
        :disabled="!!reason"
        :aria-disabled="!!reason"
        :aria-describedby="reason ? 'publish-reason' : undefined"
        @click="choose('publish')"
      >
        <span class="item-label">{{ label }}</span>
        <span v-if="reason" id="publish-reason" class="reason" data-test="publish-reason">{{ reason }}</span>
      </button>
      <button v-if="live" class="item" role="menuitem" data-test="unpublish" @click="choose('unpublish')">
        <span class="item-label">Onpubliceren</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.publish-menu { position: relative; }
.trigger { gap: 6px; }
.pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 240px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  display: grid;
  gap: 2px;
  z-index: 40;
}
.item {
  display: grid;
  gap: 1px;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 7px 10px;
  border-radius: 5px;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.item:hover:not(:disabled) { background: var(--surface-2); }
.item:disabled { cursor: default; }
.item:disabled .item-label { color: var(--muted); }
.item-label { font-weight: 500; }
.reason { font-size: 0.8rem; color: var(--muted); }
</style>
