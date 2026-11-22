# Apple Clear Glass and Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Apple-style balanced clear-glass material and restrained spring-like interaction feedback across the main window and desktop widget.

**Architecture:** Centralize glass/motion tokens in shared renderer CSS, then refine existing Vue components and list/popover transitions without changing domain behavior or adding dependencies.

**Tech Stack:** Vue 3, CSS transitions/TransitionGroup, Electron, Playwright, Vitest.

**Spec:** Approved Apple-balanced clear glass and gentle motion design in this conversation.

## Global Constraints

- Preserve all task, window, data, and accessibility behavior; visual/motion changes only.
- Glass must remain readable: balanced translucency, approximately 30px backdrop blur, elevated saturation, refractive inner border, and localized highlights rather than a uniform white panel.
- Motion is subtle and short: hover lift, press compression, restrained release spring, task enter/exit, and popover fade/scale.
- Honor `prefers-reduced-motion: reduce` by removing movement/spring while preserving state contrast.
- No animation loop, large parallax, layout redesign, or new runtime dependency.

## Review Focus

- Acrylic and CSS fallback must both remain readable against varied wallpaper colors.
- Transform animations must not interfere with native window drag regions, popover fixed positioning, or task drag ordering.
- Reduced-motion mode must disable spatial motion without hiding immediate state feedback.
- TransitionGroup keys and leave transitions must not mutate task ordering or completion behavior.

### Task 1: Shared Apple Glass Material

**Files:**
- Create: `src/renderer/src/apple-glass.css`
- Modify: `src/renderer/src/main.ts`, `widget-main.ts`, `widget.css`, `App.vue`
- Modify: `WindowTitlebar.vue`, `AdvancedSettings.vue`, `AppSelect.vue`, `DateField.vue`, `TimeField.vue`
- Test: `tests/e2e/glass-material.spec.ts`

**Interfaces:**
- Produces CSS tokens `--glass-surface`, `--glass-surface-strong`, `--glass-edge`, `--glass-highlight`, `--glass-shadow`, `--motion-fast`, `--motion-spring`.
- Produces shared `.glass-button`, `.glass-panel`, and `.glass-input` classes without changing component public APIs.

- [ ] Step 1: Write failing E2E assertions for widget/main computed backdrop blur/saturation, non-uniform translucent layers, refractive borders, and shared tokens.
- [ ] Step 2: Run `npx playwright test tests/e2e/glass-material.spec.ts`; Expected: FAIL because tokens/material are missing.
- [ ] Step 3: Implement balanced light material on Acrylic and CSS branches, layered surfaces, inner highlights, and readable text contrast.
- [ ] Step 4: Re-run material E2E plus existing launch/widget/settings tests; Expected: PASS.
- [ ] Step 5: Commit `feat: refine Apple clear glass material`.

### Task 2: Buttons, Tasks, and Popover Motion

**Files:**
- Create: `src/renderer/src/motion.css`
- Modify: `src/renderer/src/main.ts`, `widget-main.ts`, `components/FloatingPopover.vue`
- Modify: `components/TaskList.vue`, `components/WidgetTaskList.vue`, `components/TaskDetail.vue`, `WidgetApp.vue`
- Modify: `components/WindowTitlebar.vue`, `components/AdvancedSettings.vue`, `App.vue`, `widget.css`
- Test: `tests/e2e/glass-motion.spec.ts`

**Interfaces:**
- Produces shared motion classes/Transition names `task-list` and `glass-popover`.
- Preserves existing task/list/component events and DOM test IDs.

- [ ] Step 1: Write failing E2E for hover transform, pointer-down compression, release transition, add/complete list animations, popover fade/scale, and native drag-region computed values remaining correct.
- [ ] Step 2: Run `npx playwright test tests/e2e/glass-motion.spec.ts`; Expected: FAIL because motion is incomplete.
- [ ] Step 3: Implement restrained button/toggle motion, keyed TransitionGroups, popover transitions, and add/check feedback without delaying IPC operations.
- [ ] Step 4: Re-run motion E2E and all affected task/widget tests; Expected: PASS.
- [ ] Step 5: Commit `feat: add gentle liquid glass interactions`.

### Task 3: Reduced Motion, Review, and Packaged Visual Verification

**Files:**
- Modify only files required by verified regression failures.

- [ ] Step 1: Add reduced-motion E2E using `page.emulateMedia({ reducedMotion: 'reduce' })`; assert spatial transforms/animations are suppressed while color/state changes remain.
- [ ] Step 2: Run `npm run typecheck && npm run test && npm run test:e2e`; Expected: all tests pass.
- [ ] Step 3: Dispatch one independent review; fix Critical/Important findings in one RED→GREEN pass and record deferred minors.
- [ ] Step 4: Run `npm run dist`; inspect packaged light glass over at least two wallpaper colors, hover/press/add/complete/popover motion, native dragging, and reduced-motion mode. Document unverified Windows 10 behavior.
- [ ] Step 5: Commit final verification changes if any with `test: verify Apple glass release`.
