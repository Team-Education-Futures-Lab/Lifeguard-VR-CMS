import { describe, expect, it } from 'vitest'
import {
  COPY_NOT_SHARED,
  HAS_COPY_HINT,
  addConfirmationBody,
  basedOnText,
  copyConfirmation,
  losingReceiversSentence,
  newVersionLabel,
  noticeCountLabel,
  receiversSentence,
  withdrawnText,
} from '../src/lib/courseReference'

// Texts for taken-over courses (specs/010 contracts/ui.md).

const ref = (changes) => ({ version: { versionNumber: 2 }, newVersion: null, notice: false, withdrawn: null, ...changes })

describe('withdrawnText', () => {
  it.each([
    ['unpublished', 'De eigenaar heeft deze cursus ingetrokken. Jullie houden versie 2.'],
    ['course_deleted', 'De eigenaar heeft deze cursus verwijderd. Jullie houden versie 2.'],
    ['no_access', 'De eigenaar deelt deze cursus niet meer met jullie. Jullie houden versie 2.'],
    ['owner_deleted', 'De eigenaar van deze cursus bestaat niet meer. Jullie houden versie 2.'],
  ])('%s', (withdrawn, text) => {
    expect(withdrawnText(ref({ withdrawn }))).toBe(text)
  })

  it('is empty when not withdrawn', () => {
    expect(withdrawnText(ref({}))).toBe('')
  })
})

describe('newVersionLabel', () => {
  it('is the notice, or the quiet text after keeping the version', () => {
    expect(newVersionLabel(ref({ newVersion: { versionNumber: 3 }, notice: true }))).toBe('Nieuwe versie beschikbaar (versie 3)')
    expect(newVersionLabel(ref({ newVersion: { versionNumber: 3 }, notice: false }))).toBe('Nieuwere versie beschikbaar (versie 3)')
    expect(newVersionLabel(ref({}))).toBe('')
  })
})

describe('sentences for the owner', () => {
  it('counts receivers in singular and plural', () => {
    expect(receiversSentence(0)).toBe('')
    expect(receiversSentence(1)).toBe('1 organisatie heeft deze cursus overgenomen en houdt haar huidige versie.')
    expect(receiversSentence(2)).toBe('2 organisaties hebben deze cursus overgenomen en houden hun huidige versie.')
    expect(losingReceiversSentence(1)).toBe('1 daarvan heeft deze cursus overgenomen en houdt haar huidige versie.')
    expect(losingReceiversSentence(3)).toBe('3 daarvan hebben deze cursus overgenomen en houden hun huidige versie.')
    expect(losingReceiversSentence(0)).toBe('')
  })

  it('labels the notice counter', () => {
    expect(noticeCountLabel(1)).toBe('1 cursus met een nieuwe versie')
    expect(noticeCountLabel(2)).toBe('2 cursussen met een nieuwe versie')
  })
})

describe('copy texts (specs/011)', () => {
  const reference = { name: 'Redden', owner: { name: 'Zwembad A' }, version: { versionNumber: 2 } }

  it('basedOnText', () => {
    expect(basedOnText({ courseName: 'Redden', ownerName: 'Zwembad A' })).toBe('Gebaseerd op Redden van Zwembad A')
    expect(basedOnText(null)).toBe('')
  })

  it('copyConfirmation names version, course and owner, and never "verwijzing"', () => {
    const { title, body, confirmLabel } = copyConfirmation(reference)
    expect(title).toBe('Deze cursus zelf aanpassen?')
    expect(confirmLabel).toBe('Aanpassen')
    expect(body).toContain('Je krijgt een eigen kopie van versie 2 van “Redden”.')
    expect(body).toContain('De kopie krijgt geen nieuwe versies meer van Zwembad A, en de cursus van Zwembad A verandert niet.')
    expect(body).toContain('downloaden hem de volgende keer opnieuw')
    expect(body).toContain('Dit kun je niet ongedaan maken.')
    expect(`${title} ${body}`.toLowerCase()).not.toContain('verwijzing')
  })

  it('addConfirmationBody points to an own copy', () => {
    const body = addConfirmationBody({ name: 'Redden', owner: { name: 'Zwembad A' } })
    expect(body).toContain('De cursus blijft van Zwembad A. Wil je hem aanpassen, dan maak je later een eigen kopie.')
    expect(body).not.toContain('niet zelf aanpassen')
  })

  it('hint and sharing texts', () => {
    expect(HAS_COPY_HINT).toBe('Jullie hebben al een aangepaste kopie van deze cursus.')
    expect(COPY_NOT_SHARED).toBe('Een aangepaste cursus is alleen voor jouw organisatie en kan niet gedeeld worden.')
  })
})
