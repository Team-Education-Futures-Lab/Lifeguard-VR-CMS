<script setup>
// "Quest koppelen": the quest link code of the own organisation, with a way to make a new one
// (specs/007 FR-017, FR-018). Texts from contracts/organisation-api.md.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getQuestLink, renewQuestLink } from '../api/questLink'
import { confirmDialog, toast } from '../lib/ui'

const code = ref('')
const loadError = ref('')
const renewError = ref('')
const busy = ref(false)
const copied = ref(false)
let copiedTimer

onMounted(async () => {
  try {
    code.value = await getQuestLink()
  } catch (e) {
    loadError.value = e.message
  }
})
onBeforeUnmount(() => clearTimeout(copiedTimer))

async function copy() {
  try {
    await navigator.clipboard.writeText(code.value)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Copying is a convenience; the code stays visible to type over.
  }
}

async function renew() {
  const ok = await confirmDialog({
    title: 'Nieuwe koppelcode maken?',
    body: 'De oude code werkt daarna niet meer. Alle Quests van jullie organisatie moeten opnieuw gekoppeld worden met de nieuwe code.',
    confirmLabel: 'Nieuwe code maken',
    danger: true,
  })
  if (!ok) return
  renewError.value = ''
  busy.value = true
  try {
    code.value = await renewQuestLink()
    copied.value = false
    toast('Er is een nieuwe koppelcode gemaakt.')
  } catch {
    renewError.value = 'Het maken van een nieuwe code is niet gelukt. Probeer het opnieuw.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page narrow">
    <div class="page-head"><h1>Quest koppelen</h1></div>

    <section class="card">
      <p class="muted">
        Met deze code koppel je een Quest aan jullie organisatie. Vul hem in op de Quest. Dit is niet de code waarmee je
        inlogt in het CMS.
      </p>

      <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>
      <div v-else-if="code" class="code-row">
        <span class="code" aria-label="Koppelcode">{{ code }}</span>
        <button class="btn btn-sm" @click="copy">{{ copied ? 'Gekopieerd' : 'Kopiëren' }}</button>
      </div>

      <p v-if="renewError" class="error" role="alert">{{ renewError }}</p>
      <div>
        <button class="btn btn-sm btn-ghost" :disabled="busy || !code" @click="renew">Nieuwe koppelcode maken</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.code-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.code {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  padding: 8px 16px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-sm);
  background: var(--surface);
  user-select: all;
}
</style>
