<script setup>
import TaskItem from './TaskItem.vue'
defineProps({ tasks: Array, filter: String, pending: Number, percentage: Number })
const emit = defineEmits(['add', 'filter', 'toggle', 'delete', 'clear'])
const filters = [{ key: 'all', label: '全部' }, { key: 'active', label: '进行中' }, { key: 'done', label: '已完成' }]
</script>
<template>
<section class="panel" aria-label="待办清单">
<form class="add-form" @submit.prevent="emit('add', $event)">
<div class="input-wrap">
<span aria-hidden="true">＋</span>
<input name="task" maxlength="200" aria-label="新任务" placeholder="添加一件想做的小事…" autocomplete="off" required>
</div>
<button class="add-btn" type="submit">添加任务</button>
</form>
<div class="toolbar">
<div class="filters" aria-label="筛选任务">
<button v-for="item in filters" :key="item.key" :class="{ active: filter === item.key }" :aria-pressed="filter === item.key" @click="emit('filter', item.key)">{{ item.label }}</button>
</div>
<button class="clear" @click="emit('clear')">清除已完成</button>
</div>
<ul class="task-list">
<li v-if="!tasks.length" class="empty">{{ filter === 'done' ? '还没有完成的任务，每一个小进步都算数。' : filter === 'active' ? '待办已清空，好好享受当下。' : '从一件小事开始，写下你的第一个任务。' }}</li>
<TaskItem v-for="task in tasks" v-else :key="task.id" :task="task" @toggle="emit('toggle', $event)" @delete="emit('delete', $event)" />
</ul>
<div class="panel-footer">
<span>{{ pending ? `还有 ${pending} 件小事，慢慢来` : '所有小事都完成了，休息一下吧' }}</span>
<div class="progress">
<div class="progress-track">
<div class="progress-fill" :style="{ width: `${percentage}%` }">
</div>
</div>
<span>{{ percentage }}% 已完成</span>
</div>
</div>
</section>
</template>
