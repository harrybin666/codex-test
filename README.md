# 日常 · 待办清单

基于 Vue 3 Composition API 和 Vite 的待办清单，使用 JavaScript 和原生 CSS。

## 本地运行

```sh
npm install
npm run dev
```

## 构建与预览

```sh
npm run build
npm run preview
```

任务保存在当前站点的浏览器 localStorage 中，存储键为 `richang-todos-v1`。与原页面在同一来源（协议、域名和端口）运行时可直接读取原有数据；切换来源不会自动共享浏览器存储。

`src/App.vue` 管理状态和持久化；`src/components` 包含侧栏、概览、任务面板、任务项和提示组件；`src/styles.css` 保留原页面布局与响应式样式。
