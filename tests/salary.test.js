import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CONFIG,
  calculateSnapshot,
  getDayInfo,
  getMonthWorkdays,
  getPaydayCountdown,
  getTodayProgress,
  validateConfig,
} from '../src/salary.js';

const config = { ...DEFAULT_CONFIG, customRestDays: [0, 6] };

test('2027 法定节假日覆盖普通工作日', () => {
  assert.deepEqual(getDayInfo(new Date(2027, 1, 5), config), {
    isWorkday: false,
    type: 'holiday',
    label: '春节',
  });
  assert.equal(getDayInfo(new Date(2027, 8, 15), config).label, '中秋节');
});

test('2027 调休上班日覆盖周末规则', () => {
  const sunday = getDayInfo(new Date(2027, 0, 31), config);
  const saturday = getDayInfo(new Date(2027, 4, 8), config);
  assert.equal(sunday.isWorkday, true);
  assert.equal(sunday.type, 'makeup');
  assert.equal(saturday.isWorkday, true);
  assert.equal(saturday.type, 'makeup');
});

test('关闭法定节假日后仅按每周休息制度判断', () => {
  const withoutHolidays = { ...config, useMainlandChinaHolidays: false };
  assert.equal(getDayInfo(new Date(2027, 1, 5), withoutHolidays).isWorkday, true);
  assert.equal(getDayInfo(new Date(2027, 0, 31), withoutHolidays).isWorkday, false);
});

test('月工作日会计入调休并排除法定节假日', () => {
  const january = getMonthWorkdays(2027, 0, config);
  assert.equal(january.includes(1), false);
  assert.equal(january.includes(31), true);
  assert.equal(january.length, 21);
});

test('午休期间暂停收入进度', () => {
  const beforeLunch = getTodayProgress(new Date(2026, 10, 9, 12, 0, 0), config);
  const duringLunch = getTodayProgress(new Date(2026, 10, 9, 13, 30, 0), config);
  assert.equal(beforeLunch.status, 'working');
  assert.equal(duringLunch.status, 'lunch');
  assert.equal(duringLunch.elapsedSeconds, 4 * 60 * 60);
});

test('发薪日倒计时按自然日计算且当天为零', () => {
  assert.equal(getPaydayCountdown(new Date(2026, 10, 10, 18), 10).days, 0);
  assert.equal(getPaydayCountdown(new Date(2026, 10, 11, 9), 10).days, 29);
  assert.equal(getPaydayCountdown(new Date(2027, 1, 27, 9), 31).days, 1);
});

test('收入快照从自然月一日累计并限制在月薪内', () => {
  const snapshot = calculateSnapshot(config, new Date(2026, 10, 9, 18, 0, 0));
  assert.equal(snapshot.monthWorkdays, 21);
  assert.equal(snapshot.todayEarned, snapshot.dailySalary);
  assert.ok(Math.abs(snapshot.perMinute - snapshot.dailySalary / (8 * 60)) < 1e-12);
  assert.equal(snapshot.monthEarned <= config.monthlySalary, true);
  assert.equal(snapshot.monthPending, config.monthlySalary - snapshot.monthEarned);
});

test('配置校验拒绝跨午夜和全部休息', () => {
  assert.equal(Boolean(validateConfig({ ...config, startTime: '22:00', endTime: '06:00' }).workTime), true);
  assert.equal(Boolean(validateConfig({
    ...config,
    restRule: 'custom',
    customRestDays: [0, 1, 2, 3, 4, 5, 6],
  }).customRestDays), true);
});
