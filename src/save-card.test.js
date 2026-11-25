import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { setImmediate } from 'node:timers/promises'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const calculator = readFileSync(new URL('./calculator.js', import.meta.url), 'utf8')
const bridge = readFileSync(new URL('./native-bridge.js', import.meta.url), 'utf8')
const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8')
const image = 'data:image/png;base64,aW1hZ2U='

function loadApp(platform, exportCard = async () => ({ type: 'image/png' })) {
  const nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, {
    hidden: false, value: '', textContent: '', handlers: {}, classList: { toggle() {} },
    addEventListener(type, handler) { this.handlers[type] = handler },
    setAttribute() {}, removeAttribute() {}, focus() {}
  }]))
  const messages = []
  let downloads = 0
  let reads = 0
  let serial = 0
  const timers = new Map()
  const window = { localStorage: { getItem: () => JSON.stringify({ salary: 10560, days: 22, hours: 8 }) } }
  const send = value => messages.push(JSON.parse(value))
  if (platform === 'android') window.callNative = { evaluateJsToNative: send }
  if (platform === 'ios') window.webkit = { messageHandlers: { evaluateJsToNative: { postMessage: send } } }
  const context = createContext({
    window,
    document: {
      getElementById: id => nodes.get(id),
      createElement: () => ({ click() { downloads++ }, remove() {} }),
      body: { append() {} }
    },
    URL: { createObjectURL: () => 'blob:preview', revokeObjectURL() {} },
    setTimeout(callback, delay) { const id = ++serial; timers.set(id, { callback, delay }); return id },
    clearTimeout(id) { timers.delete(id) },
    FishWageExport: { exportCard, imageDataUrl: async () => { reads++; return image } },
    FishWageCatImage: image
  })
  runInContext(calculator, context)
  runInContext(bridge, context)
  runInContext(main, context)
  nodes.get('name').value = '奶茶'
  nodes.get('amount').value = '25'
  nodes.get('calculator-form').handlers.submit({ preventDefault() {} })
  return {
    nodes, window, messages, timers,
    save: () => nodes.get('save-card').handlers.click(),
    downloads: () => downloads,
    reads: () => reads
  }
}

test('保存按钮等待 Android 回调期间禁用，成功后提示相册保存且不触发浏览器下载', async () => {
  const app = loadApp('android')
  const saving = app.save()
  await setImmediate()
  assert.equal(app.messages.length, 1)
  assert.equal(app.messages[0].action, 'shareImg')
  assert.equal(app.nodes.get('save-card').disabled, true)
  assert.equal(app.nodes.get('save-card').textContent, '正在保存到相册…')
  assert.equal(app.nodes.get('image-preview').hidden, false)
  assert.ok(!app.nodes.get('save-status').textContent.includes('已保存'))
  await app.save()
  assert.equal(app.messages.length, 1)
  app.window.onSuccessCallback({ ...app.messages[0], data: { code: 200 } })
  await saving
  assert.equal(app.nodes.get('save-card').disabled, false)
  assert.equal(app.nodes.get('save-status').textContent, '本次对比图已保存到相册')
  assert.equal(app.downloads(), 0)
})

test('权限被拒绝时保留图片预览，明确显示权限原因且不自动下载', async () => {
  const app = loadApp('android')
  const saving = app.save()
  await setImmediate()
  app.window.onFailCallback({ ...app.messages[0], data: { code: -1000004, msg: '拒绝权限,保存失败' } })
  await saving
  assert.equal(app.nodes.get('image-preview').hidden, false)
  assert.match(app.nodes.get('save-status').textContent, /未获得相册或存储权限/)
  assert.equal(app.nodes.get('save-card').disabled, false)
  assert.equal(app.downloads(), 0)
})

test('没有收到客户端回调时不显示保存成功，提示先查看相册', async () => {
  const app = loadApp('android')
  const saving = app.save()
  await setImmediate()
  const timeout = [...app.timers.values()].find(timer => timer.delay === 60000)
  timeout.callback()
  await saving
  assert.match(app.nodes.get('save-status').textContent, /暂未收到保存结果.*先查看相册/)
  assert.equal(app.downloads(), 0)
})

test('普通浏览器仍下载 PNG，iOS 保留预览且不发送未知客户端方法', async () => {
  const browser = loadApp('browser')
  await browser.save()
  assert.equal(browser.downloads(), 1)
  assert.equal(browser.reads(), 0)
  const ios = loadApp('ios')
  await ios.save()
  assert.equal(ios.nodes.get('image-preview').hidden, false)
  assert.match(ios.nodes.get('save-status').textContent, /暂不支持直接保存相册/)
  assert.equal(ios.messages.length, 0)
  assert.equal(ios.downloads(), 0)
})

test('图片生成期间修改消费，不发送旧结果到客户端', async () => {
  let finish
  const app = loadApp('android', () => new Promise(resolve => { finish = resolve }))
  const saving = app.save()
  app.nodes.get('amount').value = '30'
  app.nodes.get('amount').handlers.input()
  finish({ type: 'image/png' })
  await saving
  assert.equal(app.messages.length, 0)
  assert.equal(app.downloads(), 0)
  assert.equal(app.nodes.get('save-card').disabled, true)
})
