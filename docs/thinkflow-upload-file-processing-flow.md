# ThinkFlow 当前「上传来源」逻辑总结：上传后怎么处理、不同文件类型走什么流程

## 1. 结论先行

当前 ThinkFlow 的“上传来源”逻辑可以分成两层看：

- 第一层是 `上传时立即发生什么`。
- 第二层是 `上传完成后，这些文件在聊天、RAG、PPT、导图、播客里会怎样再次被处理`。

如果先说最核心的结论：

- 前端上传本身很薄，只是把文件逐个发给 `/api/v1/kb/upload`。参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2630) 和 [ThinkFlowAddSourceModal.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowAddSourceModal.tsx#L85)。
- 后端上传接口会做四件事：
  - 校验扩展名。
  - 把文件复制进 notebook 的 `sources/{stem}/original/` 目录。
  - 尝试生成该来源的统一 Markdown 表示。
  - 对非数据集文件自动做 embedding / 向量入库。
- `PDF / DOCX / PPTX / MD / 图片 / MP4 / CSV` 的处理路径并不一样。
- 真正最完整的处理链是：
  - `PDF`：上传后就会生成 MinerU 结果和统一 Markdown，并自动切块向量化。
  - `DOCX / PPTX`：上传时会先生成一个“轻量文本版 markdown”，自动 embedding 时再转 PDF 走 PDF/MinerU 链。
  - `图片 / MP4`：不会变成文本块，而是通过多模态模型先生成描述，再把“描述文本”向量化。
  - `CSV`：会保存为来源，但默认不会自动向量化。

---

## 2. 前端上传入口：其实只是逐个调接口

ThinkFlow 前端上传文件时，没有在前端做复杂分流，它只是把每个文件作为 `multipart/form-data` 单独提交给 `/api/v1/kb/upload`。

主要入口有两个：

- 工作区左侧上传：参考 [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx#L2630)。
- Add Source 弹窗上传：参考 [ThinkFlowAddSourceModal.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowAddSourceModal.tsx#L85)。

表单里附带的信息主要是：

- `file`
- `email`
- `user_id`
- `notebook_id`
- `notebook_title`

也就是说，上传时前端并不决定“文件怎么解析”，真正的类型判断和流程分支都在后端。

---

## 3. 后端上传主入口：`/api/v1/kb/upload`

主入口在 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L348)。

它的整体流程是：

1. 校验 `email` 和 `notebook_id`。
2. 根据扩展名做白名单校验。
3. 把上传的文件先写到 notebook 根目录下的临时目录 `_tmp/`。
4. 调 `SourceManager.import_file()` 把它正式导入 notebook 的 source 树。
5. 额外复制一份到旧版 `kb_data` 路径，做兼容。
6. 如果不是数据集类型，则自动调用 `process_knowledge_base_files()` 做 embedding。
7. 记录 source record，并返回 `embedded` 状态。

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L373)。

### 3.1 当前上传接口真正允许的文件类型

`/kb/upload` 的白名单是：

- `.pdf`
- `.docx`
- `.pptx`
- `.png`
- `.jpg`
- `.jpeg`
- `.mp4`
- `.md`
- `.csv`

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L138) 和 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L366)。

这里要特别注意两个边界：

- 后续有些工作流代码支持 `.doc`、`.ppt`、`.txt`、`.markdown`、`.avi`、`.mov`，但它们 **不是当前上传接口允许上传的类型**。
- 也就是说，“后端某些处理器能处理”不等于“用户能通过当前上传入口传进来”。

### 3.2 `CSV` 是一个特例

当前 `DATASET_EXTENSIONS = {".csv"}`，上传接口会对非 CSV 自动 embedding，但会跳过 CSV。参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L142) 和 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L408)。

所以：

- CSV 会被保存成 source。
- 但默认不会立即入向量库。

---

## 4. 上传后文件落在哪里

新的 notebook-centric 目录结构由 `NotebookPaths` 统一管理。参考 [notebook_paths.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/notebook_paths.py#L1)。

核心目录结构是：

```text
outputs/{user_id}/{safe_title}_{notebook_id}/
├── sources/{source_stem}/original/
├── sources/{source_stem}/mineru/
├── sources/{source_stem}/markdown/
├── vector_store/
├── ppt/{timestamp}/
├── mindmap/{timestamp}/
├── podcast/{timestamp}/
└── drawio/{timestamp}/
```

参考 [notebook_paths.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/notebook_paths.py#L6)。

也就是说，每个上传来源会在 notebook 下占一个独立 source 目录，最典型的是：

- `sources/{stem}/original/` 保存原文件
- `sources/{stem}/markdown/` 保存统一 markdown 表示
- `sources/{stem}/mineru/` 保存 PDF/MinerU 解析结果

---

## 5. `SourceManager.import_file()` 在上传时做了什么

上传接口在把临时文件写好后，会调用 `SourceManager.import_file(tmp_path, filename)`。参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L388) 和 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L48)。

它的逻辑分三步：

1. 复制原文件到 `sources/{stem}/original/`
2. 如果是 PDF，运行 MinerU，结果写到 `sources/{stem}/mineru/`
3. 为该来源生成统一 Markdown，写到 `sources/{stem}/markdown/{stem}.md`

参考 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L49) 到 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L90)。

这一步很重要，因为它意味着：

- 上传后不仅有原文件。
- 系统还尽量给每个来源准备一个“可读文本版本”。

---

## 6. 上传阶段，不同文件类型会怎样生成统一 Markdown

统一 Markdown 的生成逻辑在 `SourceManager._generate_markdown()`。参考 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L311)。

### 6.1 PDF

PDF 的处理顺序是：

- 如果 MinerU 跑成功，优先直接读取 MinerU 产出的 `.md`
- 如果 MinerU 不可用，则回退到 PyMuPDF 文本提取

参考 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L315) 到 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L327)。

这意味着 PDF 在“上传时”就已经是最高质量处理路径：

- 有结构化 MinerU 结果时就用它
- 没有时至少还能保底抽正文

### 6.2 MD / Markdown / TXT

对于 `.md`、`.markdown`、`.txt`：

- 直接按文本读取
- 原样作为统一 Markdown

参考 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L329)。

不过这里有一个现实边界：

- 当前 `/kb/upload` 只允许 `.md`，不允许 `.txt` / `.markdown`
- 但 `SourceManager` 本身是支持这些文本类型的

### 6.3 DOCX / DOC

对于 Word：

- 上传导入阶段会尝试直接用 `python-docx` 提取段落文本
- 生成一份文本版 markdown

参考 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L336) 和 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L361)。

但注意：

- 当前上传接口允许的是 `.docx`
- `SourceManager` 虽然也支持 `.doc`，但 `.doc` 不是当前上传白名单

### 6.4 PPTX / PPT

对于 PPT：

- 上传导入阶段会尝试用 `python-pptx` 提取每页文字
- 生成一个“按 slide 展开的文本版 markdown”

参考 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L340) 和 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L370)。

同样要注意：

- 当前上传接口允许的是 `.pptx`
- `.ppt` 虽然下游某些处理器支持，但上传入口不允许

### 6.5 CSV

`SourceManager._generate_markdown()` 里没有单独写 CSV 分支，它会落到最后的 fallback：

- 尝试把文件按文本读取
- 如果能读出来，就把内容写成统一 Markdown

参考 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L344)。

所以 CSV 在导入阶段的状态是：

- 原文件会保存
- 统一 markdown 通常也能生成
- 但不会自动 embedding

### 6.6 图片 / 视频

对于 `.png/.jpg/.jpeg/.mp4` 这类二进制媒体文件，`_generate_markdown()` 没有专门的媒体转文本逻辑，最后会尝试按文本读取，通常会失败并返回空字符串。参考 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py#L344)。

所以上传导入阶段：

- 媒体文件通常只有原文件。
- 不会在这里生成一份像 PDF 那样可读的 markdown 正文。

它们真正的语义处理发生在后面的 embedding 阶段或聊天分析阶段。

---

## 7. 上传后自动 embedding：真正的类型分流在这里

上传完成后，`/kb/upload` 会对非 CSV 文件自动调用：

- `process_knowledge_base_files(file_list=[{"path": ...}], base_dir=..., mineru_output_base=...)`

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L408)。

真正的核心逻辑在 `VectorStoreManager.process_file()`。参考 [vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py#L303)。

它按扩展名分成几类：

- `.pdf` -> `_process_pdf`
- `.docx/.doc` -> `_process_word`
- `.pptx/.ppt` -> `_process_ppt`
- `.md/.markdown/.txt` -> `_process_text`
- `.png/.jpg/.jpeg/.mp4/.avi/.mov` -> `_process_media`
- 其他 -> `skipped`

参考 [vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py#L327)。

### 7.1 PDF：MinerU / 缓存 / fallback / chunk / embedding

PDF 是最完整的 embedding 流程：

1. 优先复用已有 MinerU 缓存
2. 没有缓存就调用 `run_mineru_pdf_extract`
3. 如果 MinerU 失败，则回退到 PyMuPDF 提取文本并写成 `.md`
4. 读取 markdown 内容
5. 分块
6. 对每个 chunk 做 embedding
7. 把 chunk 元数据写进向量库和 manifest

参考 [vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py#L409) 到 [vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py#L523)。

这说明 PDF 上传后的真实状态通常是：

- 有原文件
- 有 MinerU 结构化结果
- 有统一 markdown
- 有切块向量

### 7.2 DOCX：先转 PDF，再完全复用 PDF 流程

Word 文件在 embedding 阶段不是直接按 docx 文本分块，而是：

1. 用 LibreOffice 转 PDF
2. 再调用 `_process_pdf`

参考 [vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py#L525)。

这点很关键，因为它意味着：

- 上传导入阶段的 docx markdown 只是一个轻量文本版。
- 真正入向量库时，Word 会走“转 PDF -> MinerU / PDF fallback -> chunk -> embed”的流程。

### 7.3 PPTX：也先转 PDF，再复用 PDF 流程

PPT 在 embedding 阶段与 Word 类似：

1. 用 LibreOffice 转 PDF
2. 调 `_process_pdf`

参考 [vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py#L536)。

所以 PPT 有两套文本化路径：

- 上传导入阶段：`python-pptx` 提取 slide 文本，生成统一 markdown
- embedding 阶段：转 PDF 后再走 PDF/MinerU 管道

### 7.4 MD / 纯文本：直接分块 embedding

文本文件的 embedding 很简单：

1. 读取全文
2. 分块
3. 向量化

参考 [vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py#L542)。

因此 `.md` 上传后最直接：

- 原文件
- 统一 markdown
- 文本 chunk 向量

### 7.5 图片：先多模态生成描述，再把描述向量化

媒体文件走 `_process_media()`。参考 [vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py#L572)。

对图片：

1. 如果上传时没有额外 description，就调用多模态模型生成描述
2. 把描述保存到 `description.txt`
3. 对这段描述做 embedding
4. 在 manifest 中记为 `media_desc_count = 1`

参考 [vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py#L583) 到 [vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py#L630)。

所以图片不会变成很多文本 chunk，而是：

- 一个媒体文件
- 一段机器生成的描述
- 一个基于描述的向量

### 7.6 视频：和图片类似，但走视频理解模型

对视频也是 `_process_media()`：

- 如果没有 description，就调用视频理解模型生成一段描述
- 然后把描述文本向量化

参考 [vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py#L594)。

但需要注意：

- 当前上传接口允许的是 `.mp4`
- `_process_media()` 还支持 `.avi/.mov`，但这些并不是当前 `/kb/upload` 可上传的白名单格式

### 7.7 CSV：上传默认不会自动 embedding

虽然 `VectorStoreManager` 的文本分支能处理 `.txt/.md`，但 `/kb/upload` 对 CSV 的策略是：

- 允许上传
- 跳过自动 embedding

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L410)。

所以 CSV 上传后默认不会有向量记录，除非你后续单独改逻辑或手动走其他数据流。

---

## 8. 上传后的状态如何被系统识别

上传并自动 embedding 后，向量状态会写进 `knowledge_manifest.json`。

`SourceService.list_notebook_files()` 会把每个 source 和 manifest 对上，补出：

- `vector_status`
- `vector_ready`
- `vector_chunks_count`
- `vector_media_desc_count`

参考 [source_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/source_service.py#L165) 和 [source_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/source_service.py#L333)。

这意味着前端文件列表里看到的“是否已 embedding”，并不是拍脑袋，而是从向量 manifest 反推出来的。

---

## 9. 如果自动 embedding 失败，后面怎么办

系统留了一个补救接口：

- `/api/v1/kb/reembed-source`

它会：

1. 定位到原始文件
2. 重新调用 `process_knowledge_base_files()`
3. 复用该来源应有的 `mineru` 目录

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L455)。

所以“上传成功但 embedded=false”并不意味着这个文件彻底不能用，只是自动入库这一步失败了。

---

## 10. 上传完成后，在聊天里会怎么被再次处理

聊天走的是 `intelligent_qa` 工作流。参考 [wf_intelligent_qa.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_intelligent_qa.py#L245)。

这里有一个很关键的优化逻辑：

- 如果某个文件已经在 vector manifest 里被视为 `embedded`，聊天时会跳过“逐文件重新解析”，改走 RAG 检索。

参考 [wf_intelligent_qa.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_intelligent_qa.py#L62) 和 [wf_intelligent_qa.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_intelligent_qa.py#L254)。

这意味着上传后在聊天里有两种大路径：

### 10.1 已 embedding 的文件

- 主要走向量检索 / RAG
- 不再逐个文件重新做重解析

### 10.2 未 embedding 的文件

- 会在聊天请求时临时直接解析
- 然后再让模型按当前 query 做文件分析

临时解析时的类型分支是：

- PDF -> PyMuPDF 抽文本
- DOCX/DOC -> `python-docx`
- PPTX/PPT -> `python-pptx`
- 图片/视频 -> VLM 分析
- 其他 -> 当作文本文件读取

参考 [wf_intelligent_qa.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_intelligent_qa.py#L575) 到 [wf_intelligent_qa.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_intelligent_qa.py#L708)。

因此：

- PDF / 文档类如果已 embedding，聊天更偏 RAG。
- 图片 / 视频如果没有向量描述，也还能在聊天时临时走 VLM。
- CSV 因为默认不自动 embedding，通常更容易落到“临时按文本读”的路径。

---

## 11. 上传完成后，在导图和播客里会怎么处理

`mindmap` 和 `podcast` 这两条工作流在解析文件时没有走向量库，而是直接按文件类型读原文件。

### 11.1 Mindmap

解析逻辑在 `wf_kb_mindmap.py`：

- PDF -> PyMuPDF
- DOCX/DOC -> `python-docx`
- PPTX/PPT -> `python-pptx`
- 其他 -> 当文本读取

参考 [wf_kb_mindmap.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_mindmap.py#L71)。

### 11.2 Podcast

解析逻辑在 `wf_kb_podcast.py`，分支和 mindmap 基本一致：

- PDF -> PyMuPDF
- DOCX/DOC -> `python-docx`
- PPTX/PPT -> `python-pptx`
- 其他 -> 当文本读取

参考 [wf_kb_podcast.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_podcast.py#L78)。

这意味着：

- 导图和播客更适合文档类来源。
- 对图片 / 视频这类媒体文件，它们没有专门的媒体解析分支，通常不是这两个功能的优先输入。

---

## 12. 上传完成后，在 PPT 里会怎么处理

PPT 的文件处理比导图/播客复杂得多。参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L1580)。

PPT 路径会先把来源分成三类：

- `url_sources`：网页来源
- `path_sources`：文档来源
- `user_image_items`：图片素材

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L1631)。

### 12.1 文档类来源

PPT 接受的主文档类型是：

- `.pdf`
- `.pptx`
- `.ppt`
- `.docx`
- `.doc`
- `.md`
- `.markdown`

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L1648)。

处理逻辑有两种：

#### 一种是 TEXT 模式

只要来源里有：

- Markdown
- 网页 URL

就会走 TEXT 输入模式，把所有来源内容拼成：

- `来源1: ...`
- `来源2: ...`

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L1675) 到 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L1732)。

这里 PDF 会优先读已缓存的 MinerU markdown。参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L1717)。

#### 另一种是 PDF-like 模式

如果全是 PDF / Office 文档，就会：

- 对 Office 文件先转 PDF
- 多文件时合并 PDF
- 再走后续 PPT 工作流

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L1734)。

### 12.2 图片来源

图片在 PPT 里不是主文档，而是作为可选 `image_items` / `image_paths` 参与后续图片筛选和插图流程。参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L1755)。

所以对 PPT 来说：

- 文档类来源负责“内容”
- 图片来源负责“视觉素材”

---

## 13. 文件类型总表

| 类型 | `/kb/upload` 是否允许 | 上传时会做什么 | 是否自动 embedding | 后续主要处理方式 |
| --- | --- | --- | --- | --- |
| `.pdf` | 是 | 保存原文件，跑 MinerU，生成统一 markdown | 是 | RAG / 聊天 / PPT / 导图 / 播客都能较完整使用 |
| `.docx` | 是 | 保存原文件，提取文本生成 markdown | 是 | embedding 时转 PDF 再走 PDF 流程 |
| `.pptx` | 是 | 保存原文件，提取 slide 文本生成 markdown | 是 | embedding 时转 PDF 再走 PDF 流程 |
| `.md` | 是 | 保存原文件，直接复制成 markdown | 是 | 直接文本分块和下游文本消费 |
| `.csv` | 是 | 保存原文件，通常可生成文本版 markdown | 否 | 更多依赖后续直接读文本，不默认走向量检索 |
| `.png/.jpg/.jpeg` | 是 | 保存原文件，通常不生成有效 markdown | 是 | 多模态生成描述，再用描述向量检索 |
| `.mp4` | 是 | 保存原文件，通常不生成有效 markdown | 是 | 多模态生成视频描述，再用描述向量检索 |
| `.doc/.ppt/.txt/.markdown/.avi/.mov` | 上传接口不允许 | 部分下游代码支持 | 不适用 | 属于“处理器支持但上传入口未开放”的类型 |

---

## 14. 最终判断

如果把当前上传逻辑抽象成一句话：

- `上传` 的职责不是“立刻把所有文件都转成统一格式”，而是把来源纳入 notebook 的 source 树，并尽可能生成一种适合后续消费的表示。

不同类型的“适合后续消费的表示”并不一样：

- 文档类更偏 `文本 / markdown / chunk`
- 媒体类更偏 `描述文本`
- CSV 当前只是“保存并可被后续直接读取”，不是默认进入 RAG 主路径

所以从系统设计上看，当前上传模块本质上是在做三件事：

- `source ingestion`
- `source normalization`
- `best-effort embedding`

其中真正决定质量差异的，不是“有没有上传成功”，而是：

- 这个文件类型有没有被转成高质量文本
- 有没有顺利进入向量库
- 下游功能是否对该类型有专门分支

---

## 15. 补充：和“上传”并列的两类来源导入

虽然你这次问的是上传，但当前产品里还有两类“看起来像上传、实际上不是本地文件上传”的来源入口，它们的处理方式和文件上传类似，容易一起混淆。

### 15.1 直接输入文本

接口是：

- `/api/v1/kb/add-text-source`

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L540)。

它的逻辑是：

1. 调 `SourceManager.import_text(content, title)`
2. 直接把文本保存成 notebook 内的 `.md` 来源
3. 写 source record

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L556)。

这里和本地文件上传最大的差别是：

- 它本质上直接生成了一个 markdown 来源
- 不需要做文件格式解析

### 15.2 URL 导入

接口是：

- `/api/v1/kb/import-url-as-source`

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L664)。

它的逻辑是：

1. 先抓取网页正文 `fetch_page_text(url)`
2. 调 `SourceManager.import_url(url, text, title)`，把抓下来的正文保存成 `.md`
3. 写 source record
4. 自动对保存下来的 `.md` 做 embedding

参考 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L682) 到 [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py#L741)。

因此从系统视角看：

- 本地文件上传，是“文件 -> source”
- 直接输入，是“文本 -> markdown source”
- URL 导入，是“网页正文 -> markdown source”

后两者在后续流程里都会更接近 `.md` 文件，而不是 PDF/Office/媒体文件。
