import { describe, expect, it } from 'vitest'
import { consumeDailyBudget } from './budget'

function storage() {
  const values = new Map<string, unknown>()
  let sequence: Promise<unknown> = Promise.resolve()
  return { transaction: (fn: (txn: unknown) => Promise<unknown>) => {
    const run = sequence.then(() => fn({ get: async (key: string) => structuredClone(values.get(key)), put: async (key: string, value: unknown) => { values.set(key, structuredClone(value)) } }))
    sequence = run.catch(() => {})
    return run
  } } as unknown as Pick<DurableObjectStorage, 'transaction'>
}

describe('durable extraction budget', () => {
  it('allows only 10 attempts for one user even when requests overlap', async () => {
    const store = storage()
    const results = await Promise.all(Array.from({ length: 20 }, () => consumeDailyBudget(store, 'alice')))
    expect(results.filter(Boolean)).toHaveLength(10)
    expect(await consumeDailyBudget(store, 'bob')).toBe(true)
  })
  it('bounds all accounts together and resets on the next UTC day', async () => {
    const store = storage()
    const today = new Date('2026-11-25T23:59:00Z')
    for (let i = 0; i < 100; i++) expect(await consumeDailyBudget(store, `user-${i}`, today)).toBe(true)
    expect(await consumeDailyBudget(store, 'another-user', today)).toBe(false)
    expect(await consumeDailyBudget(store, 'another-user', new Date('2026-11-26T00:00:00Z'))).toBe(true)
  })
})
