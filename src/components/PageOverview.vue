<script setup>
defineProps({ counts: Object })
const stats = [{ key: 'all', icon: '▤', label: '全部任务' }, { key: 'active', icon: '◷', label: '等待完成' }, { key: 'done', icon: '✓', label: '已经完成' }]
</script>
<template>
<div class="heading">
<div>
<div class="eyebrow">A LITTLE BETTER, EVERY DAY</div>
<h1>我的待办清单<span style="color:#8ca17b">.</span>
</h1>
<p class="subtitle">给每一件小事一个位置，让今天更从容。</p>
</div>
<svg class="plant" viewBox="0 0 120 110" fill="none" aria-hidden="true">
<ellipse cx="63" cy="103" rx="42" ry="5" fill="#e6eadd"/>
<path d="M62 86Q50 55 65 17M62 68L34 40M61 52L87 30" stroke="#849975" stroke-width="2"/>
<path d="M64 35C44 27 51 9 69 6C78 20 74 29 64 35Z" fill="#b3c2a2"/>
<path d="M50 56C26 59 23 40 25 30C44 30 52 43 50 56Z" fill="#9fb68e"/>
<path d="M63 51C63 30 82 21 99 25C95 44 80 53 63 51Z" fill="#c2cdb0"/>
<path d="M59 74C38 75 34 62 35 54C52 52 61 61 59 74Z" fill="#c2cdb0"/>
<path d="M61 68C69 50 84 51 91 57C87 71 72 77 61 68Z" fill="#a3b88f"/>
<path d="M44 81H79L75 101H48L44 81Z" fill="#dddccd"/>
<path d="M42 80H81V86H42Z" fill="#e6e5d8"/>
</svg>
</div>
<div class="summary">
<div v-for="stat in stats" :key="stat.key" class="stat">
<span class="stat-icon">{{ stat.icon }}</span>
<div>
<div class="stat-number">{{ counts[stat.key] }}</div>
<div class="stat-label">{{ stat.label }}</div>
</div>
</div>
</div>
</template>
