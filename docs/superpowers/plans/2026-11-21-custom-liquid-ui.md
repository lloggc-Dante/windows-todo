# Custom Liquid UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Narrow the desktop widget and replace visible Windows-native application chrome and controls with consistent custom Vue liquid-glass UI.

**Architecture:** Preserve existing data, IPC ownership, and task behavior. Add constrained widget-width persistence, main-process window-control commands, and reusable Vue select/date/time/toggle primitives; frameless main-window chrome invokes typed IPC only.

**Tech Stack:** Electron, TypeScript, Vue 3, Pinia, CSS, Vitest, Playwright.

**Spec:** Approved “narrow widget + fully custom window and controls” revision in this conversation.

## Global Constraints

- Widget default width 360px, user range 320–480px; persist width and retain 8-row height behavior.
- Main window frameless with custom drag/double-click titlebar and minimize/maximize/restore/close controls; remove default application menu.
- Replace visible native select/date/time/checkbox rendering; preserve accessible names and keyboard behavior.
- AppSelect supports ArrowUp/ArrowDown, Enter, Escape, outside-click close, and type-safe string values.
- DateField accepts typed `YYYY-MM-DD` plus a custom calendar; TimeField accepts typed `HH:mm` plus custom hour/minute choices.
- OS notifications, tray, and backup file dialogs remain native and out of visual scope.
- No task data migration, backend framework change, or new component library dependency.

## Review Focus

- Widget width clamping and persistence must not break multi-display position or eight-row height (Tasks 1 and 5).
- Frameless close must retain close-to-tray versus whole-app quit semantics (Task 2).
- Custom controls must not detach/reset task details during broadcasts or lose typed input (Tasks 3/4).
- Keyboard and outside-click behavior must close only the active popup without changing task data (Tasks 3/4).
- Existing E2E selectors tied to native controls must be updated to behavior-equivalent custom-control interactions (Tasks 3–5).

### Task 1: Narrow and Resizable Widget Width

**Files:**
- Modify: `src/shared/widget.ts`, `src/main/widget-window-controller.ts`, `src/main/widget-ipc.ts`
- Modify: `src/shared/contracts.ts`, `src/preload/index.ts`
- Modify: `src/renderer/src/WidgetApp.vue`, `src/renderer/src/widget.css`
- Test: `tests/main/widget-layout.test.ts`, `tests/main/widget-window-controller.test.ts`, `tests/e2e/widget.spec.ts`

**Interfaces:**
- Produces: `WIDGET_DEFAULT_WIDTH = 360`, `WIDGET_MIN_WIDTH = 320`, `WIDGET_MAX_WIDTH = 480`
- Produces: `clampWidgetWidth(width: number): number`
- Produces: `AppApi.setWidgetWidth(width: number): Promise<void>`
- Produces: `WidgetWindowController.setWidth(width: number): void`

- [ ] Step 1: Write failing tests for default 360, clamp 319→320 and 481→480, saved-width restore, work-area clamp, and E2E right-edge resize persistence.
- [ ] Step 2: Run `npx vitest run tests/main/widget-layout.test.ts tests/main/widget-window-controller.test.ts && npx playwright test tests/e2e/widget.spec.ts`; Expected: FAIL because width API is missing.
- [ ] Step 3: Implement width clamping/persistence and a no-drag right resize handle; preserve task height and position calculations using current width.
- [ ] Step 4: Re-run Task 1 commands; Expected: PASS.
- [ ] Step 5: Commit `feat: narrow and resize desktop widget`.

### Task 2: Custom Frameless Main Window Chrome

**Files:**
- Create: `src/renderer/src/components/WindowTitlebar.vue`, `src/main/window-ipc.ts`
- Modify: `src/main/index.ts`, `src/main/window-controller.ts`, `src/shared/contracts.ts`, `src/preload/index.ts`
- Modify: `src/renderer/src/App.vue`
- Test: `tests/main/windows-integration.test.ts`, `tests/e2e/window-chrome.spec.ts`

**Interfaces:**
- Produces: `AppApi.minimizeWindow(): Promise<void>`, `toggleMaximizeWindow(): Promise<void>`, `closeWindow(): Promise<void>`
- Produces: `WindowController.minimize(): void`, `toggleMaximize(): void`, `close(): void`

- [ ] Step 1: Write failing fake-window tests and E2E for minimize, maximize/restore, double-click titlebar, close-to-tray, and closeToTray=false whole-app quit.
- [ ] Step 2: Run `npx vitest run tests/main/windows-integration.test.ts && npx playwright test tests/e2e/window-chrome.spec.ts`; Expected: FAIL because custom chrome commands are missing.
- [ ] Step 3: Create main BrowserWindow with `frame=false`, remove application menu, add typed window IPC, and render a 40px no-input drag titlebar with no-drag buttons.
- [ ] Step 4: Re-run Task 2 commands; Expected: PASS.
- [ ] Step 5: Commit `feat: replace native window titlebar`.

### Task 3: Custom Selects and Toggles

**Files:**
- Create: `src/renderer/src/components/AppSelect.vue`
- Modify: `src/renderer/src/components/TaskDetail.vue`, `src/renderer/src/WidgetApp.vue`, `src/renderer/src/components/AdvancedSettings.vue`
- Modify: `src/renderer/src/App.vue`, `src/renderer/src/widget.css`
- Test: `tests/e2e/custom-controls.spec.ts`, update affected widget/settings/final-review E2E helpers.

**Interfaces:**
- Produces: `AppSelect.modelValue: string`, `options: Array<{value:string;label:string}>`, `ariaLabel: string`
- Emits: `update:modelValue[value: string]`, optional existing domain change events.

- [ ] Step 1: Write failing E2E for list/rule selection, keyboard arrows+Enter, Escape/outside click, and toggle switches without native select rendering.
- [ ] Step 2: Run `npx playwright test tests/e2e/custom-controls.spec.ts`; Expected: FAIL because AppSelect is missing.
- [ ] Step 3: Implement single-open popover select with focus restoration and scroll containment; replace native selects. Use `appearance:none` custom checkbox tracks while preserving checkbox semantics for settings/tests.
- [ ] Step 4: Run custom controls plus affected existing E2E; Expected: PASS.
- [ ] Step 5: Commit `feat: replace native selects and toggles`.

### Task 4: Custom Date and Time Fields

**Files:**
- Create: `src/renderer/src/components/DateField.vue`, `TimeField.vue`, `date-picker.ts`
- Modify: `src/renderer/src/components/TaskDetail.vue`, global/widget scrollbar CSS
- Test: `tests/main/date-picker.test.ts`, `tests/e2e/date-time-controls.spec.ts`, update existing E2E date/time interactions.

**Interfaces:**
- Produces: `calendarMonth(year: number, month: number): Array<{date:string;inMonth:boolean}>`
- Produces: controlled text `modelValue` with calendar/time popup, clear action, and typed-value normalization on blur.

- [ ] Step 1: Write failing pure calendar tests (month boundaries/leap day) and E2E for calendar selection, typed dates, custom time choices, clear, and recurrence/reminder preservation.
- [ ] Step 2: Run `npx vitest run tests/main/date-picker.test.ts && npx playwright test tests/e2e/date-time-controls.spec.ts`; Expected: FAIL because fields are missing.
- [ ] Step 3: Implement calendar/time popovers without native date/time inputs; replace task-detail controls and style all application scrollbars thin/translucent.
- [ ] Step 4: Re-run Task 4 and affected existing E2E; Expected: PASS.
- [ ] Step 5: Commit `feat: add liquid glass date and time controls`.

### Task 5: Review, Full Verification, and Packaged Visual Check

**Files:**
- Modify only files required by verified regression failures.

- [ ] Step 1: Run `npm run typecheck && npm run test && npm run test:e2e`; Expected: all existing and new tests pass.
- [ ] Step 2: Dispatch one independent whole-branch review; fix Critical/Important findings in one RED→GREEN pass and defer minors explicitly.
- [ ] Step 3: Run `npm run dist`; Expected: updated x64 NSIS installer.
- [ ] Step 4: Inspect packaged widget at 360px, resize/persist width, operate every custom control, test titlebar buttons/drag/double-click, and visually verify no native titlebar/select/date/time UI remains. Document any unavailable Windows 10 checks.
- [ ] Step 5: Commit final verification changes with `test: verify custom liquid UI release` if any.
