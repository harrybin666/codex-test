;(function () {
'use strict'
const { calculate, catSpeech, defaults, loadSettings, STORAGE_KEY, validNumber, validSettings } = globalThis.FishWageCalculator
const { exportCard } = globalThis.FishWageExport

const byId = id => document.getElementById(id)
const incomeKeys = ['salary', 'days', 'hours']
const fieldKeys = [...incomeKeys, 'name', 'amount']
let storage
try { storage = window.localStorage } catch { /* Storage is optional. */ }

const income = loadSettings(storage)
let editingIncome = !validSettings(income)
let expanded = false
let result = null
let stale = false
let generating = false
let imageUrl = ''
let timer
let saved = validSettings(income) ? '收入设置已保存' : ''

function toast(message) {
  clearTimeout(timer)
  byId('notice').textContent = message
  byId('notice').hidden = false
  timer = setTimeout(() => { byId('notice').hidden = true }, 3200)
}

function closePage() {
  const nativeFailure = () => toast('关闭失败，请使用 App 的返回按钮重试')
  try {
    if (globalThis.FishWageNative.closePage(nativeFailure)) return
  } catch {
    nativeFailure()
    return
  }
  const manualClose = () => toast('浏览器未允许自动关闭，请手动关闭此标签页')
  try {
    window.close()
  } catch {
    manualClose()
    return
  }
  setTimeout(() => {
    if (!window.closed) manualClose()
  }, 200)
}

function clearImage() {
  byId('image-preview').hidden = true
  byId('preview-image').removeAttribute('src')
  if (imageUrl) URL.revokeObjectURL(imageUrl)
  imageUrl = ''
}

function renderIncome() {
  byId('income-settings').hidden = !editingIncome
  byId('edit-income').hidden = editingIncome
  byId('nav-spacer').hidden = !editingIncome
  byId('saved').hidden = !saved
  byId('saved').textContent = saved === '收入设置已保存' ? `✓ ${saved}` : saved
  byId('work-settings').hidden = !expanded
  byId('toggle-work').setAttribute('aria-expanded', String(expanded))
  byId('toggle-work').textContent = `调整工作时间 ${expanded ? '⌃' : '⌄'}`
  byId('work-summary').textContent = `${income.days || '—'} 天 / 月 · ${income.hours || '—'} 小时 / 天`
  const rate = validSettings(income)
    ? (Number(income.salary) / (Number(income.days) * Number(income.hours))).toFixed(2)
    : '—'
  byId('current-rate').textContent = `¥${rate}`
  byId('save-income').hidden = !String(income.salary).trim()
}

function renderResult() {
  byId('result-content').hidden = !result
  byId('empty').hidden = !!result
  byId('stale').hidden = !stale
  byId('save-card').disabled = !result || stale || generating
  byId('save-card').textContent = generating ? '正在生成图片…' : '保存对比图'
  if (!result) return
  // User text is inserted as text, never parsed as HTML.
  byId('result-purchase').textContent = `${result.name} · ¥${result.amount.toFixed(2)}`
  byId('result-duration').textContent = result.duration
  byId('result-duration').classList.toggle('long', result.duration.length > 7)
  byId('result-speech').textContent = catSpeech(result)
  byId('result-disclaimer').textContent = `按税前收入估算 · 1 天按工作 ${result.hours} 小时折算`
}

function renderErrors(errors, keys = fieldKeys) {
  for (const key of keys) {
    const message = errors[key] || ''
    byId(`${key}-error`).textContent = message
    byId(`${key}-error`).hidden = !message
    byId(key).setAttribute('aria-invalid', String(!!message))
    if (message) byId(key).setAttribute('aria-describedby', `${key}-error`)
    else byId(key).removeAttribute('aria-describedby')
  }
}

function incomeErrors() {
  const errors = {}
  if (!validNumber(income.salary, 1000000)) errors.salary = '请输入大于 0、不超过 100 万元的月薪，最多两位小数'
  if (!validNumber(income.days, 31)) errors.days = '每月工作天数须大于 0 且不超过 31，最多两位小数'
  if (!validNumber(income.hours, 24)) errors.hours = '每天工作小时须大于 0 且不超过 24，最多两位小数'
  return errors
}

function revealErrors(errors) {
  const first = fieldKeys.find(key => errors[key])
  if (!first) return
  if (incomeKeys.some(key => errors[key])) editingIncome = true
  if (errors.days || errors.hours) expanded = true
  renderIncome()
  byId(first).focus()
}

function markChanged() {
  if (result) stale = true
  clearImage()
  renderResult()
}

function saveIncome() {
  const errors = incomeErrors()
  renderErrors(errors, incomeKeys)
  if (Object.keys(errors).length) {
    revealErrors(errors)
    return
  }
  try {
    if (!storage) throw new Error('Storage unavailable')
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...income, version: 1 }))
    saved = '收入设置已保存'
  } catch {
    saved = '设置暂未保存'
    toast('浏览器存储不可用，本次仍可计算，下次可能需要重新填写')
  }
  editingIncome = false
  expanded = false
  renderIncome()
  byId('edit-income').focus()
}

function submit(event) {
  event.preventDefault()
  const errors = incomeErrors()
  if (editingIncome) {
    renderErrors(errors, incomeKeys)
    if (Object.keys(errors).length) revealErrors(errors)
    else toast('请先点击保存，确认收入设置')
    return
  }
  const purchase = { name: byId('name').value, amount: byId('amount').value }
  if (!purchase.name.trim() || purchase.name.trim().length > 50) errors.name = '请填写 1—50 字的消费名称'
  if (!validNumber(purchase.amount, 1000000)) errors.amount = '请输入大于 0、不超过 100 万元的金额，最多两位小数'
  renderErrors(errors)
  if (Object.keys(errors).length) {
    revealErrors(errors)
    return
  }
  result = calculate({ ...income, ...purchase })
  stale = false
  clearImage()
  renderResult()
}

async function saveCard() {
  if (!result || stale || generating) return
  generating = true
  renderResult()
  const snapshot = result
  try {
    // A data URL keeps Canvas export usable when index.html is opened via file://.
    const url = await exportCard(snapshot, globalThis.FishWageCatImage)
    if (stale || result !== snapshot) {
      URL.revokeObjectURL(url)
      return
    }
    clearImage()
    imageUrl = url
    byId('preview-image').src = url
    byId('image-preview').hidden = false
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = '小鱼干-消费对比.png'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    toast('图片已生成；若未自动下载，可在预览中长按保存')
  } catch {
    toast('图片生成失败，请重试')
  } finally {
    generating = false
    renderResult()
  }
}

for (const key of incomeKeys) {
  byId(key).value = income[key]
  byId(key).addEventListener('input', () => {
    income[key] = byId(key).value
    markChanged()
    renderIncome()
  })
}
for (const key of ['name', 'amount']) byId(key).addEventListener('input', markChanged)
byId('calculator-form').addEventListener('submit', submit)
byId('close-page').addEventListener('click', closePage)
byId('save-income').addEventListener('click', saveIncome)
byId('edit-income').addEventListener('click', () => {
  editingIncome = true
  saved = ''
  renderIncome()
  byId('salary').focus()
})
byId('toggle-work').addEventListener('click', () => {
  expanded = !expanded
  renderIncome()
})
byId('clear-settings').addEventListener('click', () => {
  Object.assign(income, defaults)
  for (const key of incomeKeys) byId(key).value = income[key]
  editingIncome = true
  saved = ''
  renderErrors({}, incomeKeys)
  markChanged()
  renderIncome()
  try {
    if (!storage) throw new Error('Storage unavailable')
    storage.removeItem(STORAGE_KEY)
    toast('已清除收入设置')
  } catch {
    toast('页面设置已清空，但浏览器中的设置未能删除')
  }
  byId('salary').focus()
})
byId('save-card').addEventListener('click', saveCard)
byId('close-preview').addEventListener('click', () => {
  clearImage()
  byId('save-card').focus()
})

renderIncome()
renderResult()
})()
