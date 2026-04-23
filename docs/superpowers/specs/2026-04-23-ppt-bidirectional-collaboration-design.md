# PPT 对话-工作台双向协作设计规格

> 日期: 2026-04-23 | 状态: 待审阅

## 1. 目标

在 ThinkFlow 工作台实现 PPT 大纲的"对话-工作台双向协作"交互模型，同时将 ThinkFlowWorkspace.tsx（5590 行）中的 PPT 逻辑拆分为独立模块，降低维护成本。

## 2. 设计决策汇总

| 维度 | 决策 |
|------|------|
| 交互模型 | 双向协作：对话负责大改（结构调整、风格指令），右侧工作台负责小改（标题微调、要点编辑） |
| 冲突策略 | 智能合并，draft 优先。同一字段两边都改时用 draft 版本 |
| 右侧编辑同步 | 自动保存（debounce 500ms）+ blur 时在对话流插入一条汇总记录 |
| 导航联动 | 单向：对话修改自动导航右侧到受影响页面，反向不联动 |
| 阶段回退 | 允许 pages_ready → outline_ready，已生成页面保留为历史版本 |
| 全局指令管理 | 对话添加/修改，右侧独立折叠区只读展示 |
| 逐页审阅对话 | 对话驱动单页修改，消息内页码标签，底部浮动过滤器 |
| Draft 视觉 | 左侧色条：蓝色=修改页，绿色=新增页 |
| 合并提示 | Toast 通知（3秒自动消失），不打断流程 |
| 编辑记录粒度 | 每次 debounce 保存时一条汇总消息 |
| 整体布局 | 宽松布局：全局指令独立折叠区，带数量徽标 |
| 逐页对话 UI | 底部浮动过滤器 + 消息内页码标签 |
| 阶段回退入口 | 底部次要操作按钮，和"生成 PPT"主按钮同行 |
| 实现策略 | 先拆后建：先拆分 PPT 模块，再在新模块上实现功能 |

## 3. 模块拆分架构

### 3.1 拆分前

```
ThinkFlowWorkspace.tsx  (5590 行，所有逻辑混合)
```

### 3.2 拆分后

```
ThinkFlowWorkspace.tsx          (~3600 行，主壳)
├── 布局骨架 + 面板路由
├── 全局状态（notebook, user, toasts）
├── Chat/Messaging/Document/Source 逻辑（本次不拆）
└── 组合各 PPT 模块的 render

frontend/src/components/
├── usePptOutlineManager.ts     (新，~600 行)
│   ├── PPT 状态：outputs, activeOutputId, activePptSlideIndex, ...
│   ├── PPT 计算值：activePptStage, activePptOutline, activePptDraftPending, ...
│   ├── 大纲 CRUD：createOutline, saveOutline, updateOutlineSection, confirmPptOutline
│   ├── 大纲对话：handlePptOutlineChatMessage, applyPptOutlineDraft
│   ├── 新增：自动保存 + 编辑记录、智能合并、导航联动
│   └── 接口：接收 notebook, effectiveUser, pushToast, setGlobalError
│
├── usePptPageReviewManager.ts  (新，~400 行)
│   ├── 逐页状态：pptPagePrompt, pptPageBusyAction, pptPageStatus
│   ├── 逐页操作：regenerateActivePptPage, selectActivePptPageVersion, confirmActivePptPage
│   ├── 新增：阶段回退 revertToOutlineStage
│   ├── 新增：逐页对话上下文切换
│   └── 接口：接收 activeOutput, setOutputs, pushToast
│
├── PptOutlinePanel.tsx         (新，~450 行)
│   ├── 大纲编辑视图（从 renderPptOutlineWorkspace 提取）
│   ├── 只读大纲预览（从 renderPptLockedOutlinePreview 提取）
│   ├── 新增：全局指令折叠区（独立面板，带数量徽标）
│   ├── 新增：Draft 色条指示器（蓝=修改，绿=新增）
│   └── 接口：outline, draftPending, globalDirectives, onUpdate, onSave
│
├── PptPageReviewPanel.tsx      (新，~350 行)
│   ├── 逐页审阅视图（从 renderPptGenerationReview 提取）
│   ├── 最终结果视图（从 renderPptGeneratedResult 提取）
│   ├── 新增：底部操作栏（← 返回大纲编辑 | 生成 PPT）
│   └── 接口：pageReviews, pageVersions, onRegenerate, onConfirm, onRevert
│
└── pptOutlineMerge.ts          (新，~150 行)
    ├── mergeOutlineWithManualEdits（字段级智能合并）
    ├── buildEditLogFromDiff（编辑记录生成）
    ├── formatEditLogSummary（摘要格式化）
    └── 纯函数，无副作用，易测试
```

### 3.3 模块接口定义

```typescript
// usePptOutlineManager.ts
type PptOutlineManagerDeps = {
  notebook: { id: string; title: string } | null;
  effectiveUser: string;
  email: string;
  pushToast: (msg: string, type?: string) => void;
  setGlobalError: (err: string | null) => void;
  chatMessages: ThinkFlowMessage[];
  setChatMessages: React.Dispatch<...>;
  buildConversationHistoryPayload: () => ConversationHistoryMessage[];
};

type PptOutlineManagerReturn = {
  // 状态
  outputs: ThinkFlowOutput[];
  activeOutputId: string | null;
  activeOutput: ThinkFlowOutput | null;
  activePptStage: PptPipelineStage;
  activePptOutline: OutlineSection[];
  activePptDraftPending: boolean;
  activePptGlobalDirectives: OutlineDirective[];
  activePptSlideIndex: number;
  isPptOutlineChatStage: boolean;
  pptOutlineChatMessages: ThinkFlowMessage[];
  outlineSaving: boolean;
  generatingOutline: boolean;
  manualEditsBuffer: ManualEditLog[];

  // 操作
  setActiveOutputId: (id: string | null) => void;
  setActivePptSlideIndex: (index: number) => void;
  createOutline: (targetType: string, options?: CreateOutlineOptions) => Promise<void>;
  saveOutline: (options?: SaveOutlineOptions) => Promise<void>;
  updateOutlineSection: (index: number, patch: Partial<OutlineSection>) => void;
  confirmPptOutline: () => Promise<void>;
  handlePptOutlineChatMessage: (query: string) => Promise<void>;
  applyPptOutlineDraft: () => Promise<void>;
  refreshOutputs: () => Promise<void>;
  generateOutputById: (outputId: string) => Promise<void>;
  scrollOutlineCardIntoView: (index: number) => void;
};
```

```typescript
// usePptPageReviewManager.ts
type PptPageReviewManagerDeps = {
  activeOutput: ThinkFlowOutput | null;
  setOutputs: React.Dispatch<...>;
  pushToast: (msg: string, type?: string) => void;
  setGlobalError: (err: string | null) => void;
  refreshOutputs: () => Promise<void>;
  insertSystemMessage: (meta: SystemMessageMeta) => void;
};

type PptPageReviewManagerReturn = {
  // 状态
  pptPagePrompt: string;
  pptPageBusyAction: string;
  pptPageStatus: string;
  pageReviewFilter: number | null;
  pageReviewChatContext: PageReviewChatContext | null;

  // 操作
  setPptPagePrompt: (prompt: string) => void;
  setPageReviewFilter: (filter: number | null) => void;
  regenerateActivePptPage: () => Promise<void>;
  selectActivePptPageVersion: (versionId: string) => Promise<void>;
  confirmActivePptPage: () => Promise<void>;
  revertToOutlineStage: () => Promise<void>;
};
```

### 3.4 拆分原则

- 行为不变：拆分是纯重构，不改变任何现有功能的行为
- 逐文件提取：每个新文件提取后立即验证（build + 现有 Playwright 测试）
- 最小接口：模块间通过 deps 对象注入依赖，避免 prop drilling
- 纯函数优先：pptOutlineMerge.ts 全部是纯函数，可独立单元测试

## 4. 新增功能详细设计

### 4.1 右侧编辑自动保存 + 对话记录

**位置：** usePptOutlineManager.ts

**流程：**
```
用户编辑字段 → updateOutlineSection(index, patch)
    → 即时更新本地 state
    → debounce 500ms → diffOutlineChanges(lastSaved, current)
    → 有变化 → saveOutline({ manual_edit_log })
              → 插入 system message（role: 'system', meta.type: 'manual_edit'）
              → 如果有 pending draft → 记录到 manualEditsBuffer
              → 更新 lastSavedOutlineRef
```

**System 消息格式：**
```
手动修改了大纲: 第3页(标题、要点)、第5页(标题)
```

**后端变更：** `PUT /kb/outputs/{id}/outline` 新增可选参数 `manual_edit_log: ManualEditLog[]`，写入 active chat session 的 messages。

### 4.2 Draft 推送智能合并

**位置：** pptOutlineMerge.ts

**算法：**
```typescript
function mergeOutlineWithManualEdits(
  confirmed: OutlineSection[],
  draft: OutlineSection[],
  manualEdits: ManualEditLog[]
): { merged: OutlineSection[]; conflicts: MergeConflict[] }
```

字段级合并规则：
1. draft 修改的字段 → 用 draft 版本
2. 仅 manual 修改的字段 → 保留 manual 版本
3. 两边都改了同一字段 → draft 优先，记录到 conflicts
4. 都没改 → 保持原样

**冲突通知：** Toast（3秒自动消失），内容如"第3页标题的手动修改被AI版本覆盖"。

### 4.3 对话 → 右侧自动导航

**位置：** usePptOutlineManager.ts

**触发时机：** `handlePptOutlineChatMessage` 返回后，根据 `applied_scope` 和 `applied_slide_index` 自动设置 `activePptSlideIndex` 并滚动到对应卡片。

### 4.4 全局指令折叠区

**位置：** PptOutlinePanel.tsx

**视觉：**
- 独立折叠面板，位于大纲卡片列表上方
- 收起时：标题 + 数量徽标（如"全局规则 [2]"）
- 展开时：只读标签列表 + 提示"通过左侧对话添加或修改"
- 样式：浅蓝色边框面板，与大纲卡片视觉区分

### 4.5 Draft 色条指示器

**位置：** PptOutlinePanel.tsx

**视觉：**
- 大纲卡片左侧 3px 色条
- 蓝色（var(--tf-accent)）= AI 修改页
- 绿色（var(--tf-success)）= AI 新增页
- 无色条 = 未修改页
- 删除页：降低透明度 + 红色条

### 4.6 阶段回退

**位置：** usePptPageReviewManager.ts + 后端新端点

**后端：** `POST /kb/outputs/{id}/revert-stage`
- 将 pipeline_stage 回退到 outline_ready
- 已生成页面快照保存到 stage_history
- 清空 page_reviews
- 创建新的 active chat session

**前端：** 底部操作栏左侧"← 返回大纲编辑"按钮，点击弹出确认对话框。

### 4.7 逐页审阅对话模式

**位置：** usePptPageReviewManager.ts + ThinkFlowCenterPanel.tsx

**对话 UI 变化：**
- 标题栏：缩略图 + "逐页审阅 · 第 N 页" + 页面标题
- 消息内：页码标签（P1, P3 等）标识消息所属页面
- 底部：浮动过滤器（当前页 chip 高亮 + "全部"选项）+ 输入框
- 右侧选中页面变化时，对话上下文自动切换

### 4.8 消息类型扩展

```typescript
type OutlineChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  meta?: {
    type: 'manual_edit' | 'stage_change' | 'merge_result' | 'page_action';
    edit_log?: ManualEditLog;
    conflict_report?: MergeConflictReport;
    page_filter?: number;
  };
  created_at: string;
};
```

## 5. 视觉规范

### 5.1 设计系统基础

沿用现有 ThinkFlow 设计系统：
- 主色：#339af0（蓝色 accent）
- 背景：#ffffff / #f8f9fa（primary / secondary）
- 边框：#e9ecef / #dee2e6
- 文字：#212529 / #495057 / #868e96（primary / secondary / muted）
- 间距基础单位：8px（允许 4/6/8/10/12/14/16/18/24px）
- 圆角：6px（按钮）/ 10px（卡片）/ 14px（气泡）
- 过渡：150-180ms ease

### 5.2 System 消息样式

居中显示，视觉权重低于 user/assistant 消息：
- 背景：var(--tf-bg-secondary)
- 边框：1px solid var(--tf-border)
- 圆角：10px
- 字号：12px
- 颜色：var(--tf-muted)
- 图标：14px，颜色按类型区分（编辑=accent，阶段=success，冲突=warning #f59f00）

### 5.3 全局指令折叠区

- 容器：10px margin，10px 圆角，浅蓝色边框 rgba(51,154,240,0.2)
- 标签：12px 圆角 pill，浅蓝色背景 rgba(51,154,240,0.08)
- 数量徽标：10px 字号，accent 色
- 提示文字：11px，muted 色

### 5.4 底部操作栏

- 回退按钮：透明背景，muted 色文字，hover 时显示边框和 secondary 背景
- 主按钮：accent 背景，白色文字，12px 字号，500 字重
- 间距：10px 14px padding，1px solid var(--tf-border) 顶部边框

### 5.5 底部浮动过滤器

- 位置：输入框上方
- 过滤 chip：8px 圆角 pill，11px 字号
- 当前页 chip：accent 边框 + 浅蓝背景 + accent 文字 + 500 字重
- 非当前页 chip：灰色边框 + 白色背景 + muted 文字
- 消息内页码标签：4px 圆角，10px 字号，半透明背景

### 5.6 Toast 通知

- 位置：fixed top-right（16px, 16px）
- 背景：rgba(255,255,255,0.96)
- 边框：warning 色 rgba(245,159,0,0.3)
- 阴影：0 8px 24px rgba(0,0,0,0.08)
- 动画：tf-toast-in 220ms cubic-bezier(0.22,1,0.36,1)
- 自动消失：3秒

## 6. API 变更

| 端点 | 方法 | 变更 | 说明 |
|------|------|------|------|
| `/kb/outputs/{id}/outline` | PUT | 修改 | 新增可选 `manual_edit_log` 参数 |
| `/kb/outputs/{id}/outline-chat/apply` | POST | 修改 | 新增可选 `merge_strategy`, `manual_edits_since_draft` 参数 |
| `/kb/outputs/{id}/revert-stage` | POST | 新增 | 阶段回退，保留历史版本 |

## 7. 实现顺序

### Phase 1: 拆分（纯重构，行为不变）

1. 提取 pptOutlineDiff.ts 中的纯工具函数（已存在，扩展）
2. 提取 usePptOutlineManager.ts（状态 + 大纲 CRUD + 对话）
3. 提取 usePptPageReviewManager.ts（逐页状态 + 操作）
4. 提取 PptOutlinePanel.tsx（大纲渲染）
5. 提取 PptPageReviewPanel.tsx（逐页渲染）
6. 每步后验证：`npm run build` + 现有 Playwright 测试

### Phase 2: P0 功能（核心交互）

7. 右侧编辑自动保存 + 对话 system 消息
8. Draft 色条指示器
9. 对话→右侧自动导航

### Phase 3: P1 功能（协作增强）

10. 全局指令折叠区
11. pptOutlineMerge.ts 智能合并算法
12. Draft 推送智能合并 + Toast 通知

### Phase 4: P2 功能（阶段管理）

13. 后端 revert-stage 端点
14. 前端阶段回退 UI
15. 逐页审阅对话模式 + 底部浮动过滤器

## 8. 测试策略

| 模块 | 测试类型 | 工具 |
|------|---------|------|
| pptOutlineMerge.ts | 单元测试 | vitest |
| usePptOutlineManager.ts | 集成测试（mock API） | vitest + testing-library |
| PptOutlinePanel.tsx | 组件测试 | vitest + testing-library |
| revert-stage 端点 | API 契约测试 | pytest |
| 端到端交互 | E2E | Playwright |

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 拆分引入回归 | 现有功能异常 | 每步 build + Playwright 验证 |
| 225KB 文件拆分遗漏依赖 | 运行时报错 | TypeScript 编译器会捕获 |
| 智能合并边界情况 | 数据丢失 | 纯函数 + 充分单元测试 |
| 逐页对话消息膨胀 | 性能下降 | 虚拟滚动 + 过滤器减少渲染量 |
