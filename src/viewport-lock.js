;(function () {
'use strict'

let start = null
let multiTouch = false
let lastTap = null

function prevent(event) {
  if (event.cancelable) event.preventDefault()
}

document.addEventListener('touchstart', event => {
  if (event.touches.length > 1 || multiTouch) {
    multiTouch = true
    lastTap = null
    prevent(event)
    return
  }
  const touch = event.touches[0]
  if (touch) start = { x: touch.clientX, y: touch.clientY, time: Date.now(), moved: false }
}, { passive: false })

document.addEventListener('touchmove', event => {
  if (event.touches.length > 1 || multiTouch) {
    multiTouch = true
    lastTap = null
    prevent(event)
    return
  }
  const touch = event.touches[0]
  if (!start || !touch) return
  const dx = Math.abs(touch.clientX - start.x)
  const dy = Math.abs(touch.clientY - start.y)
  if (dx > 8 || dy > 8) start.moved = true
  // Keep vertical scrolling, including access to settings and the image preview.
  if (dx > 8 && dx > dy) prevent(event)
}, { passive: false })

document.addEventListener('touchend', event => {
  if (multiTouch) {
    prevent(event)
    if (!event.touches.length) { start = null; multiTouch = false }
    return
  }
  if (event.touches.length) return
  const touch = event.changedTouches[0]
  const now = Date.now()
  if (start && !start.moved && touch && now - start.time < 350) {
    if (lastTap && now - lastTap.time < 350 &&
        Math.abs(touch.clientX - lastTap.x) < 24 && Math.abs(touch.clientY - lastTap.y) < 24) {
      prevent(event)
      lastTap = null
    } else {
      lastTap = { x: touch.clientX, y: touch.clientY, time: now }
    }
  } else {
    lastTap = null
  }
  start = null
}, { passive: false })

document.addEventListener('touchcancel', () => {
  start = null
  multiTouch = false
  lastTap = null
}, { passive: true })

// Safari gesture events and trackpad pinch need their own fallback handlers.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, prevent, { passive: false })
}
document.addEventListener('wheel', event => {
  if (event.ctrlKey) prevent(event)
}, { passive: false })
})()
