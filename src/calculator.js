;(function () {
'use strict'
const STORAGE_KEY = 'fish-wage-settings-v1'
const defaults = { salary: '', days: 22, hours: 8 }
function validNumber(value, max, decimalPlaces = 2) {
  const text = String(value).trim()
  return /^\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text)) && Number(text) > 0 && Number(text) <= max && (text.split('.')[1]?.length || 0) <= decimalPlaces
}
function validSettings(settings) {
  return settings && validNumber(settings.salary, 1000000) && validNumber(settings.days, 31) && validNumber(settings.hours, 24)
}
function loadSettings(storage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY))
    return validSettings(saved) ? { salary: saved.salary, days: saved.days, hours: saved.hours } : { ...defaults }
  } catch { return { ...defaults } }
}
function calculate({ salary, days, hours, name, amount }) {
  if (!validSettings({ salary, days, hours }) || !validNumber(amount, 1000000) || !name.trim() || name.trim().length > 50) throw new Error('请检查输入内容')
  const rate = Number(salary) / (Number(days) * Number(hours))
  const rawMinutes = Number(amount) / rate * 60
  let duration = '不足 1 分钟'
  if (rawMinutes >= 1) {
    // Work in hundredths of a minute so fractional workday lengths stay exact.
    const total = Math.ceil(rawMinutes - Number.EPSILON * Math.max(1, rawMinutes) * 8) * 100
    const dayMinutes = Math.round(Number(hours) * 6000)
    const d = Math.floor(total / dayMinutes)
    const remainder = total - d * dayMinutes
    const h = Math.floor(remainder / 6000)
    const m = Number(((remainder % 6000) / 100).toFixed(2))
    duration = [d && `${d} 天`, h && `${h} 小时`, m && `${m} 分钟`].filter(Boolean).join(' ')
  }
  return { name: name.trim(), amount: Number(amount), hours: Number(hours), rate, duration }
}
function catSpeech(result) { return `「${result.name}」要打工 ${result.duration} 才能换哦，喵～` }
globalThis.FishWageCalculator = Object.freeze({ STORAGE_KEY, defaults, validNumber, validSettings, loadSettings, calculate, catSpeech })
})()
