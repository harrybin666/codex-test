<script setup>
import { computed, onUnmounted, ref } from 'vue'
import SidebarNav from './components/SidebarNav.vue'
import PageOverview from './components/PageOverview.vue'
import TaskPanel from './components/TaskPanel.vue'
import ToastMessage from './components/ToastMessage.vue'

const storageKey = 'richang-todos-v1'
function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    if (Array.isArray(saved)) return saved.filter(task => task && typeof task.text === 'string' && typeof task.id === 'string' && typeof task.done === 'boolean')
  } catch { /* Missing or unavailable storage falls back to the original sample tasks. */ }
  return [
    { id: '1', text: '喝一杯水，开启新的一天', done: true },
    { id: '2', text: '整理本周的工作计划', done: false },
    { id: '3', text: '读20页喜欢的书', done: false },
    { id: '4', text: '傍晚出去走走，看看天空', done: false },
  ]
}
const tasks = ref(loadTasks())
const filter = ref('all')
const counts = computed(() => {
  const done = tasks.value.filter(task => task.done).length
  return { all: tasks.value.length, active: tasks.value.length - done, done }
})
const percentage = computed(() => counts.value.all ? Math.round(counts.value.done / counts.value.all * 100) : 0)
const shownTasks = computed(() => tasks.value.filter(task => filter.value === 'all' || (filter.value === 'done' ? task.done : !task.done)))
const date = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
const message = ref('')
const toastVisible = ref(false)
let toastTimer
function toast(text) {
  message.value = text
  toastVisible.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastVisible.value = false }, 2400)
}
onUnmounted(() => clearTimeout(toastTimer))
function save(successMessage) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tasks.value))
    if (successMessage) toast(successMessage)
  } catch { toast('浏览器存储不可用，本次更改暂未保存') }
}
function addTask(event) {
  const input = event.target.elements.namedItem('task')
  const text = input.value.trim()
  if (!text) return
  tasks.value.push({ id: crypto.randomUUID(), text, done: false })
  if (filter.value === 'done') filter.value = 'all'
  input.value = ''
  save()
  input.focus()
}
function toggleTask(task) { task.done = !task.done; save() }
function deleteTask(task) { tasks.value = tasks.value.filter(item => item.id !== task.id); save('任务已删除') }
function clearCompleted() {
  const count = counts.value.done
  if (!count) return toast('还没有已完成的任务')
  tasks.value = tasks.value.filter(task => !task.done)
  save(`已清除 ${count} 个已完成任务`)
}
</script>
<template>
<div class="app">
<SidebarNav :counts="counts" :filter="filter" @filter="filter = $event"/>
<main>
<div class="topbar">
<span>{{ date }}</span>
<div class="avatar" aria-label="我的空间">日</div>
</div>
<div class="content">
<PageOverview :counts="counts"/>
<TaskPanel :tasks="shownTasks" :filter="filter" :pending="counts.active" :percentage="percentage" @add="addTask" @filter="filter = $event" @toggle="toggleTask" @delete="deleteTask" @clear="clearCompleted"/>
<div class="quote">“ 把注意力放在当下，把小事做成日常。 ”<span>ONE THING AT A TIME</span>
</div>
</div>
</main>
</div>
<ToastMessage :message="message" :visible="toastVisible"/>
</template>
