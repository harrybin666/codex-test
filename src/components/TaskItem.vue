<script setup>
defineProps({ task: Object })
const emit = defineEmits(['toggle', 'delete'])
</script>
<template>
<li class="task" :class="{ done: task.done }">
<button class="check" :aria-label="(task.done ? '标为未完成：' : '完成：') + task.text" :aria-pressed="task.done" @click="emit('toggle', task)">{{ task.done ? '✓' : '' }}</button>
<div class="task-body">
<div class="task-text">{{ task.text }}</div>
<div class="task-meta">{{ task.done ? '已完成 · 又前进了一小步' : '日常 · 按自己的节奏来' }}</div>
</div>
<button class="delete" :aria-label="'删除：' + task.text" @click="emit('delete', task)">×</button>
</li>
</template>
