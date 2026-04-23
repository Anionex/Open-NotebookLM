# PPT 对话-工作台双向协作：技术设计文档

> 版本: v0.1 | 日期: 2026-04-23 | 基于 PRD: ppt-chat-workspace-interaction-prd.md

---

## 1. 变更范围

### 1.1 前端

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `ThinkFlowWorkspace.tsx` | 修改 | 双向同步逻辑、合并策略、阶段回退、逐页对话模式 |
| `ThinkFlowCenterPanel.tsx` | 修改 | system 消息渲染、页面过滤器、逐页审阅对话 UI |
| `ThinkFlowWorkspace.css` | 修改 | 色条指示器、draft 预览样式、全局指令标签、toast |
| `thinkflow-types.ts` | 修改 | ManualEditLog、MergeConflictReport、system message 类型 |
| `pptOutlineDiff.ts` | 修改 | 字段级合并算法 |

### 1.2 后端

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `output_v2_service.py` | 修改 | 手动编辑记录、合并策略、阶段回退 |
| `kb_outputs_v2.py` | 修改 | revert-stage 端点、outline save 支持 edit_log |

### 1.3 新增端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /kb/outputs/{id}/revert-stage` | POST | 阶段回退，保留历史版本 |

---

## 2. 前端状态设计

### 2.1 新增 / 修改状态

```typescript
// ThinkFlowWorkspace.tsx 新增状态

// 手动编辑追踪：记录 draft 期间右侧的手动修改
const [manualEditsBuffer, setManualEditsBuffer] = useState<ManualEditLog[]>([]);

// 逐页审阅：当前页面过滤器
const [pageReviewFilter, setPageReviewFilter] = useState<number | null>(null);

// 保存 debounce timer ref
const outlineSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// 上一次保存的 outline 快照（用于生成 edit log diff）
const lastSavedOutlineRef = useRef<OutlineSection[] | null>(null);
```

### 2.2 类型定义变更

```typescript
// thinkflow-types.ts

type ManualEditLog = {
  page_index: number;
  fields: ('title' | 'layout_description' | 'key_points' | 'asset_ref')[];
  summary: string;       // "第3页(标题、要点)"
  timestamp: string;
};

type MergeConflictReport = {
  conflicts: {
    page_index: number;
    field: string;
    draft_value: string;
    manual_value: string;
  }[];
  auto_merged_count: number;
};

// OutlineChatMessage 扩展 role: 'system'
type OutlineChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  meta?: {
    type: 'manual_edit' | 'stage_change' | 'merge_result' | 'page_action';
    edit_log?: ManualEditLog;
    conflict_report?: MergeConflictReport;
    page_filter?: number;  // 逐页审阅时关联的页码
  };
  created_at: string;
};
```

---

## 3. 核心交互实现

### 3.1 右侧编辑 → 自动保存 + 对话记录

```
用户编辑字段
    │
    ▼
updateOutlineSection(index, patch)  ← 即时更新本地 state
    │
    ▼
debounce 500ms
    │
    ▼
diffOutlineChanges(lastSavedOutlineRef, currentOutline)
    │
    ├── 无变化 → 跳过
    │
    └── 有变化 →
         ├── saveOutline({ manual_edit_log: editLog })  ← 持久化
         ├── 插入 system message 到对话流
         │     content: "手动修改了大纲: 第3页(标题、要点)"
         │     meta.type: 'manual_edit'
         │
         ├── 如果有 pending draft → 记录到 manualEditsBuffer
         │
         └── 更新 lastSavedOutlineRef
```

**关键函数：**

```typescript
const debouncedSaveOutline = useCallback(() => {
  if (outlineSaveTimerRef.current) clearTimeout(outlineSaveTimerRef.current);
  outlineSaveTimerRef.current = setTimeout(async () => {
    const prev = lastSavedOutlineRef.current;
    const curr = activeOutput?.outline;
    if (!prev || !curr) return;

    const editLog = buildEditLogFromDiff(prev, curr);
    if (editLog.length === 0) return;

    await saveOutline({ manual_edit_log: editLog });
    insertSystemMessage({
      type: 'manual_edit',
      content: formatEditLogSummary(editLog),
      edit_log: editLog,
    });

    if (activePptDraftPending) {
      setManualEditsBuffer(buf => [...buf, ...editLog]);
    }
    lastSavedOutlineRef.current = structuredClone(curr);
  }, 500);
}, [activeOutput?.outline, activePptDraftPending]);
```

### 3.2 Draft 推送时的智能合并

```
用户点击 "推送这版"
    │
    ▼
mergeOutlines(confirmedOutline, draftOutline, manualEditsBuffer)
    │
    ▼
字段级合并：
    ├── draft 修改的字段 → draft 版本
    ├── 仅 manual 修改的字段 → manual 版本
    ├── 两边都改了 → draft 优先，记录冲突
    └── 都没改 → 保持原样
    │
    ▼
applyPptOutlineDraft({ merge_strategy: 'smart' })
    │
    ├── 有冲突 → 显示 toast: "第3页标题的手动修改被AI版本覆盖"
    └── 清空 manualEditsBuffer
```

**合并算法（pptOutlineDiff.ts 新增）：**

```typescript
function mergeOutlineWithManualEdits(
  confirmed: OutlineSection[],
  draft: OutlineSection[],
  manualEdits: ManualEditLog[]
): { merged: OutlineSection[]; conflicts: MergeConflictReport } {
  const merged = structuredClone(draft);
  const conflicts: MergeConflictReport['conflicts'] = [];

  // PLACEHOLDER_MERGE_IMPL
}
```

### 3.3 对话 → 右侧自动导航

```typescript
// handlePptOutlineChatMessage 返回后
const handleOutlineChatResponse = (response) => {
  const { applied_slide_index, applied_scope } = response;

  if (applied_scope === 'slide' && applied_slide_index != null) {
    setActivePptSlideIndex(applied_slide_index);
    scrollOutlineCardIntoView(applied_slide_index);
  } else if (applied_scope === 'global') {
    // 全局修改：跳到第一个被修改的页
    const firstModified = findFirstModifiedPage(
      activeOutput?.outline, response.output.outline_chat_draft_outline
    );
    if (firstModified != null) {
      setActivePptSlideIndex(firstModified);
      scrollOutlineCardIntoView(firstModified);
    }
  }
};
```

### 3.4 阶段回退

```typescript
const revertToOutlineStage = async () => {
  const res = await apiFetch(
    `/api/v1/kb/outputs/${activeOutput.id}/revert-stage`,
    { method: 'POST', body: JSON.stringify({ target_stage: 'outline_ready' }) }
  );
  if (res.ok) {
    refreshOutputs();
    insertSystemMessage({
      type: 'stage_change',
      content: '已返回大纲编辑阶段，之前生成的页面已保留为历史版本',
    });
  }
};
```

### 3.5 逐页审阅对话模式

```typescript
// 逐页审阅时，对话上下文跟随选中页面
const pageReviewChatContext = useMemo(() => {
  if (activePptStage !== 'pages_ready') return null;
  return {
    title: `逐页审阅 · 第 ${activePptSlideIndex + 1} 页`,
    placeholder: '描述这页需要怎么调整...',
    pageIndex: activePptSlideIndex,
  };
}, [activePptStage, activePptSlideIndex]);

// 对话消息过滤
const filteredMessages = useMemo(() => {
  if (pageReviewFilter == null) return chatMessages;
  return chatMessages.filter(m =>
    m.meta?.page_filter === pageReviewFilter
    || m.role === 'system'
  );
}, [chatMessages, pageReviewFilter]);
```

---

## 4. 视觉设计规范

### 4.1 设计原则

基于当前 ThinkFlow 设计系统（蓝色主调 #339af0、暖灰背景、8px 基础间距），遵循以下原则：

- **状态可感知**：通过结构变化（色条、标签）而非冗余文字传达状态
- **最小噪声**：system 消息视觉权重低于 user/assistant 消息
- **一致性**：复用现有 diff chip 色彩体系（蓝=修改、绿=新增、红=删除）

### 4.2 Draft 预览色条

右侧大纲卡片左侧添加 3px 色条指示 draft 状态：

```css
/* 大纲卡片色条 */
.thinkflow-ppt-outline-card {
  position: relative;
}

.thinkflow-ppt-outline-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: transparent;
  transition: background 180ms ease;
}

/* AI 修改页：蓝色条 → 复用 accent */
.thinkflow-ppt-outline-card.is-draft-modified::before {
  background: var(--tf-accent);
}

/* AI 新增页：绿色条 → 复用 success */
.thinkflow-ppt-outline-card.is-draft-added::before {
  background: var(--tf-success);
}

/* AI 删除页：红色条 + 降低透明度 */
.thinkflow-ppt-outline-card.is-draft-removed {
  opacity: 0.5;
}
.thinkflow-ppt-outline-card.is-draft-removed::before {
  background: #e03131;
}
```

视觉效果：

```
右侧大纲卡片列表：

 ┃ 第1页：封面              ← 蓝色条 = AI 修改
   第2页：目录              ← 无色条 = 未修改
 ┃ 第3页：数据洞察          ← 蓝色条 = AI 修改
   第4页：方案对比          ← 无色条 = 未修改
 ┃ 第8页：行动计划  [新增]   ← 绿色条 = AI 新增
```

### 4.3 全局指令只读标签

右侧大纲顶部，大纲卡片列表上方：

```css
.thinkflow-global-directives-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--tf-border);
  background: var(--tf-bg-secondary);
}

.thinkflow-directive-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--tf-subtle);
  background: rgba(51, 154, 240, 0.08);
  border: 1px solid rgba(51, 154, 240, 0.16);
  user-select: none;
}

.thinkflow-directive-tag .tag-icon {
  width: 12px;
  height: 12px;
  color: var(--tf-muted);
}

.thinkflow-directives-hint {
  font-size: 11px;
  color: var(--tf-muted);
  margin-top: 4px;
}
```

布局：

```
┌──────────────────────────────────────────┐
│ 全局规则                                  │
│ [⚙ 整体风格: 商务汇报] [🎨 配色: 深蓝]    │
│ 通过左侧对话添加或修改                     │
├──────────────────────────────────────────┤
│ 大纲卡片列表...                           │
```

### 4.4 System 消息样式

对话流中的 system 消息（手动编辑记录、阶段切换等）视觉权重低于 user/assistant：

```css
.thinkflow-message-row.system {
  justify-content: center;
  padding: 4px 0;
}

.thinkflow-system-message {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 10px;
  font-size: 12px;
  color: var(--tf-muted);
  background: var(--tf-bg-secondary);
  border: 1px solid var(--tf-border);
  max-width: 80%;
}

.thinkflow-system-message .system-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--tf-muted);
}

/* 手动编辑记录：铅笔图标 */
.thinkflow-system-message.is-manual-edit .system-icon {
  color: var(--tf-accent);
}

/* 阶段切换：箭头图标 */
.thinkflow-system-message.is-stage-change .system-icon {
  color: var(--tf-success);
}

/* 合并冲突：警告图标 */
.thinkflow-system-message.is-merge-conflict .system-icon {
  color: #f59f00;
}
```

视觉效果（对话流中）：

```
┌──────────────────────────────────────┐
│                                      │
│ 👤 把整体风格改成商务汇报              │
│                                      │
│ 🤖 已生成候选修改...                  │
│    [推送这版] [继续修改]              │
│                                      │
│      ─── ✏ 手动修改: 第5页(标题) ───  │  ← system 消息，居中，小字
│                                      │
│ 👤 第3页加个数据图表                   │
│                                      │
└──────────────────────────────────────┘
```

### 4.5 Toast 通知

合并冲突时的轻量 toast，复用现有 `tf-toast-in` 动画：

```css
.thinkflow-merge-toast {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(245, 159, 0, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  font-size: 13px;
  color: var(--tf-text);
  max-width: 360px;
  animation: tf-toast-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.thinkflow-merge-toast .toast-icon {
  width: 16px;
  height: 16px;
  color: #f59f00;
  flex-shrink: 0;
  margin-top: 1px;
}

.thinkflow-merge-toast .toast-detail {
  font-size: 12px;
  color: var(--tf-muted);
  margin-top: 2px;
}
```

### 4.6 逐页审阅对话 UI

对话标题区域显示当前页码 + 缩略图，底部添加页面过滤器：

```css
/* 逐页审阅对话标题 */
.thinkflow-page-review-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--tf-border);
  background: var(--tf-bg-secondary);
}

.thinkflow-page-review-thumb {
  width: 48px;
  height: 27px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid var(--tf-border);
}

.thinkflow-page-review-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tf-text);
}

/* 页面过滤器 */
.thinkflow-page-filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-top: 1px solid var(--tf-border);
  background: var(--tf-bg-secondary);
  font-size: 12px;
}

.thinkflow-page-filter-chip {
  padding: 2px 10px;
  border-radius: 10px;
  border: 1px solid var(--tf-border);
  background: var(--tf-bg);
  color: var(--tf-subtle);
  cursor: pointer;
  transition: all 150ms ease;
}

.thinkflow-page-filter-chip:hover {
  border-color: var(--tf-accent);
  color: var(--tf-accent);
}

.thinkflow-page-filter-chip.is-active {
  background: var(--tf-accent-soft);
  border-color: var(--tf-accent);
  color: var(--tf-accent);
  font-weight: 500;
}
```

### 4.7 阶段回退按钮

pages_ready 阶段右侧顶部添加回退入口，低优先级视觉：

```css
.thinkflow-revert-stage-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--tf-muted);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 150ms ease;
}

.thinkflow-revert-stage-btn:hover {
  color: var(--tf-subtle);
  background: var(--tf-bg-secondary);
  border-color: var(--tf-border);
}
```

---

## 5. 后端变更

### 5.1 outline save 支持 edit_log

```python
# kb_outputs_v2.py
class SaveOutlineRequest(BaseModel):
    # ... 现有字段
    manual_edit_log: Optional[List[Dict[str, Any]]] = None

# output_v2_service.py — save_outline 方法
if request.manual_edit_log:
    active_session = self._get_active_chat_session(item)
    if active_session:
        for log_entry in request.manual_edit_log:
            active_session["messages"].append({
                "id": uuid4().hex,
                "role": "system",
                "content": log_entry.get("summary", ""),
                "meta": {"type": "manual_edit", "edit_log": log_entry},
                "created_at": self._now(),
            })
```

### 5.2 阶段回退端点

```python
# kb_outputs_v2.py
class RevertStageRequest(BaseModel):
    notebook_id: str
    notebook_title: str = ""
    user_id: str = "local"
    email: Optional[str] = None
    target_stage: str  # "outline_ready"

@router.post("/{output_id}/revert-stage")
async def revert_stage(output_id: str, request: RevertStageRequest):
    output = await service.revert_stage(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        email=(request.email or request.user_id or "local").strip() or "local",
        output_id=output_id,
        target_stage=request.target_stage,
    )
    return {"success": True, "output": output}
```

```python
# output_v2_service.py
async def revert_stage(self, *, notebook_id, notebook_title, user_id, email,
                       output_id, target_stage):
    manifest_path = self._manifest_path(notebook_id, notebook_title, user_id)
    manifest = self._read_manifest(manifest_path)
    index, item = self._find_output(manifest, output_id)

    current_stage = item.get("pipeline_stage", "outline_ready")
    if target_stage == "outline_ready" and current_stage in ("pages_ready", "generated"):
        # 保留已生成页面为历史版本
        if item.get("page_reviews"):
            snapshot = {
                "id": uuid4().hex,
                "stage": current_stage,
                "page_reviews": item["page_reviews"],
                "result": item.get("result"),
                "reverted_at": self._now(),
            }
            item.setdefault("stage_history", []).append(snapshot)

        item["pipeline_stage"] = "outline_ready"
        item["status"] = "outline_ready"
        item["page_reviews"] = []
        item["updated_at"] = self._now()

        # 创建新的 active chat session
        self._ensure_active_chat_session(item)

        manifest[index] = item
        self._write_manifest(manifest_path, manifest)

    return item
```

### 5.3 outline-chat/apply 支持合并策略

```python
# kb_outputs_v2.py
class OutlineChatApplyRequest(BaseModel):
    # ... 现有字段
    merge_strategy: str = "smart"  # "smart" | "draft_only"
    manual_edits_since_draft: Optional[List[Dict[str, Any]]] = None
```

```python
# output_v2_service.py — apply_outline_chat 方法增加合并逻辑
def _merge_outline_smart(self, draft, confirmed, manual_edits):
    """字段级智能合并：draft 优先，保留 manual 对 draft 未涉及字段的修改"""
    merged = []
    conflicts = []
    # ... 合并逻辑
    return merged, conflicts
```

---

## 6. 实现优先级

| 优先级 | 功能 | 复杂度 | 依赖 |
|--------|------|--------|------|
| P0 | 右侧编辑自动保存 + 对话 system 消息 | 中 | 无 |
| P0 | Draft 色条指示器 | 低 | 无 |
| P0 | 对话→右侧自动导航 | 低 | 无 |
| P1 | 全局指令只读标签展示 | 低 | 无 |
| P1 | Draft 推送智能合并 | 高 | P0 自动保存 |
| P1 | 合并冲突 toast 通知 | 低 | P1 智能合并 |
| P2 | 阶段回退（pages_ready → outline_ready） | 中 | 后端新端点 |
| P2 | 逐页审阅对话模式 | 中 | 无 |
| P2 | 逐页对话页面过滤器 | 低 | P2 逐页对话 |
| P3 | generated → pages_ready 回退 | 低 | P2 阶段回退 |
