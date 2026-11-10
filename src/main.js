import {
  computed,
  createApp,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue/dist/vue.esm-bundler.js';
import {
  DEFAULT_CONFIG,
  calculateSnapshot,
  formatDuration,
  formatMoney,
  validateConfig,
} from './salary.js';
import './styles.css';

const STORAGE_KEY = 'salary-motivator-config-v1';
const MOTIVATIONAL_QUOTES = [
  '把今天该做的事做好，时间会给你答案。',
  '慢一点没关系，只要你一直在向前。',
  '你认真走过的每一步，都在为未来积攒底气。',
  '努力不是为了感动谁，而是让自己拥有更多选择。',
  '与其等待机会，不如先让自己成为机会。',
  '坚持把小事做好，时间会放大你的成长。',
  '今天多学一点，明天就少一点慌张。',
  '低头赶路的时候，也是在悄悄接近目标。',
  '稳定地前进，比偶尔拼尽全力更可靠。',
  '答案不会从天而降，但会在行动里慢慢清晰。',
];

function getDailyQuote(date) {
  const dayNumber = Math.floor(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ) / 86400000);
  return MOTIVATIONAL_QUOTES[dayNumber % MOTIVATIONAL_QUOTES.length];
}

function cloneConfig(source = DEFAULT_CONFIG) {
  return {
    ...source,
    customRestDays: [...(source.customRestDays ?? [0, 6])],
  };
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? cloneConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) }) : null;
  } catch {
    return null;
  }
}

function drawBrandMark(canvas) {
  if (!canvas) return;
  const ratio = Math.max(2, window.devicePixelRatio || 1);
  const size = 44;
  canvas.width = size * ratio;
  canvas.height = size * ratio;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  context.clearRect(0, 0, size, size);
  context.fillStyle = '#ff6b3d';
  context.beginPath();
  context.arc(22, 22, 20, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,.42)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(22, 22, 15.5, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = '#fffaf2';
  context.font = '700 22px system-ui';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('¥', 22, 22.5);
}

createApp({
  setup() {
    const savedConfig = loadConfig();
    const config = reactive(cloneConfig(savedConfig ?? DEFAULT_CONFIG));
    const draft = reactive(cloneConfig(config));
    const now = ref(new Date());
    const settingsDialog = ref(null);
    const brandCanvas = ref(null);
    const hasSavedConfig = ref(Boolean(savedConfig));
    const errors = reactive({});
    const notice = ref('');
    let timerId;
    let noticeTimer;

    const snapshot = computed(() => calculateSnapshot(config, now.value));
    const quote = computed(() => getDailyQuote(now.value));
    const dateText = computed(() => new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(now.value));
    const clockText = computed(() => new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now.value));
    const paydayText = computed(() => new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
    }).format(snapshot.value.paydayDate));
    const calendarText = computed(() => {
      if (!config.useMainlandChinaHolidays) return '仅按每周休息制度';
      return now.value.getFullYear() === 2027 ? '2027 法定节假日已生效' : '按每周休息制度计算';
    });
    const todayTagClass = computed(() => `status-tag status-${snapshot.value.dayInfo.type}`);
    const restRuleLabel = computed(() => ({
      double: '双休',
      single: '单休',
      custom: '自定义',
    }[config.restRule] ?? '双休'));

    function syncDraft() {
      Object.assign(draft, cloneConfig(config));
      Object.keys(errors).forEach((key) => delete errors[key]);
    }

    function openSettings() {
      syncDraft();
      settingsDialog.value?.showModal();
    }

    function closeSettings() {
      if (hasSavedConfig.value) settingsDialog.value?.close();
    }

    function handleDialogCancel(event) {
      if (!hasSavedConfig.value) event.preventDefault();
    }

    function saveSettings() {
      const nextErrors = validateConfig(draft);
      Object.keys(errors).forEach((key) => delete errors[key]);
      Object.assign(errors, nextErrors);
      if (Object.keys(nextErrors).length) return;

      Object.assign(config, cloneConfig({
        ...draft,
        monthlySalary: Number(draft.monthlySalary),
        lunchBreakMinutes: Number(draft.lunchBreakMinutes),
        payday: Number(draft.payday),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      hasSavedConfig.value = true;
      settingsDialog.value?.close();
      notice.value = '设置已保存，收入已重新计算';
      window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => { notice.value = ''; }, 2600);
    }

    function toggleCustomRestDay(day) {
      const index = draft.customRestDays.indexOf(day);
      if (index >= 0) draft.customRestDays.splice(index, 1);
      else draft.customRestDays.push(day);
      draft.customRestDays.sort((a, b) => a - b);
    }

    onMounted(async () => {
      drawBrandMark(brandCanvas.value);
      timerId = window.setInterval(() => { now.value = new Date(); }, 500);
      if (!hasSavedConfig.value) {
        await nextTick();
        settingsDialog.value?.showModal();
      }
    });

    onBeforeUnmount(() => {
      window.clearInterval(timerId);
      window.clearTimeout(noticeTimer);
    });

    return {
      brandCanvas,
      calendarText,
      clockText,
      closeSettings,
      config,
      dateText,
      draft,
      errors,
      formatDuration,
      formatMoney,
      handleDialogCancel,
      hasSavedConfig,
      notice,
      openSettings,
      paydayText,
      quote,
      restRuleLabel,
      saveSettings,
      settingsDialog,
      snapshot,
      todayTagClass,
      toggleCustomRestDay,
      weekDays: [
        { value: 1, label: '一' },
        { value: 2, label: '二' },
        { value: 3, label: '三' },
        { value: 4, label: '四' },
        { value: 5, label: '五' },
        { value: 6, label: '六' },
        { value: 0, label: '日' },
      ],
    };
  },
  template: `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="#main" aria-label="打工人激励器首页">
          <canvas ref="brandCanvas" class="brand-mark" aria-hidden="true"></canvas>
          <span>
            <strong>打工人激励器</strong>
            <small>每一秒，都算数</small>
          </span>
        </a>
        <div class="topbar-actions">
          <div class="clock" aria-live="off">
            <strong>{{ clockText }}</strong>
            <span>{{ dateText }}</span>
          </div>
          <button class="icon-button" type="button" title="工资设置" aria-label="打开工资设置" @click="openSettings">
            <span aria-hidden="true">⚙</span>
          </button>
        </div>
      </header>

      <main id="main" class="main-content">
        <section class="earnings-panel" aria-labelledby="today-heading">
          <div class="earnings-heading">
            <div>
              <p class="eyebrow">今日已赚</p>
              <h1 id="today-heading"><span>¥</span>{{ formatMoney(snapshot.todayEarned) }}</h1>
            </div>
            <span :class="todayTagClass">{{ snapshot.statusText }}</span>
          </div>

          <p class="earning-meta">
            日薪 ¥{{ formatMoney(snapshot.dailySalary) }}
            <span aria-hidden="true">·</span>
            每分钟 +¥{{ formatMoney(snapshot.perMinute) }}
            <span aria-hidden="true">·</span>
            <template v-if="snapshot.dayInfo.isWorkday && snapshot.progress < 1">
              还需 {{ formatDuration(snapshot.remainingSeconds) }}
            </template>
            <template v-else>{{ snapshot.dayInfo.label }}</template>
          </p>

          <div class="progress-block">
            <div class="progress-track" role="progressbar" aria-label="今日工作进度" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(snapshot.progress * 100)">
              <span :style="{ width: (snapshot.progress * 100) + '%' }"></span>
            </div>
            <div class="progress-copy">
              <span>今日工作进度 {{ Math.round(snapshot.progress * 100) }}%</span>
              <span>还可赚 ¥{{ formatMoney(Math.max(0, snapshot.dailySalary - snapshot.todayEarned)) }}</span>
            </div>
          </div>
        </section>

        <section class="stats-grid" aria-label="本月工资数据">
          <article class="stat-card stat-primary">
            <div class="stat-label"><span class="stat-dot coral"></span>本月已赚</div>
            <strong>¥{{ formatMoney(snapshot.monthEarned) }}</strong>
            <small>从本月 1 日起累计</small>
          </article>
          <article class="stat-card">
            <div class="stat-label"><span class="stat-dot gold"></span>本月待入账</div>
            <strong>¥{{ formatMoney(snapshot.monthPending) }}</strong>
            <small>按税前月薪计算</small>
          </article>
          <article class="stat-card">
            <div class="stat-label"><span class="stat-dot teal"></span>本月计薪日</div>
            <strong>{{ snapshot.monthWorkdays }}<em>天</em></strong>
            <small>{{ calendarText }}</small>
          </article>
          <article class="stat-card">
            <div class="stat-label"><span class="stat-dot ink"></span>距离发薪日</div>
            <strong>{{ snapshot.paydayDays }}<em>天</em></strong>
            <small>{{ paydayText }} 发薪 · 自然日</small>
          </article>
        </section>

        <section class="schedule-strip" aria-label="当前计算设置">
          <div>
            <span>工作制度</span>
            <strong>{{ restRuleLabel }}</strong>
          </div>
          <div>
            <span>工作时间</span>
            <strong>{{ config.startTime }}–{{ config.endTime }}</strong>
          </div>
          <div>
            <span>午休</span>
            <strong>{{ config.lunchBreakMinutes }} 分钟</strong>
          </div>
          <div>
            <span>放假规则</span>
            <strong>{{ config.useMainlandChinaHolidays ? '法定节假日' : '每周休息' }}</strong>
          </div>
        </section>

        <figure class="quote-banner">
          <blockquote>{{ quote }}</blockquote>
          <figcaption>
            <i aria-hidden="true"></i>每日激励<i aria-hidden="true"></i>
          </figcaption>
        </figure>
      </main>

      <footer>收入为激励性估算，不作为真实工资结算依据</footer>

      <Transition name="toast">
        <div v-if="notice" class="toast" role="status">{{ notice }}</div>
      </Transition>

      <dialog ref="settingsDialog" class="settings-dialog" @cancel="handleDialogCancel">
        <form method="dialog" @submit.prevent="saveSettings">
          <header class="dialog-header">
            <div>
              <h2>工资设置</h2>
              <p class="dialog-note">填写后自动保存到本机，下次打开无需重填</p>
            </div>
            <button v-if="hasSavedConfig" class="icon-button close-button" type="button" title="关闭" aria-label="关闭设置" @click="closeSettings">×</button>
          </header>

          <div class="form-body">
            <label class="field full-field">
              <span>月工资 <small>税前 · 元</small></span>
              <input v-model="draft.monthlySalary" type="number" inputmode="decimal" min="0.01" step="0.01" autocomplete="off" :aria-invalid="Boolean(errors.monthlySalary)" />
              <em v-if="errors.monthlySalary" class="field-error">{{ errors.monthlySalary }}</em>
            </label>

            <label class="field full-field">
              <span>休息制度</span>
              <select v-model="draft.restRule">
                <option value="double">双休（周六、周日）</option>
                <option value="single">单休（周日）</option>
                <option value="custom">自定义每周休息日</option>
              </select>
            </label>

            <div v-if="draft.restRule === 'custom'" class="custom-days full-field">
              <span>每周休息日</span>
              <div class="day-options">
                <button v-for="day in weekDays" :key="day.value" type="button" :class="{ active: draft.customRestDays.includes(day.value) }" :aria-pressed="draft.customRestDays.includes(day.value)" @click="toggleCustomRestDay(day.value)">
                  {{ day.label }}
                </button>
              </div>
              <em v-if="errors.customRestDays" class="field-error">{{ errors.customRestDays }}</em>
            </div>

            <label class="toggle-row full-field">
              <span>
                <strong>跟随中国大陆法定节假日</strong>
                <small>包含 2027 年放假与调休安排</small>
              </span>
              <input v-model="draft.useMainlandChinaHolidays" type="checkbox" role="switch" />
            </label>

            <label class="field">
              <span>上班</span>
              <input v-model="draft.startTime" class="time-input" type="time" :aria-invalid="Boolean(errors.workTime)" @click="$event.currentTarget.showPicker?.()" />
            </label>
            <label class="field">
              <span>下班</span>
              <input v-model="draft.endTime" class="time-input" type="time" :aria-invalid="Boolean(errors.workTime)" @click="$event.currentTarget.showPicker?.()" />
            </label>
            <label class="field">
              <span>午休 <small>分钟</small></span>
              <input v-model="draft.lunchBreakMinutes" type="number" inputmode="numeric" min="0" step="1" :aria-invalid="Boolean(errors.lunchBreakMinutes)" />
            </label>
            <em v-if="errors.workTime" class="field-error row-error">{{ errors.workTime }}</em>
            <em v-if="errors.lunchBreakMinutes" class="field-error row-error">{{ errors.lunchBreakMinutes }}</em>

            <label class="field full-field">
              <span>每月发薪日 <small>自然日</small></span>
              <input v-model="draft.payday" type="number" inputmode="numeric" min="1" max="31" step="1" :aria-invalid="Boolean(errors.payday)" />
              <em v-if="errors.payday" class="field-error">{{ errors.payday }}</em>
            </label>
          </div>

          <div class="dialog-actions">
            <button class="primary-button" type="submit">保存并开始</button>
            <p>保存后将按新配置重新计算全部收入</p>
          </div>
        </form>
      </dialog>
    </div>
  `,
}).mount('#app');
