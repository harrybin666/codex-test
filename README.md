# 小鱼干时薪换算器

原生 HTML + CSS + JavaScript 单页项目，参考 PRD 与粉黄手绘风移动端原型。不使用 Vue 或其他前端框架，无生产依赖、后端、账号或外部字体依赖。页面使用普通脚本，支持直接打开本地文件。Vite 仅用于可选的开发服务和构建预览。

## 直接打开（无需安装）

双击项目根目录的 `index.html`，即可填写收入、换算消费和生成 PNG 对比图。不需要安装 Node.js、安装依赖或启动终端。请保留 `index.html` 和 `src/` 的相对位置，不要只复制一个 HTML 文件。

PNG 导出使用 `src/assets/cat-data.js` 中的内嵌图片，避免本地文件图片导致 Canvas 导出受到限制。如果替换了 `src/assets/cat.png`，请运行一次 `npm run assets`，更新导出图使用的猫咪图片数据；之后打开页面仍无需 npm。

浏览器对 `file://` 本地文件存储的支持不同，可能无法持久保存收入；保存失败会提示，但本次仍可换算。直接打开文件与通过本地服务器访问时的收入设置不保证共享。

## 开发与测试（可选）

需要 Node.js 20.19+ 或 22.12+。

```sh
npm install
npm run dev
```

打开终端显示的本地地址（默认 http://127.0.0.1:5173）。

使用开发服务器期间请保持终端运行；关闭终端或按 Ctrl+C 会停止服务。也可以直接双击根目录 `index.html` 使用。`npm run build` 会更新内嵌图片，并把 HTML、样式、普通脚本和图片复制到 `dist/`；可直接打开 `dist/index.html`，也可将其部署到静态网站服务器。

```sh
npm test
npm run build
npm run preview
```

## 功能

- 左上角小门按钮：在喵喵 App 内通过原生 `close` 操作关闭当前 WebView，回到 App；Android 使用 `window.callNative.evaluateJsToNative`（文档标注 SDK 1.2 起支持），iOS 使用 `window.webkit.messageHandlers.evaluateJsToNative.postMessage`。两端均传入含 `action`、字符串 `requestId` 和空 `data` 的 JSON 字符串。按实际接口是否存在选择平台，无需添加 URL 平台参数。
- 普通浏览器中点击小门会尝试关闭标签页；浏览器不允许时提示手动关闭。原生接口报错时提示使用 App 返回按钮，不改为网页历史后退。App 中的实际关闭效果仍需在 iOS 和 Android 真机联调。
- 填写税前月薪；默认每月 22 天、每天 8 小时，可展开调整。
- 输入月薪后显示保存按钮，点击后保存到当前浏览器并收起收入区域，右上角可重新编辑，支持清除；存储不可用时仍可计算。
- 手动输入消费名称和金额，金额及月薪不超过 100 万元，含上限。
- 按未舍入时薪计算；不足一分钟单独提示，其余向上取整到整分钟；天数按设置的每日工作小时折算。
- 结果、猫咪台词、单笔消费图卡共用同一结果快照；输入变更后需重新计算。
- 本地 Canvas 生成 PNG，不展示月薪与时薪；提供下载及长按保存预览。
- 收入之外的消费和图卡只保存在页面内存中。没有账单导入。

页面以 375 × 750 为设计基准；内容较长、展开工作设置或显示错误时自然延伸，适配窄屏及键盘操作。首次输入为空，示例仅作为占位提示。

## 文件

- `index.html`：完整页面结构，包括表单、结果区和图片预览。
- `src/main.js`：通过原生 DOM 和事件处理实现收入保存、表单校验、换算和导出交互。
- `src/native-bridge.js`：按提供的 Android/iOS 接口文档发送关闭操作，并接收原生回调；在页面头部提前加载。
- `src/native-bridge.test.js`：使用模拟的两端原生接口验证 JSON 报文、请求匹配、异常及浏览器兼容处理。
- `src/styles.css`：粉黄配色、爪印底纹和描边样式。
- `src/calculator.js`：输入校验、恢复设置和时长计算。
- `src/calculator.test.js`：Node 内置测试，覆盖公式、取整、边界和异常恢复。
- `src/export-card.js`：PNG 图卡生成。
- `src/assets/`：来自用户提供参考图的猫咪及小屋素材。
- `src/assets/cat-data.js`：由猫咪 PNG 自动生成的内嵌图片数据，用于本地文件模式下导出图片。
- `scripts/embed-cat.js`：更新内嵌猫咪图片数据。
- `scripts/build.js`：生成支持直接打开的 `dist/` 发布目录。

浏览器存储按来源隔离，换域名、端口或设备不会自动同步。项目使用独立存储键 `fish-wage-settings-v1`，不覆盖原待办数据。
