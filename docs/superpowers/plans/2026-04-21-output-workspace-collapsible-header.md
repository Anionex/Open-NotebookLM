# Output Workspace Collapsible Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `frontend` output workspace header expand at the top and collapse into a compact sticky rail while scrolling.

**Architecture:** Keep the behavior local to `ThinkFlowWorkspace` and `OutputWorkspaceSection`. `ThinkFlowWorkspace` owns the collapsed state and derives display counts; `OutputWorkspaceSection` reports scroll position from the real output body scroll container.

**Tech Stack:** React 18, TypeScript, CSS transitions, Playwright.

---

### Task 1: Add Scroll-State Regression Test

**Files:**
- Modify: `frontend/tests/i18n.spec.js`

- [ ] Add a Playwright test that injects a minimal output-workspace DOM fixture matching production class names.
- [ ] Assert the fixture starts expanded.
- [ ] Scroll the body container and assert the collapsed class appears.
- [ ] Scroll back to top and assert the expanded class returns.

### Task 2: Wire Scroll State

**Files:**
- Modify: `frontend/src/components/OutputWorkspaceSection.tsx`
- Modify: `frontend/src/components/ThinkFlowWorkspace.tsx`

- [ ] Add `onOutputWorkspaceScroll` and `isOutputHeaderCollapsed` props to `OutputWorkspaceSection`.
- [ ] Emit scroll updates from the `.thinkflow-output-workspace-body` container.
- [ ] Reset the collapsed state when active output changes.
- [ ] Apply collapsed/expanded classes and deterministic `data-testid` hooks to the header.

### Task 3: Refactor Header Markup

**Files:**
- Modify: `frontend/src/components/ThinkFlowWorkspace.tsx`

- [ ] Split the header into always-visible rail and expandable details.
- [ ] Keep badge, title, count pills, and actions in the rail.
- [ ] Move descriptive copy and source lock card into the detail region.
- [ ] Preserve existing PPT/non-PPT data display in expanded state.

### Task 4: Add Motion and Responsive Styling

**Files:**
- Modify: `frontend/src/components/ThinkFlowWorkspace.css`

- [ ] Make the header sticky inside the output workspace area.
- [ ] Add collapsed-state sizing, opacity, transform, and backdrop transitions.
- [ ] Add reduced-motion handling.
- [ ] Add mobile wrapping/spacing adjustments.

### Task 5: Verify

**Files:**
- Test: `frontend/tests/i18n.spec.js`

- [ ] Run the new Playwright test and confirm it passes.
- [ ] Run `npx tsc --noEmit --pretty false`.
- [ ] Run `npm run build`.
