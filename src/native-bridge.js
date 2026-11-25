;(function () {
'use strict'

let requestSerial = 0
const pendingCloseRequests = new Map()

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
    if (message?.action === 'close' && pendingCloseRequests.has(message.requestId)) {
      const onFailure = pendingCloseRequests.get(message.requestId)
      pendingCloseRequests.delete(message.requestId)
      // A success callback only acknowledges dispatch; it does not prove the view closed.
      if (name === 'onFailCallback' && typeof onFailure === 'function') onFailure()
    }
    if (typeof previous === 'function') previous.call(this, value)
  }
}

if (typeof window.evaluateNativeToJSUnCallback !== 'function') {
  window.evaluateNativeToJSUnCallback = function () { /* No lifecycle handling is needed. */ }
}

function closePage(onFailure) {
  const ios = window.webkit?.messageHandlers?.evaluateJsToNative
  const android = window.callNative
  let send
  if (typeof ios?.postMessage === 'function') {
    send = message => ios.postMessage(message)
  } else if (typeof android?.evaluateJsToNative === 'function') {
    send = message => android.evaluateJsToNative(message)
  } else {
    return false
  }

  const requestId = `fish-wage-close-${++requestSerial}`
  const message = JSON.stringify({ action: 'close', requestId, data: {} })
  pendingCloseRequests.set(requestId, onFailure)
  try {
    send(message)
  } catch (error) {
    pendingCloseRequests.delete(requestId)
    throw error
  }
  return true
}

globalThis.FishWageNative = Object.freeze({ closePage })
})()
