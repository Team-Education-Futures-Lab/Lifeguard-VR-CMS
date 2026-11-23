<script setup>
// The messages of the completeness check, grouped per type (specs/005 FR-023, verbeterronde 005,
// punt 6): the list "nog te doen" in the editor bar, and the dialog "Nog niet klaar om te
// publiceren" (specs/006 verbeterronde V1) use the same look. Groups can be folded; they start open
// when there are fewer than 5 points. The course-level group stands apart from the groups about steps.
import { computed, ref } from 'vue'
import { useEditor } from './context'
import { findNode, nodeLabel } from '../lib/course'
import { groupIssues } from '../lib/completeness'
import Icon from '../components/Icon.vue'

const OPEN_BELOW = 5
const props = defineProps({ issues: { type: Array, required: true } })
const emit = defineEmits(['pick'])
const ed = useEditor()

const groups = computed(() => groupIssues(props.issues))
const courseGroups = computed(() => groups.value.filter((g) => g.courseLevel))
const stepGroups = computed(() => groups.value.filter((g) => !g.courseLevel))

// Folded groups by key, decided when the list appears.
const folded = ref(props.issues.length < OPEN_BELOW ? new Set() : new Set(groups.value.map((g) => g.key)))
function toggle(key) {
  const next = new Set(folded.value)
  next.has(key) ? next.delete(key) : next.add(key)
  folded.value = next
}

/** The step a message is about, so a row says which block it means. */
function stepName(issue) {
  const node = issue.nodeId && findNode(ed.course, issue.nodeId)
  if (!node) return ''
  return (node.type === 'question' ? 'Vraag: ' : '') + nodeLabel(node, ed.stepVideos)
}
</script>

<template>
  <template v-for="(list, part) in [courseGroups, stepGroups]" :key="part">
    <section v-for="group in list" :key="group.key" class="group" :class="{ course: group.courseLevel }" :data-group="group.key">
      <button class="group-head" :aria-expanded="!folded.has(group.key)" data-test="group-head" @click="toggle(group.key)">
        <Icon :name="folded.has(group.key) ? 'right' : 'down'" :size="14" />
        <span class="group-label">{{ group.label }}</span>
        <span class="count">{{ group.issues.length }}</span>
      </button>
      <div v-if="!folded.has(group.key)" class="rows">
        <button
          v-for="issue in group.issues"
          :key="issue.id"
          class="pop-item"
          :class="{ flagged: ed.isFlagged(issue) }"
          data-test="todo-item"
          @click="emit('pick', issue)"
        >
          <span v-if="stepName(issue)" class="step">{{ stepName(issue) }}</span>
          <span class="msg">{{ issue.msg }}</span>
        </button>
      </div>
    </section>
    <hr v-if="part === 0 && courseGroups.length && stepGroups.length" class="split" />
  </template>
</template>

<style scoped>
.group { display: grid; gap: 2px; }
.group.course { background: var(--surface-2); border-radius: var(--r-sm); padding: 4px; }
.group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  padding: 4px 6px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  text-align: left;
}
.group-head:hover { background: var(--surface-2); }
.group-label { flex: 1; }
.count { font-size: 0.75rem; font-weight: 600; padding: 0 7px; border-radius: 999px; background: var(--todo-soft); color: var(--todo); }
.rows { display: grid; gap: 1px; padding-left: 18px; }
.pop-item {
  display: grid;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  color: var(--todo);
}
.pop-item:hover { background: var(--todo-soft); }
.pop-item.flagged { color: var(--err); }
.pop-item.flagged:hover { background: var(--err-soft); }
.step { font-size: 0.78rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg { font-size: 0.88rem; }
.split { border: 0; border-top: 1px solid var(--line); margin: 4px 0; }
</style>
