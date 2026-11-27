# 喵喵时薪秤

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

## Windows 内网服务自动重启

项目附带 `scripts/server-manager.ps1`，不需要添加 npm 依赖。在项目根目录的 PowerShell 中运行一次：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\server-manager.ps1 -Action Install
```

脚本使用当前安装的 Node 和 Vite，把网页服务绑定到 `0.0.0.0:5173`，同一内网可使用电脑的实际 IPv4 地址访问。后台守护进程每 5 秒检查一次服务，Vite 退出后重新启动；恢复还需加上 Vite 自身的启动时间。已在运行且属于本项目的服务会被接管，其他程序占用端口时不会被结束。

优先注册当前用户的 Windows 计划任务：登录后恢复守护进程，并每分钟补拉一次意外退出的守护进程。如果系统拒绝创建计划任务，会自动改用当前用户“启动”目录快捷方式；这种降级模式下，Vite 退出仍能自动恢复，但守护进程本身被结束后需要手动 Start 或重新登录。

启动依赖用户登录；电脑关机、休眠或网络中断期间网页不可访问。IP 改变后需要更新手机访问地址。此机制不检查网页内部业务错误，也不对仍存活但卡死的服务进行强制重启。

```powershell
# 查看运行状态
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\server-manager.ps1 -Action Status
# 手动启动或解除暂停
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\server-manager.ps1 -Action Start
# 暂停守护并停止本项目网页服务，不会被下次检查立即拉起
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\server-manager.ps1 -Action Stop
# 取消登录启动，并停止服务（保留源码和日志）
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\server-manager.ps1 -Action Uninstall
```

状态、配置和轮转日志写入忽略提交的 `.server/`。移动项目目录或更换 Node 路径前，先在旧位置执行 Uninstall，再在新位置执行 Install。`npm run dev` 仍保持原来的前台本地开发方式，不要在后台服务已占用 5173 时重复启动。

## 功能

- 左上角小门按钮：在喵喵 App 内通过原生 `close` 操作关闭当前 WebView，回到 App；Android 使用 `window.callNative.evaluateJsToNative`（文档标注 SDK 1.2 起支持），iOS 使用 `window.webkit.messageHandlers.evaluateJsToNative.postMessage`。两端均传入含 `action`、字符串 `requestId` 和空 `data` 的 JSON 字符串。按实际接口是否存在选择平台，无需添加 URL 平台参数。
- 普通浏览器中点击小门会尝试关闭标签页；浏览器不允许时提示手动关闭。原生接口报错时提示使用 App 返回按钮，不改为网页历史后退。App 中的实际关闭效果仍需在 iOS 和 Android 真机联调。
- 填写税前月薪；默认每月 22 天、每天 8 小时，可展开调整。
- 输入月薪后显示保存按钮，点击后保存到当前浏览器并收起收入区域，右上角可重新编辑，支持清除；存储不可用时仍可计算。
- 手动输入消费名称和金额，金额及月薪不超过 100 万元，含上限。
- 按未舍入时薪计算；不足一分钟单独提示，其余向上取整到整分钟；天数按设置的每日工作小时折算。
- 结果、猫咪台词、单笔消费图卡共用同一结果快照；输入变更后需重新计算。
- 本地 Canvas 生成 PNG，不展示月薪与时薪。Android App 内调用 `shareImg`（文档标注 SDK 2.7 起支持），传入 `platform: 3` 和 `data:image/png;base64,...`，由客户端处理授权及保存；仅收到匹配请求的成功回调且 `data.code === 200` 时提示已保存到相册。
- Android 保存期间禁用重复点击；权限拒绝（`-1000004`）、取消、客户端忙、调用异常分别提示，并保留图片预览。60 秒未收到回调时提示先查看相册，避免重复保存，不自动切换浏览器下载。
- 浏览器生成图卡后自动滚动到底部预览；Android 在客户端保存成功后滚动，iOS 长按保存方案也会自动展示预览。等待图片加载完成后再定位；输入已修改时不跳转。系统启用“减少动态效果”时直接定位，否则平滑滚动。
- 当前提供的 iOS 文档未包含保存图片/相册接口，因此 iOS 保留预览与长按保存，不调用未定义的 `shareImg`。完整支持 iOS 直接保存相册需要补充已实现的接口名称、参数及回调文档。普通浏览器继续提供 PNG 下载与长按预览。
- 原生保存仍受客户端版本、系统权限及设备状态影响，用户拒绝授权时无法保证写入相册；Android 的实际相册写入和权限弹窗需要真机验证。
- 收入之外的消费和图卡只保存在页面内存中。没有账单导入。

页面随手机视口伸缩，最大内容宽度 480px；支持 320px 窄屏、Android Chrome/WebView 和 iOS Safari/WKWebView 的移动布局。使用 `viewport-fit=cover` 与安全区域留白，主要按钮和输入框点击高度至少 44px，输入字号至少 16px。网页锁定初始缩放比例，限制横向拖动、双指缩放和双击缩放，保留上下滚动、表单操作及长按图片保存。窄屏下消费字段及换算结果纵向排列；金额与时长支持换行。

缩放限制由 viewport、CSS `touch-action` 及触摸/手势事件共同处理。系统辅助功能缩放及 App 容器自身的侧滑返回、回弹或缩放策略仍由系统/客户端控制；如需锁定这些原生行为，需由客户端配置 WebView。

支持小数数字键盘和“下一项/完成”键提示：消费名称回车后进入金额，工作天数回车后进入小时数，收入或小时数回车可保存设置。内容、错误提示和图片预览自然延伸，手机横屏与键盘弹出时可滚动。首次输入为空，示例仅作为占位提示。模拟视口用于验证布局；刘海屏安全区、软键盘和客户端原生保存仍需真机验证。

## 文件

- `index.html`：完整页面结构，包括表单、结果区和图片预览。
- `src/main.js`：通过原生 DOM 和事件处理实现收入保存、表单校验、换算和导出交互。
- `src/viewport-lock.js`：限制横向拖动与网页手势缩放，保留纵向滚动和长按图片。
- `src/viewport-lock.test.js`：验证单指滚动、多指缩放、双击、长按和触摸中断恢复。
- `src/native-bridge.js`：按提供的 Android/iOS 接口文档发送关闭操作，并接入 Android 图片保存及回调；在页面头部提前加载。
- `src/native-bridge.test.js`：使用模拟的原生接口验证 JSON 报文、保存结果、权限拒绝、超时、请求匹配及异常。
- `src/save-card.test.js`：验证按钮保存流程、原生结果提示、浏览器下载、iOS 预览及旧结果防护。
- `src/styles.css`：粉黄配色、爪印底纹和描边样式。
- `src/calculator.js`：输入校验、恢复设置和时长计算。
- `src/calculator.test.js`：Node 内置测试，覆盖公式、取整、边界和异常恢复。
- `src/export-card.js`：PNG 图卡生成。
- `src/assets/`：来自用户提供参考图的猫咪及小屋素材。
- `src/assets/cat-data.js`：由猫咪 PNG 自动生成的内嵌图片数据，用于本地文件模式下导出图片。
- `scripts/embed-cat.js`：更新内嵌猫咪图片数据。
- `scripts/build.js`：生成支持直接打开的 `dist/` 发布目录。

浏览器存储按来源隔离，换域名、端口或设备不会自动同步。项目使用独立存储键 `fish-wage-settings-v1`，不覆盖原待办数据。
