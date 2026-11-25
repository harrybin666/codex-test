import test from 'node:test'
import assert from 'node:assert/strict'
import './calculator.js'
const { calculate, validNumber, loadSettings, STORAGE_KEY } = globalThis.FishWageCalculator
const base = { salary: 10560, days: 22, hours: 8, name: '奶茶' }
test('换算分钟、工作天数和不足一分钟', () => {
  assert.equal(calculate({ ...base, amount: 25 }).duration, '25 分钟')
  assert.equal(calculate({ ...base, amount: 1080 }).duration, '2 天 2 小时')
  assert.equal(calculate({ ...base, amount: .5 }).duration, '不足 1 分钟')
  assert.equal(calculate({ ...base, amount: 25.01 }).duration, '26 分钟')
})
test('按用户每天的工作小时折算', () => {
  assert.equal(calculate({ ...base, salary: 12000, days: 20, hours: 6, amount: 1300 }).duration, '2 天 1 小时')
  assert.equal(calculate({ ...base, salary: 1000, days: 20, hours: 7.5, amount: 100 }).duration, '2 天')
})
test('金额边界及非法数字', () => {
  assert.equal(validNumber(1000000, 1000000), true)
  for (const value of [0, -1, 1000000.01, Infinity, 'NaN', '1e5', '1.001', '']) assert.equal(validNumber(value, 1000000), false)
})
test('恢复有效设置，损坏或不可读时使用默认值', () => {
  assert.equal(loadSettings({ getItem: key => key === STORAGE_KEY ? JSON.stringify(base) : null }).salary, 10560)
  for (const storage of [{ getItem: () => '{' }, { getItem: () => 'null' }, { getItem: () => { throw Error() } }]) assert.equal(loadSettings(storage).salary, '')
})
