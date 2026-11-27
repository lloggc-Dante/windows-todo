# Windows 原生分层贴片与玻璃卡片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 WPF 原生逐像素透明贴片替换 Electron 贴片，保持全部任务交互并消除移动合成异常，同时完成主窗口玻璃卡片层级。

**Architecture:** Electron 继续拥有 SQLite、业务校验、提醒、托盘与主窗口；独立 .NET Framework 4.8 WPF 进程只负责贴片显示和输入。双方通过标准输入输出的逐行 JSON 通信，主进程在每次变更后推送完整状态快照。

**Tech Stack:** Electron 45、Vue 3、TypeScript、Node.js、WPF/.NET Framework 4.8、C# 5、Vitest、Playwright、KimiCU 真实 Windows 验证

**Spec:** `docs/superpowers/specs/2026-11-23-native-layered-widget-design.md`；主窗口视觉同时遵循 `docs/superpowers/specs/2026-11-23-glass-card-hierarchy-design.md`

## Global Constraints

- WPF 不直接访问 SQLite，不开放网络端口，不引入第三方运行库或 UI 依赖。
- 贴片 `Topmost=False`、`ShowInTaskbar=False`，可被普通窗口覆盖。
- 保持 320–480 DIP 宽度、42 DIP 行高、最多八行、手动排序和中文 IME 输入。
- 贴片不使用 Acrylic、Mica 或背景高斯模糊。
- 不创建第二个 Electron 贴片窗口；主窗口与现有数据保持兼容。
- 沿用当前 feature 工作区和 Native 执行方式，不提交、合并或重置用户改动。

## Review Focus

- 部分 JSON 行、损坏消息和未知类型：Task 1 测试逐行解析与拒绝行为。
- 主窗口与贴片并发修改/排序：Task 2 测试数据库最新状态优先并完整重发快照。
- 中文 IME、添加失败保留输入和无效 ID：Task 3、Task 4 验证原生操作与错误回传。
- 高 DPI、多显示器、八行滚动与位置恢复：Task 3、Task 5 验证 DIP 几何和重启。
- WPF 异常退出或应用退出：Task 2、Task 4 测试进程清理和下一次显示时重建。

---

### Task 1: 原生构建与 JSON 协议

**Files:**
- Create: `native-widget/Models.cs`
- Create: `native-widget/Protocol.cs`
- Create: `native-widget/Program.cs`
- Create: `scripts/build-native-widget.mjs`
- Create: `src/shared/native-widget-protocol.ts`
- Modify: `package.json`
- Test: `tests/main/native-widget-protocol.test.ts`
- Test: `tests/packaging/config.test.ts`

**Interfaces:**
- Produces: `NativeWidgetSnapshot`、`NativeWidgetCommand`、`NativeWidgetEvent`、`parseNativeWidgetEvent(line: string)`、`serializeNativeWidgetCommand(command)`。
- Produces: `npm run build:native-widget`，输出 `native-widget/bin/LightTodo.Widget.exe`；`--self-test` 返回 0。

- [ ] **Step 1: 写协议失败测试**

验证 `add`、`complete`、`selectList`、`reorder`、`moved`、`resized`、`openMain`、`hide`、`ready`、`error` 的合法 JSON；验证未知类型、无效 JSON、缺失字段、非有限坐标均失败。验证序列化命令保留 Unicode 和换行转义。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/main/native-widget-protocol.test.ts`
Expected: 因协议模块不存在而失败。

- [ ] **Step 3: 实现协议与原生构建骨架**

TypeScript 使用可辨识联合类型和运行时校验；C# 使用 Windows 自带的 `JavaScriptSerializer` 和对应数据契约，标准输入固定为 UTF-8。`Program.cs` 支持 `--self-test` 并在无窗口模式下验证契约与 `widgetHeight` 等价计算。构建脚本调用 `C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe`，显式引用 WPF 程序集，不使用 NuGet。

- [ ] **Step 4: 验证协议和编译**

Run: `npx vitest run tests/main/native-widget-protocol.test.ts && npm run build:native-widget && ./native-widget/bin/LightTodo.Widget.exe --self-test`
Expected: 测试通过、生成 EXE、自测试退出码 0。

### Task 2: 原生进程控制器与业务映射

**Files:**
- Create: `src/main/native-widget-controller.ts`
- Modify: `src/main/ipc.ts`
- Test: `tests/main/native-widget-controller.test.ts`
- Test: `tests/main/ipc-broadcast.test.ts`

**Interfaces:**
- Consumes: Task 1 协议、`TaskStore`、`ScreenService`、`SettingsStore`、现有共享几何函数。
- Produces: `NativeWidgetController.initialize()`、`refresh()`、`show(inactive)`、`hide()`、`applySettings()`、`allowQuit()`；构造参数提供可注入进程与业务回调。

- [ ] **Step 1: 写控制器失败测试**

用假的 ChildProcess 覆盖：分段 stdout、ready 后 init、完整状态重发、添加/完成/切换/排序映射、无效 ID、添加失败 operationResult、显示隐藏、异常退出后重建、退出清理。排序事件传 `listId/draggedId/targetId`，调用 `resolveWidgetReorder` 后再写 `reorderTasks`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/main/native-widget-controller.test.ts`
Expected: 因控制器不存在而失败。

- [ ] **Step 3: 实现控制器**

按行缓冲 stdout，进程写入串行排队；成功操作通过现有 `broadcast` 和提醒调度路径，失败返回错误文本。几何使用现有恢复/钳制函数，位置在 moved 后持久化，显示隐藏不写乱现有设置键。

- [ ] **Step 4: 验证控制器和现有广播**

Run: `npx vitest run tests/main/native-widget-controller.test.ts tests/main/ipc-broadcast.test.ts tests/main/widget-order.test.ts`
Expected: 全部通过。

### Task 3: WPF 分层窗口与玻璃卡片交互

**Files:**
- Create: `native-widget/WidgetWindow.cs`
- Create: `native-widget/GlassStyles.cs`
- Create: `native-widget/Geometry.cs`
- Modify: `native-widget/Program.cs`
- Test: `tests/main/native-widget-protocol.test.ts`

**Interfaces:**
- Consumes: Task 1 的 C# 契约和 JSON stdin/stdout。
- Produces: 可运行的原生透明贴片及全部窗口外操作事件。

- [ ] **Step 1: 写原生几何失败自测试**

覆盖空/一/八/九任务高度、320–480 宽度钳制、八行滚动区域高度和 42 DIP 行高；先运行 `--self-test` 确认新增断言失败。

- [ ] **Step 2: 实现原生窗口**

纯 C# 创建 WPF Window、ItemsControl、TextBox、清单 Popup、按钮和 ScrollViewer；设置 `AllowsTransparency=True`、无标题栏、非置顶、无任务栏项。使用原生 `DragMove()` 移动，右缘调整宽度，原生拖放只发送 dragged/target 对。

- [ ] **Step 3: 实现玻璃卡片视觉与反馈**

按照 `ui-hierarchy-preview.html` 的方案二设置 26px 外壳、每行圆角卡片、亮边、冷白渐变、局部高光和克制阴影。默认卡片安静，悬停/按压增强；TextBox 保留 IME 和文本选择，其余文本不可选。错误以内联条显示，添加成功才清空输入。

- [ ] **Step 4: 验证原生自测试和基本运行**

Run: `npm run build:native-widget && ./native-widget/bin/LightTodo.Widget.exe --self-test`
Expected: 全部通过。随后启动隔离原生预览，检查中文输入、清单、勾选、排序、八行滚动和非控件文字不可选。

### Task 4: 替换 Electron 贴片并打包

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/windows-integration.ts`（仅接入现有退出生命周期）
- Modify: `electron-builder.yml`
- Modify: `package.json`
- Remove from production path: `src/main/widget-ipc.ts`、`src/renderer/src/WidgetApp.vue` 对应 BrowserWindow 创建；保留旧文件仅当仍被测试或其他入口引用。
- Test: `tests/packaging/config.test.ts`
- Test: `tests/e2e/launch.spec.ts`
- Test: `tests/e2e/window-chrome.spec.ts`

**Interfaces:**
- Consumes: Task 2 控制器、Task 3 原生 EXE。
- Produces: 应用只启动一个 WPF 贴片，任务变更同步到 Vue 与 WPF，安装包包含原生 EXE。

- [ ] **Step 1: 写打包与生命周期失败测试**

断言 `extraResources` 包含 `native-widget/bin/LightTodo.Widget.exe`，`build`/`dist` 先运行原生构建；主进程创建 NativeWidgetController 而不再创建贴片 BrowserWindow，退出时调用其 `allowQuit()`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/packaging/config.test.ts && npx playwright test tests/e2e/launch.spec.ts tests/e2e/window-chrome.spec.ts`
Expected: 因原生资源或生命周期尚未接入而失败。

- [ ] **Step 3: 接入生产主进程**

统一开发/测试/打包 EXE 路径；把现有任务 broadcast 包装为同时 `widget.refresh()`，让设置、备份恢复和提醒变更同步。原生 `openMain`、`hide` 接入既有控制器；不创建旧贴片 BrowserWindow。

- [ ] **Step 4: 验证集成**

Run: `npm run typecheck && npm run test && npm run test:e2e`
Expected: 主窗口与现有功能全部通过；旧贴片专属 Playwright 测试若针对已删除 BrowserWindow，应由 Task 5 的原生黑盒验证替代并在计划中记录，不保留无效测试。

### Task 5: 主窗口玻璃卡片与原生贴片系统验收

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/components/ListSidebar.vue`
- Modify: `src/renderer/src/components/TaskList.vue`
- Modify: `src/renderer/src/components/TaskDetail.vue`
- Modify: `src/renderer/src/components/WindowTitlebar.vue`
- Modify: `src/renderer/src/apple-glass.css`
- Test: `tests/e2e/glass-material.spec.ts`
- Test: `tests/e2e/final-review.spec.ts`
- Test: `tests/e2e/glass-motion.spec.ts`

**Interfaces:**
- Consumes: 现有三栏 grid 与共享 `--glass-*` 变量。
- Produces: 侧栏、任务区、详情区三个协调玻璃面板，以及轻量任务卡片和明确选中态。

- [ ] **Step 1: 写主窗口材质失败测试**

断言三个面板的圆角、透明渐变和亮边，选中任务区别于默认任务；先运行并确认旧样式失败。

- [ ] **Step 2: 实现主窗口玻璃卡片**

增加面板间距和透明容器背景；侧栏降权、任务区最高、详情次级。任务卡片不增加文档高度，快速添加和保存保持主按钮地位，窄宽度仍隐藏详情。

- [ ] **Step 3: 验证主窗口回归**

Run: `npx playwright test tests/e2e/glass-material.spec.ts tests/e2e/final-review.spec.ts tests/e2e/glass-motion.spec.ts tests/e2e/window-chrome.spec.ts`
Expected: 全部通过。

- [ ] **Step 4: 验证真实原生贴片**

用隔离数据运行当前构建，完整执行添加中文、完成、切换清单、排序、打开主窗口、隐藏、重启恢复。捕获静止和真实拖动的完整桌面截图，确认逐像素透明且无黑色底/模糊；检查失焦、八行滚动和 DPI 几何。

### Task 6: 完整构建与交付

**Files:**
- Verify: 全部改动文件与 `release/轻待办-Setup-0.1.0-x64.exe`

**Interfaces:**
- Produces: 包含 WPF 贴片的已验证 Windows 安装包。

- [ ] **Step 1: 完整验证**

Run: `npm run typecheck && npm run test && npm run test:e2e && npm run dist`
Expected: 所有保留测试通过，安装包构建成功。

- [ ] **Step 2: 验证最终安装内容**

确认 `release/win-unpacked/resources` 包含 `LightTodo.Widget.exe`，以隔离数据启动最终打包应用，重复 Task 5 的真实拖动、中文输入和任务同步验收。

- [ ] **Step 3: 清理与审查**

关闭隔离预览，不关闭用户正在使用的实例；删除本次截图、测试输出和临时构建产物，保留交付安装包。执行完整差异审查，记录所有架构决定和未解决项，不提交或合并分支。
