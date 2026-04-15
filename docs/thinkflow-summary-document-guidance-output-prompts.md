# ThinkFlow 中「摘要 / 梳理文档 / 产出指导」的输出方式与提示词总结

## 1. 这份文档回答什么问题

这份文档只回答两个问题：

- `摘要`、`梳理文档`、`产出指导` 这三类对象，当前分别是怎么产出的。
- 它们在生成时，实际使用的提示词是什么样的。

这里不展开讲正式产出链路怎么消费它们，那部分已经在另一份分析里写过；这里专注“它们自己是怎么被生成出来的”。

---

## 2. 总结版结论

先给最短结论：

- `摘要`：一定是先走 `/api/v1/kb/chat` 生成一份 AI 摘要草稿，再保存成 workspace item。
- `产出指导`：也是先走 `/api/v1/kb/chat` 生成一份 AI brief，再保存成 workspace item。
- `梳理文档`：情况最复杂，有三种主要输出方式。
  - 用户手工编辑和保存。
  - 把对话内容 push 进文档，按 `append / organize / merge` 三种模式输出。
  - 如果没有主文档但又要做产出，系统会先基于 `来源` 自动生成一份“来源梳理文档”。

也就是说：

- `摘要` 和 `产出指导` 的核心是“先生成 draft，再 capture”。
- `梳理文档` 的核心是“一个可持续累积和改写的主文档”，它既支持 AI 生成，也支持用户直接编辑。

---

## 3. 摘要是怎么输出的

### 3.1 输出路径

摘要的生成入口在前端 `generateWorkspaceDraft(itemType === 'summary')`。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2821)。

它的流程是：

1. 把当前选中的对话片段或文本整理成 `sourceContent`。
2. 调 `/api/v1/kb/chat`，让模型先生成一份 Markdown 摘要草稿。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2870)。
3. 再把这份草稿通过 `/api/v1/kb/workspace-items/capture` 保存成一个 `summary` 类型的 workspace item。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2454)。

因此，摘要不是把原问答原样保存，而是：

- 先让 LLM 归纳一次。
- 再把归纳后的结果存起来。

### 3.2 摘要生成时的提示词

前端为 `summary` 构造的 instruction 是：

```text
你是 ThinkFlow 的 AI 笔记整理器。
请根据给定来源与对话片段，输出一份简洁、可继续编辑的 markdown 摘要。
不要直接复制原始问答，要先归纳。
必须包含这些二级标题：
## 这段在说什么
## 当前结论
## 关键依据
## 待确认 / 可追问
每一节尽量简洁，优先 bullet。不要输出额外解释。
```

参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2833)。

除此之外，前端还会把用户补充要求和待整理内容一起拼进 query：

```text
{instruction}

补充要求：
{prompt}

待整理内容：
{sourceText}
```

对应实现参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2861)。

### 3.3 摘要保存时长什么样

摘要草稿生成完后，不是直接作为纯文本扔进数据库，而是被包装成 workspace item 内容。

后端 `ThinkFlowWorkspaceService._compose_capture_block()` 对 `summary` 的包装格式是：

- `## {标题}`
- 可选 `> 来源: ...`
- 可选 `> 摘要要求: ...`
- `### 对话沉淀`
- 正文内容

参考 [thinkflow_workspace_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/thinkflow_workspace_service.py#L91)。

但有一个细节要注意：

- 前端真正 capture 时传给接口的 `prompt` 是空字符串。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2465)。

所以在当前实现中：

- 摘要的“生成要求”主要已经被 baked 到生成好的 Markdown 里面。
- 不会再作为一个独立结构化字段稳定保留下来。

---

## 4. 产出指导是怎么输出的

### 4.1 输出路径

产出指导和摘要的生成方式几乎一致，也是：

1. 前端先调 `generateWorkspaceDraft(itemType === 'guidance')`。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2821)。
2. 用 `/api/v1/kb/chat` 生成一份 Markdown 版的高权重 brief。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2870)。
3. 再通过 `/api/v1/kb/workspace-items/capture` 保存为 `guidance` 类型 workspace item。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2454)。

### 4.2 产出指导生成时的提示词

前端为 `guidance` 构造的 instruction 是：

```text
你是 ThinkFlow 的产出指导生成器。
请根据给定来源与对话片段，输出一份高权重、只读的 markdown 产出指导。
这份内容将直接进入后续 PPT / 报告 / 其他产出的核心上下文。
不要复述原始问答，要输出明确要求。
必须包含这些二级标题：
## 产出目标
## 必须覆盖
## 重点强调
## 需要避免
## 表达风格
## 关键依据
每一节尽量简洁、明确、可执行。不要输出额外解释。
```

参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2846)。

和摘要一样，它最终送去 `/kb/chat` 的 query 也是：

```text
{instruction}

补充要求：
{prompt}

待整理内容：
{sourceText}
```

参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2861)。

### 4.3 产出指导保存时长什么样

后端 `ThinkFlowWorkspaceService._compose_capture_block()` 对 `guidance` 的包装格式是：

- `## {标题}`
- 可选 `> 来源: ...`
- 可选 `### 产出要求`
- `### 参考对话`
- 正文内容

参考 [thinkflow_workspace_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/thinkflow_workspace_service.py#L117)。

同样也有一个关键细节：

- 前端 capture guidance 时同样传的是 `prompt: ''`，不是原始补充要求。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2465)。

因此当前 `产出指导` 的真实数据形态是：

- 一份已经生成好的、可直接被后续流程使用的 Markdown brief。
- 它的约束信息主要包含在正文里，而不是保存在单独 prompt 字段里。

---

## 5. 梳理文档是怎么输出的

梳理文档和前两者不同，不是单一路径。当前至少有四种实际输出方式。

## 5.1 方式一：用户直接编辑后保存

这是最朴素的一种方式：

- 用户直接在右侧文档编辑区修改内容。
- 前端调用 `updateDocumentContent()`，再请求 `/api/v1/kb/documents/{id}` 保存全文。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2242)。

这一条路径没有 LLM 提示词，因为它不是 AI 生成，而是用户直接写。

## 5.2 方式二：把对话内容 push 进文档

前端把内容推入 `document` 时，调用：

- `/api/v1/kb/documents/{id}/push`。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2418)。

后端 `DocumentService.push_document()` 支持三种模式：

- `append`
- `organize`
- `merge`

参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L537)。

这三种模式决定了文档“是怎么输出出来的”。

### 5.2.1 `append`：直接拼接，不走 LLM

如果是普通追加，后端会调用 `_compose_push_block()`，把内容包装成：

- `## 标题`
- 可选 `> 来源: ...`
- 可选 `> 整理要求: ...`
- 正文或 bullet

参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L173)。

这条路径没有 AI 提示词，因为它只是结构化拼接，不做模型改写。

### 5.2.2 `organize`：先让 AI 整理，再写入文档

如果选择 `organize`，后端会调用 `_organize_with_ai()`。参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L568)。

这个函数的 system prompt 是：

```text
你是 ThinkFlow 的文档整理助手。
请把用户给出的对话片段整理成适合写入 Markdown 文档的结构化内容。
不要返回代码块，不要写解释，不要重复来源或整理要求。
输出应该是可以直接放在标题下面的正文，优先使用小标题、要点和简洁段落。
```

对应代码参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L317)。

它的 user prompt 结构是：

```text
目标标题：{title}
来源：{source_names}
整理要求：{prompt 或默认要求}
待整理内容：
{text_items}
```

参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L323)。

也就是说，`organize` 模式下的梳理文档是：

- 以当前选中的对话/文本为原料，
- 由文档整理助手先重写成适合 Markdown 文档的结构化正文，
- 再写进主文档。

### 5.2.3 `merge`：把新增内容融合进现有文档

如果选择 `merge`，后端会调用 `_merge_with_ai()`。参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L585)。

这个函数的 system prompt 是：

```text
你是 ThinkFlow 的文档融合助手。
请把新增信息融合进现有 Markdown 文档，输出完整的新文档全文。
尽量保留现有结构和已经确认的内容，只在必要位置改写、新增或补充。
不要返回代码块，不要写解释。
```

参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L354)。

它的 user prompt 结构是：

```text
新增内容标题：{title}
来源：{source_names}
融合要求：{prompt 或默认要求}
现有文档：
{original}
新增信息：
{text_items}
```

参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L360)。

也就是说，`merge` 模式不是“新增一个块”，而是：

- 把现有全文和新增信息一起交给模型，
- 让模型输出一份新的完整文档全文，
- 再覆盖当前文档内容。

这也是三种模式里最强的一种改写方式。

## 5.3 方式三：没有主文档时，系统基于来源自动生成一份梳理文档

当前前端有一条很关键的补桥逻辑：如果要做正式产出，但没有可用的主文档，会先自动生成一份“来源梳理文档”。

对应函数是 `buildSourceDerivedDocument()`。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2266)。

它会调用 `/api/v1/kb/chat`，使用如下 query：

```text
你是 ThinkFlow 的来源梳理助手。
用户还没有准备好正式的梳理文档，现在需要你直接基于当前来源生成一份可用于后续产出的 markdown 梳理。
要求：
1. 输出结构化 markdown，不要解释你的过程。
2. 必须优先归纳来源中的核心结论、关键依据、关键数据/事实、适合后续产出的线索。
3. 内容要适合作为 PPT / 报告 / 导图等产出的基础输入。
4. 如果来源之间存在不确定或冲突，请明确标记 [待确认]。
5. 推荐结构：
# 核心主题
## 核心结论
## 关键依据
## 结构化要点
## 待确认问题
本次目标产出：{targetType}
当前来源：{sourceNames}
```

参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2276)。

它的工作方式和摘要/产出指导相同的一点在于：

- 也是通过 `/kb/chat`
- 也是 `files: selectedFilePaths + query`

但不同点在于：

- 它生成的不是 workspace item，
- 而是一份新的正式 `document`。

生成完后，前端会新建文档，再把生成内容保存进去。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2312)。

## 5.4 方式四：创建空文档后，后续不断累积

这不是单次输出，但从使用方式上也很重要：

- 用户可以先创建一个空文档。
- 之后通过 `append / organize / merge` 持续沉淀。
- 文档服务会为每次改动记录版本与 trace。

参考 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L108) 和 [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py#L616)。

这说明梳理文档并不是“一次性产物”，而是一个持续演化的主文稿。

---

## 6. 三者的提示词对比

为了便于看差异，可以把三者的核心提示词目标压缩成一句话：

- `摘要`：把对话和来源整理成“阅读笔记 / 当前理解卡片”。
- `梳理文档`：把对话和来源整理成“可直接作为后续产出输入的主文档”。
- `产出指导`：把对话和来源整理成“高权重 brief / 产出约束说明”。

如果进一步看格式要求：

### 6.1 摘要

固定要求输出：

- `## 这段在说什么`
- `## 当前结论`
- `## 关键依据`
- `## 待确认 / 可追问`

它强调的是：

- 简洁
- 可编辑
- 优先 bullet
- 不要复述原始问答

### 6.2 梳理文档

梳理文档没有唯一固定模板，而是分场景：

- `organize`：强调“适合写入 Markdown 文档的结构化内容”。
- `merge`：强调“把新增信息融合进现有全文，输出完整新文档”。
- `来源梳理助手`：强调“核心结论 / 关键依据 / 结构化要点 / 待确认问题”，且要适合作为 PPT / 报告 / 导图的基础输入。

所以梳理文档的 prompt 本质是“面向 downstream output 的主文稿整理 prompt”。

### 6.3 产出指导

固定要求输出：

- `## 产出目标`
- `## 必须覆盖`
- `## 重点强调`
- `## 需要避免`
- `## 表达风格`
- `## 关键依据`

它强调的是：

- 明确要求
- 可执行
- 高权重
- 只读
- 直接进入后续产出核心上下文

---

## 7. 一张表看懂三者差异

| 对象 | 主要输出接口 | 是否先走 LLM | 提示词角色 | 输出目标 |
| --- | --- | --- | --- | --- |
| 摘要 | `/api/v1/kb/chat` -> `/api/v1/kb/workspace-items/capture` | 是 | `AI 笔记整理器` | 阅读笔记 / 理解卡片 |
| 产出指导 | `/api/v1/kb/chat` -> `/api/v1/kb/workspace-items/capture` | 是 | `产出指导生成器` | 高权重 brief |
| 梳理文档 `append` | `/api/v1/kb/documents/{id}/push` | 否 | 无 | 直接追加文本块 |
| 梳理文档 `organize` | `/api/v1/kb/documents/{id}/push` | 是 | `文档整理助手` | 结构化 Markdown 正文 |
| 梳理文档 `merge` | `/api/v1/kb/documents/{id}/push` | 是 | `文档融合助手` | 融合后的完整新文档 |
| 来源梳理文档 | `/api/v1/kb/chat` -> 创建 document | 是 | `来源梳理助手` | 基于来源自动生成主文档 |

---

## 8. 最后一句判断

如果只从“生成方式和提示词”看这三个对象，当前设计非常清楚：

- `摘要` 负责帮助用户理解。
- `梳理文档` 负责沉淀成主文稿。
- `产出指导` 负责约束后续产出目标、重点和风格。

它们虽然都来自对话和来源，但 prompt 目标完全不同，因此最后生成出来的内容形态也完全不同。

