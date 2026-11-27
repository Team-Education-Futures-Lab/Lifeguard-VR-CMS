<script setup>
// Shell for everything an organisation sees, in its own house style (FR-026).
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import { confirmDialog } from '../lib/ui'
import { useStyle } from '../stores/style'
import { useCourseReferences } from '../stores/courseReferences'
import { noticeCountLabel } from '../lib/courseReference'
import { useUploads } from '../stores/uploads'
import OrgLogo from './OrgLogo.vue'
import UploadIndicator from './UploadIndicator.vue'
import UploadRejectedDialog from './UploadRejectedDialog.vue'

const auth = useAuth()
const style = useStyle()
const uploads = useUploads()
const references = useCourseReferences()
const route = useRoute()
const router = useRouter()

const inEditor = computed(() => route.path.startsWith('/courses/'))
const branding = computed(() => ({ logo: style.logoUrl }))

onMounted(() => {
  style.loadStyle().catch(() => style.applyDefault())
  // The counter of new versions of taken-over courses (specs/010 FR-012); no polling.
  references.load()
})

async function logout() {
  // Logging out interrupts running uploads; they can be resumed later (FR-006c).
  if (uploads.hasActive) {
    const ok = await confirmDialog({
      title: 'Uitloggen?',
      body: 'Er loopt nog een upload. Als je uitlogt, wordt de upload onderbroken. Je kunt hem later hervatten door hetzelfde bestand opnieuw te kiezen.',
      confirmLabel: 'Uitloggen',
    })
    if (!ok) return
    await uploads.abortAll()
  }
  const target = await auth.logout()
  style.applyDefault()
  references.reset()
  router.push(target)
}
</script>

<template>
  <div class="shell" :class="{ 'in-editor': inEditor }">
    <header class="topbar">
      <RouterLink to="/" class="topbar-org">
        <OrgLogo :org="auth.organisation" :branding="branding" :size="28" on-brand />
        <span class="topbar-name">{{ auth.organisation?.name }}</span>
      </RouterLink>
      <nav class="nav" aria-label="Hoofdmenu">
        <RouterLink to="/courses" :class="{ on: route.path.startsWith('/courses') }">
          Cursussen
          <span
            v-if="references.noticeCount > 0"
            class="count"
            data-test="notice-count"
            :aria-label="noticeCountLabel(references.noticeCount)"
            :title="noticeCountLabel(references.noticeCount)"
          >{{ references.noticeCount }}</span>
        </RouterLink>
        <RouterLink to="/course-library" active-class="on">Cursusbibliotheek</RouterLink>
        <RouterLink to="/videos" active-class="on">Video’s</RouterLink>
        <RouterLink to="/settings/style" active-class="on">Huisstijl</RouterLink>
        <RouterLink to="/quest" active-class="on">Quest koppelen</RouterLink>
      </nav>
      <button class="topbar-logout" @click="logout">Uitloggen</button>
    </header>

    <main class="main">
      <RouterView :key="auth.organisation?.id" />
    </main>
    <UploadIndicator />
    <UploadRejectedDialog />
  </div>
</template>
