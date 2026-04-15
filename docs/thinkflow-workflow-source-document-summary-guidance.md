# ThinkFlow 当前 Workflow 中「来源 / 梳理文档 / 摘要 / 产出指导」的使用方式与 Prompt 注入分析

## 1. 结论先行

这四类对象在当前代码里的定位并不对等。

- `来源` 是最底层事实输入，主要进入 `/api/v1/kb/chat` 的智能问答链，以及 PPT 产出链的原始内容解析流程。在 PPT 里它仍然是第一优先级事实来源；在非 PPT 产出里，它大多只是上游材料，通常不会被下游工作流单独再次感知。
- `梳理文档` 是当前 ThinkFlow 中最核心的中间产物。前端文案已经明确说明它会作为后续 PPT / 报告 / 导图的直接输入，代码上也确实如此，尤其是在非 PPT 产出中，它几乎就是主输入。参考 [DocumentPanelSection.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/DocumentPanelSection.tsx#L116)。
- `摘要` 更像“AI 帮你记的阅读笔记”或“阶段性理解卡片”。它会被生成、保存、展示和编辑，但在当前 outputs-v2 正式产出链路里，基本没有被直接注入到 prompt。参考 [SummaryPanelSection.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/SummaryPanelSection.tsx#L87)。
- `产出指导` 是高权重 brief。它在 UI 上就是“高权重、只读”的定位，后端也会把选中的 guidance items 扁平化为 `guidance_snapshot_text`，在 PPT 大纲生成和非 PPT 的生成输入里直接参与。参考 [GuidancePanelSection.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/GuidancePanelSection.tsx#L68) 和 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L214)。

如果只用一句话概括当前实现：

- `PPT`：`来源` 是事实主源，`梳理文档/参考文档/产出指导` 会被拼成 `kb_query` 注入到大纲与图片筛选 prompt 中。
- `非 PPT`：当前 outputs-v2 主要消费 `梳理文档 + 产出指导`，`来源` 往往只是被用来先生成一份梳理文档；`摘要` 基本不直接参与正式产出。

---

## 2. 四类对象在产品里的职责定义

### 2.1 来源

来源对应的是用户在 notebook 中选择的文件或 URL，即 `selectedFilePaths` / `selectedSourceNames`。前端在聊天、自动生成摘要、自动生成产出指导、自动基于来源生成梳理文档、生成 PPT 大纲时都会把它们带入请求。关键入口在 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2266) 和 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2718)。

来源的几个特点：

- 它是最原始的事实来源。
- 在 `/api/v1/kb/chat` 里，它会进入智能问答工作流，经过文件解析、RAG 检索、来源编号映射等步骤后参与回答。
- 在 PPT 输出链里，它会继续以“原始来源解析内容”的身份进入大纲 prompt。
- 在非 PPT 输出链里，当前并没有统一的“把原始来源再次单独传给下游工作流”的机制。

### 2.2 梳理文档

产品文案已经把定位写得很清楚：

- “右侧是你确认过的梳理文档，会作为后续 PPT / 报告 / 导图的直接输入。” 参考 [DocumentPanelSection.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/DocumentPanelSection.tsx#L116)。

实现层面上，梳理文档是一个持久化 Markdown 文档，支持：

- 手工编辑与保存。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2242)。
- 把聊天内容 push 进去。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2409)。
- 通过 `append / organize / merge` 三种模式沉淀内容。对应后端逻辑在 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L537)。
- 版本管理与恢复。参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L108) 和 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L697)。

从系统角色看，梳理文档是 downstream output 的主工作底稿。

### 2.3 摘要

摘要区的 UI 定义是：

- “摘要不是默认生成的，它更像 AI 帮你记下来的阅读笔记。”
- “这是 AI 笔记区，用来沉淀你当前理解和后续可追问点。”

参考 [SummaryPanelSection.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/SummaryPanelSection.tsx#L87) 和 [SummaryPanelSection.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/SummaryPanelSection.tsx#L110)。

因此摘要当前更像：

- 对某轮问答的理解卡片。
- 后续追问或回看时的便签。
- 一个可编辑 workspace item。

它不是 outputs-v2 产出的正式结构化输入对象。

### 2.4 产出指导

产出指导区的 UI 定义是：

- “产出指导不是聊天副本，而是你从对话里抽出来的高权重 brief。”
- “它会在你生成大纲和正式产出时强约束参与。”
- “这是只读的高权重上下文，不允许直接编辑；需要改动时请重新从对话沉淀。”

参考 [GuidancePanelSection.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/GuidancePanelSection.tsx#L68)。

实现上，产出指导的角色非常明确：

- 前端允许多选 guidance item。
- 后端会把这些 item 聚合为 `guidance_snapshot_text`。
- 这个聚合文本会参与 PPT 大纲 prompt，也会参与非 PPT 的生成输入文件。

因此，`产出指导` 是当前最接近“用户意图约束层”的正式对象。

---

## 3. 从对话到工作区对象的生成链路

### 3.1 梳理文档的沉淀链路

前端把选中的消息或文本 push 到 `document` 时，调用的是：

- `/api/v1/kb/documents/{id}/push`，参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2418)。

后端 `DocumentService.push_document()` 的行为分三类：

- `append` 或普通追加：直接把文本块按结构拼进 Markdown。参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L598)。
- `organize`：调用 `_organize_with_ai()`，由 LLM 先把对话片段整理成更适合写入文档的结构化正文，再写入。参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L568) 和 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L304)。
- `merge`：调用 `_merge_with_ai()`，把新增信息融合进现有全文，并输出完整新文档。参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L585) 和 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L340)。

这条链路里，“整理要求 / prompt” 是有保留语义的：

- 如果只是普通 compose block，`> 整理要求: ...` 会被写进文档块头。参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L173)。
- 如果走 AI organize / merge，`prompt` 也会进入 `_organize_with_ai()` / `_merge_with_ai()` 的 user prompt。参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L323) 和 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L360)。

也就是说，梳理文档不仅有内容，还有较完整的“这段内容怎么来的、按什么要求整理的”的版本痕迹。

### 3.2 摘要 / 产出指导的沉淀链路

这两类对象不走文档 push，而是先生成 draft，再 capture 成 workspace item。

前端流程如下：

1. 调 `generateWorkspaceDraft()` 先用 `/api/v1/kb/chat` 生成一个 Markdown 草稿。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2446) 和 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2821)。
2. 再调 `/api/v1/kb/workspace-items/capture` 保存。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2454)。

这里有一个关键实现细节：

- 保存时前端传的是 `prompt: ''`，也就是原始“整理要求”不会作为独立字段继续保留下去。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2465)。

后端 `ThinkFlowWorkspaceService.capture_item()` 的行为是把文本块按 item type 包装后追加：

- `summary` 会写成“来源 + 摘要要求 + 对话沉淀”结构。
- `guidance` 会写成“来源 + 产出要求 + 参考对话”结构。

参考 [thinkflow_workspace_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/thinkflow_workspace_service.py#L91) 和 [thinkflow_workspace_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/thinkflow_workspace_service.py#L284)。

但由于前端 capture 时传入的 `prompt` 已经被清空，最终落库看到的通常是：

- `text_items` 里已经包含“AI 生成好的摘要 / 产出指导 Markdown”
- 原始 prompt 不再作为单独结构被保存

这意味着摘要和产出指导的“生成要求”更多是 baked into content，而不是 preserved as metadata。

---

## 4. `/api/v1/kb/chat` 里，来源是怎么进入 prompt 的

无论是普通聊天，还是自动生成摘要 / 产出指导 / 来源梳理文档，核心都依赖 `/api/v1/kb/chat` 或 `/api/v1/kb/chat/stream`。

其底层工作流是 `intelligent_qa`：

- prompt 组装在 `build_intelligent_qa_prompt()`。参考 [wf_intelligent_qa.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_intelligent_qa.py#L416)。
- 最终模板是 `QaAgentPrompts.final_qa_prompt`。参考 [pt_qa_agent_repo.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/promptstemplates/resources/pt_qa_agent_repo.py#L43)。

其结构大致是：

- `User Question: {query}`
- `File Analyses: {file_analyses}`
- `Conversation History: {history}`

其中 `file_analyses` 实际上并不只是“分析摘要”，还会拼入：

- 检索回来的 chunk 内容。
- 文件分析结果。
- `Sources:` 编号映射。

参考 [wf_intelligent_qa.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_intelligent_qa.py#L388) 到 [wf_intelligent_qa.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_intelligent_qa.py#L432)。

所以在 `/kb/chat` 这条链路中，`来源` 是通过“文件内容分析 + 检索片段 + source mapping”进入 prompt 的，而不是简单地只传一个文件名列表。

---

## 5. 自动生成 `摘要` 时，prompt 如何嵌入

前端 `generateWorkspaceDraft(itemType === 'summary')` 的指令如下：

- “你是 ThinkFlow 的 AI 笔记整理器。”
- “请根据给定来源与对话片段，输出一份简洁、可继续编辑的 markdown 摘要。”
- 必须包含：
  - `## 这段在说什么`
  - `## 当前结论`
  - `## 关键依据`
  - `## 待确认 / 可追问`

参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2833)。

真正发给 `/kb/chat` 的 `query` 结构是：

- `instruction`
- 可选 `补充要求`
- `待整理内容`

参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2861)。

注意这里“来源”并不是直接被写在这个 `instruction` 里，而是作为 `/kb/chat` 请求中的 `files: selectedFilePaths` 带进去。也就是说：

- `query` 负责告诉模型“你现在要生成摘要，格式是这样”。
- `files` 负责把 notebook 里选中的来源内容送入智能问答工作流。

最后生成出来的摘要 Markdown 被 capture 成 workspace item，但不会在 outputs-v2 里被直接消费。

因此摘要当前的真实作用是：

- 对当前轮对话与来源的二次结构化理解。
- 方便用户回顾、编辑、追问。
- 不是后续 PPT / 报告 / 导图的正式输入通道。

---

## 6. 自动生成 `产出指导` 时，prompt 如何嵌入

前端 `generateWorkspaceDraft(itemType === 'guidance')` 的指令如下：

- “你是 ThinkFlow 的产出指导生成器。”
- “请根据给定来源与对话片段，输出一份高权重、只读的 markdown 产出指导。”
- “这份内容将直接进入后续 PPT / 报告 / 其他产出的核心上下文。”
- 必须包含：
  - `## 产出目标`
  - `## 必须覆盖`
  - `## 重点强调`
  - `## 需要避免`
  - `## 表达风格`
  - `## 关键依据`

参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2846)。

它的注入方式和摘要相同：

- `files: selectedFilePaths` 负责把来源带进 `/kb/chat`
- `query` 负责规定“你要生成的是产出指导，不是问答回复”

随后这段结果会被落为 workspace item。等到正式创建 output 时，前端传的是 `guidance_item_ids`，后端再把这些 item 的内容扁平化成一大段 `guidance_snapshot_text`。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1255) 和 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1267)。

因此，产出指导并不是“再次实时现生成”，而是：

- 先在工作区里生成并固化为一个只读 brief。
- 创建正式产出时，再把所选 guidance item 的内容整体塞入下游上下文。

---

## 7. 当没有梳理文档时，系统如何把 `来源` 变成 `梳理文档`

这是当前 workflow 中最关键的一段补桥逻辑。

如果用户要生成非 PPT 产出，但还没有准备好可用的主文档，前端会先自动基于来源生成一份梳理文档：

- 入口是 `buildSourceDerivedDocument()`。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2266)。

它构造的 query 里明确告诉模型：

- “你是 ThinkFlow 的来源梳理助手。”
- “用户还没有准备好正式的梳理文档，现在需要你直接基于当前来源生成一份可用于后续产出的 markdown 梳理。”
- 要求输出：
  - `# 核心主题`
  - `## 核心结论`
  - `## 关键依据`
  - `## 结构化要点`
  - `## 待确认问题`

然后它把这段 query 连同 `files: selectedFilePaths` 发给 `/api/v1/kb/chat`。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2276) 到 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2305)。

这段逻辑意味着：

- 对于很多非 PPT 产出场景，`来源` 并不是直接喂给最终下游。
- 它先被转写成一份“来源导出的梳理文档”。
- 真正被 output 使用的主输入，仍然是这份梳理文档。

这也是为什么当前系统里 `梳理文档` 的地位非常高。

---

## 8. 创建正式产出时，前端到底传了什么

前端 `createOutline()` 调用 `/api/v1/kb/outputs-v2/outline` 时，构造的 payload 是：

- `document_id`
- `target_type`
- `title`
- `prompt: ''`
- `page_count`
- `guidance_item_ids`
- `source_paths`
- `source_names`
- `bound_document_ids`
- `enable_images`（仅 PPT）

参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2687) 到 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2733)。

这里有两个非常重要的现状：

### 8.1 `摘要` 没有进入 payload

`summary_item_ids` 没有被传到 outputs-v2，所以它不会被正式产出链直接感知。

### 8.2 `prompt` 当前固定为空

前端现在传的是 `prompt: ''`。这意味着 outputs-v2 虽然保留了“用户本次产出目标”的字段位，但在当前 ThinkFlow 页面实际使用中，这个槽位通常是空的。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2726)。

所以当前正式产出链真正依赖的是：

- 主文档 `document_id`
- 高权重 `guidance_item_ids`
- 选中的 `source_paths / source_names`
- 绑定参考文档 `bound_document_ids`

---

## 9. PPT 产出链里，这四类对象如何嵌入 prompt

PPT 是当前集成最完整的一条链。

### 9.1 outputs-v2 如何组装上下文

后端 `create_outline()` 会先加载：

- 主文档 `document`
- 所选 guidance items
- 绑定参考文档 `bound_documents`

参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1249) 到 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1267)。

随后如果 `target_type == "ppt"`，会走 `_create_ppt_outline_payload()`，并把 `guidance_snapshot_text`、`document`、`bound_documents`、`source_names`、`prompt` 一起送去构造 `kb_query`。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1281) 到 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1303) 以及 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1175)。

### 9.2 `_build_ppt_context_query()` 的拼接方式

`_build_ppt_context_query()` 会按如下顺序拼文本：

- `[任务说明]`
- 可选 `[原始来源清单]`
- 可选 `[用户本次产出目标]`
- `[优先级规则]`
- 可选 `[产出指导]`
- 可选 `[梳理文档]`
- 可选 `[补充参考文档]`
- `[输出目标]`

参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L300)。

其中最关键的优先级规则是：

- 原始来源内容是第一优先级。
- 梳理文档和参考文档只能帮助组织结构、补充上下文，不能覆盖来源事实。
- 产出指导用于匹配重点、风格和讲述顺序，但不能引入来源中不存在的事实。

参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L319)。

所以在 PPT 里，这四类对象的语义层级非常清晰：

- `来源`：事实主源。
- `梳理文档`：帮助组织结构。
- `参考文档`：补充上下文。
- `产出指导`：约束重点、风格、排序。
- `摘要`：不在链路内。

### 9.3 这些内容如何真正进入 `kb_outline_agent`

`_create_ppt_outline_payload()` 会设置：

- `state_pc.kb_query = _build_ppt_context_query(...)`
- 如果是多 PDF 来源，还会设置 `state_pc.kb_multi_source_text`

参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1175) 到 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1194)。

随后工作流 `kb_page_content` 通过 pre-tool 注入：

- `minueru_output` 给 `kb_outline_agent`
- `retrieval_text` 给 `kb_outline_agent`
- `query` 给 `kb_outline_agent`

参考 [wf_kb_page_content.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_page_content.py#L55) 到 [wf_kb_page_content.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_page_content.py#L65)。

`KBOutlineAgent.get_task_prompt_params()` 再把这些 pre-tool 结果映射到 prompt 模板参数：

- `query`
- `retrieval_text`
- `minueru_output`
- `page_count`
- `language`

参考 [kb_outline_agent.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/agentroles/kb_outline_agent.py#L35)。

`BaseAgent.build_messages()` 最终把 system prompt 和 task prompt 渲染为 LLM 消息。参考 [base_agent.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/agentroles/cores/base_agent.py#L410)。

### 9.4 `kb_outline_agent` 的模板如何理解这些字段

PPT 大纲模板写得很直接：

- `query` 可能包含：
  - 用户这次想做什么
  - 来源清单
  - 梳理文档摘要
  - 参考文档摘要
  - 产出指导
- 这些信息只能用于“调整结构、强调重点、匹配表达方式”，不能覆盖原始来源事实
- `minueru_output` 中的原始来源内容是第一优先级事实来源

参考 [pt_kb_ppt_repo.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/promptstemplates/resources/pt_kb_ppt_repo.py#L16)。

这说明 `来源 / 梳理文档 / 产出指导 / 参考文档` 在 PPT 中不是松散拼接，而是被模板明确建模为不同权重的信息层。

### 9.5 PPT 图片链路里如何继续使用这些上下文

在 `kb_page_content` 里：

- `image_filter_agent` 会收到 `query = kb_query`
- `kb_image_insert_agent` 只收到 `pagecontent_json` 和 `image_items_json`

参考 [wf_kb_page_content.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_page_content.py#L87) 到 [wf_kb_page_content.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_page_content.py#L100)。

因此：

- `来源 / 梳理文档 / 产出指导` 会间接影响“哪些图片更相关”，因为图片筛选读的是同一个 `kb_query`。
- 但在“插图进 pagecontent”这一步，已经不再单独读取这些对象，而是基于前一步筛过的图片和现有页内容继续处理。

图片相关 prompt 模板在 [pt_kb_ppt_repo.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/promptstemplates/resources/pt_kb_ppt_repo.py#L73) 和 [pt_kb_ppt_repo.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/promptstemplates/resources/pt_kb_ppt_repo.py#L93)。

### 9.6 PPT 大纲 refine 时，重新注入是否完整

`outputs_v2.refine_outline()` 调的是 `Paper2PPTService.refine_outline()`，显式传入的只有：

- `result_path`
- `outline_feedback`
- `pagecontent`

参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1418) 到 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1461)。

在 `kb_page_content` 的 `outline_refine_agent` 分支里，pre-tool 注入的是：

- `outline_feedback`
- `minueru_output`
- `text_content`
- `pagecontent`
- `pagecontent_raw`

参考 [wf_kb_page_content.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_page_content.py#L67) 到 [wf_kb_page_content.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_page_content.py#L85)。

这里的一个现实结论是：

- refine 阶段没有看到像初次生成那样重新显式拼装 `kb_query`。
- 所以 `产出指导 / 梳理文档 / 参考文档 / 来源清单` 对 refine 的影响，至少在当前 `outputs-v2 -> refine_outline()` 这条显式调用上，没有初始生成阶段那么完整和直接。

---

## 10. 非 PPT 产出链里，这四类对象如何嵌入 prompt

非 PPT 产出目前的设计明显更“文档中心”，而不是“多对象并列注入”。

### 10.1 非 PPT 大纲创建：主要只看 `梳理文档 + 产出指导`

在 `create_outline()` 里，如果 `target_type != "ppt"`，当前直接走 `_fallback_outline()`，输入内容仅为：

- `document.content`
- `guidance_snapshot_text`

参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1310)。

这里没有继续把：

- `source_paths`
- `bound_documents`
- `summary`

单独喂给 outline 生成逻辑。

所以非 PPT 大纲阶段的真实情况是：

- `梳理文档` 是主输入。
- `产出指导` 被直接拼进去。
- `来源` 和 `参考文档` 不会在 fallback outline 阶段单独参与。
- `摘要` 不参与。

### 10.2 非 PPT 正式生成：先合成一个 `generation_input.md`

对于 `mindmap / podcast / flashcard / quiz`，后端不是把多个对象分别送给原工作流，而是先生成一个中间文件 `generation_input.md`。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1743)。

这个中间文件由 `_build_generation_markdown()` 生成，内容顺序是：

- `# title`
- 可选 `## 生成意图`
- 可选 `## 产出指导`
- `## 产出大纲`
- `## 原始文档`

参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1482)。

然后下游 endpoint 统一只收到：

- `file_paths=[generation_input.md]`

参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1544)。

这件事很重要，因为它决定了下游工作流并不知道“这是 guidance，那是 document，那是 source”，它看到的只是一个合成后的 Markdown 文件。

### 10.3 报告 `report`

`report` 更简单，它甚至不再走新一轮 LLM prompt，而是直接把：

- `title`
- `guidance`
- `outline`
- `document.content`

渲染成 `report.md` 和 `report.pdf`。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1506)。

所以报告链路里：

- `梳理文档` 直接落到底稿尾部。
- `产出指导` 直接写成一节。
- `摘要` 不参与。
- `来源` 不再被单独注入。

### 10.4 思维导图 `mindmap`

mindmap 工作流会先读取传入文件内容，把所有文件内容串成 `contents_str`，然后提示词要求模型做“跨来源综合”的层级化结构分析。参考 [wf_kb_mindmap.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_mindmap.py#L166) 和 [wf_kb_mindmap.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_mindmap.py#L174)。

但在 outputs-v2 场景下，它收到的唯一文件已经是 `generation_input.md`，所以：

- 它综合的不是“原始来源集合 + 梳理文档 + 指导”这些独立对象。
- 而是 `generation_input.md` 这个合成后的文档文本。

### 10.5 播客 `podcast`

podcast 工作流同样会把文件内容串成 `contents_str`，再直接用 prompt 生成播客脚本。参考 [wf_kb_podcast.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_podcast.py#L173) 和 [wf_kb_podcast.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_podcast.py#L184)。

在 outputs-v2 里它看到的仍是单个 `generation_input.md`，因此也属于“合成输入文件驱动”，不是“多对象显式注入驱动”。

### 10.6 闪卡 `flashcard`

flashcard 的 prompt 是直接基于 `text_content` 构建：

- “请从以下内容中提取 N 个最重要的知识点，并为每个知识点生成一张闪卡”

参考 [flashcard_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/flashcard_service.py#L86)。

在 outputs-v2 里，这个 `text_content` 本质上就是从 `generation_input.md` 解析出来的文本。

### 10.7 Quiz `quiz`

quiz 的 prompt 也是直接基于 `text_content`：

- “请基于以下文档内容，生成 N 道高质量的单选题测验题目”

参考 [quiz_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/quiz_service.py#L86)。

同样，在 outputs-v2 中它感知到的是合成后的 Markdown 文本，而不是独立对象。

---

## 11. `摘要` 为什么当前几乎不直接参与产出

从代码看，`摘要` 当前不参与正式产出的原因非常直接：

### 11.1 前端没有把摘要 ID 传进 outputs-v2

`createOutline()` payload 中没有 `summary_item_ids`。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2718)。

### 11.2 后端 outputs-v2 也没有加载摘要对象

`create_outline()` 只加载：

- `document`
- `guidance_items`
- `bound_documents`

没有 `summary_items`。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1249)。

### 11.3 下游 prompt 模板也没有摘要槽位

PPT 的 `kb_query` 只显式拼接：

- 来源清单
- 用户本次产出目标
- 产出指导
- 梳理文档
- 补充参考文档

没有摘要。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L300)。

非 PPT 的 `generation_input.md` 也只拼：

- 生成意图
- 产出指导
- 产出大纲
- 原始文档

没有摘要。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1482)。

因此现在的摘要更像：

- 工作区里的辅助认知对象。
- 给用户看的，不是给正式产出链看的。

除非后续把摘要接入 outputs-v2 payload 和 prompt 组装逻辑，否则它不会成为正式约束项。

---

## 12. 绑定参考文档 `bound documents` 是怎么参与的

这个对象严格说不属于题目中的四类，但它会影响“梳理文档/来源/指导怎么被使用”，所以值得单独说明。

### 12.1 在聊天里

前端会把已绑定文档内容直接 prepend 到用户 query 中：

- `参考文档《title》:\ncontent`
- 然后再拼 `用户问题：...`
- 再附加 `要求：优先围绕上述梳理文档与当前素材回答`

参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2572)。

也就是说，聊天里的参考文档参与方式是“前端 query stuffing”，而不是后端独立结构字段。

### 12.2 在 PPT 里

PPT 的 `_build_ppt_context_query()` 有明确的 `[补充参考文档]` 段。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L329)。

### 12.3 在非 PPT 里

非 PPT 的 outline fallback 阶段并不会把 `bound_documents` 拼进去。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1310)。

因此，绑定参考文档在当前实现里：

- 对聊天有效。
- 对 PPT 明确有效。
- 对非 PPT 较弱，至少在大纲生成与 generation input 合成上不显式参与。

---

## 13. Prompt 注入方式总表

| 功能 | 来源 | 梳理文档 | 摘要 | 产出指导 | 注入方式 |
| --- | --- | --- | --- | --- | --- |
| 普通聊天 `/kb/chat/stream` | 直接参与 | 仅绑定参考文档时以 query prepend 形式参与 | 不参与 | 不参与 | `files + query + history` |
| 生成摘要 draft | 直接参与 | 不参与 | 生成目标本身 | 不参与 | `/kb/chat`，`files` 提供来源，`query` 规定摘要格式 |
| 生成产出指导 draft | 直接参与 | 不参与 | 不参与 | 生成目标本身 | `/kb/chat`，`files` 提供来源，`query` 规定 guidance 格式 |
| 把聊天沉淀成梳理文档 | 可作为 `source_refs` 与 AI 整理 prompt 参与 | 生成或更新目标本身 | 不参与 | 不参与 | `/documents/{id}/push` |
| 非 PPT 且缺主文档时自动生成梳理文档 | 直接参与 | 生成目标本身 | 不参与 | 不参与 | `/kb/chat` 生成 source-derived document |
| PPT 大纲生成 | 第一优先级事实来源 | 以 `[梳理文档]` 注入 | 不参与 | 以 `[产出指导]` 注入 | `kb_query + minueru_output` |
| PPT 图片筛选 | 通过 `kb_query` 间接参与 | 通过 `kb_query` 间接参与 | 不参与 | 通过 `kb_query` 间接参与 | `image_filter_agent(query)` |
| 非 PPT 大纲生成 | 基本不直接参与 | 主输入 | 不参与 | 直接拼接 | `_fallback_outline(document + guidance)` |
| report 生成 | 不直接参与 | 直接写入结果 | 不参与 | 直接写入结果 | 渲染 Markdown/PDF |
| mindmap / podcast / flashcard / quiz | 不直接参与 | 通过 `generation_input.md` 参与 | 不参与 | 通过 `generation_input.md` 参与 | 单一合成 Markdown 文件 |

---

## 14. 当前实现里最值得注意的几个现实问题

### 14.1 `prompt` 这个设计位当前基本没有发挥作用

后端 PPT query builder 和非 PPT generation markdown 都给 `prompt` 预留了位置：

- PPT 里是 `[用户本次产出目标]`。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L313)。
- 非 PPT 里是 `## 生成意图`。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1484)。

但前端当前 `createOutline()` 固定传 `prompt: ''`，所以这一层通常为空。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2726)。

这意味着现在真正承担“意图约束”的主要是 `产出指导`，不是 `prompt`。

### 14.2 `摘要` 的产品定位与系统接线目前是断开的

UI 把摘要描述为 AI 笔记区，这和代码现状是一致的；但如果产品预期摘要也应该“参与正式产出”，那当前实现还没有接线。

### 14.3 非 PPT 产出明显比 PPT 更弱

PPT 有：

- 原始来源解析文本
- 多层对象优先级规则
- 独立 prompt 模板
- 图片筛选链

非 PPT 则更像：

- 用 `document + guidance` 快速凑出 outline
- 再拼成一个合成 Markdown 文件
- 复用旧 endpoint

所以如果要讨论“来源 / 梳理文档 / 摘要 / 产出指导 在各功能里的精细注入”，当前真正做得完整的是 PPT，不是非 PPT。

### 14.4 `outline_refine_agent / image_filter_agent / kb_image_insert_agent` 没有看到独立 agent role 类

在当前代码树里，我没有找到类似 `@register("outline_refine_agent")` 的独立 agent role 类；但在 `wf_kb_page_content.py` 里，这几个节点是通过 `create_react_agent(name=...)` 调起的，并且有对应 prompt 模板与 `role_mapping`。参考 [wf_kb_page_content.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_page_content.py#L232) 和 [wf_kb_page_content.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_page_content.py#L401)。

这说明当前实现不是“缺功能”，而是：

- 这些 agent 可能走的是通用 agent 构造路径
- 不是像 `kb_outline_agent` 那样有显式独立类文件

### 14.5 `retrieval_text` 在 outputs-v2 的 PPT 路径里基本没有被真正利用

`kb_outline_agent` 模板确实给 `retrieval_text` 预留了位置。参考 [pt_kb_ppt_repo.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/promptstemplates/resources/pt_kb_ppt_repo.py#L16)。

`wf_kb_page_content` 也确实会把 `kb_retrieval_text` 注入到 `retrieval_text`。参考 [wf_kb_page_content.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_page_content.py#L59)。

但在当前 `outputs_v2_service._create_ppt_outline_payload()` 里，没有看到显式设置 `state_pc.kb_retrieval_text`。参考 [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py#L1175)。

所以 outputs-v2 的 PPT 大纲路径中，`retrieval_text` 这个槽位大概率是空的。

---

## 15. 最终判断：当前 workflow 的真实工作模型

如果把当前系统抽象成一条清晰的数据流，它更接近下面这个模型：

### 15.1 认知层

- `来源` 提供事实。
- `/kb/chat` 用这些事实生成回答。
- `摘要` 用来沉淀“我现在理解到了什么、还可追问什么”。

### 15.2 编排层

- `梳理文档` 负责把对话和来源整理成后续可复用的工作底稿。
- `产出指导` 负责把“要做成什么、强调什么、避免什么”提炼成高权重 brief。

### 15.3 产出层

- `PPT`：直接使用 `来源 + 梳理文档 + 参考文档 + 产出指导` 的多层结构。
- `非 PPT`：当前主要使用 `梳理文档 + 产出指导`，再把它们压缩成单个合成输入文件。

所以从系统设计成熟度上看：

- `梳理文档` 和 `产出指导` 已经是正式产出链里的“一等公民”。
- `来源` 在 PPT 里是一等公民，在非 PPT 里更像上游材料。
- `摘要` 目前还是工作区里的辅助对象，不是正式产出链对象。

---

## 16. 如果你要据此改产品或改实现，我建议重点盯这几处

- 如果希望 `摘要` 真正影响正式产出，需要在前端 `createOutline()` 加入 `summary_item_ids`，并在 outputs-v2 中显式加载与注入。
- 如果希望“本次即时产出目标”生效，需要前端不再固定传 `prompt: ''`。
- 如果希望非 PPT 和 PPT 一样具备多对象语义注入能力，需要给非 PPT 增加独立的上下文组装器，而不是只用 `generation_input.md` 这一个合成文件。
- 如果希望 bound documents 在非 PPT 中也有效，需要把它们纳入 `_fallback_outline()` 和 `_build_generation_markdown()` 的输入。

以上四点里，优先级最高的是：

- 先明确 `摘要` 是否真的要成为正式产出输入。
- 再决定非 PPT 是继续走“文档中心”还是升级为“多对象上下文中心”。

