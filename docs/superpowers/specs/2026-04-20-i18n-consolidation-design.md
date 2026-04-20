# Frontend i18n Consolidation: Delete frontend_en, Add Language Toggle to frontend_zh

## 1. Goal

Consolidate the two frontend codebases into one. Delete `frontend_en/` (legacy, architecturally divergent). Add Chinese/English language switching to `frontend_zh/` (the active ThinkFlow workspace).

## 2. Context

- `frontend_en` and `frontend_zh` are **not translations** of each other — they are fundamentally different UI architectures
- `frontend_en`: older modular design (notes editor, quiz components, settings modal)
- `frontend_zh`: active ThinkFlow workspace monolith with all current features
- Neither has any i18n infrastructure — both are hardcoded in their respective languages
- ~19 files in `frontend_zh` contain ~150-170 hardcoded Chinese strings

## 3. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| i18n approach | Lightweight custom (Zustand + JSON) | Zero new deps, matches existing store pattern, project only needs 2 languages |
| Switcher location | ThinkFlowTopBar right side | Globally visible, consistent with other controls |
| Persistence | localStorage | Survives page refresh |
| Default language | Browser detection | `navigator.language` starts with "zh" → Chinese, else English |
| Translation scope | Frontend UI strings only | No backend prompts, no AI-generated content |
| frontend_en fate | Delete entirely | No unique features worth migrating |

## 4. Architecture

### 4.1 New File Structure

```
frontend_zh/src/i18n/
├── index.ts      # useT() hook, re-exports
├── store.ts      # Zustand language store
├── types.ts      # Locale type, TranslationKey union type
├── zh.ts         # Chinese translations (~170 keys)
└── en.ts         # English translations (~170 keys)
```

### 4.2 Language Store (`store.ts`)

Zustand store following `authStore.ts` pattern:

```ts
type Locale = 'zh' | 'en'

interface I18nState {
  locale: Locale
  setLocale: (locale: Locale) => void
}
```

- Init: read `localStorage.getItem('locale')` → fallback to `navigator.language` detection
- `setLocale()`: updates state + writes `localStorage.setItem('locale', value)` + sets `document.documentElement.lang = locale` for accessibility

### 4.3 Translation Hook (`index.ts`)

```ts
function useT(): (key: TranslationKey, params?: Record<string, string>) => string
```

- Reads `locale` from Zustand store via selector
- Looks up key in the corresponding translation object
- Simple interpolation: replaces `{param}` placeholders; unmatched placeholders are stripped (replaced with empty string) and a console.warn is emitted in dev mode
- Falls back to key string if translation missing (dev safety)
- Type-safe: `TranslationKey` is derived from `keyof typeof zh`, ensuring compile-time key validation

### 4.4 Translation Files (`zh.ts`, `en.ts`)

Flat key-value objects, namespaced by component/page. Type safety enforced via shared type:

```ts
// types.ts — single source of truth for key set
import zh from './zh'
export type TranslationKey = keyof typeof zh
export type Translations = Record<TranslationKey, string>

// en.ts — must satisfy Translations, TS errors if keys mismatch
import type { Translations } from './types'
const en: Translations = { ... }
export default en
```

Example keys:

```ts
export default {
  // Dashboard
  'dashboard.create': '创建笔记本',
  'dashboard.noNotebooks': '还没有笔记本',
  'dashboard.search': '搜索笔记本',
  // Auth
  'auth.signIn': '登录',
  'auth.register': '注册',
  'auth.email': '邮箱',
  // ...
} as const
```

### 4.5 Language Switcher Component

Location: `ThinkFlowTopBar.tsx` right-side controls area + `Dashboard.tsx` top bar.

A text button showing `中文` or `EN` (matching current locale). Clicking toggles to the other language. Styled consistently with existing topbar button classes. Instant effect — Zustand state change triggers re-render of all `useT()` consumers. No page reload needed.

## 5. Translation Scope

### Files to translate

The table below is an estimate. Before implementation, run `grep -rn '[\u4e00-\u9fff]' frontend_zh/src/ --include='*.tsx' --include='*.ts'` to produce the definitive file list. Chinese in code comments does not need translation — only user-visible strings.

| File | Key count (est.) | Content type |
|---|---|---|
| stores/authStore.ts | ~9 | Error messages |
| pages/AuthPage.tsx | ~20 | Form labels, prompts, buttons |
| pages/Dashboard.tsx | ~12 | Titles, buttons, empty states |
| ThinkFlowTopBar.tsx | ~5 | Title, buttons |
| ThinkFlowLeftSidebar.tsx | ~8 | Status labels, buttons |
| ThinkFlowCenterPanel.tsx | ~10 | Chat prompts, buttons |
| ThinkFlowRightPanel.tsx | ~6 | Tab labels |
| ThinkFlowAddSourceModal.tsx | ~18 | Tabs, buttons, errors |
| DocumentPanelSection.tsx | ~8 | Title, buttons, hints |
| SummaryPanelSection.tsx | ~6 | Title, hints |
| GuidancePanelSection.tsx | ~6 | Title, hints |
| OutputWorkspaceSection.tsx | ~10 | Title, buttons, status |
| ThinkFlowOutputContextModal.tsx | ~8 | Modal copy |
| ThinkFlowFlashcardStudy.tsx | ~6 | Buttons, hints |
| ThinkFlowQuizStudy.tsx | ~6 | Buttons, hints |
| TableAnalysisPanel.tsx | ~5 | Title, hints |
| TableResultCard.tsx | ~4 | Buttons, labels |
| ThinkFlowWorkspace.tsx | ~15 | Various prompts and status |
| MermaidPreview.tsx | ~3 | Labels |
| index.html | ~1 | Page title (`<title>`) |

Dynamic count strings (e.g., "3 个笔记本") use interpolation: `t('dashboard.notebookCount', { count: '3' })` → "3 个笔记本" / "3 notebooks".

### NOT translated

- Backend API error messages
- AI-generated content (chat responses, summaries, documents, guidance)
- Prompt templates in `workflow_engine/`
- Backend log messages

## 6. Delete frontend_en

### Remove

- `frontend_en/` directory (entire tree)

### Clean up references

- `docs/development-architecture-guide.md` — remove Section 7 (frontend_en description) and update any cross-references
- Other docs referencing frontend_en (if any, verify with grep)
- Note: `scripts/` directory does not reference frontend_en (verified) — no changes needed there

### Do NOT migrate

- No components from frontend_en to frontend_zh (ThinkFlow already covers all features)
- No services layer (frontend_zh's api.ts is sufficient)

## 7. Testing Strategy

- Manual: switch language on Dashboard → verify all strings change
- Manual: switch language in ThinkFlow workspace → verify all panels update
- Manual: refresh page → verify language persists
- Manual: clear localStorage → verify browser language detection works
- Build: `npm run build` must pass with no TS errors — the `Translations` type constraint ensures `en.ts` and `zh.ts` have identical key sets at compile time
- CI guard (optional): a script asserting `Object.keys(zh).sort()` equals `Object.keys(en).sort()` to prevent key drift
