<script setup>
import { computed, ref, watch } from 'vue';

const priorityNames = { high: '高优先级', medium: '中优先级', low: '低优先级' };
const weekdayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const seedTasks = [
  { id: 1, title: '完成产品周报', meta: '上午 10:00', priority: 'high', done: false },
  { id: 2, title: '回复重要邮件', meta: '上午 11:30', priority: 'medium', done: true },
  { id: 3, title: '午休后散步50分钟', meta: '下午 13:30', priority: 'low', done: false },
  { id: 4, title: '准备明天的会议材料', meta: '下午 16:00', priority: 'medium', done: false },
  { id: 5, title: '读书 30 分钟', meta: '晚上 21:00', priority: 'low', done: false },
];

const storedTasks = localStorage.getItem('daily-list-tasks');
const tasks = ref(storedTasks ? JSON.parse(storedTasks) : seedTasks);
const activeFilter = ref('today');
const selectedDate = ref(new Date());
const query = ref('');
const sort = ref('default');
const searchVisible = ref(false);
const focusRunning = ref(false);
const newTitle = ref('');
const newPriority = ref('medium');
const toast = ref('');
let toastTimer;

watch(tasks, (value) => localStorage.setItem('daily-list-tasks', JSON.stringify(value)), { deep: true });

const completedCount = computed(() => tasks.value.filter((task) => task.done).length);
const pendingCount = computed(() => tasks.value.length - completedCount.value);
const progress = computed(() => tasks.value.length ? Math.round(completedCount.value / tasks.value.length * 100) : 0);
const visibleTasks = computed(() => {
  let result = [...tasks.value];
  if (activeFilter.value === 'pending') result = result.filter((task) => !task.done);
  if (activeFilter.value === 'completed') result = result.filter((task) => task.done);
  if (query.value.trim()) result = result.filter((task) => task.title.toLowerCase().includes(query.value.trim().toLowerCase()));
  if (sort.value === 'priority') {
    const order = { high: 0, medium: 1, low: 2 };
    result.sort((a, b) => order[a.priority] - order[b.priority]);
  }
  if (sort.value === 'time') result.sort((a, b) => a.meta.localeCompare(b.meta, 'zh-CN'));
  return result;
});
const dates = computed(() => [-2, -1, 0, 1, 2].map((offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date;
}));
const weekdayLabel = computed(() => `${weekdayNames[selectedDate.value.getDay()]} · ${selectedDate.value.getMonth() + 1}月${selectedDate.value.getDate()}日`);
const progressText = computed(() => progress.value === 100 ? '太棒了，今天的任务全部完成' : progress.value ? `已经完成 ${completedCount.value} 项，继续保持` : '完成第一个任务，开启今天的节奏');

function setFilter(filter) { activeFilter.value = filter === 'all' ? 'today' : filter; }
function toggleTask(task) { task.done = !task.done; }
function deleteTask(task) { tasks.value = tasks.value.filter((item) => item.id !== task.id); showToast('任务已删除'); }
function addTask() {
  const title = newTitle.value.trim();
  if (!title) return;
  tasks.value.push({ id: Date.now(), title, meta: '今天', priority: newPriority.value, done: false });
  newTitle.value = '';
  showToast('任务已添加');
}
function moveDay(offset) {
  const next = new Date(selectedDate.value);
  next.setDate(next.getDate() + offset);
  selectedDate.value = next;
}
function showToast(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ''; }, 1800);
}
function toggleFocus() {
  focusRunning.value = !focusRunning.value;
  showToast(focusRunning.value ? '专注计时开始' : '专注已结束');
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#" aria-label="今日清单首页"><span class="brand-mark">✓</span><span>今日清单</span></a>
      <div class="side-section">
        <p class="side-label">工作区</p>
        <button class="nav-item active" type="button"><span class="nav-icon">▦</span> 今日任务 <span class="nav-count">{{ pendingCount }}</span></button>
        <button class="nav-item" type="button" @click="setFilter('all')"><span class="nav-icon">☰</span> 全部任务</button>
        <button class="nav-item" type="button" @click="setFilter('completed')"><span class="nav-icon">✓</span> 已完成</button>
      </div>
      <div class="side-section projects">
        <div class="side-label-row"><p class="side-label">列表</p><button class="text-icon" type="button" aria-label="添加列表">＋</button></div>
        <button class="project-item" type="button"><i class="dot blue"></i>个人</button>
        <button class="project-item" type="button"><i class="dot coral"></i>工作</button>
        <button class="project-item" type="button"><i class="dot mint"></i>生活</button>
      </div>
      <div class="sidebar-bottom">
        <div class="quote-card"><span class="quote-mark">“</span><p>一次只专注一件事，<br>也足够完成很多事。</p><span class="quote-author">— 今日提醒</span></div>
        <button class="settings" type="button"><span>⚙</span> 偏好设置</button>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <div><p class="eyebrow">{{ weekdayLabel }}</p><h1>早上好，<span>小明</span></h1></div>
        <div class="top-actions"><button class="icon-button" type="button" aria-label="搜索" @click="searchVisible = !searchVisible">⌕</button><button class="avatar" type="button" aria-label="个人资料">小</button></div>
      </header>
      <section class="day-switcher" aria-label="日期选择">
        <button class="date-arrow" type="button" aria-label="前一天" @click="moveDay(-1)">‹</button>
        <div class="date-cards">
          <button v-for="(date, index) in dates" :key="date.toISOString()" class="date-card" :class="{ current: index === 2 }" type="button" @click="selectedDate = date"><span class="date-week">{{ index === 2 ? '今天' : weekdayNames[date.getDay()].replace('星期', '周') }}</span><span class="date-number">{{ date.getDate() }}</span></button>
        </div>
        <button class="date-arrow" type="button" aria-label="后一天" @click="moveDay(1)">›</button>
      </section>

      <div class="content-grid">
        <section class="tasks-panel">
          <div class="panel-heading"><div><h2>今日待办</h2><p>整理一下，按自己的节奏来。</p></div><div class="heading-tools"><div v-show="searchVisible" class="search-box"><span>⌕</span><input v-model="query" type="search" placeholder="搜索任务" /></div><select v-model="sort" aria-label="排序方式"><option value="default">我的顺序</option><option value="priority">优先级</option><option value="time">时间</option></select></div></div>
          <div class="filter-tabs" role="tablist"><button class="filter-tab" :class="{ active: activeFilter === 'today' }" type="button" @click="setFilter('today')">全部 <span>{{ tasks.length }}</span></button><button class="filter-tab" :class="{ active: activeFilter === 'pending' }" type="button" @click="setFilter('pending')">未完成 <span>{{ pendingCount }}</span></button><button class="filter-tab" :class="{ active: activeFilter === 'completed' }" type="button" @click="setFilter('completed')">已完成 <span>{{ completedCount }}</span></button></div>
          <div class="task-list">
            <article v-for="task in visibleTasks" :key="task.id" class="task-item" :class="{ done: task.done }"><button class="check" type="button" :aria-label="task.done ? '标记未完成' : '标记完成'" @click="toggleTask(task)">{{ task.done ? '✓' : '' }}</button><div class="task-copy"><span class="task-name">{{ task.title }}</span><span class="task-meta"><i class="priority" :class="task.priority"></i>{{ task.meta }} · {{ priorityNames[task.priority] }}</span></div><div class="task-actions"><button class="task-action delete" type="button" aria-label="删除任务" @click="deleteTask(task)">×</button></div></article>
            <div v-if="!visibleTasks.length" class="empty-state"><strong>☀</strong>这里暂时没有任务<br>给自己留一点空间吧</div>
          </div>
          <form class="add-task" @submit.prevent="addTask"><button class="add-plus" type="submit" aria-label="添加任务">＋</button><input v-model="newTitle" type="text" placeholder="添加一项任务…" autocomplete="off" /><select v-model="newPriority" aria-label="任务优先级"><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select><button class="add-submit" type="submit">添加</button></form>
        </section>
        <aside class="insight-panel">
          <div class="progress-card"><div class="card-heading"><span>今日进度</span><span class="sparkle">✦</span></div><div class="progress-main"><strong>{{ progress }}%</strong><span>完成度</span></div><div class="progress-track"><span :style="{ width: `${progress}%` }"></span></div><p>{{ progressText }}</p></div>
          <div class="focus-card"><div class="focus-icon">◷</div><p class="mini-label">专注建议</p><h3>给自己 25 分钟<br>不被打扰的时间</h3><button type="button" class="focus-button" @click="toggleFocus"><span>{{ focusRunning ? 'Ⅱ' : '▶' }}</span>{{ focusRunning ? ' 专注中' : ' 开始专注' }}</button></div>
          <div class="stats-row"><div class="stat"><strong>3</strong><span>连续天数</span><i>↗</i></div><div class="stat"><strong>{{ completedCount }}</strong><span>本周完成</span><i>✦</i></div></div>
        </aside>
      </div>
    </main>
  </div>
  <div class="toast" :class="{ show: toast }" role="status">{{ toast }}</div>
</template>
