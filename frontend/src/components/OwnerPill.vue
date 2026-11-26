<script setup>
// Owner of a video (specs/003 FR-009, FR-025b) or of a course in the course library (specs/009): a
// coloured pill for another organisation, which filters the library on that organisation when
// clicked, and a neutral "Eigen" pill for own items.
defineProps({
  owner: { type: Object, required: true },
  // What the filter shows: video's (specs/003) or cursussen (specs/009 course library).
  subject: { type: String, default: 'video' },
})
const emit = defineEmits(['filter'])
const VIDEOS = "video's"
</script>

<template>
  <span v-if="owner.isOwn" class="pill own" data-test="owner">Eigen</span>
  <button
    v-else
    type="button"
    class="pill other"
    :title="`Toon alleen ${subject === 'course' ? 'cursussen' : VIDEOS} van ${owner.name}`"
    data-test="owner"
    @click.stop="emit('filter', owner)"
  >
    {{ owner.name }}
  </button>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 2px 9px;
  border-radius: 999px;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Fixed colours, independent of the house style, so other organisations always stand out. */
.other {
  border: 1px solid var(--pill-other-border);
  background: var(--pill-other-bg);
  color: var(--pill-other-fg);
  cursor: pointer;
}
.other:hover { background: var(--pill-other-bg-hover); }
.other:focus-visible { outline: 2px solid var(--pill-other-fg); outline-offset: 1px; }
.own {
  border: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--muted);
  font-weight: 500;
}
</style>
