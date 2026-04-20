# Frontend i18n Consolidation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete `frontend_en/`, add zh/en language toggle to `frontend_zh/` with Zustand-based i18n, extract all hardcoded Chinese into translation files.

**Architecture:** Zustand store for locale state (localStorage-persisted, browser-detected default). `useT()` hook returns a type-safe translator function. `zh.ts` is the source-of-truth for keys; `en.ts` must satisfy the same `Translations` type. Language switcher in TopBar and Dashboard.

**Tech Stack:** React 18, TypeScript, Zustand, Vite, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-20-i18n-consolidation-design.md`

---

## Chunk 1: i18n Core Infrastructure

### Task 1: Create i18n Zustand store

**Files:**
- Create: `frontend_zh/src/i18n/store.ts`

- [ ] **Step 1: Create the language store**

Note: `Locale` type is defined here initially. In Task 3, `types.ts` will become the canonical source and this file will be updated to import from there.

```ts
import { create } from 'zustand'

type Locale = 'zh' | 'en'

function detectLocale(): Locale {
  const saved = localStorage.getItem('locale')
  if (saved === 'zh' || saved === 'en') return saved
  return navigator.language.startsWith('zh') ? 'zh' : 'en'
}

interface I18nState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: detectLocale(),
  setLocale: (locale) => {
    localStorage.setItem('locale', locale)
    document.documentElement.lang = locale
    set({ locale })
  },
}))
```

- [ ] **Step 2: Commit**

```bash
git add frontend_zh/src/i18n/store.ts
git commit -m "feat(i18n): add Zustand language store with localStorage persistence"
```

### Task 2: Create Chinese translation file (source of truth)

**Files:**
- Create: `frontend_zh/src/i18n/zh.ts`

Before writing this file, run the definitive audit:
```bash
grep -rn '[\u4e00-\u9fff]' frontend_zh/src/ --include='*.tsx' --include='*.ts' | grep -v '\/\/' | grep -v 'import '
```

- [ ] **Step 1: Create zh.ts with all Chinese UI strings**

Extract every user-visible Chinese string from the ~20 files identified in the spec. Organize by namespace (component/page). The file uses `as const` so TypeScript infers literal key types.

```ts
const zh = {
  // ── Dashboard ──
  'dashboard.title': '知识工作台',
  'dashboard.subtitle': '管理你的知识库，随时进入工作区开始探索。',
  'dashboard.signOut': '退出登录',
  'dashboard.newNotebook': '新建笔记本',
  'dashboard.workspace': '工作区',
  'dashboard.selectNotebook': '选择一个笔记本继续工作',
  'dashboard.searchPlaceholder': '搜索笔记本',
  'dashboard.noNotebooks': '还没有笔记本',
  'dashboard.noMatch': '没有匹配结果',
  'dashboard.noNotebooksHint': '先创建一个笔记本，再进入 ThinkFlow 工作台。',
  'dashboard.noMatchHint': '换个关键词试试，或者直接创建新的笔记本。',
  'dashboard.unnamed': '未命名笔记本',
  'dashboard.fetchError': '获取笔记本列表失败',
  'dashboard.createError': '创建笔记本失败',
  'dashboard.knowledgeBase': '知识库',
  'dashboard.enterNotebook': '点击进入，开始你的知识探索之旅。',
  'dashboard.openNotebook': '打开笔记本',
  'dashboard.overview': '工作区概览',
  'dashboard.knowledgeSpaces': '知识空间',
  'dashboard.workspaceCount': '个工作区',
  'dashboard.mode': '模式',
  'dashboard.cloudSync': '云端同步',
  'dashboard.localTrial': '本地试用',
  'dashboard.coreCapability': '核心能力',
  'dashboard.coreCapabilityValue': '来源 · 对话 · 产出',
  'dashboard.closedLoop': '完整知识工作闭环',
  'dashboard.createTitle': '新建笔记本',
  'dashboard.createHint': '创建后会直接进入该笔记本的 ThinkFlow 工作台。',
  'dashboard.namePlaceholder': '输入笔记本名称',
  'dashboard.cancel': '取消',
  'dashboard.creating': '创建中...',
  'dashboard.createAndEnter': '创建并进入',

  // ── Auth ──
  'auth.brandHeadline': '开启你的知识之旅',
  'auth.brandSubtitle': '在这里管理你的文档、生成洞见、创建多样化产出。',
  'auth.explore': '探索',
  'auth.smartQA': '智能问答',
  'auth.smartQADesc': '基于来源的深度 RAG 对话，精准引用原文',
  'auth.organize': '整理',
  'auth.knowledgeOrg': '知识梳理',
  'auth.knowledgeOrgDesc': '沉淀对话、整理文档、构建专属知识底稿',
  'auth.output': '产出',
  'auth.diverseOutput': '多样产出',
  'auth.diverseOutputDesc': '一键生成 PPT、播客、导图、测验和报告',
  'auth.fullPipeline': 'AI 全链路知识工作台',
  'auth.fullPipelineDesc': '从来源导入、智能问答到多样产出，ThinkFlow 覆盖知识工作的完整闭环。',
  'auth.createAccount': '创建你的账号',
  'auth.welcomeBack': '欢迎回来',
  'auth.registerHint': '注册后即可进入统一的 ThinkFlow 工作台。',
  'auth.loginHint': '登录后继续你的文档与产出工作流。',
  'auth.login': '登录',
  'auth.register': '注册',
  'auth.email': '邮箱',
  'auth.password': '密码',
  'auth.confirmPassword': '确认密码',
  'auth.passwordPlaceholder': '请输入密码',
  'auth.passwordMinHint': '至少 6 位',
  'auth.confirmPlaceholder': '再次输入密码',
  'auth.loggingIn': '登录中...',
  'auth.verificationCode': '验证码',
  'auth.otpPlaceholder': '输入邮件中的验证码',
  'auth.otpDisabledHint': '先填写上方信息再发送',
  'auth.send': '发送',
  'auth.sent': '已发送',
  'auth.otpSentHint': '验证码已发送，请查收邮件。',
  'auth.resendCountdown': '{seconds}s 后重发',
  'auth.resendLink': '没收到？重新发送',
  'auth.verifying': '验证中...',
  'auth.sending': '发送中...',
  'auth.completeVerify': '完成验证',
  'auth.continueAsGuest': '以访客身份继续',
  'auth.codeSent': '验证码已发送到 {email}，请查收。',
  'auth.resentTo': '已重新发送到 {email}。',
  'auth.missingEmail': '缺少待验证邮箱。',
  'auth.enterEmailPassword': '请输入邮箱和密码。',
  'auth.invalidEmail': '请输入正确的邮箱地址。',
  'auth.fillAll': '请完整填写邮箱和密码。',
  'auth.passwordMismatch': '两次输入的密码不一致。',
  'auth.passwordTooShort': '密码长度至少为 6 位。',
  'auth.enterOtp': '请输入验证码。',

  // ── AuthStore errors ──
  'authStore.notConfigured': '认证未配置',
  'authStore.loginFailed': '登录失败',
  'authStore.registerFailed': '注册失败',
  'authStore.verifyFailed': '验证失败',
  'authStore.resendFailed': '重发失败',

  // ── TopBar ──
  'topbar.history': '历史',

  // ── LeftSidebar ──
  'sidebar.materials': '素材',
  'sidebar.outputs': '产出',
  'sidebar.addSource': '添加来源',
  'sidebar.refreshing': '刷新中...',
  'sidebar.noSources': '暂无来源',
  'sidebar.addSourceHint': '上传文件或添加链接开始',
  'sidebar.noOutputs': '暂无产出',
  'sidebar.statusReady': '已解析',
  'sidebar.statusPending': '解析中',
  'sidebar.statusFailed': '失败',
  'sidebar.statusDefault': '待处理',
  // (Remaining keys added in Task 5)
} as const

export default zh
```

- [ ] **Step 2: Commit**

```bash
git add frontend_zh/src/i18n/zh.ts
git commit -m "feat(i18n): add Chinese translation file with Dashboard/Auth/TopBar/Sidebar keys"
```

### Task 3: Create types and English translation file

**Files:**
- Create: `frontend_zh/src/i18n/types.ts`
- Create: `frontend_zh/src/i18n/en.ts`

- [ ] **Step 1: Create types.ts**

```ts
import type zh from './zh'

export type Locale = 'zh' | 'en'
export type TranslationKey = keyof typeof zh
export type Translations = Record<TranslationKey, string>
```

- [ ] **Step 2: Create en.ts**

Must satisfy `Translations` type — TS will error if any key is missing or extra. Write the full English translation for every key present in `zh.ts` at this point (all Dashboard, Auth, AuthStore, TopBar, and Sidebar keys).

```ts
import type { Translations } from './types'

const en: Translations = {
  // ── Dashboard ──
  'dashboard.title': 'Knowledge Workspace',
  'dashboard.subtitle': 'Manage your knowledge bases and start exploring anytime.',
  'dashboard.signOut': 'Sign out',
  'dashboard.newNotebook': 'New notebook',
  // ... (MUST include ALL keys from zh.ts — run `npx tsc --noEmit` to verify)
}

export default en
```

- [ ] **Step 3: Update store.ts to import Locale from types.ts**

Replace the local `type Locale = 'zh' | 'en'` in `store.ts` with:
```ts
import type { Locale } from './types'
```

- [ ] **Step 4: Verify types match**

Run: `cd frontend_zh && npx tsc --noEmit`
Expected: No errors (en.ts has all keys from zh.ts, Locale type is unified)

- [ ] **Step 5: Commit**

```bash
git add frontend_zh/src/i18n/types.ts frontend_zh/src/i18n/en.ts
git commit -m "feat(i18n): add TypeScript types and English translation file"
```

### Task 4: Create useT() hook and index barrel

**Files:**
- Create: `frontend_zh/src/i18n/index.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useCallback } from 'react'
import { useI18nStore } from './store'
import type { TranslationKey } from './types'
import zh from './zh'
import en from './en'

export type { Locale, TranslationKey, Translations } from './types'
export { useI18nStore } from './store'

const translations = { zh, en } as const

export function useT() {
  const locale = useI18nStore((s) => s.locale)
  return useCallback(
    (key: TranslationKey, params?: Record<string, string>): string => {
      let text = translations[locale]?.[key] ?? key
      if (params) {
        text = text.replace(/\{(\w+)\}/g, (match, name) => {
          if (name in params) return params[name]
          if (import.meta.env.DEV) console.warn(`[i18n] Missing param "${name}" for key "${key}"`)
          return ''
        })
      }
      return text
    },
    [locale],
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend_zh/src/i18n/index.ts
git commit -m "feat(i18n): add useT() translation hook with interpolation support"
```

---

## Chunk 2: Extract Strings & Add Language Switcher

### Task 5: Complete zh.ts with remaining component strings

**Files:**
- Modify: `frontend_zh/src/i18n/zh.ts`
- Modify: `frontend_zh/src/i18n/en.ts`

- [ ] **Step 1: Audit all remaining Chinese strings**

Run: `grep -rn '[\u4e00-\u9fff]' frontend_zh/src/ --include='*.tsx' --include='*.ts' | grep -v '//' | grep -v 'import '`

For each file listed in the spec (CenterPanel, RightPanel, AddSourceModal, DocumentPanel, SummaryPanel, GuidancePanel, OutputWorkspace, OutputContextModal, FlashcardStudy, QuizStudy, TableAnalysis, TableResultCard, Workspace, MermaidPreview), extract all user-visible Chinese strings.

- [ ] **Step 2: Add remaining keys to zh.ts**

Add namespaced keys for all remaining components. Example namespaces:

```ts
  // ── CenterPanel ──
  'chat.newConversation': '开始新对话',
  'chat.viewHistory': '查看历史对话',
  'chat.settleMessage': '沉淀当前消息',
  'chat.settleQA': '沉淀这一轮问答',
  'chat.addMultiSettle': '加入多条沉淀',
  'chat.ai': 'AI',
  'chat.you': '你',

  // ── RightPanel ──
  'rightPanel.summary': '摘要',
  'rightPanel.document': '梳理文档',
  'rightPanel.guidance': '产出指导',
  'rightPanel.outline': '大纲编排',

  // ── AddSourceModal ──
  'addSource.fileUpload': '文件上传',
  'addSource.webLink': '网页链接',
  'addSource.textPaste': '文本粘贴',
  'addSource.quickSearch': '快速搜索',
  'addSource.deepResearch': '深度研究',
  // ... all error messages and labels

  // ── DocumentPanel ──
  // ── SummaryPanel ──
  // ── GuidancePanel ──
  // ── OutputWorkspace ──
  // ── OutputContextModal ──
  // ── FlashcardStudy ──
  // ── QuizStudy ──
  // ── TableAnalysis ──
  // ── Workspace (output type labels) ──
  'output.report': '报告',
  'output.mindmap': '导图',
  'output.podcast': '播客',
  'output.flashcard': '卡片',
  'output.quiz': '测验',
  // ... all remaining strings
```

- [ ] **Step 3: Add matching English translations to en.ts**

Every key added to `zh.ts` must also be added to `en.ts`. Run `npx tsc --noEmit` to verify — TS will error on any key mismatch.

- [ ] **Step 4: Verify build**

Run: `cd frontend_zh && npx tsc --noEmit`
Expected: No errors (all keys match between zh.ts and en.ts)

- [ ] **Step 5: Commit**

```bash
git add frontend_zh/src/i18n/zh.ts frontend_zh/src/i18n/en.ts
git commit -m "feat(i18n): complete all translation keys for remaining components"
```

### Task 6: Migrate authStore.ts to use i18n

**Files:**
- Modify: `frontend_zh/src/stores/authStore.ts`

- [ ] **Step 1: Add a non-hook translation helper and replace hardcoded strings**

Since Zustand stores can't use hooks, access the store directly via `getState()`:

```ts
import { useI18nStore } from '../i18n/store'
import zh from '../i18n/zh'
import en from '../i18n/en'

function getT(key: keyof typeof zh): string {
  const locale = useI18nStore.getState().locale
  return (locale === 'zh' ? zh : en)[key] ?? key
}
```

Replace each occurrence:
- `"认证未配置"` → `getT('authStore.notConfigured')`
- `"登录失败"` → `getT('authStore.loginFailed')`
- `"注册失败"` → `getT('authStore.registerFailed')`
- `"验证失败"` → `getT('authStore.verifyFailed')`
- `"重发失败"` → `getT('authStore.resendFailed')`

- [ ] **Step 2: Commit**

```bash
git add frontend_zh/src/stores/authStore.ts
git commit -m "feat(i18n): migrate authStore error messages to translation keys"
```

### Task 7: Migrate AuthPage.tsx

**Files:**
- Modify: `frontend_zh/src/pages/AuthPage.tsx`

- [ ] **Step 1: Add useT() and replace all Chinese strings**

At top of component: `const t = useT()`

Replace every hardcoded Chinese string with `t('auth.xxx')` calls. Examples:
- `'请输入邮箱和密码。'` → `t('auth.enterEmailPassword')`
- `'请输入正确的邮箱地址。'` → `t('auth.invalidEmail')`
- `'登录'` → `t('auth.login')`
- `'注册'` → `t('auth.register')`
- `` `验证码已发送到 ${pendingEmail}，请查收。` `` → `t('auth.codeSent', { email: pendingEmail })`
- `` `${cooldown}s 后重发` `` → `t('auth.resendCountdown', { seconds: String(cooldown) })`

- [ ] **Step 2: Verify no Chinese strings remain**

Run: `grep -n '[\u4e00-\u9fff]' frontend_zh/src/pages/AuthPage.tsx`
Expected: Only comments (if any), no user-visible strings.

- [ ] **Step 3: Commit**

```bash
git add frontend_zh/src/pages/AuthPage.tsx
git commit -m "feat(i18n): migrate AuthPage to translation keys"
```

### Task 8: Migrate Dashboard.tsx

**Files:**
- Modify: `frontend_zh/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add useT() and replace all Chinese strings**

At top of component: `const t = useT()`

Replace all ~30 hardcoded Chinese strings with `t('dashboard.xxx')` calls.

- [ ] **Step 2: Verify**

Run: `grep -n '[\u4e00-\u9fff]' frontend_zh/src/pages/Dashboard.tsx`
Expected: No user-visible Chinese strings.

- [ ] **Step 3: Commit**

```bash
git add frontend_zh/src/pages/Dashboard.tsx
git commit -m "feat(i18n): migrate Dashboard to translation keys"
```

### Task 9: Add language switcher to ThinkFlowTopBar

**Files:**
- Modify: `frontend_zh/src/components/ThinkFlowTopBar.tsx`

- [ ] **Step 1: Add language toggle button**

```tsx
import { useI18nStore } from '../i18n'
import type { Locale } from '../i18n'

// Inside the component, before the closing </div>:
const { locale, setLocale } = useI18nStore()

// Add after the history button:
<button
  type="button"
  className="thinkflow-topbar-btn"
  onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
>
  {locale === 'zh' ? 'EN' : '中文'}
</button>
```

Also replace `历史` with `t('topbar.history')`.

- [ ] **Step 2: Add language switcher to Dashboard.tsx header**

In the Dashboard header controls area (next to sign out button), add the same toggle:

```tsx
const { locale, setLocale } = useI18nStore()

// Add button in the flex-wrap controls area:
<button
  type="button"
  onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
  className="inline-flex items-center gap-2 rounded-[18px] border border-white/70 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(37,53,81,0.08)] transition hover:-translate-y-0.5"
>
  {locale === 'zh' ? 'EN' : '中文'}
</button>
```

- [ ] **Step 3: Commit**

```bash
git add frontend_zh/src/components/ThinkFlowTopBar.tsx frontend_zh/src/pages/Dashboard.tsx
git commit -m "feat(i18n): add language switcher to TopBar and Dashboard"
```

### Task 10: Migrate ThinkFlow panel components

**Files:**
- Modify: `frontend_zh/src/components/ThinkFlowLeftSidebar.tsx`
- Modify: `frontend_zh/src/components/ThinkFlowCenterPanel.tsx`
- Modify: `frontend_zh/src/components/ThinkFlowRightPanel.tsx`
- Modify: `frontend_zh/src/components/ThinkFlowAddSourceModal.tsx`

- [ ] **Step 1: Migrate each file**

For each file:
1. Import `useT` from `'../i18n'`
2. Add `const t = useT()` at top of component
3. Replace every hardcoded Chinese string with the corresponding `t()` call
4. Verify with grep that no user-visible Chinese remains

- [ ] **Step 2: Commit**

```bash
git add frontend_zh/src/components/ThinkFlowLeftSidebar.tsx \
       frontend_zh/src/components/ThinkFlowCenterPanel.tsx \
       frontend_zh/src/components/ThinkFlowRightPanel.tsx \
       frontend_zh/src/components/ThinkFlowAddSourceModal.tsx
git commit -m "feat(i18n): migrate ThinkFlow panel components to translation keys"
```

### Task 11: Migrate workspace section components

**Files:**
- Modify: `frontend_zh/src/components/DocumentPanelSection.tsx`
- Modify: `frontend_zh/src/components/SummaryPanelSection.tsx`
- Modify: `frontend_zh/src/components/GuidancePanelSection.tsx`
- Modify: `frontend_zh/src/components/OutputWorkspaceSection.tsx`
- Modify: `frontend_zh/src/components/ThinkFlowOutputContextModal.tsx`

- [ ] **Step 1: Migrate each file**

Same pattern: import `useT`, add `const t = useT()`, replace all Chinese strings.

- [ ] **Step 2: Commit**

```bash
git add frontend_zh/src/components/DocumentPanelSection.tsx \
       frontend_zh/src/components/SummaryPanelSection.tsx \
       frontend_zh/src/components/GuidancePanelSection.tsx \
       frontend_zh/src/components/OutputWorkspaceSection.tsx \
       frontend_zh/src/components/ThinkFlowOutputContextModal.tsx
git commit -m "feat(i18n): migrate workspace section components to translation keys"
```

### Task 12: Migrate remaining components

**Files:**
- Modify: `frontend_zh/src/components/ThinkFlowFlashcardStudy.tsx`
- Modify: `frontend_zh/src/components/ThinkFlowQuizStudy.tsx`
- Modify: `frontend_zh/src/components/TableAnalysisPanel.tsx`
- Modify: `frontend_zh/src/components/TableResultCard.tsx`
- Modify: `frontend_zh/src/components/MermaidPreview.tsx`
- Modify: `frontend_zh/src/components/ThinkFlowWorkspace.tsx`

- [ ] **Step 1: Migrate each file**

Same pattern. For `ThinkFlowWorkspace.tsx`, focus on the output type labels array and helper functions that return Chinese strings (e.g., `workspaceItemLabel`, `pushStatusText`).

- [ ] **Step 2: Commit**

```bash
git add frontend_zh/src/components/ThinkFlowFlashcardStudy.tsx \
       frontend_zh/src/components/ThinkFlowQuizStudy.tsx \
       frontend_zh/src/components/TableAnalysisPanel.tsx \
       frontend_zh/src/components/TableResultCard.tsx \
       frontend_zh/src/components/MermaidPreview.tsx \
       frontend_zh/src/components/ThinkFlowWorkspace.tsx
git commit -m "feat(i18n): migrate remaining components to translation keys"
```

### Task 13: Update index.html title

**Files:**
- Modify: `frontend_zh/index.html`

- [ ] **Step 1: Set a neutral title**

The `<title>` tag should be language-neutral or set dynamically. Simplest: set to "ThinkFlow" (brand name, works in both languages).

- [ ] **Step 2: Add locale init script**

Add a small inline script in `<head>` to set `<html lang>` before React hydrates:

```html
<script>
  document.documentElement.lang = localStorage.getItem('locale') || (navigator.language.startsWith('zh') ? 'zh' : 'en')
</script>
```

- [ ] **Step 3: Commit**

```bash
git add frontend_zh/index.html
git commit -m "feat(i18n): set neutral page title and html lang attribute"
```

### Task 14: Full build verification

- [ ] **Step 1: Type check**

Run: `cd frontend_zh && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Build**

Run: `cd frontend_zh && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Final Chinese string audit**

Run: `grep -rn '[\u4e00-\u9fff]' frontend_zh/src/ --include='*.tsx' --include='*.ts' | grep -v '//' | grep -v 'import ' | grep -v 'i18n/'`
Expected: No user-visible Chinese strings outside of `i18n/` directory. Known exceptions that are acceptable: `thinkflow-types.ts` (type definitions), `design-tokens.ts` (comments), `config/api.ts` (comments), `lib/supabase.ts` (comments).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(i18n): address build and audit issues"
```

---

## Chunk 3: Delete frontend_en & Cleanup

### Task 15: Delete frontend_en directory

**Files:**
- Delete: `frontend_en/` (entire directory)

- [ ] **Step 1: Remove the directory**

```bash
git rm -r frontend_en/
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: delete legacy frontend_en (consolidated into frontend_zh with i18n)"
```

### Task 16: Clean up documentation references

**Files:**
- Modify: `docs/development-architecture-guide.md`

- [ ] **Step 1: Find all references to frontend_en**

Run: `grep -rn 'frontend_en' docs/`

- [ ] **Step 2: Update development-architecture-guide.md**

Remove Section 7 (`frontend_en/` description). Update Section 2 project structure to note that `frontend_zh` is the sole frontend with i18n support. Update any cross-references.

- [ ] **Step 3: Commit**

```bash
git add docs/development-architecture-guide.md
git commit -m "docs: remove frontend_en references, update architecture guide for i18n"
```

### Task 17: Final verification

- [ ] **Step 1: Full build**

```bash
cd frontend_zh && npm run build
```
Expected: Success

- [ ] **Step 2: Manual test checklist**

1. Start dev server: `cd frontend_zh && npm run dev -- --port 3001 --host 0.0.0.0`
2. Open Dashboard — verify all strings are in detected language
3. Click language toggle — verify all strings switch instantly
4. Refresh page — verify language persists
5. Navigate to a notebook — verify TopBar toggle works
6. Check all right panel tabs (摘要/梳理文档/产出指导/大纲编排) switch language
7. Open Add Source modal — verify all tabs and messages switch
8. Clear localStorage, refresh — verify browser language detection works
