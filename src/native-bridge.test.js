import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'

const source = readFileSync(new URL('./native-bridge.js', import.meta.url), 'utf8')

function loadBridge(window = {}) {
  let nextTimer = 0
  const timers = new Map()
  const context = createContext({
    window,
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id },
    clearTimeout(id) { timers.delete(id) }
  })
  runInContext(source, context)
  return { window, bridge: context.FishWageNative, timers }
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

const image = 'data:image/png;base64,aW1hZ2U='

test('Android 保存传入 platform=3 和 PNG Base64，收到 code=200 才完成', async () => {
  let message
  let completed = false
  const { bridge, window, timers } = loadBridge({
    callNative: { evaluateJsToNative(value) { message = JSON.parse(value) } }
  })
  assert.equal(bridge.getPlatform(), 'android')
  const saving = bridge.saveImageToAlbum(image).then(result => { completed = true; return result })
  assert.equal(message.action, 'shareImg')
  assert.equal(typeof message.requestId, 'string')
  assert.deepEqual(message.data, { platform: 3, base64: image })
  await Promise.resolve()
  assert.equal(completed, false)
  window.onSuccessCallback(JSON.stringify({ ...message, data: { code: 200, msg: '分享完成' } }))
  assert.equal((await saving).code, 200)
  assert.equal(timers.size, 0)
})

test('保存回调严格匹配 action 和 requestId，关闭回调不能完成保存', async () => {
  let message
  const { bridge, window, timers } = loadBridge({
    callNative: { evaluateJsToNative(value) { message = JSON.parse(value) } }
  })
  const saving = bridge.saveImageToAlbum(image)
  window.onSuccessCallback(JSON.stringify({ ...message, action: 'close', data: { code: 200 } }))
  window.onSuccessCallback(JSON.stringify({ ...message, requestId: 'wrong', data: { code: 200 } }))
  assert.equal(timers.size, 1)
  window.onSuccessCallback({ ...message, data: { code: 200 } })
  await saving
  assert.equal(timers.size, 0)
})

test('拒绝权限、取消和客户端忙均作为失败，不把成功入口误当作已保存', async () => {
  for (const callback of ['onSuccessCallback', 'onFailCallback']) {
    for (const code of [-1000004, -1000002, 400, 302, undefined]) {
      let message
      const { bridge, window, timers } = loadBridge({
        callNative: { evaluateJsToNative(value) { message = JSON.parse(value) } }
      })
      const saving = bridge.saveImageToAlbum(image)
      window[callback](JSON.stringify({ ...message, data: { code } }))
      await assert.rejects(saving, error => error.code === code && /权限|取消|处理|保存失败/.test(error.message))
      assert.equal(timers.size, 0)
    }
  }
})

test('保存超过 60 秒无回调时释放请求，晚到的成功不改变超时结果', async () => {
  let message
  const { bridge, window, timers } = loadBridge({
    callNative: { evaluateJsToNative(value) { message = JSON.parse(value) } }
  })
  const saving = bridge.saveImageToAlbum(image)
  const timeout = [...timers.values()].find(timer => timer.delay === 60000)
  assert.ok(timeout)
  timeout.callback()
  await assert.rejects(saving, error => error.code === 'timeout' && error.message.includes('先查看相册'))
  window.onSuccessCallback(JSON.stringify({ ...message, data: { code: 200 } }))
})

test('重复保存会被阻止，当前请求完成后允许新请求', async () => {
  const messages = []
  const { bridge, window } = loadBridge({
    callNative: { evaluateJsToNative(value) { messages.push(JSON.parse(value)) } }
  })
  const first = bridge.saveImageToAlbum(image)
  await assert.rejects(bridge.saveImageToAlbum(image), error => error.code === 400)
  assert.equal(messages.length, 1)
  window.onSuccessCallback({ ...messages[0], data: { code: 200 } })
  await first
  const second = bridge.saveImageToAlbum(image)
  assert.notEqual(messages[0].requestId, messages[1].requestId)
  window.onSuccessCallback({ ...messages[1], data: { code: 200 } })
  await second
})

test('iOS 和普通浏览器不发送未在文档中定义的保存指令', async () => {
  let calls = 0
  for (const host of [{}, { webkit: { messageHandlers: { evaluateJsToNative: { postMessage() { calls++ } } } } }]) {
    const { bridge } = loadBridge(host)
    await assert.rejects(bridge.saveImageToAlbum(image), error => error.code === 'unsupported')
  }
  assert.equal(calls, 0)
})

test('无效图片和桥接抛错不会留下保存请求或计时器', async () => {
  let calls = 0
  const { bridge, timers } = loadBridge({
    callNative: { evaluateJsToNative() { calls++; throw new Error('native failure') } }
  })
  for (const invalid of ['', 'data:image/png;base64,', 'blob:preview', 'data:image/jpeg;base64,aW1hZ2U=']) {
    await assert.rejects(bridge.saveImageToAlbum(invalid), error => error.code === 'invalid_image')
  }
  assert.equal(calls, 0)
  await assert.rejects(bridge.saveImageToAlbum(image), error => error.code === 'bridge_error')
  await assert.rejects(bridge.saveImageToAlbum(image), error => error.code === 'bridge_error')
  assert.equal(calls, 2)
  assert.equal(timers.size, 0)
})
