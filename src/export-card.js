;(function () {
'use strict'
const { catSpeech } = globalThis.FishWageCalculator
function wrap(ctx, text, maxWidth) {
  const lines = []; let line = ''
  for (const char of text) { if (ctx.measureText(line + char).width > maxWidth && line) { lines.push(line); line = char } else line += char }
  if (line) lines.push(line)
  return lines
}
async function exportCard(result, catUrl) {
  await document.fonts.ready
  const image = new Image()
  image.src = catUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 750
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法生成图片')
  ctx.font = '28px sans-serif'
  const names = wrap(ctx, result.name, 610)
  const speeches = wrap(ctx, catSpeech(result), 600)
  const height = 820 + Math.max(0, names.length - 1) * 40 + Math.max(0, speeches.length - 1) * 38
  canvas.height = height
  ctx.fillStyle = '#fff7e4'; ctx.fillRect(0, 0, 750, height)
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#292a24'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.roundRect(35, 35, 680, height - 70, 28); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#ffd0df'; ctx.fillRect(38, 65, 674, 85)
  ctx.textAlign = 'center'; ctx.fillStyle = '#292a24'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('小鱼干 · 本喵的换算小票', 375, 120)
  ctx.drawImage(image, 285, 180, 180, 145)
  let y = 375; ctx.font = '28px sans-serif'
  for (const line of names) { ctx.fillText(line, 375, y); y += 40 }
  ctx.fillStyle = '#df6086'; ctx.font = 'bold 40px sans-serif'; ctx.fillText(`¥${result.amount.toFixed(2)}`, 375, y + 14)
  y += 90; ctx.font = '24px sans-serif'; ctx.fillStyle = '#797873'; ctx.fillText('等于你的打工时间', 375, y)
  y += 65; ctx.font = 'bold 46px sans-serif'; while (ctx.measureText(result.duration).width > 610) { const size = parseInt(ctx.font.match(/\d+/)[0]) - 1; ctx.font = `bold ${size}px sans-serif` } ctx.fillStyle = '#df6086'; ctx.fillText(result.duration, 375, y)
  y += 76; ctx.font = '26px sans-serif'; ctx.fillStyle = '#4c4438'
  for (const line of speeches) { ctx.fillText(line, 375, y); y += 38 }
  ctx.font = '21px sans-serif'; ctx.fillStyle = '#797873'; ctx.fillText(`按税前收入估算 · 1 天按工作 ${result.hours} 小时折算`, 375, height - 90)
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('图片生成失败')
  return URL.createObjectURL(blob)
}
globalThis.FishWageExport = Object.freeze({ exportCard })
})()
