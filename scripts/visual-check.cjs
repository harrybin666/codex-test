const fs = require('node:fs');
const path = require('node:path');

const modulesRoot = process.env.CODEX_NODE_MODULES;
if (!modulesRoot) throw new Error('CODEX_NODE_MODULES is required');
const { chromium } = require(path.join(modulesRoot, 'playwright'));

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('artifacts');
fs.mkdirSync(outputDir, { recursive: true });

async function inspectViewport(browser, name, viewport, firstRun) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  if (firstRun) {
    await page.addInitScript(() => localStorage.clear());
  } else {
    await page.addInitScript(() => {
      localStorage.setItem('salary-motivator-config-v1', JSON.stringify({
        monthlySalary: 5000,
        restRule: 'double',
        customRestDays: [0, 6],
        useMainlandChinaHolidays: true,
        startTime: '09:00',
        endTime: '18:00',
        lunchBreakMinutes: 60,
        payday: 10,
      }));
    });
  }

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  if (firstRun) {
    const dialog = page.locator('dialog');
    try {
      await dialog.waitFor({ state: 'visible', timeout: 5000 });
    } catch (error) {
      const state = await page.evaluate(() => ({
        appText: document.querySelector('#app')?.textContent?.slice(0, 300),
        dialogCount: document.querySelectorAll('dialog').length,
        dialogOpen: document.querySelector('dialog')?.open,
      }));
      throw new Error(`settings dialog missing: ${JSON.stringify({ state, errors })}`, { cause: error });
    }
    const timeInputs = page.locator('input[type="time"]');
    await page.evaluate(() => { window.__timePickerCalls = []; });
    for (let index = 0; index < 2; index += 1) {
      await timeInputs.nth(index).evaluate((element) => {
        element.showPicker = () => window.__timePickerCalls.push(element.value);
      });
      await timeInputs.nth(index).click({ position: { x: 12, y: 12 } });
    }
    const pickerCalls = await page.evaluate(() => window.__timePickerCalls.length);
    if (pickerCalls !== 2) errors.push(`time picker calls: ${pickerCalls}`);
    await page.screenshot({ path: path.join(outputDir, `${name}-settings.png`) });
    await page.getByLabel('月工资 税前 · 元').fill('6800');
    await page.getByRole('button', { name: '保存并开始' }).click();
    await dialog.waitFor({ state: 'hidden' });
  }

  await page.locator('.earnings-panel').waitFor({ state: 'visible' });
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyHeight: document.body.scrollHeight,
    h1: document.querySelector('h1')?.textContent?.trim(),
    cards: document.querySelectorAll('.stat-card').length,
  }));
  if (dimensions.scrollWidth > dimensions.innerWidth) {
    errors.push(`horizontal overflow: ${dimensions.scrollWidth} > ${dimensions.innerWidth}`);
  }
  if (!dimensions.h1 || dimensions.cards !== 4) {
    errors.push(`unexpected content: ${JSON.stringify(dimensions)}`);
  }

  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
  await context.close();
  return { name, dimensions, errors };
}

(async () => {
  const browser = await chromium.launch({ executablePath: edgePath, headless: true });
  try {
    const results = [];
    results.push(await inspectViewport(browser, 'desktop-1440', { width: 1440, height: 1000 }, true));
    results.push(await inspectViewport(browser, 'mobile-390', { width: 390, height: 844 }, true));
    console.log(JSON.stringify(results, null, 2));
    if (results.some((result) => result.errors.length)) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
