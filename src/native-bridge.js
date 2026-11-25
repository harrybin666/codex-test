;(function () {
'use strict'

let requestSerial = 0
const pendingRequests = new Map()

function getTransport() {
  const ios = window.webkit?.messageHandlers?.evaluateJsToNative
  const android = window.callNative
  if (typeof ios?.postMessage === 'function') {
    return { platform: 'ios', send: message => ios.postMessage(message) }
  }
  if (typeof android?.evaluateJsToNative === 'function') {
    return { platform: 'android', send: message => android.evaluateJsToNative(message) }
  }
  return null
}

function getPlatform() {
  return getTransport()?.platform || 'browser'
}

function saveError(code) {
  const messages = {
    '-1000004': '未获得相册或存储权限，请在系统设置中允许后重试',
    '-1000002': '已取消保存',
    400: '客户端正在处理图片，请稍后再试',
    timeout: '暂未收到保存结果，请先查看相册，避免重复保存',
    unsupported: '当前 App 暂不支持直接保存相册，请长按预览图片保存',
    invalid_image: '图片数据无效，请重新生成',
    bridge_error: '无法调用相册保存，请重试或长按预览图片保存'
  }
  const error = new Error(messages[code] || '保存失败，请重试或长按预览图片保存')
  error.code = code
  return error
}

function parseMessage(value) {
  try {
    const message = typeof value === 'string' ? JSON.parse(value) : value
    return message && typeof message === 'object' ? message : null
  } catch {
    return null
  }
}

// iOS may send callbacks before the rest of the page has loaded.
for (const name of ['onSuccessCallback', 'onFailCallback']) {
  const previous = window[name]
  window[name] = function (value) {
    const message = parseMessage(value)
    const pending = message && pendingRequests.get(message.requestId)
    if (pending && message.action === pending.action) {
      pendingRequests.delete(message.requestId)
      if (pending.timer !== undefined) clearTimeout(pending.timer)
      if (pending.action === 'close') {
        // A close success callback only acknowledges dispatch, not that the view closed.
        if (name === 'onFailCallback' && typeof pending.onFailure === 'function') pending.onFailure()
      } else if (name === 'onSuccessCallback' && message.data?.code === 200) {
        pending.resolve(message.data)
      } else {
        pending.reject(saveError(message.data?.code))
      }
    }
    if (typeof previous === 'function') previous.call(this, value)
  }
}

if (typeof window.evaluateNativeToJSUnCallback !== 'function') {
  window.evaluateNativeToJSUnCallback = function () { /* No lifecycle handling is needed. */ }
}

function closePage(onFailure) {
  const transport = getTransport()
  if (!transport) return false

  const requestId = `fish-wage-close-${++requestSerial}`
  const message = JSON.stringify({ action: 'close', requestId, data: {} })
  pendingRequests.set(requestId, { action: 'close', onFailure })
  try {
    transport.send(message)
  } catch (error) {
    pendingRequests.delete(requestId)
    throw error
  }
  return true
}

function saveImageToAlbum(base64) {
  const transport = getTransport()
  // Only Android documents shareImg/platform=3. Do not send an invented iOS action.
  if (transport?.platform !== 'android') return Promise.reject(saveError('unsupported'))
  if (typeof base64 !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return Promise.reject(saveError('invalid_image'))
  }
  if ([...pendingRequests.values()].some(request => request.action === 'shareImg')) {
    return Promise.reject(saveError(400))
  }

  const requestId = `fish-wage-save-${++requestSerial}`
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(saveError('timeout'))
    }, 60000)
    pendingRequests.set(requestId, { action: 'shareImg', resolve, reject, timer })
    try {
      transport.send(JSON.stringify({ action: 'shareImg', requestId, data: { platform: 3, base64 } }))
    } catch {
      clearTimeout(timer)
      pendingRequests.delete(requestId)
      reject(saveError('bridge_error'))
    }
  })
}

globalThis.FishWageNative = Object.freeze({ closePage, getPlatform, saveImageToAlbum })
})()
