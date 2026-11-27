<script setup>
// Central course library (specs/009 FR-013 – FR-020, contracts/ui.md § Cursusbibliotheek): the
// live versions of the courses that other organisations share with this one, and the own shared
// courses, in one list. Search, filter and sort work on that list in the browser (FR-019); the
// course window opens on top, so the list keeps its state. Only a summary is shown (FR-018).
import { computed, onMounted, ref } from 'vue'
import { getLibraryCourse, listLibraryCourses } from '../api/courseLibrary'
import { DEFAULT_SORT, libraryView, OWNERSHIP_OPTIONS, SORT_OPTIONS } from '../lib/courseLibrary'
import { formatDate } from '../lib/format'
import { toast } from '../lib/ui'
import CourseLibraryDetailsDialog from '../components/CourseLibraryDetailsDialog.vue'
import OwnerPill from '../components/OwnerPill.vue'

const NOT_AVAILABLE = 'Deze cursus is niet meer beschikbaar.'

const courses = ref([])
const loaded = ref(false)
const loadError = ref('')
const openCourse = ref(null) // the course in the course window, or null when it is closed

const query = ref('')
const ownership = ref('all')
const sort = ref(DEFAULT_SORT)
// Organisation chosen by clicking its pill: { id, name }, or null.
const ownerFilter = ref(null)
const shown = computed(() =>
  libraryView(courses.value, {
    query: query.value,
    ownership: ownership.value,
    ownerId: ownerFilter.value?.id ?? null,
    sort: sort.value,
  }),
)
const filtering = computed(() => query.value.trim() !== '' || ownership.value !== 'all' || ownerFilter.value !== null)

function filterOnOwner(owner) {
  ownerFilter.value = { id: owner.id, name: owner.name }
}
function filterOnOwnerFromWindow(owner) {
  openCourse.value = null
  filterOnOwner(owner)
}
function clearFilters() {
  query.value = ''
  ownership.value = 'all'
  ownerFilter.value = null
}

async function load() {
  try {
    courses.value = await listLibraryCourses()
    loadError.value = ''
  } catch (err) {
    if (err.status !== 401) loadError.value = 'De cursusbibliotheek kon niet worden geladen. Probeer het later opnieuw.'
  } finally {
    loaded.value = true
  }
}
onMounted(load)

// The window shows the course as it is now. A course that was unpublished or deleted meanwhile
// leaves the loaded list with a message (specs/009 US5, research R11); there is no polling.
async function open(course) {
  try {
    openCourse.value = await getLibraryCourse(course.id)
  } catch (err) {
    if (err.status === 404) {
      toast(NOT_AVAILABLE)
      courses.value = courses.value.filter((row) => row.id !== course.id)
    } else if (err.status !== 401) toast(err.message)
  }
}

// After "Toevoegen aan mijn organisatie" (specs/010 US1).
function markAdded(courseId) {
  courses.value = courses.value.map((row) => (row.id === courseId ? { ...row, takenOver: true } : row))
  if (openCourse.value?.id === courseId) openCourse.value = { ...openCourse.value, takenOver: true }
}
function unavailable() {
  openCourse.value = null
  toast(NOT_AVAILABLE)
  load()
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Cursusbibliotheek</h1>
        <p class="muted intro">Cursussen die andere organisaties met jullie delen, en jullie eigen gedeelde cursussen.</p>
      </div>
    </div>

    <p v-if="loadError" class="error">{{ loadError }}</p>

    <div v-if="courses.length" class="toolbar" data-test="toolbar">
      <input
        v-model="query"
        class="input search"
        type="search"
        placeholder="Zoek op naam, beschrijving of organisatie"
        aria-label="Zoek op naam, beschrijving of organisatie"
        data-test="search"
      />
      <button
        v-if="ownerFilter"
        type="button"
        class="chip"
        :aria-label="`Filter op ${ownerFilter.name} wissen`"
        data-test="owner-filter"
        @click="ownerFilter = null"
      >
        Organisatie: {{ ownerFilter.name }} <span class="chip-x" aria-hidden="true">✕</span>
      </button>
      <div class="seg" role="group" aria-label="Welke cursussen">
        <button
          v-for="option in OWNERSHIP_OPTIONS"
          :key="option.key"
          type="button"
          :class="{ on: ownership === option.key }"
          :aria-pressed="ownership === option.key"
          :data-test="`ownership-${option.key}`"
          @click="ownership = option.key"
        >
          {{ option.label }}
        </button>
      </div>
      <select v-model="sort" class="select sort" aria-label="Sorteren" data-test="sort">
        <option v-for="option in SORT_OPTIONS" :key="option.key" :value="option.key">{{ option.label }}</option>
      </select>
    </div>

    <ul v-if="shown.length" class="grid">
      <li v-for="course in shown" :key="course.id" class="card" data-test="library-course">
        <button type="button" class="open" :aria-label="`${course.name} openen`" @click="open(course)">
          <img v-if="course.thumbnailUrl" class="th" :src="course.thumbnailUrl" :alt="course.name" loading="lazy" />
          <span v-else class="th placeholder" aria-hidden="true" data-test="placeholder" />
          <span class="name">{{ course.name }}</span>
        </button>
        <span class="labels">
          <OwnerPill :owner="course.owner" subject="course" @filter="filterOnOwner" />
          <span v-if="course.takenOver" class="added" data-test="course-added">Toegevoegd</span>
        </span>
        <span v-if="course.description" class="description" data-test="description">{{ course.description }}</span>
        <span class="meta">Versie {{ course.versionNumber }} · {{ formatDate(course.publishedAt) }}</span>
        <span class="meta">{{ plural(course.stepCount, 'onderdeel', 'onderdelen') }} · {{ plural(course.videoCount, 'video', "video's") }}</span>
      </li>
    </ul>

    <div v-else-if="courses.length && filtering" class="empty" data-test="no-results">
      <p>Geen cursussen gevonden</p>
      <button class="btn" data-test="clear-filters" @click="clearFilters">Zoekterm en filters wissen</button>
    </div>

    <div v-else-if="loaded && !loadError && !courses.length" class="empty" data-test="library-empty">
      <p>Er zijn nog geen gedeelde cursussen.</p>
    </div>

    <CourseLibraryDetailsDialog
      v-if="openCourse"
      :course="openCourse"
      @close="openCourse = null"
      @filter-owner="filterOnOwnerFromWindow"
      @added="markAdded"
      @unavailable="unavailable"
    />
  </div>
</template>

<style scoped>
.intro { margin: 4px 0 0; }
.error {
  padding: 8px 14px;
  border-radius: var(--r);
  background: var(--err-soft);
  color: var(--err);
}
.toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search { flex: 1 1 260px; }
.sort { width: auto; }
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px 16px;
}
.card { display: grid; gap: 2px; align-content: start; }
.open { display: grid; gap: 2px; padding: 0; border: 0; background: none; text-align: left; cursor: pointer; color: inherit; font: inherit; }
.open:hover .name { text-decoration: underline; }
.th {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 1;
  object-fit: cover;
  border-radius: var(--r);
  border: 1px solid var(--line);
  background: var(--surface-2);
  margin-bottom: 6px;
}
.name { font-weight: 500; font-size: 0.9rem; line-height: 1.35; overflow-wrap: anywhere; }
.added { padding: 2px 9px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; background: var(--surface-2); color: var(--muted); }
.labels { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; margin: 2px 0; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--pill-other-border);
  border-radius: 999px;
  background: var(--pill-other-bg);
  color: var(--pill-other-fg);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.chip:hover { background: var(--pill-other-bg-hover); }
.chip-x { font-size: 0.8rem; }
/* At most two lines in the list; the full description is in the course window. */
.description {
  font-size: 0.82rem;
  color: var(--fg);
  white-space: pre-line;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}
.meta { font-size: 0.82rem; color: var(--muted); }
.empty { display: grid; justify-items: start; gap: 12px; color: var(--muted); }
</style>
