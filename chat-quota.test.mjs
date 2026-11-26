// 额度/token 耗尽：MClaw 在额度用尽时并不返回错误码，而是 HTTP 200 + SSE
// chat.completion.chunk，带 tokenStatus:"over" 且 delta.content 为「token已耗尽」，
// usage 为空对象。旧实现看到 choices 就原样透传，magpie 因此把它当成成功响应，
// 不会回退到路由组里的下一个供应商。这里锁定「必须转成 502 quota_exhausted」，
// 同时确保非额度的 401/503 与正常流不受影响。
import './nonet.mjs'
import { expect, test } from 'bun:test'
import { _internal } from './index.mjs'

const { normalizeChatResponse } = _internal

const response = (body, init = {}) => new Response(
  new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  }),
  init,
)

const SSE = { status: 200, headers: { 'content-type': 'text/event-stream' } }

test('SSE tokenStatus over 转成 502 quota_exhausted', async () => {
  const chunk = {
    id: '1',
    object: 'chat.completion.chunk',
    model: 'mclaw/huoshan_deepseek_v4_1_flash',
    tokenStatus: 'over',
    choices: [{ index: 0, delta: { role: 'assistant', content: 'token已耗尽' }, finish_reason: 'stop' }],
    usage: {},
  }
  const res = await normalizeChatResponse(response('data: ' + JSON.stringify(chunk) + '\n\ndata:[DONE]\n\n', SSE))
  expect(res.status).toBe(502)
  const body = await res.json()
  expect(body.error.code).toBe('quota_exhausted')
  expect(body.error.message).toContain('token已耗尽')
})

test('额度耗尽转 502 后保留登录态', async () => {
  const chunk = { tokenStatus: 'over', choices: [{ index: 0, delta: { content: 'token已耗尽' } }], usage: {} }
  const res = await normalizeChatResponse(response('data: ' + JSON.stringify(chunk) + '\n\n', SSE))
  expect(res.status).toBe(502)
  expect(res.headers.get('x-magpie-sign-in')).toBe('kept')
})

test('裸 JSON token 耗尽转 502', async () => {
  const res = await normalizeChatResponse(
    response(JSON.stringify({ error: { code: '01000002', message: 'token已耗尽' } }), SSE),
  )
  expect(res.status).toBe(502)
  const body = await res.json()
  expect(body.error.code).toBe('quota_exhausted')
  expect(body.error.message).toBe('token已耗尽')
})

test('HTTP 429 配额文案转 502', async () => {
  const res = await normalizeChatResponse(response(JSON.stringify({ msg: 'token已耗尽' }), { status: 429 }))
  expect(res.status).toBe(502)
  expect((await res.json()).error.code).toBe('quota_exhausted')
})

test('SSE error 事件配额文案转 502', async () => {
  const sse = 'data: ' + JSON.stringify({ error: { code: '01000003', message: 'token已耗尽' } }) + '\n\n'
  const res = await normalizeChatResponse(response(sse, SSE))
  expect(res.status).toBe(502)
  expect((await res.json()).error.code).toBe('quota_exhausted')
})

test('多种配额措辞都转 502', async () => {
  for (const message of ['额度已用尽', '额度已耗尽', '积分不足', 'quota exceeded', 'insufficient balance']) {
    const res = await normalizeChatResponse(response(JSON.stringify({ error: { code: '9999', message } }), SSE))
    expect(res.status).toBe(502)
    expect((await res.json()).error.code).toBe('quota_exhausted')
  }
})

test('鉴权失败仍然映射 401 而不是 502', async () => {
  const res = await normalizeChatResponse(
    response(JSON.stringify({ error: { code: '01000002', message: 'invalid api key' } }), SSE),
  )
  expect(res.status).toBe(401)
  expect(res.headers.get('x-magpie-sign-in')).toBe('expired')
})

test('非配额的上游错误保留原状态码', async () => {
  const res = await normalizeChatResponse(response(JSON.stringify({ error: { message: 'boom' } }), { status: 503 }))
  expect(res.status).toBe(503)
  expect(await res.text()).toContain('boom')
})

test('正常 SSE 流原样透传', async () => {
  const sse = 'data: ' + JSON.stringify({ choices: [{ delta: { content: 'hello' } }] }) + '\n\n'
  const res = await normalizeChatResponse(response(sse, SSE))
  expect(res.status).toBe(200)
  expect(await res.text()).toContain('hello')
})

test('正常回答里出现「耗尽」二字不误判', async () => {
  const chunk = { tokenStatus: 'ok', choices: [{ index: 0, delta: { content: '电量已耗尽' } }], usage: {} }
  const res = await normalizeChatResponse(response('data: ' + JSON.stringify(chunk) + '\n\n', SSE))
  expect(res.status).toBe(200)
})
