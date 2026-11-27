import { describe, expect, it } from 'vitest'
import {
  losingReceiversSentence,
  newVersionLabel,
  noticeCountLabel,
  receiversList,
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

  it('lists the receivers by name', () => {
    expect(receiversList([])).toBe('')
    expect(receiversList([{ id: 5, name: 'Zwembad B' }])).toBe('Overgenomen door 1 organisatie: Zwembad B')
    expect(receiversList([{ id: 4, name: 'Brandweer Noord' }, { id: 5, name: 'Zwembad B' }])).toBe(
      'Overgenomen door 2 organisaties: Brandweer Noord, Zwembad B',
    )
  })

  it('labels the notice counter', () => {
    expect(noticeCountLabel(1)).toBe('1 cursus met een nieuwe versie')
    expect(noticeCountLabel(2)).toBe('2 cursussen met een nieuwe versie')
  })
})
