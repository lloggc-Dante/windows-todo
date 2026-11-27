# 玻璃卡片视觉层级与拖动材质 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将主窗口与桌面贴片改造成用户选定的玻璃卡片视觉层级，并修复实测仍存在的贴片拖动背景模糊。

**Architecture:** 保留现有 Vue 组件、Electron 窗口控制和数据流，只在确认拖动模糊的真实来源后做最小窗口/材质修复。主窗口通过现有组件的作用域样式建立三个玻璃面板，贴片在 `widget.css` 中复用相同的色彩与边缘语言，不引入依赖。

**Tech Stack:** Electron 45、Vue 3、TypeScript、CSS、Playwright、Vitest

**Spec:** `docs/superpowers/specs/2026-11-23-glass-card-hierarchy-design.md`

## Global Constraints

- 不改变任务功能、数据结构、三栏逻辑、八行上限、滚动、拖动、缩放和托盘行为。
- 不引入新的 UI 框架、图标库或依赖。
- 贴片不得使用任何背景高斯模糊；玻璃感由渐变、亮边和阴影承担。
- 保留现有测试选择器、交互区域与减少动态效果支持。
- 沿用当前 Native 执行方式，不提交或合并分支。

## Review Focus

- 用户实际运行的安装版可能不是最新构建：Task 1 核对安装资源与运行进程，不能仅凭源码断言已修复。
- Windows 透明窗口的 DWM 合成可能独立于 CSS：Task 1 同时核对 `backgroundMaterial`、`transparent` 和 `roundedCorners`。
- 卡片化不得破坏 42px 贴片行高和八行滚动：Task 3 扩展现有几何测试。
- 主窗口窄宽度仍需隐藏详情并保留任务操作：Task 2 运行现有最小宽度回归。
- 新增悬停/选中动效不得影响拖动区域或减少动态效果：Task 2、Task 3 运行现有动效与拖动区域测试。

---

### Task 1: 定位并消除真实拖动模糊

**Files:**
- Modify: `src/main/widget-window-controller.ts`
- Modify: `src/shared/widget.ts`
- Modify: `src/renderer/src/widget.css`
- Test: `tests/main/widget-window-controller.test.ts`
- Test: `tests/main/widget-layout.test.ts`
- Test: `tests/e2e/glass-material.spec.ts`

**Interfaces:**
- Consumes: `WidgetPresentation`、`WidgetWindowController.initialize()`、`resolveWidgetPresentation()`。
- Produces: 与现有接口兼容的窗口材质配置；贴片运行时所有背景采样滤镜均为 `none`。

- [ ] **Step 1: 核对用户实测运行链路**

确认已安装进程路径、安装资源中的贴片 CSS 与当前构建是否一致；在当前构建的隔离预览中记录 `getComputedStyle()` 的 `backdropFilter`/`filter` 以及窗口 `WidgetPresentation`。用完整桌面截图分别捕获静止与真实鼠标拖动状态，排除 KimiCU 单窗口透明截图的黑底干扰。

- [ ] **Step 2: 为确认的根因写一个失败回归测试**

若运行资源仍是旧版，先修正安装验证流程，不改无关窗口代码；若最新构建仍模糊，针对实际来源添加断言：CSS 来源检查计算样式，Electron 配置来源检查 `createWindow` 参数，平台配置来源检查 `resolveWidgetPresentation()` 的精确返回值。测试必须在修复前因该来源失败。

- [ ] **Step 3: 实施单一根因修复**

只改变 Step 2 证明会引发模糊的窗口选项或样式；不得同时恢复 Acrylic、系统背景材质或任何 `backdrop-filter: blur(...)`。

- [ ] **Step 4: 验证修复**

运行相关 Vitest/Playwright 测试并确认通过；再次用同一桌面背景和拖动路径截图，对比后方壁纸边缘在静止和拖动时都保持清晰。

### Task 2: 主窗口玻璃卡片层级

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/components/ListSidebar.vue`
- Modify: `src/renderer/src/components/TaskList.vue`
- Modify: `src/renderer/src/components/TaskDetail.vue`
- Modify: `src/renderer/src/components/WindowTitlebar.vue`
- Modify: `src/renderer/src/apple-glass.css`
- Test: `tests/e2e/glass-material.spec.ts`
- Test: `tests/e2e/final-review.spec.ts`

**Interfaces:**
- Consumes: 现有 `.app-shell` 三栏 grid、`.list-sidebar`、`.task-panel`、`.task-detail` 与 `--glass-*` 变量。
- Produces: 三个协调玻璃面板、轻量任务卡片，以及默认/悬停/选中/聚焦的明确层级；DOM 与事件接口不变。

- [ ] **Step 1: 写失败的材质与层级测试**

在 `glass-material.spec.ts` 中断言三个面板具有非空圆角、透明渐变背景与亮边，选中任务具有区别于默认任务的背景；不得只检查源码文本。

- [ ] **Step 2: 运行测试确认因旧材质失败**

Run: `npx playwright test tests/e2e/glass-material.spec.ts`

- [ ] **Step 3: 实现主窗口视觉层级**

让 `.app-shell` 使用面板间距和透明容器背景；侧栏降低对比度，任务区保持最高内容权重，详情栏使用次级材质。将 `.task-item` 改为不增加文档高度的轻量卡片，默认低对比、悬停略亮、选中使用更亮玻璃与克制蓝色强调；快速添加和保存保留主按钮地位，删除保持次级危险操作。

- [ ] **Step 4: 检查响应式与真实交互**

Run: `npx playwright test tests/e2e/glass-material.spec.ts tests/e2e/final-review.spec.ts tests/e2e/glass-motion.spec.ts tests/e2e/window-chrome.spec.ts`

Expected: 全部通过，最小宽度下详情隐藏、编辑与窗口生命周期不受影响。

### Task 3: 贴片玻璃卡片与几何回归

**Files:**
- Modify: `src/renderer/src/widget.css`
- Modify: `src/renderer/src/components/WidgetTaskList.vue`（仅在现有结构无法承载卡片样式时）
- Test: `tests/e2e/glass-material.spec.ts`
- Test: `tests/e2e/widget.spec.ts`
- Test: `tests/e2e/glass-motion.spec.ts`

**Interfaces:**
- Consumes: `.widget-shell`、`.widget-task-row`、`.widget-composer` 和 `WIDGET_ROW_HEIGHT = 42`。
- Produces: 与主窗口一致的轻量玻璃任务卡片；窗口拖动区域和输入行为不变。

- [ ] **Step 1: 扩展失败的几何与材质断言**

验证贴片容器不含任何 `blur()` 背景滤镜，任务行具有卡片圆角且实际高度仍为 42px，九项任务仍在八行视口内滚动。

- [ ] **Step 2: 实现贴片卡片样式**

使用低白度渐变、局部高光和细亮边形成任务卡片；通过行内间距而不是增加行高制造分隔。输入框与添加按钮保持清晰但次于任务内容，禁止文字选择和拖动区域行为保持不变。

- [ ] **Step 3: 验证贴片交互与几何**

Run: `npx playwright test tests/e2e/glass-material.spec.ts tests/e2e/widget.spec.ts tests/e2e/widget-settings.spec.ts tests/e2e/glass-motion.spec.ts`

Expected: 全部通过，包括添加、勾选、排序、清单切换、拖动区域、文字选择、八行滚动与减少动态效果。

### Task 4: 完整验证与交付

**Files:**
- Verify: `src/renderer/src/**/*.vue`
- Verify: `src/renderer/src/*.css`
- Verify: `release/轻待办-Setup-0.1.0-x64.exe`

**Interfaces:**
- Consumes: Tasks 1–3 的完整改动。
- Produces: 经完整回归验证的新安装包。

- [ ] **Step 1: 运行完整验证**

Run: `npm run typecheck && npm run test && npm run test:e2e`

Expected: 类型检查无错误，所有单元测试和 24 项以上端到端测试通过。

- [ ] **Step 2: 构建安装包**

Run: `npm run dist`

Expected: 成功生成 `release/轻待办-Setup-0.1.0-x64.exe`；未签名与默认图标警告如实保留。

- [ ] **Step 3: 验证最终打包版**

从托盘退出旧版后，以隔离数据启动打包版，检查默认、悬停、选中、聚焦、空状态、窄窗口和八行滚动；对贴片执行真实鼠标拖动并捕获完整桌面，确认静止/拖动均无背景模糊。关闭隔离预览，删除本次截图与测试输出，保留安装包。
