export const DEFAULT_CONFIG = Object.freeze({
  monthlySalary: 5000,
  restRule: 'double',
  customRestDays: [0, 6],
  useMainlandChinaHolidays: true,
  startTime: '09:00',
  endTime: '18:00',
  lunchBreakMinutes: 60,
  payday: 10,
});

const HOLIDAY_RANGES_2027 = [
  ['2027-01-01', '2027-01-03', '元旦'],
  ['2027-02-05', '2027-02-13', '春节'],
  ['2027-04-03', '2027-04-05', '清明节'],
  ['2027-05-01', '2027-05-05', '劳动节'],
  ['2027-06-09', '2027-06-09', '端午节'],
  ['2027-09-15', '2027-09-15', '中秋节'],
  ['2027-10-01', '2027-10-07', '国庆节'],
];

const MAKEUP_WORKDAYS_2027 = new Set([
  '2027-01-31',
  '2027-02-14',
  '2027-05-08',
  '2027-09-26',
  '2027-10-09',
]);

const HOLIDAYS_2027 = buildHolidayMap(HOLIDAY_RANGES_2027);

function buildHolidayMap(ranges) {
  const result = new Map();
  for (const [start, end, name] of ranges) {
    const cursor = parseDateKey(start);
    const last = parseDateKey(end);
    while (cursor <= last) {
      result.set(toDateKey(cursor), name);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return result;
}

function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

export function validateConfig(config) {
  const errors = {};
  const salary = Number(config.monthlySalary);
  const lunch = Number(config.lunchBreakMinutes);
  const payday = Number(config.payday);
  const start = parseTime(config.startTime);
  const end = parseTime(config.endTime);

  if (!Number.isFinite(salary) || salary <= 0) {
    errors.monthlySalary = '请输入大于 0 的税前月工资';
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    errors.workTime = '下班时间必须晚于上班时间';
  } else if (!Number.isFinite(lunch) || lunch < 0 || lunch >= end - start) {
    errors.lunchBreakMinutes = '午休时长必须小于当天工作区间';
  }
  if (!Number.isInteger(payday) || payday < 1 || payday > 31) {
    errors.payday = '发薪日应为 1 至 31 的整数';
  }
  if (config.restRule === 'custom' && (config.customRestDays?.length ?? 0) >= 7) {
    errors.customRestDays = '每周至少保留一个工作日';
  }
  return errors;
}

function getWeeklyRestDays(config) {
  if (config.restRule === 'single') return new Set([0]);
  if (config.restRule === 'custom') {
    return new Set((config.customRestDays ?? []).map(Number));
  }
  return new Set([0, 6]);
}

export function getDayInfo(date, config = DEFAULT_CONFIG) {
  const key = toDateKey(date);
  if (config.useMainlandChinaHolidays && date.getFullYear() === 2027) {
    if (MAKEUP_WORKDAYS_2027.has(key)) {
      return { isWorkday: true, type: 'makeup', label: '调休上班' };
    }
    if (HOLIDAYS_2027.has(key)) {
      return { isWorkday: false, type: 'holiday', label: HOLIDAYS_2027.get(key) };
    }
  }

  const isRestDay = getWeeklyRestDays(config).has(date.getDay());
  return isRestDay
    ? { isWorkday: false, type: 'weekly-rest', label: '休息日' }
    : { isWorkday: true, type: 'workday', label: '工作日' };
}

export function getMonthWorkdays(year, monthIndex, config = DEFAULT_CONFIG) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const result = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day);
    if (getDayInfo(date, config).isWorkday) result.push(day);
  }
  return result;
}

export function getSchedule(config) {
  const startMinute = parseTime(config.startTime);
  const endMinute = parseTime(config.endTime);
  const lunchMinutes = Number(config.lunchBreakMinutes);
  const grossMinutes = endMinute - startMinute;
  const effectiveMinutes = grossMinutes - lunchMinutes;
  const lunchStartMinute = startMinute + Math.max(0, (grossMinutes - lunchMinutes) / 2);
  return {
    startMinute,
    endMinute,
    lunchMinutes,
    effectiveMinutes,
    lunchStartMinute,
    lunchEndMinute: lunchStartMinute + lunchMinutes,
  };
}

function secondsSinceMidnight(date) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

export function getTodayProgress(now, config = DEFAULT_CONFIG) {
  const dayInfo = getDayInfo(now, config);
  const schedule = getSchedule(config);
  const totalSeconds = schedule.effectiveMinutes * 60;

  if (!dayInfo.isWorkday) {
    return { progress: 0, elapsedSeconds: 0, remainingSeconds: totalSeconds, status: dayInfo.type };
  }

  const current = secondsSinceMidnight(now);
  const start = schedule.startMinute * 60;
  const end = schedule.endMinute * 60;
  const lunchStart = schedule.lunchStartMinute * 60;
  const lunchEnd = schedule.lunchEndMinute * 60;
  let elapsedSeconds = 0;
  let status = 'before-work';

  if (current >= end) {
    elapsedSeconds = totalSeconds;
    status = 'after-work';
  } else if (current >= start) {
    if (schedule.lunchMinutes > 0 && current >= lunchStart && current < lunchEnd) {
      elapsedSeconds = lunchStart - start;
      status = 'lunch';
    } else if (current >= lunchEnd) {
      elapsedSeconds = current - start - schedule.lunchMinutes * 60;
      status = 'working';
    } else {
      elapsedSeconds = current - start;
      status = 'working';
    }
  }

  elapsedSeconds = Math.min(totalSeconds, Math.max(0, elapsedSeconds));
  return {
    progress: totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0,
    elapsedSeconds,
    remainingSeconds: Math.max(0, totalSeconds - elapsedSeconds),
    status,
  };
}

function dateOrdinal(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

function paydayForMonth(year, monthIndex, payday) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(Number(payday), lastDay));
}

export function getPaydayCountdown(now, payday) {
  let target = paydayForMonth(now.getFullYear(), now.getMonth(), payday);
  if (dateOrdinal(now) > dateOrdinal(target)) {
    target = paydayForMonth(now.getFullYear(), now.getMonth() + 1, payday);
  }
  return {
    days: dateOrdinal(target) - dateOrdinal(now),
    target,
  };
}

function formatStatus(dayInfo, progressStatus) {
  if (dayInfo.type === 'holiday') return `${dayInfo.label} · 今日休息`;
  if (dayInfo.type === 'weekly-rest') return '今天休息';
  if (progressStatus === 'before-work') return '还未开工';
  if (progressStatus === 'lunch') return '午休充电中';
  if (progressStatus === 'after-work') return '今日已完成';
  if (dayInfo.type === 'makeup') return '调休上班 · 正在计薪';
  return '正在计薪';
}

export function calculateSnapshot(config, now = new Date()) {
  const workdays = getMonthWorkdays(now.getFullYear(), now.getMonth(), config);
  const monthlySalary = Number(config.monthlySalary);
  const dailySalary = workdays.length ? monthlySalary / workdays.length : 0;
  const schedule = getSchedule(config);
  const perSecond = schedule.effectiveMinutes > 0
    ? dailySalary / (schedule.effectiveMinutes * 60)
    : 0;
  const perMinute = perSecond * 60;
  const dayInfo = getDayInfo(now, config);
  const todayProgress = getTodayProgress(now, config);
  const todayEarned = dayInfo.isWorkday ? dailySalary * todayProgress.progress : 0;
  const completedWorkdays = workdays.filter((day) => day < now.getDate()).length;
  const monthEarned = Math.min(monthlySalary, dailySalary * completedWorkdays + todayEarned);
  const payday = getPaydayCountdown(now, config.payday);

  return {
    dayInfo,
    statusText: formatStatus(dayInfo, todayProgress.status),
    todayEarned,
    dailySalary,
    perMinute,
    perSecond,
    progress: todayProgress.progress,
    remainingSeconds: todayProgress.remainingSeconds,
    monthEarned,
    monthPending: Math.max(0, monthlySalary - monthEarned),
    monthWorkdays: workdays.length,
    paydayDays: payday.days,
    paydayDate: payday.target,
  };
}

export function formatMoney(value) {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${minutes}分钟`;
}
