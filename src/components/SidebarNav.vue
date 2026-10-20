<script setup>
defineProps({ counts: Object, filter: String })
const emit = defineEmits(['filter'])
const items = [{ key: 'all', icon: '▤', label: '全部任务' }, { key: 'active', icon: '◷', label: '进行中' }, { key: 'done', icon: '☑', label: '已完成' }]
</script>
<template>
<aside class="sidebar">
<div class="brand">
<span class="brand-icon">✓</span>日常</div>
<div class="tagline">把日子，慢慢理好。</div>
<div class="nav-label">我的空间</div>
<nav class="nav" aria-label="任务导航">
<button v-for="item in items" :key="item.key" :class="{ active: filter === item.key }" :aria-pressed="filter === item.key" @click="emit('filter', item.key)">
<span>{{ item.icon }}</span>{{ item.label }}<span class="count">{{ counts[item.key] }}</span>
</button>
</nav>
<div class="sidebar-bottom">
<div class="small-leaf">❧</div>不必一次做好所有事，<br>每天进步一点点就好。<div class="sidebar-credit">日常 / YOUR EVERYDAY SPACE</div>
</div>
</aside>
</template>
