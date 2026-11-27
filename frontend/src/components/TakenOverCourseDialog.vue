<script setup>
// Window of a course taken over from the course library (specs/010 contracts/ui.md § Venster van
// een overgenomen cursus): a summary of the chosen version, the choice for a newer version, the
// explanation when the owner withdrew the course, and removing it from the own organisation.
// Never a way to the editor of the original (FR-008); "Aanpassen" makes an own copy (specs/011).
import { computed, ref } from 'vue'
import { copyReference, removeReference, useNewVersion, keepVersion } from '../api/courseReferences'
import { formatPublishedAt } from '../lib/publication'
import { COPY_DONE, COPY_GONE, copyConfirmation, withdrawnText } from '../lib/courseReference'
import { confirmDialog, toast } from '../lib/ui'
import { useCourseReferences } from '../stores/courseReferences'
import Icon from './Icon.vue'
import Modal from './Modal.vue'

const props = defineProps({ reference: { type: Object, required: true } })
// copied: the id of the own copy (specs/011); stale: the course is gone meanwhile, reload the lists.
const emit = defineEmits(['close', 'removed', 'changed', 'copied', 'stale'])
const store = useCourseReferences()

const current = ref(props.reference)
const busy = ref(false)
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`
const explanation = computed(() => withdrawnText(current.value))

function update(reference) {
  current.value = reference
  store.replace(reference)
  emit('changed', reference)
}

async function useNew() {
  busy.value = true
  try {
    const reference = await useNewVersion(current.value.courseId)
    update(reference)
    toast(`Jullie VR-brillen krijgen versie ${reference.version.versionNumber} bij de volgende synchronisatie.`)
  } catch (error) {
    // The situation changed meanwhile: show the current state, no error needed.
    if (error.code === 'no_newer_version' && error.reference) update(error.reference)
    else toast(error.message)
  } finally {
    busy.value = false
  }
}

async function keep() {
  busy.value = true
  try {
    update(await keepVersion(current.value.courseId))
  } catch (error) {
    toast(error.message)
  } finally {
    busy.value = false
  }
}

/** "Aanpassen" (specs/011 US1): an own copy of the chosen version; the parent opens the editor. */
async function copy() {
  const r = current.value
  if (!(await confirmDialog(copyConfirmation(r)))) return
  busy.value = true
  try {
    const { courseId } = await copyReference(r.courseId)
    store.remove(r.courseId)
    toast(COPY_DONE)
    emit('copied', courseId)
  } catch (error) {
    if (error.code === 'course_already_copied' || error.status === 404) {
      store.remove(r.courseId)
      toast(error.status === 404 ? COPY_GONE : error.message)
      emit('stale', r.courseId)
    } else {
      toast(error.message)
    }
  } finally {
    busy.value = false
  }
}

async function remove() {
  const r = current.value
  const ok = await confirmDialog({
    title: 'Cursus verwijderen uit jouw organisatie?',
    body:
      `“${r.name}” verdwijnt uit jouw cursussen en is na de volgende synchronisatie niet meer te downloaden op de VR-brillen. De cursus van ${r.owner.name} zelf blijft bestaan.` +
      (r.withdrawn ? ' Je kunt hem daarna niet opnieuw toevoegen, omdat hij niet meer in de cursusbibliotheek staat.' : ''),
    confirmLabel: 'Verwijderen',
    danger: true,
  })
  if (!ok) return
  try {
    await removeReference(r.courseId)
    store.remove(r.courseId)
    toast('Cursus verwijderd uit jouw cursussen')
    emit('removed', r.courseId)
  } catch (error) {
    toast(error.message)
  }
}
</script>

<template>
  <Modal :title="current.name" width="560px" @close="emit('close')">
    <div class="view" data-test="taken-over-details">
      <img v-if="current.thumbnailUrl" class="th" :src="current.thumbnailUrl" :alt="current.name" />
      <div v-else class="th placeholder" aria-hidden="true" />
      <p class="owner"><span class="pill" data-test="taken-over-pill">Overgenomen van {{ current.owner.name }}</span></p>
      <p v-if="current.description" class="description">{{ current.description }}</p>
      <dl class="facts">
        <dt>Versie</dt>
        <dd data-test="chosen-version">{{ current.version.versionNumber }}</dd>
        <dt>Gepubliceerd op</dt>
        <dd>{{ formatPublishedAt(current.version.publishedAt) }}</dd>
        <dt>Onderdelen</dt>
        <dd>{{ plural(current.version.stepCount, 'onderdeel', 'onderdelen') }}</dd>
        <dt>Video's</dt>
        <dd>{{ plural(current.version.videoCount, 'video', "video's") }}</dd>
        <dt>Toegevoegd op</dt>
        <dd>{{ formatPublishedAt(current.addedAt) }}</dd>
      </dl>

      <p v-if="explanation" class="withdrawn" data-test="withdrawn"><Icon name="info" :size="15" />{{ explanation }}</p>

      <div v-else-if="current.newVersion" class="choice" data-test="version-choice">
        <p>
          Jullie VR-brillen gebruiken versie {{ current.version.versionNumber }} van
          {{ formatPublishedAt(current.version.publishedAt) }}. Er is een nieuwe versie: versie
          {{ current.newVersion.versionNumber }} van {{ formatPublishedAt(current.newVersion.publishedAt) }}.
        </p>
        <div class="choice-buttons">
          <button type="button" class="btn btn-primary" :disabled="busy" data-test="use-new-version" @click="useNew">Nieuwe versie gebruiken</button>
          <button v-if="current.notice" type="button" class="btn" :disabled="busy" data-test="keep-version" @click="keep">Huidige versie houden</button>
        </div>
      </div>
    </div>
    <template #foot>
      <button type="button" class="btn btn-danger remove" data-test="remove-reference" @click="remove">Verwijderen uit mijn organisatie</button>
      <button type="button" class="btn" :disabled="busy" data-test="copy-reference" @click="copy">Aanpassen</button>
      <button type="button" class="btn btn-primary" data-test="details-close" @click="emit('close')">Sluiten</button>
    </template>
  </Modal>
</template>

<style scoped>
.view { display: grid; gap: 8px; }
.th { width: 100%; aspect-ratio: 2 / 1; object-fit: cover; border-radius: var(--r); background: var(--surface-2); }
.owner { margin: 0; }
.pill {
  display: inline-flex;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  background: var(--brand-soft);
  color: var(--brand-text);
}
.description { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 4px 0 0; font-size: 0.9rem; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; }
.withdrawn { display: flex; gap: 6px; align-items: flex-start; margin: 8px 0 0; color: var(--muted); font-size: 0.9rem; }
.choice { display: grid; gap: 8px; margin-top: 8px; padding: 12px; border: 1px solid var(--line); border-radius: var(--r); }
.choice p { margin: 0; }
.choice-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.remove { margin-right: auto; }
</style>
