<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { calculate, catSpeech, defaults, loadSettings, STORAGE_KEY, validNumber, validSettings } from './calculator.js'
import { exportCard } from './export-card.js'
import cat from './assets/cat.png'
import door from './assets/door.png'
let storage
try { storage = window.localStorage } catch { /* Storage is optional. */ }
const income = reactive(loadSettings(storage))
const editingIncome = ref(!validSettings(income))
const purchase = reactive({ name: '', amount: '' })
const expanded = ref(false)
const result = ref(null)
const stale = ref(false)
const errors = reactive({})
const notice = ref('')
const saved = ref(validSettings(income) ? '收入设置已保存' : '')
const generating = ref(false)
const imageUrl = ref('')
const currentRate = computed(() => validSettings(income) ? (Number(income.salary) / (Number(income.days) * Number(income.hours))).toFixed(2) : '—')
let timer
function toast(message) { notice.value = message; clearTimeout(timer); timer = setTimeout(() => { notice.value = '' }, 3200) }
function clearImage() { if (imageUrl.value) URL.revokeObjectURL(imageUrl.value); imageUrl.value = '' }
function validateIncome() {
  for (const key of ['salary', 'days', 'hours']) delete errors[key]
  if (!validNumber(income.salary, 1000000)) errors.salary = '请输入大于 0、不超过 100 万元的月薪，最多两位小数'
  if (!validNumber(income.days, 31)) errors.days = '每月工作天数须大于 0 且不超过 31，最多两位小数'
  if (!validNumber(income.hours, 24)) errors.hours = '每天工作小时须大于 0 且不超过 24，最多两位小数'
  if (errors.days || errors.hours) expanded.value = true
  const first = ['salary', 'days', 'hours'].find(key => errors[key])
  if (first) requestAnimationFrame(() => document.getElementById(first)?.focus())
  return !first
}
function saveIncome() {
  if (!validateIncome()) return
  try { if (!storage) throw Error(); storage.setItem(STORAGE_KEY, JSON.stringify({ ...income, version: 1 })); saved.value = '收入设置已保存' }
  catch { saved.value = '设置暂未保存'; toast('浏览器存储不可用，本次仍可计算，下次可能需要重新填写') }
  editingIncome.value = false
  expanded.value = false
  requestAnimationFrame(() => document.querySelector('.edit-income')?.focus())
}
function editIncome() {
  editingIncome.value = true
  saved.value = ''
  requestAnimationFrame(() => document.getElementById('salary')?.focus())
}
watch([income, purchase], () => { if (result.value) stale.value = true; clearImage() }, { flush: 'sync' })
function clearSettings() {
  Object.assign(income, defaults)
  editingIncome.value = true
  saved.value = ''
  try { if (!storage) throw Error(); storage.removeItem(STORAGE_KEY); toast('已清除收入设置') }
  catch { toast('页面设置已清空，但浏览器中的设置未能删除') }
}
function submit() {
  if (editingIncome.value) {
    if (validateIncome()) toast('请先点击保存，确认收入设置')
    return
  }
  Object.keys(errors).forEach(key => delete errors[key])
  if (!validNumber(income.salary, 1000000)) errors.salary = '请输入大于 0、不超过 100 万元的月薪，最多两位小数'
  if (!validNumber(income.days, 31)) errors.days = '每月工作天数须大于 0 且不超过 31，最多两位小数'
  if (!validNumber(income.hours, 24)) errors.hours = '每天工作小时须大于 0 且不超过 24，最多两位小数'
  if (!purchase.name.trim() || purchase.name.trim().length > 50) errors.name = '请填写 1—50 字的消费名称'
  if (!validNumber(purchase.amount, 1000000)) errors.amount = '请输入大于 0、不超过 100 万元的金额，最多两位小数'
  if (Object.keys(errors).length) {
    if (errors.days || errors.hours) expanded.value = true
    requestAnimationFrame(() => document.getElementById(Object.keys(errors)[0])?.focus())
    return
  }
  result.value = calculate({ ...income, ...purchase })
  stale.value = false
  clearImage()
}
async function save() {
  if (!result.value || stale.value || generating.value) return
  generating.value = true
  const snapshot = result.value
  try {
    const url = await exportCard(snapshot, cat)
    if (stale.value || result.value !== snapshot) { URL.revokeObjectURL(url); return }
    clearImage(); imageUrl.value = url
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = '小鱼干-消费对比.png'; anchor.click()
    toast('图片已生成；若未自动下载，可在预览中长按保存')
  } catch { toast('图片生成失败，请重试') }
  finally { generating.value = false }
}
onBeforeUnmount(() => { clearTimeout(timer); clearImage() })
</script>

<template>
  <main class="phone">
    <header class="app-header">
      <img :src="door" class="door" alt="喵喵小屋" />
      <h1>小鱼干时薪换算器</h1><button v-if="!editingIncome" type="button" class="edit-income" aria-label="编辑收入设置" aria-controls="income-settings" @click="editIncome">编辑</button><span v-else class="nav-spacer" aria-hidden="true"></span>
    </header>
    <section class="hero" aria-label="喵喵帮你算一算">
      <div><p class="eyebrow">喵喵帮你算一算</p><h2>买下这份快乐<br />要搬多久的砖？</h2></div>
      <div class="mascot"><img :src="cat" alt="灰白猫咪，粉色腮红" /><span>喵，帮你算算～</span></div>
    </section>
    <form novalidate @submit.prevent="submit">
      <section v-if="editingIncome" id="income-settings" class="panel income-panel">
        <div class="section-title"><h2>我的收入</h2><span v-if="saved" class="saved">{{ saved === '收入设置已保存' ? '✓ ' : '' }}{{ saved }}</span></div>
        <label for="salary" class="field-label">税前月薪 <span>元 / 月</span></label>
        <div class="money"><span aria-hidden="true">¥</span><input id="salary" v-model="income.salary" type="number" inputmode="decimal" placeholder="填写你的税前月薪" min="0.01" max="1000000" step="0.01" :aria-invalid="!!errors.salary" :aria-describedby="errors.salary ? 'salary-error' : undefined" /></div>
        <p v-if="errors.salary" id="salary-error" class="error">{{ errors.salary }}</p>
        <div class="work-row"><span>{{ income.days || '—' }} 天 / 月 · {{ income.hours || '—' }} 小时 / 天</span><button type="button" :aria-expanded="expanded" aria-controls="work-settings" @click="expanded = !expanded">调整工作时间 {{ expanded ? '⌃' : '⌄' }}</button></div>
        <div v-if="expanded" id="work-settings" class="work-settings">
          <label for="days">每月工作天数<input id="days" v-model="income.days" type="number" inputmode="decimal" min="0.01" max="31" step="0.01" :aria-invalid="!!errors.days" :aria-describedby="errors.days ? 'days-error' : undefined" /><span v-if="errors.days" id="days-error" class="error">{{ errors.days }}</span></label>
          <label for="hours">每天工作小时<input id="hours" v-model="income.hours" type="number" inputmode="decimal" min="0.01" max="24" step="0.01" :aria-invalid="!!errors.hours" :aria-describedby="errors.hours ? 'hours-error' : undefined" /><span v-if="errors.hours" id="hours-error" class="error">{{ errors.hours }}</span></label>
          <button class="clear" type="button" @click="clearSettings">清除收入设置</button>
        </div>
        <div class="hourly">你的每小时，价值 <strong>¥{{ currentRate }}</strong></div>
        <button v-if="String(income.salary).trim()" type="button" class="save-income" @click="saveIncome">保存</button>
      </section>
      <section class="panel expense-panel">
        <div class="section-title"><h2>想买点什么？</h2></div>
        <div class="expense-fields">
          <label for="name">或者买了什么<input id="name" v-model="purchase.name" maxlength="50" placeholder="例如：一杯奶茶" :aria-invalid="!!errors.name" :aria-describedby="errors.name ? 'name-error' : undefined" /></label>
          <label for="amount">金额（元）<input id="amount" v-model="purchase.amount" type="number" inputmode="decimal" placeholder="15.00" min="0.01" max="1000000" step="0.01" :aria-invalid="!!errors.amount" :aria-describedby="errors.amount ? 'amount-error' : undefined" /></label>
        </div>
        <p v-if="errors.name" id="name-error" class="error">{{ errors.name }}</p><p v-if="errors.amount" id="amount-error" class="error">{{ errors.amount }}</p>
      </section>
      <button class="calculate" type="submit">要打工多久？<span aria-hidden="true">→</span></button>
    </form>
    <section class="result" aria-live="polite" aria-atomic="true">
      <div class="result-header"><h2>本喵的换算小票</h2><span>单笔消费</span></div>
      <template v-if="result">
        <div class="comparison"><div class="product"><span class="drink" aria-hidden="true">🛍️</span><p>{{ result.name }} · ¥{{ result.amount.toFixed(2) }}</p></div><span class="equals" aria-hidden="true">=</span><div class="time"><strong :class="{ long: result.duration.length > 7 }">{{ result.duration }}</strong><p>你的打工时间</p></div></div>
        <p class="speech">{{ catSpeech(result) }}</p>
        <p class="disclaimer">按税前收入估算 · 1 天按工作 {{ result.hours }} 小时折算</p>
        <p v-if="stale" class="stale">输入已修改，请重新换算</p>
      </template>
      <div v-else class="empty"><span aria-hidden="true">🐾</span><p>填好收入与消费，本喵帮你算～</p><p class="disclaimer">每一份喜欢，都有时间的重量</p></div>
    </section>
    <button class="save" :disabled="!result || stale || generating" @click="save">{{ generating ? '正在生成图片…' : '保存对比图' }}</button>
    <footer>把钱换成时间，把喜欢留给自己。</footer>
    <div v-if="notice" class="toast" role="status">{{ notice }}</div>
    <div v-if="imageUrl" class="image-preview"><p>对比图预览 · 可长按图片保存</p><img :src="imageUrl" alt="本次消费与打工时间对比图" /><button type="button" @click="clearImage">收起预览</button></div>
  </main>
</template>
