# Windows 原生分层贴片设计

## 背景与目标

Electron/Vue 主窗口、SQLite 数据库、提醒、托盘和设置保持现状。桌面贴片改由独立 WPF 进程实现，使用 Windows 原生分层窗口提供逐像素透明，解决 Electron 透明窗口在移动时出现黑色或模糊合成层的问题。

视觉采用已确认的“玻璃卡片式分层”：轻薄冷白渐变、局部高光、细亮边与克制阴影。贴片不使用背景高斯模糊，静止和移动保持一致。

## 已考虑方案

- 继续 Electron 透明窗口并调整 CSS、圆角或拖动算法：三种真实拖动对照均未消除移动合成异常，不再采用。
- 纯 Win32/C++：无需 .NET，但中文 IME、文本输入、滚动与拖放需要自行实现，成本和风险过高。
- 现代 .NET 8 WPF：开发体验较好，但本机没有 SDK，需要额外安装和分发运行库。
- Windows 自带 .NET Framework 4.8 WPF：已确认本机编译器与 PresentationFramework 可用；具备原生分层窗口、中文输入和完整控件能力，因此采用。

## 架构

新增独立原生程序 `LightTodo.Widget.exe`，由 Electron 主进程按需启动和关闭。WPF 窗口设置 `WindowStyle=None`、`AllowsTransparency=True`、`Background=Transparent`、`Topmost=False`、`ShowInTaskbar=False`，由 WPF 管理原生拖动与逐像素透明。

主窗口仍使用 Vue。原 `WidgetApp.vue` 和 Electron 贴片 BrowserWindow 不再用于生产；保留现有共享几何常量和可复用测试，由新的原生控制器实现相同行为。

Electron 与 WPF 只通过子进程标准输入输出交换换行分隔的 JSON。WPF 不直接访问 SQLite，不暴露网络端口，也不获得 Node 能力。所有业务校验、持久化和广播仍由 Electron/TaskStore 完成。

## 原生贴片行为

- 顶部显示当前清单、未完成任务数量、打开主窗口和隐藏贴片按钮。
- 清单选择器支持展开与选择，不使用系统原生下拉外观。
- 任务按当前清单和手动顺序显示；每行包含拖动柄、完成圆形按钮、标题以及可选截止信息。
- 可直接输入新任务，Enter 或加号提交；只有输入框允许文本编辑与选择。
- 支持原生鼠标拖动排序，顺序经 Electron 校验并写回数据库。
- 空白状态和顶部非控件区域可以移动贴片；移动时保持逐像素透明，不进入 Electron 原生拖动。
- 右侧可调整宽度，范围沿用 320–480 DIP；位置与宽度仍由 Electron 设置存储。
- 默认按实际任务数显示行数，空状态一行，最多八行；超过八行后在贴片内部滚动。
- 贴片可失去焦点并被普通窗口覆盖，不设置置顶。
- 关闭、隐藏、主窗口操作、应用退出和登录启动行为与当前版本一致。

## JSON 协议

主进程向贴片发送：

- `init`：清单、当前清单、任务、位置、宽度和可见状态。
- `state`：完整清单/当前清单/任务快照，用于所有变更后的同步。
- `operationResult`：操作是否成功及错误文本；添加失败时保留输入，其他失败显示内联错误并立即同步最新状态。
- `visibility`：显示或隐藏，显示时不得抢占焦点。
- `geometry`：任务数变化、显示器变化或外部设置恢复后的位置与尺寸。
- `shutdown`：要求进程退出。

贴片向主进程发送：

- `ready`：原生窗口和协议初始化完成。
- `add`：标题文本。
- `complete`：任务 ID。
- `selectList`：清单 ID。
- `reorder`：当前清单 ID、被拖动任务 ID 和目标任务 ID；Electron 使用 `resolveWidgetReorder` 重新读取数据库最新任务后计算顺序，陈旧快照不得覆盖其他窗口刚发生的变更。
- `openMain`、`hide`。
- `moved`：拖动完成后的最终位置。
- `resized`：调整完成后的最终宽度。
- `error`：原生侧可报告的显示或输入错误。

每条消息带 `type` 字段；数据载荷使用明确的数据契约。C# 使用 Windows 自带的 `JavaScriptSerializer`，并通过 UTF-8 `StreamReader` 读取标准输入，以避免旧版 DataContract 的顺序限制和系统代码页破坏中文 JSON。未知类型、无效 JSON 和无效 ID 不得写入数据库。进程输出按行缓冲，部分行必须等待换行后再解析。业务操作完成后由 Electron 推送最新完整状态，避免原生与 SQLite 状态分叉。

## 主进程与生命周期

新增 `NativeWidgetController` 管理进程启动、ready 等待、消息分发、几何恢复、显示隐藏和退出。它复用 `restoreWidgetPosition`、`widgetHeight`、`clampWidgetWidth` 与 `resolveWidgetReorder`。

- 初始化时读取与当前版本相同的位置、宽度和可见设置。
- 仅在 Windows 使用原生程序；开发、测试和打包路径统一定位。
- 收到原生操作后调用现有 TaskStore 方法，并复用任务变更广播。
- 贴片隐藏不退出进程；应用真正退出时关闭 WPF 进程并保存位置。
- 原 Electron 贴片窗口不再创建，避免双贴片。
- 原生进程异常退出时记录错误并保持主窗口可用；下一次显示贴片可重新启动并执行完整 `init`。
- 保留 Electron 退出时主窗口销毁和 `app.exit(0)` 的现有修复。

## UI 实现

WPF 使用纯 C# 和程序化控件样式，不依赖 XAML 编译或外部 UI 库。文本输入使用 WPF TextBox 以保留中文 IME；任务列表使用 ItemsControl/ListBox 与 ScrollViewer；自定义按钮、圆形完成控件、弹层和拖动柄采用统一玻璃卡片样式。

视觉验收以用户选定的 `ui-hierarchy-preview.html` 玻璃卡片方案为准，而不是复刻旧的扁平任务行。26px 外壳圆角、42px 行高和八行几何保持不变；任务行内部使用圆角卡片、局部高光与悬停/选中反馈，不增加文档高度。清单选择使用 WPF Popup，可暂时超出贴片边界；弹层不得抢焦点或出现在任务切换器，贴片移动、隐藏和退出时必须同步关闭或跟随。

透明度只作用于窗口背景与卡片材质，不改变文字不透明度。选中、悬停、按压和聚焦使用亮度、边缘与短促动效表达；支持系统减少动态效果设置。窗口背景始终透明，不使用 Acrylic、Mica 或 backdrop blur。

## 构建与打包

新增 `scripts/build-native-widget.mjs`，调用 Windows 自带 .NET Framework 4.8 的 `csc.exe` 编译 WPF 原生程序。构建输入为 `native-widget/*.cs`，输出为 `native-widget/bin/LightTodo.Widget.exe`。

`npm run build` 和 `npm run dist` 先构建原生程序；Electron Builder 通过 `extraResources` 将其放入安装包。生产环境从 `process.resourcesPath` 加载，开发与测试从项目构建目录加载。非 Windows 环境可编译 TypeScript，但只有 Windows 运行原生贴片。

## 测试与验收

- TypeScript 单元测试覆盖协议逐行解析、无效消息、几何恢复、原生操作到 TaskStore 的映射和进程退出。
- 原生侧提供无需显示窗口的协议/几何自测试入口，验证数据契约和八行高度计算。
- 真实 Windows 端到端验证添加、勾选、清单切换、排序、输入中文、打开主窗口、隐藏和重启恢复。
- 完整桌面截图比较静止与真实鼠标拖动，壁纸边缘必须始终清晰，不得出现黑色底或高斯模糊。
- 检查聚焦/失焦、不同 DPI、八行滚动、位置与宽度恢复。
- 完整运行类型检查、Vitest、现有 Playwright 主窗口回归及安装包构建；最终验证打包后的原生贴片，而不只验证开发预览。

## 非目标

- 不重写 Electron/Vue 主窗口、任务详情、提醒或备份。
- 不让 WPF 直接访问数据库，不引入网络服务。
- 不恢复智能筛选、标签、优先级或自动云备份。
- 不保证非 Windows 平台运行贴片。
