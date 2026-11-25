import { readFile, writeFile } from 'node:fs/promises'

const image = await readFile(new URL('../src/assets/cat.png', import.meta.url))
const source = '// Generated from cat.png by npm run assets. Do not edit by hand.\n' +
  `globalThis.FishWageCatImage = 'data:image/png;base64,${image.toString('base64')}';\n`
await writeFile(new URL('../src/assets/cat-data.js', import.meta.url), source)
console.log('已生成支持本地 PNG 导出的猫咪图片数据')
