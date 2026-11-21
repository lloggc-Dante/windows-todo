# Liquid Glass Desktop Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a draggable, non-topmost liquid-glass desktop widget that synchronizes tasks with the existing Electron/Vue app and shows every active task with an eight-row scrolling limit.

**Architecture:** A second BrowserWindow and Vue renderer reuse the existing task IPC and SQLite owner. A main-process WidgetWindowController owns platform-specific Acrylic/transparency, geometry, visibility, position persistence, and lifecycle; data-change broadcasts keep both renderers synchronized.

**Tech Stack:** Electron 45, TypeScript, Vue 3, Pinia, electron-vite, Windows DWM Acrylic, CSS, Vitest, Playwright.

**Spec:** Approved revised desktop-widget design in this conversation; Electron Acrylic support is limited by the official BrowserWindow documentation to Windows 11 22H2+.

## Global Constraints

- Widget is frameless, non-topmost, skipTaskbar, non-resizable, fixed at 520px wide, and never embedded into Explorer/WorkerW.
- Every active task has a row; 0 tasks uses one empty-state row, 1–8 rows auto-grow, and 9+ tasks scroll at exactly eight rows.
- Row height 42px; header 52px; composer 60px; vertical padding 24px; total height `136 + 42 * rows`.
- Windows 11 22H2+: `transparent=false`, native rounded corners, `setBackgroundMaterial('acrylic')`, CSS tint/highlights only.
- Windows 10/older Windows 11: `transparent=true`, CSS rounded corners and translucent fallback; no promise of real wallpaper blur.
- Direct add, complete, list switching, and task drag ordering reuse existing APIs and SQLite; no second database or scheduler.
- Main close-to-tray keeps both windows; closeToTray=false quits the entire app. Widget close hides and persists invisibility.
- Hidden login shows the main window neither visibly nor actively; widget follows persisted visibility and uses showInactive.
- Widget is created only after single-instance acquisition. Inputs/buttons are no-drag; header/grip is drag-only.
- Position, visibility, and selected list live in existing settings and backups; no network or new dependency is required by this plan.

## Review Focus

- Nine or more tasks must retain every row through scrolling without resizing past eight rows; Task 1 and Task 5 tests pin this.
- Acrylic must never be combined with transparent layered-window mode; Task 1 and Task 2 tests pin platform presentation.
- Closing the main window with closeToTray=false must quit despite the widget keeping other windows alive; Task 2 tests pin this.
- Task changes and deleted/imported lists must leave both renderers on valid current data; Task 3 and Task 5 tests pin this.
- Drag regions must not swallow text input or buttons, and moved coordinates must clamp after display removal; Task 2 and Task 5 tests pin this.

### Task 1: Widget Geometry and Platform Presentation

**Files:**
- Create: `src/shared/widget.ts`
- Test: `tests/main/widget-layout.test.ts`

**Interfaces:**
- Produces: `WIDGET_WIDTH = 520`, `WIDGET_MAX_ROWS = 8`
- Produces: `widgetRows(taskCount: number): number`
- Produces: `widgetHeight(taskCount: number): number`
- Produces: `resolveWidgetPresentation(input: { platform: string; release: string }): WidgetPresentation`
- Produces: `restoreWidgetPosition(saved: WidgetPosition | null, displays: DisplayInfo[]): WidgetPosition`

- [ ] **Step 1: Write failing tests**

Assert rows/heights for 0/1/8/9 as 178/178/472/472px; Windows `10.0.22621` resolves non-transparent Acrylic/native corners, `10.0.19045` resolves transparent CSS fallback; a removed display falls back and coordinates clamp inside its work area.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/main/widget-layout.test.ts`
Expected: FAIL because `src/shared/widget.ts` does not exist.

- [ ] **Step 3: Implement pure layout and presentation functions**

Parse Windows build from `os.release`; Acrylic requires win32 build >= 22621. Clamp negative/non-finite task counts and saved coordinates. Keep all constants and types in the shared module.

- [ ] **Step 4: Run tests to verify success**

Run: `npx vitest run tests/main/widget-layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/widget.ts tests/main/widget-layout.test.ts
git commit -m "feat: define desktop widget layout and presentation"
```

### Task 2: Widget Window Lifecycle and Position

**Files:**
- Create: `src/main/widget-window-controller.ts`
- Modify: `src/main/index.ts`, `src/main/windows-integration.ts`
- Modify: `src/shared/contracts.ts`, `src/preload/index.ts`
- Test: `tests/main/widget-window-controller.test.ts`, `tests/main/windows-integration.test.ts`

**Interfaces:**
- Consumes: Task 1 presentation, geometry, and position functions.
- Produces: `WidgetWindowController.setTaskCount(count: number): void`
- Produces: `WidgetWindowController.show(inactive?: boolean): void`, `hide(): void`, `applySettings(): void`
- Produces: `AppApi.getWidgetPresentation(): Promise<WidgetPresentation>`
- Produces: `AppApi.setWidgetTaskCount(count: number): Promise<void>`
- Produces: `AppApi.hideWidget(): Promise<void>`, `openMainWindow(): Promise<void>`

- [ ] **Step 1: Write failing controller and lifecycle tests**

Use fake windows/screens/settings to assert correct BrowserWindow options per platform, moved-position persistence, eight-row bounds, close-as-hide, hidden-start showInactive, and creation after lock. Add a WindowsIntegration test asserting closeToTray=false calls app quit rather than allowing main-window destruction.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/main/widget-window-controller.test.ts tests/main/windows-integration.test.ts`
Expected: FAIL because controller and new quit behavior are missing.

- [ ] **Step 3: Implement controller and integrate lifecycle**

Load `widget.html` in production and `/widget.html` under the dev renderer URL. Apply Acrylic only in the non-transparent branch. Persist `widgetPosition` on moved and `widgetVisible` on hide. Clamp on display-metrics-changed. Keep main IPC registration singular and create the widget after the lock. Change closeToTray=false to a controlled whole-app quit.

- [ ] **Step 4: Run tests to verify success**

Run: `npx vitest run tests/main/widget-window-controller.test.ts tests/main/windows-integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main src/shared/contracts.ts src/preload/index.ts tests/main/widget-window-controller.test.ts tests/main/windows-integration.test.ts
git commit -m "feat: manage desktop widget window lifecycle"
```

### Task 3: Multi-window Data Synchronization and Renderer Entry

**Files:**
- Modify: `src/main/ipc.ts`, `src/main/index.ts`, `electron.vite.config.ts`
- Modify: `src/shared/contracts.ts`, `src/preload/index.ts`
- Modify: `src/renderer/src/stores/tasks.ts`
- Create: `src/renderer/widget.html`, `src/renderer/src/widget-main.ts`
- Test: `tests/main/ipc-broadcast.test.ts`, `tests/e2e/launch.spec.ts`

**Interfaces:**
- Produces: `AppApi.onTasksChanged(callback: () => void): () => void`
- Produces: `AppApi.getWidgetSelectedList(): Promise<string | null>`
- Produces: `AppApi.setWidgetSelectedList(listId: string): Promise<void>`
- Produces: `useTasksStore().refresh(): Promise<void>` Pinia action, not the main-process TaskStore.
- Consumes: existing task/list methods for all mutations.

- [ ] **Step 1: Write failing broadcast and launch tests**

Assert every successful create/update/delete/complete/undo/reorder/list mutation and backup replacement broadcasts exactly one `tasks:changed`, while failed validation does not. Extend launch E2E to identify main and widget windows by URL/title rather than assuming firstWindow forever.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/main/ipc-broadcast.test.ts && npx playwright test tests/e2e/launch.spec.ts`
Expected: FAIL because broadcasts and widget entry are missing.

- [ ] **Step 3: Implement typed broadcasts and multi-entry renderer**

Broadcast to all existing BrowserWindows after successful mutations; do not re-register IPC per window. Add Pinia refresh that reloads lists, preserves a valid selected list, and falls back when deleted. Configure Vite inputs for index.html and widget.html. Persist selected widget list through validated IPC.

- [ ] **Step 4: Run tests to verify success**

Run: `npx vitest run tests/main/ipc-broadcast.test.ts && npx playwright test tests/e2e/launch.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron.vite.config.ts src/main src/preload src/shared/contracts.ts src/renderer tests/main/ipc-broadcast.test.ts tests/e2e/launch.spec.ts
git commit -m "feat: synchronize tasks across app windows"
```

### Task 4: Liquid Glass Widget Interface

**Files:**
- Create: `src/renderer/src/WidgetApp.vue`
- Create: `src/renderer/src/components/WidgetTaskList.vue`
- Create: `src/renderer/src/widget.css`
- Test: `tests/e2e/widget.spec.ts`

**Interfaces:**
- Consumes: existing Pinia store and all Task 2/3 APIs.
- Produces: DOM contract `data-testid="desktop-widget"`, `widget-task-list`, `widget-quick-add`, `widget-list-select`.

- [ ] **Step 1: Write failing widget E2E**

Launch with isolated data, find the widget window, add tasks through its composer, complete one, switch lists, reorder tasks, and assert the main window reloads the same state. Create nine tasks and assert exactly eight row heights of scroll viewport, scrollHeight > clientHeight, and persistent all-row data.

- [ ] **Step 2: Run test to verify failure**

Run: `npx playwright test tests/e2e/widget.spec.ts`
Expected: FAIL because WidgetApp and its DOM are missing.

- [ ] **Step 3: Implement widget UI and glass styling**

Build header/list selector/menu, all active task rows, complete buttons, drag ordering, internal scrolling, empty state, and bottom composer. Apply drag/no-drag regions. Use platform presentation to select Acrylic-native-corner versus transparent-CSS-corner roots. Call setWidgetTaskCount after every relevant refresh. Widget menu opens main or hides widget.

- [ ] **Step 4: Run test to verify success**

Run: `npx playwright test tests/e2e/widget.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/WidgetApp.vue src/renderer/src/components/WidgetTaskList.vue src/renderer/src/widget.css tests/e2e/widget.spec.ts
git commit -m "feat: build liquid glass desktop widget"
```

### Task 5: Settings, Backup Restoration, and Multi-display E2E

**Files:**
- Modify: `src/shared/contracts.ts`, `src/main/ipc.ts`, `src/main/backup.ts`
- Modify: `src/renderer/src/components/AdvancedSettings.vue`
- Modify: `src/main/widget-window-controller.ts`
- Test: `tests/e2e/widget-settings.spec.ts`, `tests/main/backup.test.ts`

**Interfaces:**
- Extends: `AppSettings.showWidget: boolean` (default true).
- Consumes: `WidgetWindowController.applySettings()` after visibility and backup changes.

- [ ] **Step 1: Write failing settings and restoration tests**

Assert settings toggle hides/reopens the widget and persists across restart; widget close updates the setting; backup round-trip retains visibility/position/selected list; replacement reapplies valid list, position, and visibility. Use a main-process move test seam for native drag persistence and simulate display removal for clamping.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/main/backup.test.ts && npx playwright test tests/e2e/widget-settings.spec.ts`
Expected: FAIL because showWidget and apply-after-restore are missing.

- [ ] **Step 3: Implement settings and restoration integration**

Add the checkbox to Advanced Settings without moving backup controls. Validate showWidget as boolean. Apply imported widget settings after replace, refresh both renderers, and handle missing displays/lists without resetting unrelated user data.

- [ ] **Step 4: Run tests to verify success**

Run: `npx vitest run tests/main/backup.test.ts && npx playwright test tests/e2e/widget-settings.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/contracts.ts src/main src/renderer/src/components/AdvancedSettings.vue tests/e2e/widget-settings.spec.ts tests/main/backup.test.ts
git commit -m "feat: persist desktop widget preferences"
```

### Task 6: Full Verification and Installer

**Files:**
- Modify: `docs/superpowers/plans/2026-11-21-windows-todo.md` only if the prior plan's status notes require cross-reference; no production files planned.
- Test: all existing suites.

- [ ] **Step 1: Run complete automated verification**

Run: `npm run typecheck && npm run test && npm run test:e2e`
Expected: all existing and new tests pass with no new failures.

- [ ] **Step 2: Build the installer**

Run: `npm run dist`
Expected: updated x64 NSIS installer in `release/`. If network retrieval fails, retry standard build first; electron-builder's supported electronDist cache option is acceptable only with the identical Electron version.

- [ ] **Step 3: Verify the packaged widget on Windows**

Launch `release/win-unpacked/轻待办.exe` with isolated data. Verify add/complete/switch/sync, nine-task scrolling, position restore, close-to-tray, whole-app quit, auto-start without focus theft, and notification behavior. On Windows 11 22H2+ visually confirm Acrylic/native corners; exercise the transparent CSS fallback through platform tests and document if no Windows 10 machine is available.

- [ ] **Step 4: Commit any final verification changes**

If verification required no file changes, skip this empty commit.

```bash
git add -A
git commit -m "test: verify desktop widget release"
```
