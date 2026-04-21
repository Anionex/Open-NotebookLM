# Output Workspace Collapsible Header Design

## Goal

Reduce the visual dominance of the output workspace header in `frontend` while preserving the sense that the user has entered a dedicated production workbench.

The selected interaction is:

- Default to a fully expanded workbench header when the user enters an output workspace
- Collapse automatically when the user scrolls down inside the output workspace content area
- Re-expand automatically when the scroll position returns to the top
- Use animated transitions
- Keep the collapsed state minimal:
  - workbench badge
  - output title
  - 3 context count pills
  - primary actions
- Do not keep an extra "source locked" short hint in the collapsed state

## Scope

In scope:

- `frontend` only
- Output workspace header in `ThinkFlowWorkspace`
- Sticky/collapsible behavior for output modes
- Motion and responsive adjustments
- Targeted UI tests for expanded/collapsed behavior

Out of scope:

- `frontend_zh`
- Left sidebar behavior
- Chat panel behavior
- Changing source lock semantics or output data flow
- Redesigning the actual output canvas/content below the header

## Current Problem

The output workspace header is currently a static, tall information block:

- top row with badge, title, explanatory copy, actions
- context pill strip
- source lock card with detailed tags

This creates two issues:

1. The header occupies too much of the initial viewport, pushing the actual output canvas too far down.
2. Once the user starts editing or reviewing output, the same full information density remains visible even though only a compact context summary is needed.

## Selected UX Model

Use a scroll-driven sticky header with two visual states.

### Expanded State

Shown when:

- the user first enters an output workspace
- the output workspace scroll container is at the top

Content:

- existing badge
- title
- descriptive paragraph
- context pill strip
- full source lock card
- existing primary actions

Behavior:

- visually presented as a "workbench stage"
- non-essential details are still fully visible in this state

### Collapsed State

Shown when:

- the output workspace body has been scrolled down beyond a small threshold

Content:

- workbench badge
- output title
- three context pills
- primary actions

Hidden in collapsed state:

- descriptive paragraph
- full source lock card
- any secondary explanatory copy

Behavior:

- remains sticky at the top of the output workspace area
- keeps the user oriented without dominating the viewport

## Interaction Rules

### Scroll Container

The scroll signal must come from the output workspace content scroll container, not the browser window and not the whole app shell.

Expected implementation target:

- attach scroll listener logic to the existing output workspace body container
- compute a local `isHeaderCollapsed` state from its `scrollTop`

### Thresholds

Use a simple hysteresis-free rule initially:

- collapse when `scrollTop > 24`
- expand when `scrollTop <= 4`

This creates a clear top-of-page restore behavior without requiring extra complexity.

If the current layout produces flicker, the thresholds may be widened slightly during implementation, but the behavior must remain:

- easy to trigger collapse with the first meaningful downward scroll
- guaranteed expand when user returns to top

### Modes

Apply this behavior to all output workspace modes:

- `output_focus`
- `output_immersive`

For `normal`, the collapsible output header logic is irrelevant because there is no active output workspace surface being shown in the same way.

## Visual Behavior

### Expanded Visual Direction

The expanded header should feel intentional and premium, not like a generic admin card.

Target qualities:

- slightly more stage-like framing
- clearer separation between the high-level title area and the locked-context details
- enough contrast to read as the "entry point" to the workspace

This should be achieved through refinement of the existing structure, not a full redesign.

### Collapsed Visual Direction

The collapsed bar should read like a slim production rail.

Target qualities:

- compact height
- sticky top presence
- slight translucency or blur so motion feels modern
- clear title hierarchy
- pills remain readable but secondary

### Motion

Use combined transitions rather than a single abrupt height jump.

Preferred motion ingredients:

- container height or max-height transition
- opacity fade for disappearing detail sections
- small upward translate on hidden detail content
- sticky bar background/backdrop transition

Motion should be fast and controlled:

- approximately 180ms to 260ms
- ease-out or standard cubic-bezier used elsewhere in the project

Avoid:

- bounce
- springy overshoot
- delayed content popping after the container has already resized

## Structural Plan

Refactor the output workspace header into explicit layers so state changes are easy to manage.

### Layer 1: Sticky Shell

Responsibilities:

- owns sticky positioning
- owns expanded/collapsed state class
- owns animated container framing

### Layer 2: Always-Visible Rail

Visible in both states:

- badge
- title
- context count pills
- action buttons

This is the core collapsed bar.

### Layer 3: Expandable Detail Region

Visible only in expanded state:

- descriptive paragraph
- full source lock card

This region should animate out without removing the sticky shell itself.

## Data and Rendering Rules

No backend or data contract changes are required.

The collapsed rail will reuse already-derived values:

- title
- source count
- bound/reference document count
- guidance count

For non-PPT outputs, the collapsed rail still uses the count-based display rather than retaining the current long "main document" pill. The purpose of the collapsed state is compression and consistency.

Expanded state may continue using the richer per-output distinctions already present.

## Responsive Behavior

### Desktop / Large Screens

- expanded state may remain visually generous
- collapsed state should fit in a single compact band

### Smaller Screens

- collapse should trigger with the same logic, but the resulting bar can wrap more aggressively
- action buttons may wrap to a second row only if unavoidable
- the detail region should not consume most of the viewport on entry

Implementation guidance:

- on narrower widths, reduce expanded spacing and typography slightly
- keep collapsed bar readable before preserving decorative spacing

## Accessibility and Robustness

- Respect `prefers-reduced-motion` by reducing or removing non-essential transitions
- Do not hide critical controls during state changes
- Avoid layout shifts that cause the content below to jump unpredictably
- Ensure the sticky header does not block interaction with content immediately beneath it

## Testing Plan

Add targeted UI coverage for the new behavior.

### Required Checks

1. Output workspace header is expanded on initial render
2. Scrolling the output workspace body collapses the header
3. Returning scroll to top expands the header again
4. Collapsed state retains title, count pills, and action buttons
5. Collapsed state hides descriptive copy and source lock details

### Test Level

Use Playwright or existing UI test conventions in `frontend`, preferring a focused scenario rather than a broad end-to-end workflow.

The test may use:

- deterministic DOM hooks
- class/state assertions
- scroll simulation on the actual workspace scroll container

## Files Expected To Change

- `frontend/src/components/ThinkFlowWorkspace.tsx`
- `frontend/src/components/ThinkFlowWorkspace.css`
- one or more `frontend/tests/*` files for UI verification

## Risks

1. The wrong scroll container may be observed, producing no state change or inconsistent state changes.
2. Height animation can create content jump if sticky spacing is not handled carefully.
3. Existing output modes may have slightly different layout constraints and expose edge cases.

## Recommendation

Implement the collapsible header as a local enhancement inside `ThinkFlowWorkspace`, without creating a new cross-app abstraction first.

This keeps the change tightly scoped, aligns with the user-selected interaction, and minimizes risk while still producing a visibly more intentional workbench experience.
