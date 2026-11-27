# 原生液态玻璃贴片与拖动修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复贴片仅小拖动柄可移动的问题，并让 WPF 贴片获得可验证的真实背景柔化与动态液态高光。

**Architecture:** 保留独立 WPF 进程、Electron 业务控制器和 JSON 协议，只改变原生窗口合成、输入分发与视觉层。先用 DWM `WindowChrome` 验证真实背景柔化，再在独立透明视觉层叠加高光；任务文字始终位于不受模糊和动画影响的顶层。

**Tech Stack:** WPF/.NET Framework 4.8、C# 5、Windows DWM API、TypeScript、Vitest、Playwright、KimiCU 真实鼠标与完整桌面截图

**Spec:** `docs/superpowers/specs/2026-11-23-liquid-glass-widget-design.md`

## Global Constraints

- 使用 `AllowsTransparency=False` + `WindowChrome.GlassFrameThickness=-1` 作为首选验证方案；不使用失焦发白 Acrylic、Electron 贴片或静态壁纸截图。
- 保留 `Topmost=False`、`ShowInTaskbar=False`、320–480 DIP 宽度、42 DIP 行高、八行滚动和全部现有任务交互。
- 按钮、输入框、清单弹层、滚动条、排序柄和右缘缩放不得触发窗口移动；其余标题、任务文字和空白背景可以移动。
- 动画不参与命中测试、不模糊文字，并尊重 Windows 动画设置；不引入第三方运行库或 UI 依赖。
- 沿用 `feature/windows-todo` 当前工作区，不提交、合并、推送或重置已有改动。

## Review Focus

- 从排序柄、右缘和清单开始按下后移出控件：Task 2 用输入祖先链自测试及真实鼠标确保不误拖窗口。
- 中文输入和文本选择：Task 2 真实验证 TextBox 仍可聚焦、选择文字及提交，任务文字不进入编辑或选择。
- DWM 不可用、窗口失焦及跨屏：Task 1 和 Task 4 验证黑底、圆角、位置恢复与进程生命周期。
- 减少动态效果、持续资源占用和拖动中刷新：Task 3 自测试动画开关，Task 4 检查拖动/静止/失焦。
- 空任务、八行以上任务、添加失败与进程重连：Task 4 回归既有协议和端到端测试并验证打包路径。

---

### Task 1: 验证 DWM 真实玻璃合成

**Files:**
- Create: `native-widget/NativeComposition.cs`
- Modify: `native-widget/WidgetWindow.cs:34-95`
- Modify: `native-widget/Program.cs:17-57`
- Modify: `scripts/build-native-widget.mjs`

**Interfaces:**
- Produces: `NativeComposition.Configure(Window window)`，在 `SourceInitialized` 取得 HWND 后配置无边框窗口、全表面 GlassFrame 和系统圆角。
- Produces: `NativeComposition.SelfTest()`，验证 Windows 合成可用性检查与无效 HWND 的安全返回。

- [ ] **Step 1: 写原生合成失败自测试**

在 `Program.RunSelfTests()` 调用 `NativeComposition.SelfTest()`；断言无效 HWND 不修改窗口、不抛出未处理异常，并显式检查 DWM 合成是否启用。先运行 `npm run build:native-widget`，预期因类型不存在而编译失败。

- [ ] **Step 2: 实现最小 DWM 配置**

`NativeComposition.cs` 仅封装 `DwmIsCompositionEnabled`、`DwmExtendFrameIntoClientArea`、`DwmSetWindowAttribute` 和所需 Win32 结构。窗口使用 `WindowStyle=None`、`AllowsTransparency=False`、`ResizeMode=NoResize`；`SourceInitialized` 设置 `WindowChrome.GlassFrameThickness=-1`、`UseAeroCaptionButtons=False` 与非客户端命中测试，系统支持时优先使用圆角窗口属性。

- [ ] **Step 3: 单独验证材质，不添加动画**

构建并启动隔离原生预览，推送复杂中文任务。使用带 `SetProcessDPIAware()` 的 `CopyFromScreen` 捕获 2560×1600 完整桌面，在复杂壁纸上检查背景确实经过采样柔化、窗口外无黑色矩形、圆角不泄漏、文字清晰。若该配置只是全透明，调整 DWM 合成参数或调用方式后重复验证，未经截图确认不进入动态高光。

- [ ] **Step 4: 运行原生与协议回归**

Run: `npm run build:native-widget && ./native-widget/bin/LightTodo.Widget.exe --self-test && npx vitest run tests/main/native-widget-protocol.test.ts && npx playwright test tests/e2e/native-widget.spec.ts`
Expected: 编译、自测试、协议测试和原生黑盒测试全部通过。

### Task 2: 整个非控件外壳可拖动

**Files:**
- Create: `native-widget/WidgetInput.cs`
- Modify: `native-widget/WidgetWindow.cs:97-175,276-468`
- Modify: `native-widget/Program.cs`

**Interfaces:**
- Produces: `WidgetInput.CanStartWindowDrag(DependencyObject source)`，遍历 WPF 可视/逻辑祖先，拒绝 `ButtonBase`、`TextBox`、`ScrollBar`、排序柄和缩放手柄。
- Produces: `SortGrip`、`ResizeGrip` 标记类型，供命中测试明确区分任务排序和窗口缩放。
- Consumes: 现有 `BeginWindowDrag`、`DragMove()` 与 `moved` 事件协议。

- [ ] **Step 1: 写输入分类失败自测试**

构造嵌套 `Button`、`TextBox`、`ScrollBar`、`SortGrip`、`ResizeGrip`、普通 `TextBlock` 及其父容器；仅普通任务文字、标题文字和外壳返回可拖动，交互子元素即使嵌套在普通容器内也必须被拒绝。先编译并确认因 `WidgetInput` 不存在而失败。

- [ ] **Step 2: 实现统一外壳输入处理**

将排序柄和缩放柄改为明确标记类型；根 `Grid` 注册 `MouseLeftButtonDown += BeginWindowDrag`，移除标题和空状态的重复专用入口。`BeginWindowDrag` 使用 `e.OriginalSource` 调用 `WidgetInput.CanStartWindowDrag`，其余区域保留原生 `DragMove()`，结束后只报告一次最终坐标；排序的 `CaptureMouse`/`DoDragDrop` 与右缘缩放逻辑不变。

- [ ] **Step 3: 验证原生分类和真实鼠标**

Run: `npm run build:native-widget && ./native-widget/bin/LightTodo.Widget.exe --self-test`
Expected: 自测试通过。用真实鼠标从标题空白、任务文字、普通背景各拖动至少 100 像素，比较拖动前后窗口位置；对添加、完成、清单、TextBox、排序柄、滚动条和右缘重复按下/移动，确认窗口不误动且原功能仍有效。

### Task 3: 折射边缘、流光与按钮动效

**Files:**
- Create: `native-widget/LiquidGlassLayer.cs`
- Modify: `native-widget/GlassStyles.cs`
- Modify: `native-widget/WidgetWindow.cs:59-95,306-416`
- Modify: `native-widget/Program.cs`

**Interfaces:**
- Consumes: Task 1 已验证的 DWM 玻璃窗口。
- Produces: `LiquidGlassLayer.Create(widthBinding)` 返回 `IsHitTestVisible=False` 的装饰元素；`SetAnimationsEnabled(bool enabled)` 控制环境流光。
- Produces: `GlassStyles.MotionEnabled`、`ShellEdgeBrush()`、更新后的 `ButtonStyle(double radius)`。

- [ ] **Step 1: 写材质和减少动画失败自测试**

验证高光层不接收鼠标、动画开关能停止环境动画并清除动态位移；Windows 动画关闭时仅保留静态折射边缘与悬停/按压状态。先确认新类型/接口不存在导致编译失败。

- [ ] **Step 2: 构建分层液态材质**

外壳由 DWM 背景、低白度冷色渐变、独立内亮边、顶部椭圆聚光和侧面窄流光组成；装饰层不覆盖命中测试，文字与图标置于最上层。任务卡片使用独立低透明渐变和轻微内高光，默认保持安静，保留 26px 外壳与 11px 卡片圆角。

- [ ] **Step 3: 实现克制的动态反馈**

用 WPF `DoubleAnimation`/`TranslateTransform` 让侧面高光缓慢循环；按钮模板增加独立光晕层和轻微浮起，悬停扩散、按压缩放并收缩。动画只改变装饰层，不给文字或整个卡片加 `BlurEffect`；读取 Windows 动画设置，关闭时禁用循环动画。

- [ ] **Step 4: 编译与视觉检查**

Run: `npm run build:native-widget && ./native-widget/bin/LightTodo.Widget.exe --self-test`
Expected: 自测试通过。完整桌面截图检查静止、悬停、按压、失焦与拖动状态；玻璃具有柔化背景、折射亮边和可见但克制的高光，不得出现静态透明叠层、塑料白板或文字模糊。

### Task 4: 完整回归与安装版验收

**Files:**
- Modify: `tests/e2e/native-widget.spec.ts`（仅在需要覆盖新合成恢复时）
- Test: `tests/main/native-widget-controller.test.ts`
- Test: `tests/packaging/config.test.ts`
- Verify: `release/轻待办-Setup-0.1.0-x64.exe`

**Interfaces:**
- Consumes: 前三个任务的 WPF 可执行文件和既有 `NativeWidgetController`。
- Produces: 包含最终原生 EXE 的常规 Windows 安装包。

- [ ] **Step 1: 回归协议、控制器和打包配置**

Run: `npm run typecheck && npm run test`
Expected: 既有 98 项或新增后的全部单元测试通过；任务操作、位置持久化、跨屏匹配、异常恢复和退出清理没有回归。

- [ ] **Step 2: 运行全部端到端测试**

Run: `npm run test:e2e`
Expected: 全部 Playwright 测试通过，包括 Unicode、坏命令恢复、主窗口任务管理与托盘行为；若测试输出产生非交付文件，清理这些临时文件。

- [ ] **Step 3: 构建并安装最终版本**

Run: `npm run dist`
Expected: 构建成功，`release/轻待办-Setup-0.1.0-x64.exe` 包含新原生程序。安装并启动该版本，不借用开发进程做验收。

- [ ] **Step 4: 完成真实交互与视觉验收**

在复杂壁纸完整桌面截图中比较静止与拖动，并检查失焦；分别验证标题/任务文字/背景拖动，按钮、清单、中文输入、勾选、排序、右缘缩放和八行滚动。确认普通窗口可以盖住贴片、移动后坐标可保存、退出无残留进程。检查 `git status --short`，只保留源码、设计/计划和既有交付文件，不提交任何改动。
