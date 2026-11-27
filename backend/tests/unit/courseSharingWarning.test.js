import { describe, expect, it } from 'vitest'
import { isRestrictedVideo, sharedVideosWarning } from '../../src/lib/courseSharing.js'

// Which videos the owner must confirm before a course is shared (specs/009 FR-009, FR-010,
// research R4).

const B = 2
const C = 3
const ALL = [B, C]

const open = { id: 1, name: 'Open', visibility: 'public', deletedAt: null, ownerDeleted: false }
const own = { id: 2, name: 'Eigen', visibility: 'private', deletedAt: null, ownerDeleted: false }
const chosen = { id: 3, name: 'Selectief', visibility: 'selective', deletedAt: null, ownerDeleted: false }
const fresh = { id: 4, name: 'Nieuw', visibility: 'private', deletedAt: null, ownerDeleted: false }

const notLive = { live: false, visibility: 'private', accessOrganisationIds: [] }
const priv = { live: true, visibility: 'private', accessOrganisationIds: [] }
const pub = { live: true, visibility: 'public', accessOrganisationIds: [] }
const sel = (...ids) => ({ live: true, visibility: 'selective', accessOrganisationIds: ids })

const names = (list) => list.map((video) => video.name)
const warn = (before, after, contentVideos, previousVideoIds = []) =>
  names(sharedVideosWarning({ before, after, contentVideos, previousVideoIds, allOrganisationIds: ALL }))

describe('isRestrictedVideo', () => {
  it('is false only for a public, not deleted video of an active owner', () => {
    expect(isRestrictedVideo(open)).toBe(false)
    expect(isRestrictedVideo(own)).toBe(true)
    expect(isRestrictedVideo(chosen)).toBe(true)
    expect(isRestrictedVideo({ ...open, deletedAt: new Date() })).toBe(true)
    expect(isRestrictedVideo({ ...open, ownerDeleted: true })).toBe(true)
  })
})

describe('sharedVideosWarning', () => {
  const content = [open, own, chosen]

  it.each([
    ['private → public: every restricted video', priv, pub, content, [1, 2, 3], ['Eigen', 'Selectief']],
    ['no live version → selective: every restricted video', notLive, sel(B), content, [], ['Eigen', 'Selectief']],
    ['selective [B] → selective [B, C]: every restricted video', sel(B), sel(B, C), content, [1, 2, 3], ['Eigen', 'Selectief']],
    ['selective [B] → public: every restricted video', sel(B), pub, content, [1, 2, 3], ['Eigen', 'Selectief']],
    ['public → selective [B]: only new ones (none)', pub, sel(B), content, [1, 2, 3], []],
    ['public → public, same videos: none', pub, pub, content, [1, 2, 3], []],
    ['public → public, a new restricted video: only that one', pub, pub, [...content, fresh], [1, 2, 3], ['Nieuw']],
    ['→ private: none', pub, priv, content, [], []],
    ['no live version afterwards: none', pub, notLive, content, [], []],
    ['selective [B, C] → selective [B]: none', sel(B, C), sel(B), content, [1, 2, 3], []],
  ])('%s', (_label, before, after, videos, previous, expected) => {
    expect(warn(before, after, videos, previous)).toEqual(expected)
  })

  it('is empty without restricted videos', () => {
    expect(warn(priv, pub, [open])).toEqual([])
  })

  it('counts deleted videos and videos of a deleted owner', () => {
    const deleted = { ...open, id: 5, name: 'Verwijderd', deletedAt: new Date() }
    const ownerGone = { ...open, id: 6, name: 'Eigenaar weg', ownerDeleted: true }
    expect(warn(priv, pub, [deleted, ownerGone])).toEqual(['Verwijderd', 'Eigenaar weg'])
  })

  it('keeps the order of the content and lists every video once', () => {
    expect(warn(priv, pub, [chosen, open, own, chosen])).toEqual(['Selectief', 'Eigen'])
  })

  it('returns id and name', () => {
    expect(sharedVideosWarning({ before: priv, after: pub, contentVideos: [own], allOrganisationIds: ALL })).toEqual([
      { id: 2, name: 'Eigen' },
    ])
  })
})
