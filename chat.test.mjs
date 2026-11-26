// normalizeChatResponse：网关以 HTTP 200 包裸 JSON 错误、正常 JSON、SSE 流、
// 空响应、超过旧 1MB 截断的大回复——全部本地构造，不碰网络。
import { test } from 'node:test'
import assert from 'node:assert/strict'
const expect = (actual) => ({
  toBe: (v) => assert.equal(actual, v),
  toContain: (v) => assert.ok(String(actual).includes(v)),
  toEqual: (v) => assert.deepEqual(actual, v),
  toBeTruthy: () => assert.ok(actual),
  toBeFalsy: () => assert.ok(!actual),
  toThrow: () => assert.throws(actual),
})
import { _internal } from './index.mjs'

const { normalizeChatResponse } = _internal

const sseResponse = (chunks) => new Response(
  new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
      controller.close()
    },
  }),
  { status: 200, headers: { 'content-type': 'text/event-stream' } },
)

test('HTTP 200 + 裸 JSON 错误 01000002 → 401，标记登录失效', async () => {
  const out = await normalizeChatResponse(Response.json({ error: { code: '01000002', message: '无效的ApiKey' } }))
  expect(out.status).toBe(401)
  expect(out.headers.get('x-magpie-sign-in')).toBe('expired')
  const body = await out.json()
  expect(body.error.code).toBe('01000002')
  expect(body.error.message).toBe('无效的ApiKey')
})

test('HTTP 200 + 裸 JSON 错误（其他 code）→ 502，登录保持', async () => {
  const out = await normalizeChatResponse(Response.json({ error: { code: '01000005', message: '资源不存在' } }))
  expect(out.status).toBe(502)
  expect(out.headers.get('x-magpie-sign-in')).toBe('kept')
})

test('HTTP 200 + success:false → 502', async () => {
  const out = await normalizeChatResponse(Response.json({ success: false, code: 'X', message: 'nope' }))
  expect(out.status).toBe(502)
  expect((await out.json()).error.message).toBe('nope')
})

test('正常 JSON 回复原样透出', async () => {
  const payload = { choices: [{ message: { role: 'assistant', content: 'hi' } }], usage: { total_tokens: 1 } }
  const out = await normalizeChatResponse(Response.json(payload))
  expect(out.status).toBe(200)
  expect(await out.json()).toEqual(payload)
})

test('超过 1MB 的合法 JSON 回复不再被截断成 502', async () => {
  const payload = { choices: [{ message: { role: 'assistant', content: 'x'.repeat(2 * 1024 * 1024) } }] }
  const out = await normalizeChatResponse(Response.json(payload))
  expect(out.status).toBe(200)
  const body = await out.json()
  expect(body.choices[0].message.content.length).toBe(2 * 1024 * 1024)
})

test('SSE 流透传：检查过的首字节重放，其余照序', async () => {
  const chunks = ['data: {"id":"1","cho', 'ices":[{"delta":{"content":"你"}}]}\n\n', 'data: [DONE]\n\n']
  const out = await normalizeChatResponse(sseResponse(chunks))
  expect(out.status).toBe(200)
  expect(out.headers.get('content-type')).toBe('text/event-stream')
  const text = await out.text()
  expect(text).toBe(chunks.join(''))
})

test('空响应体 → 502 empty_response', async () => {
  const out = await normalizeChatResponse(new Response('', { status: 200 }))
  expect(out.status).toBe(502)
  expect((await out.json()).error.code).toBe('empty_response')
})

test('JSON 但既非错误也非对话响应 → 502 invalid_response', async () => {
  const out = await normalizeChatResponse(Response.json({ foo: 'bar' }))
  expect(out.status).toBe(502)
  expect((await out.json()).error.code).toBe('invalid_response')
})

// 缓存命中统计：MClaw 转发火山/DeepSeek 时 usage 缓存字段形态不一，
// 插件要规范化成 magpie 认识的标准字段，否则缓存命中率恒为 0。
test('normalizeUsage：顶层 cached_tokens → 三种标准形态', () => {
  const { normalizeUsage } = _internal
  const out = normalizeUsage({ prompt_tokens: 1000, cached_tokens: 800 })
  expect(out.prompt_tokens_details.cached_tokens).toBe(800)
  expect(out.input_tokens_details.cached_tokens).toBe(800)
  expect(out.prompt_cache_hit_tokens).toBe(800)
})

test('normalizeUsage：DeepSeek prompt_cache_hit_tokens → 标准形态', () => {
  const { normalizeUsage } = _internal
  const out = normalizeUsage({ prompt_tokens: 1000, prompt_cache_hit_tokens: 700 })
  expect(out.prompt_tokens_details.cached_tokens).toBe(700)
  expect(out.input_tokens_details.cached_tokens).toBe(700)
})

test('normalizeUsage：火山 input_tokens_details.cached_tokens 保留并补齐', () => {
  const { normalizeUsage } = _internal
  const out = normalizeUsage({ input_tokens_details: { cached_tokens: 600 } })
  expect(out.prompt_tokens_details.cached_tokens).toBe(600)
  expect(out.prompt_cache_hit_tokens).toBe(600)
})

test('normalizeUsage：cache_write_tokens → cache_creation_input_tokens', () => {
  const { normalizeUsage } = _internal
  const out = normalizeUsage({ cache_write_tokens: 120 })
  expect(out.prompt_tokens_details.cache_creation_input_tokens).toBe(120)
  expect(out.input_tokens_details.cache_creation_input_tokens).toBe(120)
})

test('normalizeUsage：无缓存字段时不杜撰', () => {
  const { normalizeUsage } = _internal
  const out = normalizeUsage({ prompt_tokens: 100, completion_tokens: 20 })
  expect(out.prompt_tokens_details).toBeFalsy()
  expect(out.prompt_cache_hit_tokens).toBeFalsy()
})

test('ensureUsageRequest：流式 chat 请求补 include_usage', () => {
  const { ensureUsageRequest } = _internal
  const init = { method: 'POST', body: JSON.stringify({ stream: true, messages: [{ role: 'user', content: 'hi' }] }) }
  const out = ensureUsageRequest(init)
  expect(JSON.parse(out.body).stream_options.include_usage).toBe(true)
  expect(init.body.includes('include_usage')).toBe(false)
})

test('ensureUsageRequest：非流式/非 JSON 请求原样返回', () => {
  const { ensureUsageRequest } = _internal
  const a = { body: JSON.stringify({ stream: false, messages: [] }) }
  expect(ensureUsageRequest(a) === a).toBe(true)
  const b = { body: 'not-json' }
  expect(ensureUsageRequest(b) === b).toBe(true)
})

test('SSE usage 帧里的缓存字段被规范化', async () => {
  const chunk = 'data:' + JSON.stringify({ choices: [], usage: { prompt_tokens: 100, cached_tokens: 80 } }) + '\n\n'
  const out = await normalizeChatResponse(sseResponse([chunk]))
  const text = await out.text()
  expect(text).toContain('"cached_tokens":80')
  expect(text).toContain('"prompt_cache_hit_tokens":80')
})
