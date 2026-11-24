import { describe, expect, it } from 'vitest'
import {
  generateQuestLinkCode,
  isValidLoginCode,
  isValidQuestLinkCode,
  normalizeLoginCode,
  normalizeQuestLinkCode,
  QUEST_LINK_ALPHABET,
  suggestLoginCodeBase,
} from '../../src/lib/codes.js'

describe('login codes (research R6)', () => {
  it('normalizes by trimming and upper-casing', () => {
    expect(normalizeLoginCode(' zwembad-a ')).toBe('ZWEMBAD-A')
    expect(normalizeLoginCode(undefined)).toBe('')
  })

  it('suggests a code from the name', () => {
    expect(suggestLoginCodeBase('Zwembad De Hoven')).toBe('ZWEMBAD-DE-HOVEN')
    expect(suggestLoginCodeBase('Café Ëiland!')).toBe('CAFE-EILAND')
  })

  it('shortens long names to at most 46 characters without a trailing dash', () => {
    const suggestion = suggestLoginCodeBase('Zwemvereniging '.repeat(6))
    expect(suggestion.length).toBeLessThanOrEqual(46)
    expect(suggestion.endsWith('-')).toBe(false)
  })

  it('validates the format', () => {
    for (const bad of ['-AB', 'AB-', 'A', 'AB', 'A'.repeat(51), 'AB C', 'ab-c']) {
      expect(isValidLoginCode(bad), bad).toBe(false)
    }
    for (const good of ['ABC', 'ZWEMBAD-A', 'A'.repeat(50)]) {
      expect(isValidLoginCode(good), good).toBe(true)
    }
  })

  it('generates 8-character Crockford base32 Quest link codes', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateQuestLinkCode()
      expect(code).toHaveLength(8)
      expect([...code].every((c) => QUEST_LINK_ALPHABET.includes(c))).toBe(true)
    }
  })
})

describe('quest link codes (specs/007 research R2)', () => {
  it('normalizes by trimming and upper-casing', () => {
    expect(normalizeQuestLinkCode(' qz7k2m9x ')).toBe('QZ7K2M9X')
    expect(normalizeQuestLinkCode(123)).toBe('')
    expect(normalizeQuestLinkCode(undefined)).toBe('')
  })

  it('accepts exactly 8 characters from the alphabet', () => {
    expect(isValidQuestLinkCode('QZ7K2M9X')).toBe(true)
    expect(isValidQuestLinkCode(generateQuestLinkCode())).toBe(true)
    for (const code of ['QZ7K2M9', 'QZ7K2M9XX', 'QZ7K2M9I', 'ZWEMBAD-A', 'qz7k2m9x', '']) {
      expect(isValidQuestLinkCode(code)).toBe(false)
    }
  })
})
