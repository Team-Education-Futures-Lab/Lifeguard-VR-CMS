import { describe, expect, it, vi } from 'vitest'
import { withDeadlockRetry } from '../../src/lib/deadlockRetry.js'

// Retrying a transaction that MariaDB rolled back because of a deadlock (ER_LOCK_DEADLOCK).

const deadlock = () => Object.assign(new Error('Deadlock found when trying to get lock'), { code: 'ER_LOCK_DEADLOCK', errno: 1213 })

describe('withDeadlockRetry', () => {
  it('returns the result of the first successful attempt', async () => {
    const transaction = vi.fn().mockResolvedValue('klaar')
    await expect(withDeadlockRetry(transaction, { delayMs: 0 })).resolves.toBe('klaar')
    expect(transaction).toHaveBeenCalledTimes(1)
  })

  it('runs the transaction again after a deadlock', async () => {
    const transaction = vi.fn().mockRejectedValueOnce(deadlock()).mockRejectedValueOnce(deadlock()).mockResolvedValue('klaar')
    await expect(withDeadlockRetry(transaction, { delayMs: 0 })).resolves.toBe('klaar')
    expect(transaction).toHaveBeenCalledTimes(3)
  })

  it('runs the transaction again after a changed snapshot (ER_CHECKREAD, specs/011)', async () => {
    const changed = Object.assign(new Error('Record has changed since last read'), { code: 'ER_CHECKREAD', errno: 1020 })
    const transaction = vi.fn().mockRejectedValueOnce(changed).mockResolvedValue('klaar')
    await expect(withDeadlockRetry(transaction, { delayMs: 0 })).resolves.toBe('klaar')
    expect(transaction).toHaveBeenCalledTimes(2)
  })

  it('gives up after the last attempt and passes the deadlock on', async () => {
    const transaction = vi.fn().mockRejectedValue(deadlock())
    await expect(withDeadlockRetry(transaction, { attempts: 3, delayMs: 0 })).rejects.toMatchObject({ code: 'ER_LOCK_DEADLOCK' })
    expect(transaction).toHaveBeenCalledTimes(3)
  })

  it('does not retry other errors', async () => {
    const other = Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' })
    const transaction = vi.fn().mockRejectedValue(other)
    await expect(withDeadlockRetry(transaction, { delayMs: 0 })).rejects.toBe(other)
    expect(transaction).toHaveBeenCalledTimes(1)
  })
})
