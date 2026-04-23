# PPT 生成、对话框与工作台交互逻辑 PRD

> 版本: v0.1 | 日期: 2026-04-23 | 状态: 草稿待讨论

---

## 1. 功能概述

ThinkFlow 工作台的 PPT 生成功能，允许用户基于知识库来源（PDF/PPTX/DOCX/MD/URL）通过"对话式大纲编辑 → 逐页生成 → 逐页审阅"的流水线，生成结构化 PPT。

核心理念：**Chat → Brief → Output**，即用户通过对话澄清需求，系统生成大纲（Brief），确认后生成最终 PPT（Output）。

---

## 2. 用户角色与场景

| 角色 | 典型场景 |
|------|----------|
| 研究者 | 上传论文 PDF，生成学术汇报 PPT |
| 职场用户 | 上传多份文档，生成项目汇报 PPT |
| 学生 | 上传课件/笔记，生成复习演示文稿 |

---

## 3. 流水线阶段（Pipeline Stages）

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ outline_ready│───▶│ pages_ready │───▶│  generated  │
│  大纲编辑    │    │  逐页审阅    │    │  最终产出    │
└─────────────┘    └─────────────┘    └─────────────┘
```

### 3.1 阶段一：outline_ready（大纲编辑）

**触发方式：** 用户在工作台点击"生成 PPT"按钮

**后端流程：**
1. `POST /api/v1/kb/outputs/outline` 创建初始大纲
2. 后端解析来源文件（PDF→mineru markdown, PPTX→解析, DOCX/MD→文本提取）
3. 调用 `kb_page_content` workflow，结合来源内容、梳理文档、产出指导生成 pagecontent
4. 返回结构化大纲（OutlineSection 数组），每个 section 包含：id, pageNum, title, layout_description, key_points, asset_ref

**前端状态：**
- `activeOutput.pipeline_stage = 'outline_ready'`
- `isPptOutlineChatStage = true`
- 右侧面板切换为大纲编辑视图
- 中间面板进入"大纲对话模式"

**用户可执行操作：**
- 直接编辑大纲字段（标题、布局描述、要点、素材引用）
- 添加/删除幻灯片
- 通过对话框发送修改意见（进入大纲对话子流程）

---

### 3.2 大纲对话子流程（Outline Chat）

这是当前交互的核心环节，用户通过自然语言与系统协商大纲修改。

**交互模型：草稿-推送（Draft-Push）**

```
用户发消息 ──▶ 系统生成 draft_outline ──▶ 用户查看 diff ──▶ 推送/继续修改
                    │                           │
                    ▼                           ▼
              draft 暂存区               diffPptOutline() 对比
              (不影响正式大纲)            显示 added/removed/modified
```

**对话请求：** `POST /api/v1/kb/outputs/{id}/outline-chat`

请求参数：
- `message`: 用户消息
- `active_slide_index`: 当前选中的幻灯片索引（用于定位修改范围）
- `conversation_history`: 对话历史

**后端处理：**
1. 加载当前活跃 chat session
2. 构建 feedback prompt，注入上下文快照（来源、梳理文档、产出指导）
3. 调用 `Paper2PPTService.refine_outline()` 进行 LLM 推理
4. 检测变更范围（全局/单页）、变更摘要、意图摘要
5. 合并 global directives（全局指令，如"所有页面使用深色背景"）

**返回数据：**
- `assistant_message`: 助手回复
- `applied_scope`: 变更范围（'global' | 'slide'）
- `applied_slide_index`: 受影响的幻灯片索引
- `change_summary`: 变更摘要
- `intent_summary`: 意图解析结果（mode, global_directives, slide_targets）

**前端 Diff 展示：**
- `diffPptOutline(confirmedOutline, draftOutline)` 对比正式大纲与草稿
- 展示 added（新增页）、removed（删除页）、modified（修改页）
- modified 细分字段：title, layout, points, asset, position
- `diffPptGlobalDirectives()` 对比全局指令变更

**推送操作：** `POST /api/v1/kb/outputs/{id}/outline-chat/apply`
- 将 draft_outline 覆盖到正式 outline
- 将 draft_global_directives 覆盖到 outline_global_directives
- 当前 session 标记为 "applied"，创建新的 active session
- 用户可继续发起新一轮对话

**Chat Session 管理：**
- 每个 output 维护 `outline_chat_sessions` 数组
- 每个 session: `{id, status: active|applied|archived, messages, draft_outline, draft_global_directives, has_pending_changes}`
- 同一时间只有一个 active session
- apply 后旧 session 归档，新建 active session

---

### 3.3 阶段二：pages_ready（逐页审阅）

**触发方式：** 用户确认大纲，调用 `saveOutline({ pipelineStage: 'pages_ready' })`

**后端流程：**
1. `POST /api/v1/kb/outputs/{id}/generate` 生成 PPT
2. 调用 `paper2ppt_parallel_consistent_style` workflow
3. 逐页生成幻灯片图片 → `ppt_pages/page_*.png`
4. 导出 PDF 和 PPTX 文件

**用户可执行操作：**

| 操作 | API | 说明 |
|------|-----|------|
| 重新生成单页 | `POST .../pages/{index}/regenerate` | 输入修改提示词，生成新版本 |
| 选择页面版本 | `POST .../pages/{index}/versions/{versionId}/select` | 从历史版本中选择 |
| 确认页面 | `POST .../pages/{index}/confirm` | 标记页面为已确认 |

**版本管理：**
- 每次重新生成创建新版本（page_N_vX.png）
- `page_versions` 数组记录所有版本，含 preview_path, slide_snapshot
- `page_reviews` 数组记录每页确认状态

---

### 3.4 阶段三：generated（最终产出）

**触发方式：** 所有页面审阅完成后，用户点击最终生成

**产出物：**
- `paper2ppt.pdf` — PDF 版本
- `paper2ppt_editable.pptx` — 可编辑 PPTX 版本
- 提供下载链接

---

## 4. 前端工作台交互布局

```
┌──────────────────────────────────────────────────────────┐
│                     ThinkFlowTopBar                       │
├────────────┬─────────────────────────┬───────────────────┤
│            │                         │                   │
│  Left      │    CenterPanel          │   RightPanel      │
│  Sidebar   │                         │                   │
│            │  outline_ready 阶段:     │  大纲编辑器       │
│  来源列表   │  - 大纲对话模式          │  - 幻灯片列表     │
│  梳理文档   │  - 显示对话消息          │  - 字段编辑       │
│  产出指导   │  - 显示 diff 提示        │  - 添加/删除页    │
│            │                         │                   │
│            │  pages_ready 阶段:       │  页面预览         │
│            │  - 页面预览图            │  - 版本选择       │
│            │  - 重新生成输入框        │  - 确认按钮       │
│            │                         │                   │
├────────────┴─────────────────────────┴───────────────────┤
│                     状态栏 / 操作按钮                      │
└──────────────────────────────────────────────────────────┘
```

**CenterPanel 在大纲对话模式下的特殊行为：**
- 顶部显示提示："当前消息会综合来源、梳理文档、产出指导和当前 notebook 对话，先整理这份 PPT 的候选大纲；只有点击'推送改动'后才会覆盖正式大纲"
- 隐藏消息操作按钮（push, select）
- 对话输入框发送消息走 `handlePptOutlineChatMessage` 而非普通 chat

---

## 5. 数据模型

### 5.1 OutlineSection（大纲条目）

```typescript
{
  id: string;
  pageNum?: number;
  title: string;
  layout_description?: string;
  key_points?: string[];
  bullets?: string[];
  asset_ref?: string | null;
  summary?: string;
  ppt_img_path?: string;
  generated_img_path?: string;
}
```

### 5.2 OutlineChatSession（对话会话）

```typescript
{
  id: string;
  status: 'active' | 'applied' | 'archived';
  messages: { id, role: 'user'|'assistant', content, created_at }[];
  draft_outline?: OutlineSection[];
  draft_global_directives?: OutlineDirective[];
  intent_summary?: { mode, global_directives, slide_targets };
  has_pending_changes: boolean;
}
```

### 5.3 OutlineDirective（全局指令）

```typescript
{
  id: string;
  scope: 'global' | 'slide';
  type?: string;
  label: string;
  instruction?: string;
  action: 'set' | 'remove';
  value?: string;
  page_num?: number | null;
}
```

---

## 6. API 端点汇总

| 端点 | 方法 | 阶段 | 用途 |
|------|------|------|------|
| `/kb/outputs/outline` | POST | → outline_ready | 创建初始大纲 |
| `/kb/outputs/{id}/outline` | PUT | outline_ready | 保存/确认大纲 |
| `/kb/outputs/{id}/outline-chat` | POST | outline_ready | 大纲对话 |
| `/kb/outputs/{id}/outline-chat/apply` | POST | outline_ready | 推送草稿到正式大纲 |
| `/kb/outputs/{id}/outline-refine` | POST | outline_ready | 直接精炼大纲（非对话） |
| `/kb/outputs/{id}/generate` | POST | → pages_ready/generated | 生成 PPT |
| `/kb/outputs/{id}/pages/{i}/regenerate` | POST | pages_ready | 重新生成单页 |
| `/kb/outputs/{id}/pages/{i}/confirm` | POST | pages_ready | 确认单页 |
| `/kb/outputs/{id}/pages/{i}/versions/{v}/select` | POST | pages_ready | 选择页面版本 |

---

## 7. 存储结构

```
workspace/outputs/
├── items.json                          # 所有 output 的 manifest
└── {output_id}/
    └── ppt_pipeline/
        ├── input/auto/                 # mineru 解析缓存
        ├── ppt_pages/page_*.png        # 生成的幻灯片图片
        ├── paper2ppt.pdf               # PDF 导出
        ├── paper2ppt_editable.pptx     # PPTX 导出
        └── page_versions/page_NNN/     # 页面历史版本
```

---

## 8. 当前已知问题与待讨论点

### 8.1 交互层面

1. **大纲对话的"推送"心智模型**：用户需要理解"草稿→推送"两步操作，是否直觉？是否需要自动推送选项？
2. **多轮对话累积**：连续多轮对话修改大纲，每轮都基于上一轮 draft，但用户可能想回退到某一轮的状态
3. **active_slide_index 的作用**：对话时传入当前选中幻灯片，后端用于定位修改范围，但用户可能不清楚"选中哪页"会影响 AI 的修改行为
4. **大纲编辑 vs 对话修改的冲突**：用户可以同时直接编辑大纲字段和通过对话修改，两者如何协调？

### 8.2 流水线层面

5. **outline_ready → pages_ready 的过渡**：确认大纲后直接生成所有页面，无法选择性生成部分页面
6. **逐页审阅的效率**：大量页面时逐页确认体验较重
7. **版本管理的深度**：页面版本只记录图片快照，不记录生成时的 prompt/参数，难以复现

### 8.3 数据层面

8. **Legacy 端点共存**：`/paper2ppt/*` 旧端点与 `/kb/outputs/*` 新端点并存，`Paper2PPTService` 被两套路由共用
9. **Chat Session 膨胀**：每次 apply 创建新 session，长期使用后 sessions 数组可能很大
10. **Global Directives 的可见性**：全局指令（如"深色背景"）在 UI 上如何展示和管理不够清晰

### 8.4 测试覆盖

11. **前端零测试**：整个 PPT 交互流程无任何前端测试
12. **后端部分覆盖**：`test_source_first_output.py` 覆盖了 outline 创建和 chat，但 page regeneration/version 逻辑未覆盖
13. **Workflow 未测试**：`paper2ppt_parallel_consistent_style` 等核心 workflow 无单元测试

---

## 9. 附录：状态机完整视图

```
                    createOutline()
                         │
                         ▼
              ┌─── outline_ready ◀──┐
              │    (大纲对话模式)     │
              │         │           │
              │    outline-chat     │
              │    (生成 draft)      │
              │         │           │
              │    apply draft ─────┘  (可多轮)
              │         │
              │    confirmPptOutline()
              │         │
              ▼         ▼
           pages_ready
              │
              ├── regenerate page (可多次)
              ├── select version
              ├── confirm page
              │
              │    generateOutputById()
              │         │
              ▼         ▼
           generated
              │
              └── 下载 PDF / PPTX
```
