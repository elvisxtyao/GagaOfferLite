import { getAuthToken } from 'deepspace'

export async function runAction<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Please sign in again. Your saved work is still available.')
  const response = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(55_000),
  })
  if (!response.ok) throw new Error(response.status === 401 ? 'Please sign in again.' : 'The server could not save this change. Please try again.')
  const result = await response.json() as { success: boolean; data?: T; error?: string }
  if (!result.success || !result.data) throw new Error(result.error || 'The request failed. Your saved work has been kept.')
  return result.data
}
