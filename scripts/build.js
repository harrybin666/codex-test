import { cp, mkdir } from 'node:fs/promises'
import './embed-cat.js'

const root = new URL('../', import.meta.url)
const output = new URL('dist/', root)
await mkdir(output, { recursive: true })
await cp(new URL('index.html', root), new URL('index.html', output))
await cp(new URL('src/', root), new URL('src/', output), {
  recursive: true,
  filter: source => !source.endsWith('.test.js')
})
console.log('已构建到 dist/，支持直接打开 dist/index.html 或部署到静态服务器')
