import type { Env } from '../../worker'
import { InputError } from './contracts'

type DailyBudget = { day: string; total: number; users: Record<string, number> }
export const USER_DAILY_AI_LIMIT = 10
export const APP_DAILY_AI_LIMIT = 100

/** One private KV value in the existing RecordRoom; its transaction serializes all isolates. */
export async function consumeDailyBudget(storage: Pick<DurableObjectStorage, 'transaction'>, userId: string, now = new Date()): Promise<boolean> {
  const day = now.toISOString().slice(0, 10)
  return storage.transaction(async (txn) => {
    const previous = await txn.get<DailyBudget>('lite:ai-budget')
    const budget: DailyBudget = previous?.day === day ? previous : { day, total: 0, users: {} }
    const count = Object.hasOwn(budget.users, userId) ? budget.users[userId] : 0
    if (count >= USER_DAILY_AI_LIMIT || budget.total >= APP_DAILY_AI_LIMIT) return false
    budget.total++
    budget.users[userId] = count + 1
    await txn.put('lite:ai-budget', budget)
    return true
  })
}

export async function reserveExtraction(env: Env, userId: string): Promise<void> {
  const room = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const response = await room.fetch(new Request('https://internal/lite-ai-budget', {
    method: 'POST', headers: { 'X-App-Action': 'true', 'X-User-Id': userId },
  }))
  if (response.status === 429) throw new InputError('The daily AI limit has been reached. Your source is saved; you can add requirements manually or try again after midnight UTC.')
  if (!response.ok) throw new InputError('AI extraction is temporarily unavailable. Your source is saved; please try again later.')
}
