import { describe, expect, it, vi } from 'vitest'
import { extractModelJson, type ModelFetch } from './model'

const env = { APP_OWNER_JWT: 'test-only-token', API_WORKER_URL: 'https://example.invalid' }

describe('model integration boundary', () => {
  it('uses the real endpoint and model, bounds output, and forwards an abort signal', async () => {
    const request = vi.fn<ModelFetch>(async () => new Response(JSON.stringify({
      success: true, data: { choices: [{ finish_reason: 'stop', message: { content: '{"requirements":[]}' } }] },
    })))
    await expect(extractModelJson('A source', env, request)).resolves.toBe('{"requirements":[]}')
    const [actualEnv, endpoint, init] = request.mock.calls[0]
    expect(actualEnv).toBe(env)
    expect(endpoint).toBe('/api/integrations/openai/chat-completion')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('gpt-4.1-mini')
    expect(body.max_tokens).toBe(4000)
    expect(body.messages[1].content).toBe('{"source_text":"A source"}')
  })

  it('actually aborts an outstanding network request on timeout', async () => {
    let aborted = false
    const request: ModelFetch = async (_env, _path, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        aborted = true
        reject(new DOMException('aborted', 'AbortError'))
      })
    })
    await expect(extractModelJson('A source', env, request, 10)).rejects.toThrow('timed out')
    expect(aborted).toBe(true)
  })

  it('reports credit failure and truncation without returning partial AI output', async () => {
    const noCredit: ModelFetch = async () => new Response(JSON.stringify({ success: false, code: 'insufficient_credits' }), { status: 402 })
    await expect(extractModelJson('Source', env, noCredit)).rejects.toThrow('credits are unavailable')
    const truncated: ModelFetch = async () => new Response(JSON.stringify({ success: true, data: { choices: [{ finish_reason: 'length', message: { content: 'partial' } }] } }))
    await expect(extractModelJson('Source', env, truncated)).rejects.toThrow('incomplete')
  })

  it('sanitizes unexpected upstream failures', async () => {
    const request: ModelFetch = async () => { throw new Error('internal upstream diagnostic') }
    await expect(extractModelJson('Source', env, request)).rejects.toThrow('AI extraction is unavailable')
  })
})
