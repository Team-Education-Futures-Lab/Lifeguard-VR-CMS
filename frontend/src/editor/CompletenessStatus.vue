<script setup>
// The course-level result of the completeness check in the editor bar (specs/005 FR-023):
// "n nog te doen" with the messages grouped per type, or "Cursus is compleet". Orange, or red once
// a message was there at a click on "Opslaan als concept" (FR-022a). It never blocks saving.
// The grouped list itself is IssueGroups, shared with the dialog "Nog niet klaar om te publiceren"
// (specs/006 verbeterronde V1).
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useEditor } from './context'
import Icon from '../components/Icon.vue'
import IssueGroups from './IssueGroups.vue'

const ed = useEditor()
const open = ref(false)
const root = ref(null)
const issues = computed(() => ed.issues.issues)
const anyFlagged = computed(() => issues.value.some((issue) => ed.isFlagged(issue)))
const label = computed(() => `${issues.value.length} nog te doen`)

/** Brings the step of a message into view; course-level messages show the whole canvas. */
function pick(issue) {
  open.value = false
  if (issue.nodeId) ed.open(issue.nodeId)
  else ed.focusRequest = { id: null, t: Date.now() }
}
const close = (e) => root.value && !root.value.contains(e.target) && (open.value = false)
onMounted(() => window.addEventListener('mousedown', close))
onBeforeUnmount(() => window.removeEventListener('mousedown', close))
</script>

<template>
  <span v-if="!issues.length" class="complete" data-test="complete"><Icon name="check" :size="15" />Cursus is compleet</span>
  <div v-else ref="root" class="todo-anchor">
    <button class="btn btn-ghost todo-btn" :class="{ flagged: anyFlagged }" data-test="todo" @click="open = !open">{{ label }}</button>
    <div v-if="open" class="pop" data-test="todo-list">
      <p class="muted small">Nog te doen voordat de cursus af is. Opslaan als concept kan altijd.</p>
      <IssueGroups :issues="issues" @pick="pick" />
    </div>
  </div>
</template>

<style scoped>
.complete { display: inline-flex; align-items: center; gap: 6px; color: var(--ok); font-size: 0.9rem; font-weight: 500; padding: 0 6px; }
.todo-anchor { position: relative; }
.todo-btn { color: var(--todo); }
.todo-btn.flagged { color: var(--err); }
.pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 340px;
  max-height: 65vh;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow-lg);
  padding: 12px;
  display: grid;
  gap: 6px;
  z-index: 40;
}
</style>
