// Shared editor state for the three editor variants. The editor works on a local copy of the
// draft; nothing is stored until "Opslaan als concept" (specs/004 FR-009, research R10).
import { ref, computed, inject, provide, reactive, watch } from 'vue'
import * as C from '../lib/course'
import { checkCourse } from '../lib/completeness'
import {
  answerKeyOf,
  applyKeyChanges,
  keyChanges,
  publicationOf,
  savedKeys,
  savedVideos,
  stepKeyOf,
  toEditor,
  toPayload,
} from '../lib/courseMapping'
import { snapCourse } from '../lib/history'
import { getEditorVariant, setEditorVariant } from '../lib/editorPreference'
import { confirmDialog, toast } from '../lib/ui'

const KEY = Symbol('editor')

/**
 * `course` is a ref with the editor model, `stepVideos` a reactive map videoId → video details,
 * `doc` the draft document the course was loaded from, `save(payload)` stores a draft and returns
 * the saved document. `publish()` and `unpublish()` call the API and return the draft document
 * (specs/006 contracts/api.md).
 */
export function provideEditor({ course, stepVideos: initialVideos, doc, history, save, publish: publishRequest, unpublish: unpublishRequest }) {
  const stepVideos = reactive(initialVideos)
  const selectedId = ref(null)
  const selectedEdge = ref(null) // '<sourceId>__<handle>' of a selected connection
  const hoverEdge = ref(null) // the connection under the pointer
  const modalId = ref(null) // variant "Canvas": the part open in the dialog
  const focusRequest = ref(null) // { id, t } – the canvas centres on this part
  const showSettings = ref(false)
  const variant = ref(getEditorVariant())
  const lastCanvas = ref(variant.value === 'list' ? 'inspector' : variant.value)
  watch(variant, (v) => {
    setEditorVariant(v)
    if (v !== 'list') lastCanvas.value = v
  })

  // What was last saved: its snapshot (for "unsaved changes") and its keys (for the payload).
  const savedSnapshot = ref(snapCourse(course.value))
  let saved = savedKeys(doc)
  // The video of every saved video step, and the steps that came back through undo without the
  // video they had, because it can no longer be picked (FR-020d, research R5b).
  let savedVideoOf = savedVideos(doc)
  const lostVideoNotices = reactive(new Set())
  const dirty = computed(() => snapCourse(course.value) !== savedSnapshot.value)
  const saving = ref(false)
  const fieldErrors = ref({})
  // The draft this editor works on, and the publication status of the course (specs/006 FR-018,
  // FR-019, research R14). A save from a draft that was published meanwhile is refused; the
  // message of the server is kept to show the "Cursus is intussen gepubliceerd" dialog.
  const draftVersionNumber = doc.draftVersionNumber ?? null
  const publication = reactive(publicationOf(doc))
  const draftReplaced = ref(null)
  // Publishing (specs/006 US1, US2, research R7): a request is running; the messages that keep the
  // course from being published, shown in the "Nog niet klaar om te publiceren" dialog.
  const publishing = ref(false)
  const publishIssues = ref(null)

  const ordered = computed(() => C.orderedNodes(course.value))

  // The live completeness check (specs/005 FR-017). Issues present at the last click on
  // "Opslaan als concept" are red, newer ones orange (FR-022a, research R5).
  const issues = computed(() => checkCourse(course.value, stepVideos))
  const flaggedIssueIds = reactive(new Set())
  const isFlagged = (issue) => flaggedIssueIds.has(issue.id)

  // The connection in focus (hovered, else selected) and its two steps: they come to the front,
  // the rest dims, so crossing lines stay apart (verbeterronde 005, punt 4).
  const focusEdge = computed(() => hoverEdge.value ?? selectedEdge.value)
  const focusEnds = computed(() => {
    if (!focusEdge.value) return null
    const [source, handle] = focusEdge.value.split('__')
    return [source, C.targetOf(course.value, source, handle)]
  })

  function select(id) {
    selectedId.value = id
    selectedEdge.value = null
  }
  function selectEdge(id) {
    selectedEdge.value = id
    selectedId.value = null
  }
  function clearSelection() {
    selectedId.value = null
    selectedEdge.value = null
  }
  /** Show a part for editing, whatever the current variant. */
  function open(id) {
    if (variant.value === 'list') variant.value = lastCanvas.value
    select(id)
    if (variant.value === 'popover') modalId.value = id
    focusRequest.value = { id, t: Date.now() }
  }

  function freeSpot() {
    const nodes = course.value.nodes
    if (!nodes.length) return { x: 0, y: 0 }
    const maxX = Math.max(...nodes.map((n) => n.x + C.NODE_W[n.type]))
    return { x: maxX + 60, y: Math.min(...nodes.map((n) => n.y)) }
  }
  const addNode = (type, pos) => C.addNode(course.value, type, pos ?? freeSpot())
  // Connections (specs/005 FR-001 – FR-003, FR-020); all of them fall under undo.
  const connect = (source, handle, target) => C.connect(course.value, source, handle, target)
  const disconnect = (source, handle) => C.disconnect(course.value, source, handle)
  const addLinked = (sourceId, handle, type, pos) => C.addLinkedNode(course.value, sourceId, handle, type, pos)

  /** "Canvas ordenen" along the route, without a question; one undo puts it back (punt 7). */
  function tidyCanvas() {
    history.flush()
    C.autoLayout(course.value)
    focusRequest.value = { id: null, t: Date.now() }
    toast('Canvas geordend', { actionLabel: 'Ongedaan maken', action: () => history.undo() })
  }
  /** Marks a step as the only start step; `null` leaves the course without one (FR-018). */
  const setStart = (id) => (course.value.startId = id)

  const isLost = (videoId) => videoId != null && stepVideos[videoId]?.available === false

  /**
   * Before a step loses a video that the organisation can no longer pick: the warning of FR-020b.
   * Resolves true when the action may go ahead (always for available videos).
   */
  function confirmLosingVideo(node) {
    if (node?.type !== 'video' || !isLost(node.videoId)) return Promise.resolve(true)
    return confirmDialog({
      title: 'Video niet meer beschikbaar',
      body: 'Deze video is niet meer beschikbaar voor jouw organisatie (privé gemaakt of verwijderd). Haal je hem uit de cursus, dan kun je hem daarna niet opnieuw toevoegen.',
      confirmLabel: 'Doorgaan',
      danger: true,
    })
  }

  /** Removes a step, after the warning when needed. Resolves true when removed. */
  async function removeNode(id) {
    if (!(await confirmLosingVideo(C.findNode(course.value, id)))) return false
    C.deleteNode(course.value, id)
    if (selectedId.value === id) selectedId.value = null
    if (modalId.value === id) modalId.value = null
    toast('Onderdeel verwijderd', { actionLabel: 'Ongedaan maken', action: () => history.undo() })
    return true
  }

  /** "Video weghalen" (FR-020c): the step stays, without a video. */
  async function clearVideo(node) {
    if (!(await confirmLosingVideo(node))) return false
    node.videoId = null
    return true
  }

  /** Puts a video from the library in a step. Resolves true when chosen. */
  async function chooseVideo(node, video) {
    if (node.videoId !== video.id && !(await confirmLosingVideo(node))) return false
    rememberVideo(video)
    node.videoId = video.id
    lostVideoNotices.delete(node.id)
    return true
  }

  // Undo/redo must not bring back a video that can no longer be picked into a step that no longer
  // has it in the saved draft: the step comes back empty, with a notice (FR-020d).
  history.setTransform((snapshot) => {
    for (const n of snapshot.nodes) {
      if (n.type !== 'video' || !isLost(n.videoId) || savedVideoOf.get(n.id) === n.videoId) continue
      n.videoId = null
      lostVideoNotices.add(n.id)
    }
    return snapshot
  })

  /** Remembers the details of a video picked from the library (always available). */
  function rememberVideo(video) {
    stepVideos[video.id] = {
      name: video.name,
      durationSeconds: video.durationSeconds,
      thumbnailUrl: video.thumbnailUrl,
      available: true,
    }
  }

  /** "Opslaan als concept". Returns true when saved. */
  async function saveDraft() {
    history.flush()
    fieldErrors.value = {}
    // FR-022a: what is still to do at this click turns red, whether or not the save succeeds.
    flaggedIssueIds.clear()
    for (const issue of issues.value.issues) flaggedIssueIds.add(issue.id)
    // A course needs a name and a description (FR-005): no request, the dialog opens instead.
    const missing = {}
    if (!course.value.name?.trim()) missing.name = 'Vul een naam en een beschrijving in.'
    if (!course.value.description?.trim()) missing.description = 'Vul een naam en een beschrijving in.'
    if (Object.keys(missing).length) {
      fieldErrors.value = missing
      showSettings.value = true
      return false
    }
    saving.value = true
    const sent = JSON.parse(snapCourse(course.value))
    try {
      const result = await save(toPayload(course.value, saved, draftVersionNumber))
      // Keep the editor's own keys stable: map the keys that were sent to the saved ones.
      const changes = keyChanges(sent, result, saved)
      history.replaceKeys(changes)
      applyKeyChanges(course.value, changes)
      if (changes[selectedId.value]) selectedId.value = changes[selectedId.value]
      if (changes[modalId.value]) modalId.value = changes[modalId.value]
      Object.assign(stepVideos, toEditor(result).stepVideos)
      saved = savedKeys(result)
      savedVideoOf = savedVideos(result)
      for (const key of [...lostVideoNotices]) {
        if (!changes[key]) continue
        lostVideoNotices.delete(key)
        lostVideoNotices.add(changes[key])
      }
      // Issue ids contain step and answer keys; keep flagged issues red under their new keys.
      for (const id of [...flaggedIssueIds]) {
        const renamed = id.split(':').map((part) => changes[part] ?? part).join(':')
        if (renamed === id) continue
        flaggedIssueIds.delete(id)
        flaggedIssueIds.add(renamed)
      }
      // What was sent, with the new keys, is what is stored now; later edits stay unsaved.
      savedSnapshot.value = JSON.stringify(applyKeyChanges(sent, changes))
      applyPublication(result)
      return true
    } catch (error) {
      if (error.code === 'draft_replaced') {
        draftReplaced.value = error.message
        return false
      }
      if (error.code === 'validation_failed') fieldErrors.value = error.fields ?? {}
      if (error.status !== 401) toast('De cursus is niet opgeslagen. Probeer het opnieuw.')
      return false
    } finally {
      saving.value = false
    }
  }

  /** Marks these issues red, as a click on "Opslaan als concept" does (specs/005 FR-022a). */
  function flagIssues(list) {
    flaggedIssueIds.clear()
    for (const issue of list) flaggedIssueIds.add(issue.id)
  }

  /** A message of the server in the shape of the editor check (ids are editor keys). */
  function fromServerIssue(issue) {
    const nodeId = issue.stepId ? stepKeyOf(issue.stepId) : null
    const answerId = issue.answerId ? answerKeyOf(issue.answerId) : null
    return { id: [issue.code, nodeId, answerId].filter(Boolean).join(':'), code: issue.code, msg: issue.message, nodeId, answerId }
  }

  /**
   * "Publiceren" after the confirmation (specs/006 FR-001 – FR-007, research R7). Publishing works on
   * the saved draft only (verbeterronde V4): with unsaved changes nothing happens (the menu says
   * "Sla eerst je wijzigingen op"). With messages of the editor check nothing is sent: the dialog
   * shows them. The server checks again; its messages go to the same dialog. Returns the new draft
   * document, or null when nothing was published.
   */
  async function publish() {
    history.flush()
    if (dirty.value) return null
    const own = issues.value.issues
    if (own.length) {
      flagIssues(own)
      publishIssues.value = own
      return null
    }
    publishing.value = true
    try {
      return await publishRequest()
    } catch (error) {
      if (error.code === 'course_incomplete') {
        const list = (error.issues ?? []).map(fromServerIssue)
        flagIssues(list)
        publishIssues.value = list
      } else if (error.code === 'draft_replaced') draftReplaced.value = error.message
      else if (error.status !== 401) toast('Publiceren is niet gelukt. Probeer het opnieuw.')
      return null
    } finally {
      publishing.value = false
    }
  }

  /**
   * Takes over the publication status and the video details of a draft document that has the same
   * steps (after unpublishing, or when the same version went live again). Whether a video is kept
   * by the live version changes with it, so the check reports the video again when the live
   * version is gone (specs/006 FR-012, FR-013).
   */
  function applyPublication(result) {
    Object.assign(publication, publicationOf(result))
    Object.assign(stepVideos, toEditor(result).stepVideos)
  }

  /** "Onpubliceren" after the confirmation (specs/006 FR-015, FR-016). Returns true when done. */
  async function unpublish() {
    publishing.value = true
    try {
      applyPublication(await unpublishRequest())
      return true
    } catch (error) {
      if (error.status !== 401) toast('Onpubliceren is niet gelukt. Probeer het opnieuw.')
      return false
    } finally {
      publishing.value = false
    }
  }

  const ctx = reactive({
    course, stepVideos, history, ordered, variant, issues,
    selectedId, selectedEdge, hoverEdge, focusEdge, focusEnds, modalId, focusRequest, showSettings,
    dirty, saving, fieldErrors, lostVideoNotices, draftVersionNumber, publication, draftReplaced, publishing, publishIssues,
    select, selectEdge, clearSelection, open, isFlagged,
    addNode, addLinked, connect, disconnect, tidyCanvas, removeNode, setStart, clearVideo, chooseVideo, confirmLosingVideo, saveDraft,
    publish, unpublish, applyPublication,
  })
  provide(KEY, ctx)
  return ctx
}

export const useEditor = () => inject(KEY)
