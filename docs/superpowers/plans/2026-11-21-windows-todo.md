# Windows Todo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline Windows 10/11 todo app with lists, optional dates, manual ordering, recurrence, notifications, tray operation, and manual backup.

**Architecture:** Electron main owns SQLite, scheduling, and Windows integration. Vue renderer calls typed preload APIs only. Recurring tasks use a current occurrence plus completion history.

**Tech Stack:** Node.js LTS, Electron, TypeScript, Vue 3, Vite, Pinia, electron-vite, better-sqlite3, electron-builder, Vitest, Playwright.

**Spec:** The approved revised design in this conversation; no separate user-facing spec file by user choice.

## Global Constraints

- Windows x64 10/11 only; offline; no accounts, sync, telemetry, automatic updates, automatic backups, or portable build.
- No search, smart filters, tags, or priorities.
- Title is the only required task field. Dates, recurrence, and reminders are optional.
- Tasks are manually ordered per list. New and moved tasks insert at the top.
- Close defaults to tray; tray can quit. Auto-start is optional and hidden.
- Notifications are Windows system notifications. Summary notification opens the main window.
- Manual backup is in Advanced Settings and replaces all data after validation and confirmation.
- contextIsolation=true, nodeIntegration=false, sandbox=true.
- Database is `%APPDATA%/<app>/tasks.db`; uninstall preserves data.

## Review Focus

- Tasks without dates must work everywhere (Tasks 2, 4, 6).
- Recurrence early/late completion, skipped occurrences, and undo (Task 4).
- Sleep, timezone changes, disabled notifications, and duplicate prevention (Task 6).
- Close versus quit, auto-start, and second instances (Task 5).
- Invalid/future backups and rollback (Task 8).

### Task 1: Secure Application Shell

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`
- Create: `src/main/index.ts`, `src/preload/index.ts`
- Create: `src/renderer/src/App.vue`, `src/renderer/src/main.ts`
- Create: `src/shared/contracts.ts`
- Test: `tests/e2e/launch.spec.ts`

**Interfaces:**
- Produces: `AppApi.getAppVersion(): Promise<string>`
- Produces: `window.appApi: AppApi`

- [ ] Step 1: Write `tests/e2e/launch.spec.ts`; assert visible `[data-testid="app-shell"]` and no renderer `require`.
- [ ] Step 2: Run `npx playwright test tests/e2e/launch.spec.ts`; Expected: FAIL because shell is missing.
- [ ] Step 3: Implement strict TypeScript electron-vite/Vue shell, secure BrowserWindow, and typed version API.
- [ ] Step 4: Run `npx playwright test tests/e2e/launch.spec.ts`; Expected: PASS.
- [ ] Step 5: Commit `feat: create secure Electron Vue shell`.

### Task 2: SQLite Lists and Tasks

**Files:**
- Create: `src/main/db/database.ts`, `src/main/db/migrations/001_init.sql`, `src/main/db/task-store.ts`, `src/shared/tasks.ts`
- Test: `tests/main/task-store.test.ts`

**Interfaces:**
- Produces: `createList(name: string): List`, `listLists(): List[]`
- Produces: `createTask(listId: string, title: string): Task`, `updateTask(id: string, patch: TaskPatch): Task`
- Produces: `listTasks(listId: string): Task[]`, `deleteTask(id: string): void`
- Task date, recurrence, and reminder fields are nullable.

- [ ] Step 1: Write tests for title-only creation/reload, empty title rejection, and future schema rejection.
- [ ] Step 2: Run `npx vitest run tests/main/task-store.test.ts`; Expected: FAIL because store is missing.
- [ ] Step 3: Implement lists, tasks, completions, reminders, settings, migrations with FK, WAL, busy timeout, and transactions; no tag/priority columns.
- [ ] Step 4: Run `npx vitest run tests/main/task-store.test.ts`; Expected: PASS.
- [ ] Step 5: Commit `feat: persist lists and tasks in SQLite`.

### Task 3: Manual Per-list Ordering

**Files:**
- Modify: `src/main/db/task-store.ts`, `src/main/db/migrations/001_init.sql`
- Test: `tests/main/task-order.test.ts`

**Interfaces:**
- Produces: `reorderTasks(listId: string, orderedTaskIds: string[]): Task[]`
- Produces: `moveTaskToList(taskId: string, targetListId: string): Task`

- [ ] Step 1: Write tests for persisted drag order, new/moved-at-top, duplicate/foreign ID rejection.
- [ ] Step 2: Run `npx vitest run tests/main/task-order.test.ts`; Expected: FAIL because ordering API is missing.
- [ ] Step 3: Implement validated transactional contiguous `sort_order` writes.
- [ ] Step 4: Run `npx vitest run tests/main/task-order.test.ts`; Expected: PASS.
- [ ] Step 5: Commit `feat: add per-list manual task ordering`.

### Task 4: Recurrence and Completion History

**Files:**
- Create: `src/main/recurrence.ts`
- Modify: `src/main/db/task-store.ts`
- Test: `tests/main/recurrence.test.ts`

**Interfaces:**
- Produces: `completeTask(taskId: string, now: Date): Task | null`
- Produces: `undoLatestCompletion(taskId: string): Task`
- Produces: `nextOccurrence(task: Task): Occurrence | null`

- [ ] Step 1: Write tests for schedule-based early completion, missed occurrence skipping, COUNT consumption, latest undo, and nonrecurring no-date completion.
- [ ] Step 2: Run `npx vitest run tests/main/recurrence.test.ts`; Expected: FAIL because recurrence is missing.
- [ ] Step 3: Implement current occurrence advancement and completion/history writes in one transaction.
- [ ] Step 4: Run `npx vitest run tests/main/recurrence.test.ts`; Expected: PASS.
- [ ] Step 5: Commit `feat: implement recurring task occurrences`.

### Task 5: Window, Tray, and Auto-start

**Files:**
- Create: `src/main/window-controller.ts`, `src/main/windows-integration.ts`
- Modify: `src/main/index.ts`
- Test: `tests/main/windows-integration.test.ts`

**Interfaces:**
- Produces: `WindowController.showMainWindow(): void`, `WindowController.showTask(taskId: string): void`
- Produces: `setAutoStart(enabled: boolean): void`, `setCloseToTray(enabled: boolean): void`

- [ ] Step 1: Write mock-Electron tests for close/hide, real quit, hidden auto-start, and second-instance restore.
- [ ] Step 2: Run `npx vitest run tests/main/windows-integration.test.ts`; Expected: FAIL because integration is missing.
- [ ] Step 3: Implement single instance, tray menu, quit flag, login item, hidden launch, and AppUserModelID.
- [ ] Step 4: Run `npx vitest run tests/main/windows-integration.test.ts`; Expected: PASS.
- [ ] Step 5: Commit `feat: integrate tray lifecycle and Windows auto start`.

### Task 6: Reminder Scheduling and Notifications

**Files:**
- Create: `src/main/reminder-scheduler.ts`, `src/main/notifier.ts`
- Modify: `src/main/index.ts`
- Test: `tests/main/reminder-scheduler.test.ts`

**Interfaces:**
- Consumes: `WindowController.showMainWindow()` and `showTask(taskId)`
- Produces: `ReminderScheduler.reschedule(): Promise<void>`, `ReminderScheduler.reconcile(now: Date): Promise<void>`

- [ ] Step 1: Write tests for no-date skip, date-only 09:00, late grouping, disabled-notification skip, timezone recalculation, dedupe, and notification clicks.
- [ ] Step 2: Run `npx vitest run tests/main/reminder-scheduler.test.ts`; Expected: FAIL because scheduler is missing.
- [ ] Step 3: Implement DB-backed nearest scheduling and reconciliation on start, data changes, resume, and clock changes.
- [ ] Step 4: Run `npx vitest run tests/main/reminder-scheduler.test.ts`; Expected: PASS.
- [ ] Step 5: Commit `feat: schedule Windows task notifications`.

### Task 7: Vue Task Interface and Drag Ordering

**Files:**
- Create: `src/renderer/src/components/ListSidebar.vue`, `TaskList.vue`, `TaskDetail.vue`, `src/renderer/src/stores/tasks.ts`
- Modify: `src/preload/index.ts`, `src/shared/contracts.ts`
- Test: `tests/e2e/task-management.spec.ts`

**Interfaces:**
- Consumes: APIs from Tasks 2–6.
- Produces: typed `window.appApi` task/list/order/settings API.

- [ ] Step 1: Write E2E for title-only create, absence of search/filter/tag/priority controls, persistent drag order, and collapsed completed area.
- [ ] Step 2: Run `npx playwright test tests/e2e/task-management.spec.ts`; Expected: FAIL because UI is missing.
- [ ] Step 3: Implement list sidebar, task list, details, quick create, drag ordering, completion area, and typed IPC.
- [ ] Step 4: Run `npx playwright test tests/e2e/task-management.spec.ts`; Expected: PASS.
- [ ] Step 5: Commit `feat: build simplified task management interface`.

### Task 8: Advanced Manual Backup

**Files:**
- Create: `src/main/backup.ts`, `src/shared/backup.ts`, `src/renderer/src/components/AdvancedSettings.vue`
- Test: `tests/main/backup.test.ts`, `tests/e2e/backup.spec.ts`

**Interfaces:**
- Produces: `exportBackup(filePath: string): Promise<void>`
- Produces: `previewBackup(filePath: string): Promise<BackupPreview>`
- Produces: `replaceFromBackup(filePath: string): Promise<void>`

- [ ] Step 1: Write tests for invalid/future backup rollback and round-trip of order, no-date tasks, recurrence, and history.
- [ ] Step 2: Run `npx vitest run tests/main/backup.test.ts`; Expected: FAIL because backup is missing.
- [ ] Step 3: Implement versioned JSON export, validation/preview, confirmed transactional replacement, scheduler rebuild, and advanced-only UI.
- [ ] Step 4: Run `npx vitest run tests/main/backup.test.ts && npx playwright test tests/e2e/backup.spec.ts`; Expected: PASS.
- [ ] Step 5: Commit `feat: add manual backup and restore`.

### Task 9: Installer and Final Verification

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json`
- Test: `tests/packaging/config.test.ts`

**Interfaces:**
- Produces: `npm run dist` generating Windows x64 NSIS installer.

- [ ] Step 1: Write config test for x64 NSIS assisted/current-user install, no auto-update, and native module inclusion.
- [ ] Step 2: Run `npx vitest run tests/packaging/config.test.ts`; Expected: FAIL because packaging config is missing.
- [ ] Step 3: Implement electron-builder configuration, app ID, shortcuts, and native module packaging.
- [ ] Step 4: Run `npm run typecheck && npm run test && npm run test:e2e && npm run dist`; Expected: all pass and installer generated; then real Windows core scenario checks.
- [ ] Step 5: Commit `build: package Windows installer`.
