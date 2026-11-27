<script setup>
// The organisation's courses with their publication status (specs/004 contracts/ui.md § Cursussen,
// specs/006 contracts/ui.md § Cursusoverzicht), and the courses taken over from the course library
// (specs/010 contracts/ui.md § Cursusoverzicht).
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listCourses, createCourse, deleteCourse } from '../api/courses'
import { timeAgo } from '../lib/util'
import { confirmDialog, toast } from '../lib/ui'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import DescriptionField from '../components/DescriptionField.vue'
import PublicationStatus from '../components/PublicationStatus.vue'
import { AVAILABILITY_LABEL, formatPublishedAt } from '../lib/publication'
import { newVersionLabel, receiversSentence, withdrawnText } from '../lib/courseReference'
import { useCourseReferences } from '../stores/courseReferences'
import TakenOverCourseDialog from '../components/TakenOverCourseDialog.vue'

const router = useRouter()
const references = useCourseReferences()
const courses = ref([])
const openReference = ref(null)
const loadState = ref('loading') // loading | ready | error

async function load() {
  loadState.value = 'loading'
  try {
    const [own] = await Promise.all([listCourses(), references.load()])
    courses.value = own
    loadState.value = 'ready'
  } catch {
    loadState.value = 'error'
  }
}
onMounted(load)

// Taken-over courses below the own courses, by name (specs/010 contracts/ui.md).
const takenOver = computed(() =>
  [...references.references].sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }) || a.courseId - b.courseId),
)

const rows = computed(() =>
  courses.value.map((c) => ({ c, updatedAt: new Date(c.updatedAt).getTime(), videos: c.videoStepCount, questions: c.questionStepCount })),
)

// Limits of FR-026, counted like the server (code points).
const NAME_MAX = 255
const DESCRIPTION_MAX = 1000
const showNew = ref(false)
const draft = ref({ name: '', description: '' })
const tried = ref(false)
const serverErrors = ref({})
const nameField = ref(null)
const message = computed(() => {
  if (!tried.value) return ''
  if (!draft.value.name.trim() || !draft.value.description.trim()) return 'Vul een naam en een beschrijving in.'
  return serverErrors.value.name ?? serverErrors.value.description ?? serverErrors.value.general ?? ''
})
function openNew() {
  draft.value = { name: '', description: '' }
  tried.value = false
  serverErrors.value = {}
  showNew.value = true
  nextTick(() => nameField.value?.$el.querySelector('input')?.focus())
}
async function create() {
  tried.value = true
  serverErrors.value = {}
  if (!draft.value.name.trim() || !draft.value.description.trim()) return
  try {
    const c = await createCourse({ name: draft.value.name.trim(), description: draft.value.description.trim() })
    showNew.value = false
    router.push('/courses/' + c.id)
  } catch (error) {
    serverErrors.value = error.fields && Object.keys(error.fields).length ? error.fields : { general: error.message }
  }
}
async function remove(c) {
  const ok = await confirmDialog({
    title: 'Cursus verwijderen?',
    // A published course also goes off the VR headsets (specs/006 FR-021).
    // A shared course also leaves the course library (specs/009 FR-025).
    body:
      (c.status && c.status !== 'draft'
        ? `“${c.name}” wordt verwijderd. Deze cursus is gepubliceerd. Na verwijderen is hij niet meer te downloaden op de VR-brillen.`
        : `“${c.name}” wordt verwijderd.`) +
      (c.visibility && c.visibility !== 'private' ? ' Andere organisaties zien hem dan ook niet meer in de cursusbibliotheek.' : '') +
      // Organisations that took it over keep their version (specs/010 FR-019).
      (c.receiverCount ? ` ${receiversSentence(c.receiverCount)}` : ''),
    confirmLabel: 'Verwijderen',
    danger: true,
  })
  if (!ok) return
  try {
    await deleteCourse(c.id)
    courses.value = courses.value.filter((x) => x.id !== c.id)
    toast('Cursus verwijderd')
  } catch (error) {
    toast(error.message)
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Cursussen</h1>
      <button class="btn btn-primary" @click="openNew"><Icon name="plus" :size="15" />Nieuwe cursus</button>
    </div>

    <p v-if="loadState === 'loading'" class="muted">Cursussen laden…</p>
    <div v-else-if="loadState === 'error'" class="empty">
      <p>De cursussen konden niet worden geladen.</p>
      <button class="btn" @click="load">Opnieuw</button>
    </div>
    <div v-else-if="!rows.length && !takenOver.length" class="empty">
      <p>Er zijn nog geen cursussen.</p>
      <button class="btn" @click="openNew">Maak de eerste cursus</button>
      <p data-test="library-hint">
        Je kunt ook een cursus van een andere organisatie toevoegen via de
        <RouterLink to="/course-library">Cursusbibliotheek</RouterLink>.
      </p>
    </div>

    <ul v-else-if="rows.length" class="list">
      <li v-for="r in rows" :key="r.c.id" class="row">
        <RouterLink :to="'/courses/' + r.c.id" class="main">
          <span class="name">{{ r.c.name }}</span>
          <span class="meta">
            {{ r.videos }} {{ r.videos === 1 ? 'video' : 'video’s' }} · {{ r.questions }} {{ r.questions === 1 ? 'vraag' : 'vragen' }} · bewerkt {{ timeAgo(r.updatedAt) }}
          </span>
        </RouterLink>
        <span class="row-status">
          <PublicationStatus compact :status="r.c.status" :publication="r.c.publication ?? null" />
          <!-- Who sees a published course in the course library (specs/009 contracts/ui.md). -->
          <span v-if="r.c.status && r.c.status !== 'draft' && r.c.visibility" class="availability" data-test="course-availability">
            {{ AVAILABILITY_LABEL[r.c.visibility] }}
          </span>
        </span>
        <button class="icon-btn" title="Verwijderen" @click="remove(r.c)"><Icon name="trash" :size="16" /></button>
      </li>
    </ul>

    <template v-if="loadState === 'ready' && takenOver.length">
      <h2 class="section-head" data-test="taken-over-section">Overgenomen cursussen</h2>
      <ul class="list">
        <li v-for="r in takenOver" :key="r.courseId" class="row" data-test="taken-over-row">
          <button type="button" class="main ref" @click="openReference = r">
            <img v-if="r.thumbnailUrl" class="ref-th" :src="r.thumbnailUrl" alt="" />
            <span v-else class="ref-th placeholder" aria-hidden="true" />
            <span class="ref-text">
              <span class="name">{{ r.name }}</span>
              <span class="pill" data-test="taken-over-pill">Overgenomen van {{ r.owner.name }}</span>
            </span>
          </button>
          <span class="row-status">
            <span class="publication-detail">Op de Quest: versie {{ r.version.versionNumber }} · {{ formatPublishedAt(r.version.publishedAt) }}</span>
            <span v-if="withdrawnText(r)" class="withdrawn" data-test="withdrawn"><Icon name="info" :size="13" />{{ withdrawnText(r) }}</span>
            <span v-else-if="r.notice" class="notice" data-test="new-version-notice"><Icon name="info" :size="13" />{{ newVersionLabel(r) }}</span>
            <span v-else-if="r.newVersion" class="newer" data-test="newer-version">{{ newVersionLabel(r) }}</span>
          </span>
        </li>
      </ul>
    </template>

    <TakenOverCourseDialog
      v-if="openReference"
      :reference="openReference"
      @close="openReference = null"
      @removed="openReference = null"
    />

    <Modal v-if="showNew" title="Nieuwe cursus" @close="showNew = false">
      <form id="new-course" class="form" @submit.prevent="create">
        <DescriptionField
          id="nc-name"
          ref="nameField"
          v-model="draft.name"
          label="Naam"
          subject="De naam"
          test-id="course-name"
          :max="NAME_MAX"
          :optional="false"
          :multiline="false"
          :invalid="tried && (!draft.name.trim() || !!serverErrors.name)"
        />
        <DescriptionField
          id="nc-desc"
          v-model="draft.description"
          test-id="course-description"
          :max="DESCRIPTION_MAX"
          :optional="false"
          :invalid="tried && (!draft.description.trim() || !!serverErrors.description)"
        />
        <p v-if="message" class="hint err" data-test="create-error">{{ message }}</p>
      </form>
      <template #foot>
        <button class="btn btn-ghost" @click="showNew = false">Annuleren</button>
        <button class="btn btn-primary" type="submit" form="new-course">Aanmaken</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  overflow: hidden;
}
.row { display: flex; align-items: center; gap: 16px; padding: 0 12px 0 0; }
.row + .row { border-top: 1px solid var(--line); }
.row-status { display: grid; gap: 2px; justify-items: start; }
.availability { font-size: 0.8rem; color: var(--muted); }
.row:hover { background: var(--brand-soft); }
.row:hover .name { color: var(--brand-text); }
.main { flex: 1; min-width: 0; display: grid; gap: 2px; padding: 14px 20px; text-decoration: none; color: inherit; }
.name { font-weight: 600; }
.meta { font-size: 0.85rem; color: var(--muted); }
.row .icon-btn { opacity: 0; }
.row:hover .icon-btn,
.row .icon-btn:focus-visible { opacity: 1; }
.empty {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 48px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  color: var(--muted);
}
.form { display: grid; gap: 16px; }
.section-head { margin: 28px 0 10px; font-size: 1.05rem; }
.ref { display: flex; align-items: center; gap: 12px; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; }
.ref-th { width: 72px; aspect-ratio: 2 / 1; object-fit: cover; border-radius: var(--r); background: var(--surface-2); flex: none; }
.ref-text { display: grid; gap: 4px; justify-items: start; min-width: 0; }
.pill { padding: 1px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: var(--brand-soft); color: var(--brand-text); }
.publication-detail { font-size: 0.85rem; }
.withdrawn, .newer { display: inline-flex; gap: 4px; align-items: center; font-size: 0.8rem; color: var(--muted); }
.notice { display: inline-flex; gap: 4px; align-items: center; font-size: 0.8rem; font-weight: 600; color: var(--brand-text); }
@media (max-width: 600px) {
  .row { flex-wrap: wrap; gap: 0 12px; padding-bottom: 12px; }
  .row .row-status { padding-left: 20px; }
  .row .icon-btn { opacity: 1; margin-left: auto; }
}
</style>
