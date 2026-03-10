# Editorial Workspace Design System

## Overview

OpenNotebookLM has been redesigned with the **Editorial Workspace** aesthetic - a magazine-inspired design system that breaks away from generic SaaS patterns with distinctive typography, warm neutrals, and vibrant coral accents.

## Design Philosophy

### Core Principles
- **Magazine-inspired**: Strong typography hierarchy, asymmetric layouts
- **Warm & inviting**: Off-white backgrounds, warm neutrals instead of pure grays
- **Distinctive accent**: Electric coral (#F43F5E) instead of generic SaaS blue
- **Refined interactions**: Lifted shadow effects, smooth transitions
- **Editorial typography**: Newsreader serif for headlines, Inter for body text

## Color Palette

### Neutrals (Warm grays)
```
neutral-50:  #FAFAF9  (Soft white - backgrounds)
neutral-100: #F5F5F4  (Lightest gray - cards)
neutral-200: #E7E5E4  (Light gray - borders)
neutral-300: #D6D3D1  (Muted gray)
neutral-400: #A8A29E  (Mid gray - secondary text)
neutral-500: #78716C  (Dark gray - tertiary text)
neutral-600: #57534E  (Darker gray)
neutral-700: #44403C  (Almost black - secondary headings)
neutral-800: #292524  (Rich black - primary headings)
neutral-900: #1C1917  (True black - body text)
```

### Accent (Electric Coral)
```
accent-50:  #FFF1F2
accent-100: #FFE4E6
accent-200: #FECDD3
accent-300: #FDA4AF
accent-400: #FB7185
accent-500: #F43F5E  ⭐ PRIMARY ACCENT
accent-600: #E11D48  (Hover state)
accent-700: #BE123C
accent-800: #9F1239
accent-900: #881337
```

### Semantic Colors
```
success-500: #10B981 (Emerald green)
warning-500: #F59E0B (Amber)
error-500:   #EF4444 (Red)
```

## Typography

### Font Families
```css
font-display: 'Newsreader', Georgia, serif      /* Headlines */
font-sans:    'Inter', 'Helvetica Neue', sans-serif  /* Body text */
font-mono:    'JetBrains Mono', 'Courier New', monospace  /* Code */
```

### Type Scale (Major Third - 1.25x ratio)
```
xs:   0.64rem  (10px)
sm:   0.8rem   (13px)
base: 1rem     (16px) ⭐ Base size
lg:   1.25rem  (20px)
xl:   1.563rem (25px)
2xl:  1.953rem (31px)
3xl:  2.441rem (39px)
4xl:  3.052rem (49px)
5xl:  3.815rem (61px)
6xl:  3.815rem (61px)
7xl:  4.768rem (76px)
```

### Usage Guidelines
- **Headlines (h1-h6)**: Use `font-display` with `font-semibold`, `tracking-tight`
- **Body text**: Use `font-sans` with `leading-relaxed` (1.5 line height)
- **UI labels**: Use `font-sans` with `font-medium`
- **Code blocks**: Use `font-mono` with neutral-900 background

## Spacing System

Based on 4px increments:
```
1:  4px    3:  12px   6:  24px   12: 48px
2:  8px    4:  16px   8:  32px   16: 64px
            5:  20px   10: 40px   20: 80px
```

## Shadows

### Editorial Signature: Lifted Effect
```css
lifted:       0 2px 0 0 rgba(0, 0, 0, 0.1)
lifted-hover: 0 4px 0 0 rgba(0, 0, 0, 0.15)
```

Use `.lifted` and `.lifted-hover` classes for buttons and interactive cards.

## Component Library

### Available Components
Located in `src/components/ui/`:

1. **Button** - Primary, secondary, ghost, and accent variants
2. **Input** - Form fields with labels, errors, and icon support
3. **Card** - Containers with default, elevated, and outlined variants
4. **Modal** - Dialog/overlay with header, content, and footer
5. **Badge** - Small status indicators and tags

### Import Pattern
```typescript
import { Button, Input, Card, Modal, Badge } from '@/components/ui';
```

## Utility Classes

### Container Utilities
```css
.container-editorial  /* Max-width 1400px, responsive padding */
.container-narrow     /* Max-width 720px for reading */
.container-wide       /* Max-width 1600px for dashboards */
```

### Layout Utilities
```css
.grid-editorial       /* 12-column magazine-style grid */
.space-editorial      /* Vertical rhythm (6rem between children) */
.space-editorial-lg   /* Large vertical rhythm (12rem) */
```

### Typography Utilities
```css
.prose-editorial      /* Styled markdown/prose content */
.text-balance         /* Better headline wrapping */
```

### Effects
```css
.lifted               /* Editorial shadow effect */
.lifted-hover         /* Hover shadow effect */
.shimmer-editorial    /* Loading animation */
.glass-subtle         /* Matte glass effect (use sparingly) */
```

## Implementation Status

### ✅ Completed
1. **Design System Foundation**
   - Created `design-tokens.ts` with complete token definitions
   - Updated `tailwind.config.js` with editorial theme
   - Rewrote `index.css` with editorial styles and utilities

2. **Component Library**
   - Button component with 4 variants
   - Input component with label, error, and icon support
   - Card component with Header, Content, Footer subcomponents
   - Modal component with animations
   - Badge component with variant support

3. **Applied to Components**
   - AIPanel redesigned with editorial colors and Badge components
   - Removed generic blue (#007AFF) → replaced with coral (#F43F5E)
   - Updated all gray colors to warm neutrals
   - Applied to both frontend_zh and frontend_en

### 🚧 Next Steps

1. **Dashboard Page**
   - Apply editorial typography (Newsreader headlines)
   - Use asymmetric grid layout for notebooks
   - Update color scheme throughout
   - Add lifted shadows to cards

2. **NotebookView (Main Workspace)**
   - Implement adaptive layout (collapsible panels)
   - Redesign file source library with visual previews
   - Enhance chat interface with editorial styling
   - Improve AI integration UX

3. **NotionEditor**
   - Apply editorial typography to editor headings
   - Update toolbar buttons with new Button component
   - Improve inline formatting styles

4. **Settings & Modals**
   - Replace all modals with new Modal component
   - Update forms with new Input component
   - Apply editorial color scheme

5. **Tool Outputs**
   - Redesign PPT/Mindmap/Podcast/Quiz interfaces
   - Use Card components consistently
   - Apply editorial typography hierarchy

## Usage Examples

### Button Examples
```tsx
import { Button } from '@/components/ui';

// Primary button (neutral-900 background)
<Button variant="primary" size="md">
  Create Notebook
</Button>

// Accent button (coral background)
<Button variant="accent" size="md">
  <Send size={16} />
  Send
</Button>

// Ghost button (transparent with border)
<Button variant="ghost" size="sm">
  Cancel
</Button>
```

### Card Examples
```tsx
import { Card, CardHeader, CardContent, CardFooter, Button } from '@/components/ui';

<Card variant="elevated" padding="lg">
  <CardHeader
    title="Knowledge Base"
    subtitle="3 files uploaded"
    action={<Button size="sm">Add Files</Button>}
  />
  <CardContent>
    <p>Your content here...</p>
  </CardContent>
  <CardFooter>
    <Button variant="ghost">Cancel</Button>
    <Button variant="primary">Save</Button>
  </CardFooter>
</Card>
```

### Badge Examples
```tsx
import { Badge, BadgeGroup } from '@/components/ui';

<BadgeGroup>
  <Badge variant="accent" size="sm">Active</Badge>
  <Badge variant="default" size="sm">Draft</Badge>
  <Badge variant="success" size="sm" icon={<Check size={12} />}>
    Completed
  </Badge>
</BadgeGroup>
```

### Input Examples
```tsx
import { Input } from '@/components/ui';
import { Search, Mail } from 'lucide-react';

<Input
  label="Email Address"
  type="email"
  placeholder="you@example.com"
  leftIcon={<Mail size={16} />}
  helperText="We'll never share your email"
/>

<Input
  placeholder="Search notebooks..."
  leftIcon={<Search size={16} />}
  error="No results found"
/>
```

## Design Tokens File

Located at `src/styles/design-tokens.ts`, this file contains:
- Complete color palette definitions
- Typography system (fonts, scales, weights, line heights)
- Spacing values
- Border radius values
- Shadow definitions
- Transition timing values
- Breakpoint definitions

Import and use in TypeScript/JavaScript:
```typescript
import { designTokens } from '@/styles/design-tokens';

const primaryAccent = designTokens.colors.accent[500]; // #F43F5E
```

## Migration Guide

### Replacing Old Colors
```
OLD                    → NEW
-------------------      -------------------
blue-500, #007AFF      → accent-500, #F43F5E
gray-50                → neutral-50, #FAFAF9
gray-100               → neutral-100, #F5F5F4
gray-200               → neutral-200, #E7E5E4
gray-400               → neutral-400, #A8A29E
gray-500               → neutral-500, #78716C
gray-700               → neutral-700, #44403C
gray-900               → neutral-900, #1C1917
green-500              → success-500, #10B981
red-500                → error-500, #EF4444
```

### Replacing Old Components
```
OLD                           → NEW
----------------------------   ----------------------------
Custom button with classes    → <Button variant="..." />
Custom input with classes     → <Input label="..." />
<div className="card...">     → <Card variant="..." />
Custom modal implementation   → <Modal isOpen={...} />
Badge with inline classes     → <Badge variant="..." />
```

## Key Differences from Old Design

1. **No more generic blue** - Distinctive coral accent (#F43F5E)
2. **Warm neutrals** - Off-whites and warm grays instead of pure grays
3. **Distinctive fonts** - Newsreader serif for headlines (not Inter/system fonts)
4. **Lifted shadows** - Editorial signature effect for depth
5. **Refined spacing** - More generous whitespace with editorial rhythm
6. **Cohesive components** - Reusable UI library with consistent styling

## Resources

- Design tokens: `src/styles/design-tokens.ts`
- Tailwind config: `tailwind.config.js`
- Global styles: `src/index.css`
- Component library: `src/components/ui/`
- Google Fonts: [Newsreader](https://fonts.google.com/specimen/Newsreader), [Inter](https://fonts.google.com/specimen/Inter), [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)

---

**Updated:** 2025-03-11
**Status:** Foundation complete, ready for page-level implementation
**Design Direction:** Editorial Workspace (magazine-inspired, warm, distinctive)
