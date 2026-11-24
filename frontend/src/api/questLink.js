import { api } from './client'

// The quest link code of the own organisation (specs/007 contracts/organisation-api.md).

export async function getQuestLink() {
  const data = await api('/api/organisation/quest-link')
  return data.questLinkCode
}

export async function renewQuestLink() {
  const data = await api('/api/organisation/quest-link/renew', { method: 'POST' })
  return data.questLinkCode
}
