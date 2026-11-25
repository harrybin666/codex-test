import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'

const source = readFileSync(new URL('./native-bridge.js', import.meta.url), 'utf8')

function loadBridge(window = {}) {
  const context = createContext({ window })
  runInContext(source, context)
  return { window, bridge: context.FishWageNative }
}

function readCloseMessage(value) {
  assert.equal(typeof value, 'string')
  const message = JSON.parse(value)
  assert.equal(message.action, 'close')
  assert.equal(typeof message.requestId, 'string')
  assert.ok(message.requestId)
  assert.deepEqual(message.data, {})
  return message
}

test('iOS 通过指定 message handler 发送关闭 JSON 字符串，保留方法调用对象', () => {
  let sent
  const handler = { postMessage(value) { assert.equal(this, handler); sent = value } }
  const { bridge } = loadBridge({ webkit: { messageHandlers: { evaluateJsToNative: handler } } })
  assert.equal(bridge.closePage(), true)
  readCloseMessage(sent)
})

test('Android 通过 callNative 发送关闭 JSON 字符串，每次请求 ID 唯一', () => {
  const sent = []
  const android = { evaluateJsToNative(value) { assert.equal(this, android); sent.push(value) } }
  const { bridge } = loadBridge({ callNative: android })
  assert.equal(bridge.closePage(), true)
  assert.equal(bridge.closePage(), true)
  const first = readCloseMessage(sent[0])
  const second = readCloseMessage(sent[1])
  assert.notEqual(first.requestId, second.requestId)
})

test('同时存在两个入口时只调用 iOS，残缺的 iOS 入口仍可使用 Android', () => {
  let iosCalls = 0
  let androidCalls = 0
  const window = {
    webkit: { messageHandlers: { evaluateJsToNative: { postMessage() { iosCalls++ } } } },
    callNative: { evaluateJsToNative() { androidCalls++ } }
  }
  const { bridge } = loadBridge(window)
  bridge.closePage()
  assert.equal(iosCalls, 1)
  assert.equal(androidCalls, 0)
  window.webkit.messageHandlers.evaluateJsToNative = {}
  bridge.closePage()
  assert.equal(androidCalls, 1)
})

test('普通浏览器或不完整的桥接对象返回 false，交由页面处理浏览器关闭', () => {
  for (const window of [{}, { webkit: {} }, { callNative: {} }]) {
    const { bridge } = loadBridge(window)
    assert.equal(bridge.closePage(), false)
  }
})

test('仅匹配本次关闭请求的失败回调，重复或无关消息不触发错误提示', () => {
  let sent
  let failures = 0
  let existingCallbacks = 0
  const { window, bridge } = loadBridge({
    callNative: { evaluateJsToNative(value) { sent = value } },
    onFailCallback() { existingCallbacks++ }
  })
  bridge.closePage(() => { failures++ })
  const message = readCloseMessage(sent)
  window.onFailCallback('not json')
  window.onFailCallback(JSON.stringify({ ...message, action: 'info' }))
  window.onFailCallback(JSON.stringify({ ...message, requestId: 'other' }))
  assert.equal(failures, 0)
  window.onFailCallback(JSON.stringify(message))
  window.onFailCallback(JSON.stringify(message))
  assert.equal(failures, 1)
  assert.equal(existingCallbacks, 5)
})

test('成功回调清理待处理请求，并保留宿主已有的生命周期函数', () => {
  let sent
  let failures = 0
  let successes = 0
  const lifecycle = () => {}
  const { window, bridge } = loadBridge({
    callNative: { evaluateJsToNative(value) { sent = value } },
    onSuccessCallback() { successes++ },
    evaluateNativeToJSUnCallback: lifecycle
  })
  assert.equal(window.evaluateNativeToJSUnCallback, lifecycle)
  bridge.closePage(() => { failures++ })
  window.onSuccessCallback(sent)
  window.onFailCallback(sent)
  assert.equal(successes, 1)
  assert.equal(failures, 0)
})

test('原生调用异常向上传递，不尝试调用另一个平台的接口', () => {
  const failure = new Error('native unavailable')
  let androidCalls = 0
  const { bridge } = loadBridge({
    webkit: { messageHandlers: { evaluateJsToNative: { postMessage() { throw failure } } } },
    callNative: { evaluateJsToNative() { androidCalls++ } }
  })
  assert.throws(() => bridge.closePage(), error => error === failure)
  assert.equal(androidCalls, 0)
})
