import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('./viewport-lock.js', import.meta.url), 'utf8')

function loadLock() {
  const listeners = new Map()
  let time = 1000
  runInNewContext(source, {
    document: { addEventListener(type, handler, options) { listeners.set(type, { handler, options }) } },
    Date: { now: () => time }
  })
  return {
    advance(milliseconds) { time += milliseconds },
    emit(type, fields = {}) {
      let prevented = false
      const event = { cancelable: true, touches: [], changedTouches: [], ...fields, preventDefault() { prevented = true } }
      const listener = listeners.get(type)
      assert.ok(listener, type)
      listener.handler(event)
      if (prevented) assert.equal(listener.options.passive, false)
      return prevented
    }
  }
}
const touch = (x, y) => ({ clientX: x, clientY: y })

test('单指上下滚动不拦截，横向拖动会拦截', () => {
  const lock = loadLock()
  assert.equal(lock.emit('touchstart', { touches: [touch(100, 100)] }), false)
  assert.equal(lock.emit('touchmove', { touches: [touch(103, 180)] }), false)
  assert.equal(lock.emit('touchmove', { touches: [touch(180, 103)] }), true)
})

test('双指手势始终拦截，手指全部离开后恢复单指滚动', () => {
  const lock = loadLock()
  assert.equal(lock.emit('touchstart', { touches: [touch(0, 0), touch(50, 50)] }), true)
  assert.equal(lock.emit('touchmove', { touches: [touch(0, 0), touch(90, 90)] }), true)
  assert.equal(lock.emit('touchend', { touches: [touch(0, 0)] }), true)
  assert.equal(lock.emit('touchmove', { touches: [touch(0, 80)] }), true)
  lock.emit('touchend')
  assert.equal(lock.emit('touchstart', { touches: [touch(10, 10)] }), false)
  assert.equal(lock.emit('touchmove', { touches: [touch(10, 100)] }), false)
})

test('连续双击同一区域不会触发缩放，单次点击仍正常', () => {
  const lock = loadLock()
  lock.emit('touchstart', { touches: [touch(100, 100)] })
  lock.advance(50)
  assert.equal(lock.emit('touchend', { changedTouches: [touch(100, 100)] }), false)
  lock.advance(100)
  lock.emit('touchstart', { touches: [touch(102, 102)] })
  lock.advance(50)
  assert.equal(lock.emit('touchend', { changedTouches: [touch(102, 102)] }), true)
})

test('点击不同位置或长按图片不当作双击，保留长按保存入口', () => {
  const lock = loadLock()
  lock.emit('touchstart', { touches: [touch(10, 10)] })
  lock.emit('touchend', { changedTouches: [touch(10, 10)] })
  lock.advance(100)
  lock.emit('touchstart', { touches: [touch(100, 100)] })
  assert.equal(lock.emit('touchend', { changedTouches: [touch(100, 100)] }), false)
  lock.emit('touchstart', { touches: [touch(100, 100)] })
  lock.advance(700)
  assert.equal(lock.emit('touchend', { changedTouches: [touch(100, 100)] }), false)
})

test('Safari 缩放事件及触控板捏合会拦截，普通滚轮仍可滚动', () => {
  const lock = loadLock()
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) assert.equal(lock.emit(type), true)
  assert.equal(lock.emit('wheel', { ctrlKey: true }), true)
  assert.equal(lock.emit('wheel', { ctrlKey: false }), false)
})

test('触摸中断后清理状态，不会卡住后续纵向滚动', () => {
  const lock = loadLock()
  lock.emit('touchstart', { touches: [touch(0, 0), touch(50, 50)] })
  lock.emit('touchcancel')
  assert.equal(lock.emit('touchstart', { touches: [touch(20, 20)] }), false)
  assert.equal(lock.emit('touchmove', { touches: [touch(20, 120)] }), false)
})
