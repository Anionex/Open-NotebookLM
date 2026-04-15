# Open-NotebookLM 开发总览文档

## 1. 文档目的

这份文档是给两类读者准备的：

- 新加入项目的开发者。
- 需要快速理解当前代码组织方式、扩展方式与边界约束的 CC / 编码助手。

它不是逐行源码注释，而是一份“开发地图 + 约定说明 + 阅读导航”。

为了保证信息密度，这份文档的说明范围是：

- 覆盖 Git 当前跟踪的核心源码目录。
- 详细说明一级目录、关键子目录、主入口文件和承担业务职责的核心文件。
- 不逐个解释 `__pycache__`、前端构建产物、图片资源、`node_modules` 这类非业务实现文件。

如果你只想知道从哪开始看代码，建议按这个顺序阅读：

1. 本文。
2. [thinkflow-workflow-source-document-summary-guidance.md](/root/user/szl/prj/Open-NotebookLM/docs/thinkflow-workflow-source-document-summary-guidance.md)
3. [thinkflow-summary-document-guidance-output-prompts.md](/root/user/szl/prj/Open-NotebookLM/docs/thinkflow-summary-document-guidance-output-prompts.md)
4. [thinkflow-upload-file-processing-flow.md](/root/user/szl/prj/Open-NotebookLM/docs/thinkflow-upload-file-processing-flow.md)
5. [CLAUDE.md](/root/user/szl/prj/Open-NotebookLM/docs/CLAUDE.md)

---

## 2. 项目总体结构

当前仓库核心上是一个三层架构：

```text
frontend_zh / frontend_en
        ↓
fastapi_app
        ↓
workflow_engine
```

职责拆分如下：

- `frontend_zh`：主产品前端，当前 ThinkFlow 工作区的主要 UI 和交互都在这里。
- `frontend_en`：较旧或备用的英文前端，实现方式和产品形态与中文前端不完全一致。
- `fastapi_app`：后端入口层与业务服务层，负责 API、存储编排、provider 选择、workspace 管理、source 管理。
- `workflow_engine`：工作流层，负责 LLM/VLM 多步骤流程、prompt 组装、agent 执行、状态机式流程编排。

当前工程的一个核心特点是：

- `来源引入`
- `Chat / 分析`
- `消费 / 输出`

这三块应该被视为相互独立的子系统。

它们之间不应该直接强耦合，而是通过工作区对象联通，尤其是：

- `梳理文档`
- `摘要`
- `产出指导`

其中当前最重要的正式桥接对象是：

- `梳理文档`
- `产出指导`

这部分详细逻辑见：

- [thinkflow-workflow-source-document-summary-guidance.md](/root/user/szl/prj/Open-NotebookLM/docs/thinkflow-workflow-source-document-summary-guidance.md)
- [thinkflow-summary-document-guidance-output-prompts.md](/root/user/szl/prj/Open-NotebookLM/docs/thinkflow-summary-document-guidance-output-prompts.md)

---

## 3. 顶层目录与根文件说明

### 3.1 顶层目录

| 路径 | 作用 |
| --- | --- |
| [fastapi_app](/root/user/szl/prj/Open-NotebookLM/fastapi_app) | FastAPI 后端、provider 接入、workspace 管理、source 管理、outputs-v2 主实现 |
| [workflow_engine](/root/user/szl/prj/Open-NotebookLM/workflow_engine) | 工作流引擎、prompt 模板、agent 封装、多模态工具、RAG 向量处理 |
| [frontend_zh](/root/user/szl/prj/Open-NotebookLM/frontend_zh) | 主前端，当前 ThinkFlow 工作区核心实现 |
| [frontend_en](/root/user/szl/prj/Open-NotebookLM/frontend_en) | 英文前端 / 另一套较旧界面实现 |
| [scripts](/root/user/szl/prj/Open-NotebookLM/scripts) | 启停脚本、迁移脚本、本地运行辅助脚本 |
| [static](/root/user/szl/prj/Open-NotebookLM/static) | README / 展示用静态资源图片 |
| [supabase](/root/user/szl/prj/Open-NotebookLM/supabase) | Supabase 相关配置占位目录 |
| [docs](/root/user/szl/prj/Open-NotebookLM/docs) | 开发文档与专题分析文档 |
| [outputs](/root/user/szl/prj/Open-NotebookLM/outputs) | 运行时数据目录，保存 notebook 数据、workspace 数据、sources、向量库、产出文件 |

### 3.2 根文件

| 文件 | 作用 |
| --- | --- |
| [.gitignore](/root/user/szl/prj/Open-NotebookLM/.gitignore) | Git 忽略规则 |
| [LICENSE](/root/user/szl/prj/Open-NotebookLM/LICENSE) | 开源许可 |
| [requirements-base.txt](/root/user/szl/prj/Open-NotebookLM/requirements-base.txt) | 当前主依赖清单，涵盖 FastAPI、LangChain、文档解析、向量库、前后端所需核心依赖 |
| [requirements-backup.txt](/root/user/szl/prj/Open-NotebookLM/requirements-backup.txt) | 备份依赖清单 |
| [sitecustomize.py](/root/user/szl/prj/Open-NotebookLM/sitecustomize.py) | 对特定运行环境下的 vLLM/flash_attn rotary import 做兼容 patch，属于运行时补丁文件 |

---

## 4. `fastapi_app/`：后端主业务层

`fastapi_app` 是当前主业务后端。可以简单理解为：

- `routers/` 负责 HTTP API 暴露。
- `services/` 负责业务编排。
- `providers/` 负责第三方 API 接入。
- `modules/` 负责更垂直的复杂子系统。
- `datasources/` 负责结构化数据源层。

### 4.1 核心入口与基础文件

| 文件 | 作用 |
| --- | --- |
| [main.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/main.py) | FastAPI 应用入口，加载 `.env`，注册中间件与所有 router，并暴露 `/outputs/*` 静态文件服务 |
| [schemas.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/schemas.py) | 各类请求与响应 schema 定义 |
| [notebook_paths.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/notebook_paths.py) | 全项目最重要的路径约束文件，统一定义 notebook-centric 的 `outputs/` 目录结构 |
| [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py) | 来源导入核心类，负责导入本地文件 / 文本 / URL，生成 `original`、`mineru`、`markdown` 三类 source 表示 |
| [kb_records.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/kb_records.py) | notebook 下 source/output 的 JSON record 读写工具 |
| [utils.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/utils.py) | 输出 URL、路径转换等通用工具 |
| [README.md](/root/user/szl/prj/Open-NotebookLM/fastapi_app/README.md) | 当前主要介绍 SQLBot backend 嵌入背景，不是完整后端开发文档 |

### 4.2 `config/`

| 文件 | 作用 |
| --- | --- |
| [settings.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/config/settings.py) | 所有环境变量的统一读取入口，基于 `BaseSettings` 加载 `fastapi_app/.env`，定义 LLM、Embedding、TTS、Search、Supabase 等配置 |

开发约定：

- 所有新引入的环境变量，优先在这里补齐字段定义。
- 同步更新 [fastapi_app/.env.example](/root/user/szl/prj/Open-NotebookLM/fastapi_app/.env.example)。

### 4.3 `dependencies/`

| 文件 | 作用 |
| --- | --- |
| [auth.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/dependencies/auth.py) | Supabase 相关依赖注入与认证辅助 |

### 4.4 `middleware/`

| 文件 | 作用 |
| --- | --- |
| [api_key.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/middleware/api_key.py) | API Key 中间件 |
| [logging.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/middleware/logging.py) | 请求日志中间件 |

### 4.5 `providers/`：外部 API 抽象层

这是当前仓库扩展第三方能力时最应该遵守的边界层。

| 文件 | 作用 |
| --- | --- |
| [base.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/base.py) | `EmbeddingProvider`、`TTSProvider`、`SearchProvider` 三个抽象基类 |
| [__init__.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/__init__.py) | provider 统一导出入口，根据环境变量选择搜索 provider，并实例化 embedding / tts provider |
| [apiyi_embedding.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/apiyi_embedding.py) | ApiYi embedding 实现 |
| [openai_embedding.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/openai_embedding.py) | OpenAI-compatible embedding 实现 |
| [apiyi_tts.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/apiyi_tts.py) | ApiYi TTS 实现 |
| [openai_tts.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/openai_tts.py) | OpenAI-compatible TTS 实现 |
| [bailian_tts.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/bailian_tts.py) | 百炼 TTS 实现 |
| [serper_search.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/serper_search.py) | Serper 搜索实现 |
| [serpapi_search.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/serpapi_search.py) | SerpAPI 搜索实现 |
| [bocha_search.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/bocha_search.py) | 博查搜索实现 |

开发原则：

- 不要在 router 里直接写第三方 API 调用。
- 不要在 workflow 里散落 provider 细节，除非是 `workflow_engine/toolkits/multimodaltool` 这一层的多模态底层调用。
- 新 provider 应先落在 `providers/`，再由 `services/` 封装业务语义。

### 4.6 `services/`：业务编排层

`services/` 是 FastAPI 层最重要的业务逻辑目录。

#### 4.6.1 ThinkFlow / Notebook 主链

| 文件 | 作用 |
| --- | --- |
| [document_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/document_service.py) | 梳理文档的创建、保存、版本恢复、push、AI organize、AI merge |
| [thinkflow_workspace_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/thinkflow_workspace_service.py) | `summary` / `guidance` workspace item 的管理与 capture |
| [output_v2_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/output_v2_service.py) | outputs-v2 的核心实现，负责 outline、generate、PPT 页面再生成、导入为来源等 |
| [workspace_repository.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/workspace_repository.py) | workspace 存储基类与 JSON manifest 读写抽象 |
| [source_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/source_service.py) | 列出 notebook 来源、返回来源预览内容、向量状态读取 |
| [notebook_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/notebook_service.py) | notebook 级别服务 |

#### 4.6.2 产出与工具型服务

| 文件 | 作用 |
| --- | --- |
| [paper2ppt_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/paper2ppt_service.py) | PPT 生成服务，承接 paper2ppt 工作流 |
| [paper2drawio_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/paper2drawio_service.py) | DrawIO 生成服务 |
| [flashcard_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/flashcard_service.py) | 闪卡生成服务 |
| [quiz_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/quiz_service.py) | Quiz 生成服务 |
| [fast_research_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/fast_research_service.py) | Fast Research 搜索入口 |
| [search_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/search_service.py) | 搜索 provider 的业务封装层 |
| [search_and_add_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/search_and_add_service.py) | 搜索并添加来源的服务 |
| [deep_research_report_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/deep_research_report_service.py) | Deep Research 报告生成 |
| [deep_research_integration.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/deep_research_integration.py) | Deep Research 集成层 |

#### 4.6.3 Provider 适配型服务

| 文件 | 作用 |
| --- | --- |
| [embedding_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/embedding_service.py) | `providers.embedding_provider` 的封装入口 |
| [tts_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/tts_service.py) | `providers.tts_provider` 的封装入口 |

#### 4.6.4 数据抽取 / SQLBot 相关

| 文件 | 作用 |
| --- | --- |
| [data_extract_service.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/data_extract_service.py) | 数据抽取服务主入口 |
| [embedded_sqlbot.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/embedded_sqlbot.py) | SQLBot 的 embedded 模式适配实现 |
| [wa_data_extract.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/wa_data_extract.py) | 数据抽取外部桥接层 |
| [wa_paper2ppt.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/wa_paper2ppt.py) | paper2ppt 旧桥接/状态初始化辅助 |

### 4.7 `routers/`：HTTP API 层

router 的原则应该保持“薄”：

- 负责参数校验和请求解包。
- 负责把请求转成 service 调用。
- 不负责复杂业务编排。

| 文件 | 作用 |
| --- | --- |
| [kb.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb.py) | 当前最重的综合 router，包含来源上传、聊天、PPT、导图、播客、直接输入、URL 导入、deep research 等 |
| [kb_documents.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb_documents.py) | 梳理文档 API |
| [kb_workspace.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb_workspace.py) | `summary` / `guidance` workspace item API |
| [kb_outputs_v2.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb_outputs_v2.py) | outputs-v2 API |
| [kb_notebooks.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb_notebooks.py) | notebook API |
| [kb_sources.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb_sources.py) | 来源预览、解析辅助 API |
| [kb_embedding.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/kb_embedding.py) | 向量入库、向量查询、删除向量 API |
| [files.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/files.py) | 文件上传与文件相关 API 的另一组实现 |
| [data_extract.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/data_extract.py) | 数据抽取 API |
| [paper2ppt.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/paper2ppt.py) | Paper2PPT API |
| [paper2drawio.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/paper2drawio.py) | Paper2DrawIO API |
| [search.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/search.py) | 搜索 API 封装 |
| [tts.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/tts.py) | TTS 音色获取等接口 |
| [auth.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/auth.py) | 认证相关接口 |
| [__init__.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/routers/__init__.py) | router 聚合导出 |

### 4.8 `datasources/`：结构化数据源子系统

这部分主要服务 SQLBot / 数据抽取能力。

| 文件 | 作用 |
| --- | --- |
| [config.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/config.py) | 数据源层配置 |
| [database.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/database.py) | 数据库连接与底层管理 |
| [datasource_interface.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/datasource_interface.py) | 数据源抽象接口 |
| [datasource_factory.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/datasource_factory.py) | 数据源实例工厂 |
| [llm_factory.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/llm_factory.py) | 数据源子系统内的 LLM 工厂 |
| [openai_compat_chat_model.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/openai_compat_chat_model.py) | OpenAI-compatible chat model 适配 |
| [unified_engine.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/unified_engine.py) | 统一数据源执行引擎 |
| [adapters/csv_datasource.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/adapters/csv_datasource.py) | CSV 数据源适配 |
| [adapters/excel_datasource.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/adapters/excel_datasource.py) | Excel 数据源适配 |
| [adapters/sql_datasource.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/adapters/sql_datasource.py) | SQL 数据源适配 |
| [adapters/clickhouse_datasource.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/adapters/clickhouse_datasource.py) | ClickHouse 数据源适配 |
| [adapters/oracle_datasource.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/adapters/oracle_datasource.py) | Oracle 数据源适配 |
| [adapters/elasticsearch_datasource.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/datasources/adapters/elasticsearch_datasource.py) | Elasticsearch 数据源适配 |

### 4.9 `modules/`：复杂子系统

`modules/` 里放的不是主 ThinkFlow 工作区链路，而是更垂直、复杂或旁路的能力。

#### 4.9.1 `modules/rag/`

这是结构化数据和检索增强相关的 RAG 子系统。

关键文件：

- [hybrid_retriever.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/rag/hybrid_retriever.py)
- [bm25_retriever.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/rag/bm25_retriever.py)
- [vector_store.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/rag/vector_store.py)
- [terminology.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/rag/terminology.py)
- [few_shot.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/rag/few_shot.py)
- [query_rewrite.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/rag/query_rewrite.py)
- [schema_embedding.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/rag/schema_embedding.py)
- [value_retriever.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/rag/value_retriever.py)

#### 4.9.2 `modules/agents/`

这是 SQLBot / 数据代理链相关实现。

关键文件：

- [sqlbot_agent.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/agents/sqlbot_agent.py)
- [router_agent.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/agents/router_agent.py)
- [clarification_agent.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/agents/clarification_agent.py)
- [multi_candidate_generator.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/agents/multi_candidate_generator.py)
- [pipeline/graph.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/agents/pipeline/graph.py)
- [pipeline/state.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/agents/pipeline/state.py)
- [tools/](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/agents/tools) 下的各类 SQL / schema / cross-source 工具

#### 4.9.3 `modules/deep_research/`

Deep Research 子系统。

关键文件：

- [react_agent.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/deep_research/react_agent.py)
- [prompt.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/deep_research/prompt.py)
- [tool_search.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/deep_research/tool_search.py)
- [tool_visit.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/deep_research/tool_visit.py)
- [tool_file.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/deep_research/tool_file.py)
- [tool_python.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/deep_research/tool_python.py)
- [tool_scholar.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/deep_research/tool_scholar.py)
- [file_tools/file_parser.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/deep_research/file_tools/file_parser.py)
- [file_tools/video_analysis.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/deep_research/file_tools/video_analysis.py)

#### 4.9.4 其他模块

| 路径 | 作用 |
| --- | --- |
| [modules/catalog](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/catalog) | catalog 服务 |
| [modules/data_pipeline](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/data_pipeline) | 数据管线 bootstrap |
| [modules/ega](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/ega) | EGA 相关分析能力 |
| [modules/semantics](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/semantics) | schema 语义对齐相关 |
| [modules/routing_feedback.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/modules/routing_feedback.py) | 路由反馈辅助 |

### 4.10 其他后端辅助目录

| 路径 / 文件 | 作用 |
| --- | --- |
| [fastapi_app/utils](/root/user/szl/prj/Open-NotebookLM/fastapi_app/utils) | 后端通用工具目录 |
| [utils/csv_export.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/utils/csv_export.py) | CSV 导出辅助 |
| [utils/excel_export.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/utils/excel_export.py) | Excel 导出辅助 |
| [utils/error_handler.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/utils/error_handler.py) | 错误处理辅助 |
| [fastapi_app/models](/root/user/szl/prj/Open-NotebookLM/fastapi_app/models) | 数据模型目录 |
| [models/agent_log.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/models/agent_log.py) | agent 日志模型 |
| [models/chat_models.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/models/chat_models.py) | 聊天相关模型 |
| [fastapi_app/adapters](/root/user/szl/prj/Open-NotebookLM/fastapi_app/adapters) | 适配层目录，目前内容较轻 |
| [fastapi_app/core](/root/user/szl/prj/Open-NotebookLM/fastapi_app/core) | 核心公共层目录，目前内容较轻 |

---

## 5. `workflow_engine/`：工作流层

`workflow_engine` 是真正负责多步骤 AI 流程编排的地方。

### 5.1 核心文件

| 文件 | 作用 |
| --- | --- |
| [state.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/state.py) | 各类 workflow state 定义 |
| [logger.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/logger.py) | 工作流日志封装 |
| [workflow/registry.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/registry.py) | 工作流注册表，`@register("name")` 就是从这里接入 |
| [workflow/__init__.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/__init__.py) | 自动发现 `wf_*.py` 文件，并提供 `run_workflow(name, state)` |
| [graphbuilder/graph_builder.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/graphbuilder/graph_builder.py) | 图式 workflow 构建器 |
| [agentroles/cores/base_agent.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/agentroles/cores/base_agent.py) | 通用 agent 执行基类，负责 prompt 渲染、消息构建、解析器绑定 |
| [toolkits/tool_manager.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/tool_manager.py) | 工具管理器 |

### 5.2 `workflow/`：具体工作流

| 文件 | 作用 |
| --- | --- |
| [wf_intelligent_qa.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_intelligent_qa.py) | notebook chat / `/kb/chat` 的核心智能问答流程 |
| [wf_kb_page_content.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_page_content.py) | KB PPT 大纲生成与图片筛选插入流程 |
| [wf_kb_mindmap.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_mindmap.py) | 思维导图生成流程 |
| [wf_kb_podcast.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_kb_podcast.py) | 播客脚本生成流程 |
| [wf_paper2ppt_parallel_consistent_style.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_paper2ppt_parallel_consistent_style.py) | Paper2PPT 正式页生成流程 |
| [wf_paper2drawio.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_paper2drawio.py) | DrawIO 生成流程 |
| [wf_paper2drawio_sam3.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/wf_paper2drawio_sam3.py) | 带 SAM3 的 DrawIO 流程 |
| [base.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/base.py) | workflow 基础定义 |

### 5.3 `agentroles/`

| 文件 | 作用 |
| --- | --- |
| [kb_outline_agent.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/agentroles/kb_outline_agent.py) | PPT 大纲 agent |
| [kb_prompt_agents.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/agentroles/kb_prompt_agents.py) | 通用 KB prompt agent |
| [cores/base_agent.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/agentroles/cores/base_agent.py) | agent 核心基类 |
| [cores/configs.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/agentroles/cores/configs.py) | agent 配置 |
| [cores/registry.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/agentroles/cores/registry.py) | agent 注册表 |
| [cores/strategies.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/agentroles/cores/strategies.py) | agent 执行策略 |

### 5.4 `promptstemplates/`

| 文件 | 作用 |
| --- | --- |
| [prompt_template.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/promptstemplates/prompt_template.py) | prompt 模板渲染器 |
| [prompts_repo.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/promptstemplates/prompts_repo.py) | 通用 prompt 仓库 |
| [drawio_system_prompt.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/promptstemplates/drawio_system_prompt.py) | DrawIO prompt |
| [resources/pt_qa_agent_repo.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/promptstemplates/resources/pt_qa_agent_repo.py) | QA agent prompt 模板 |
| [resources/pt_kb_ppt_repo.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/promptstemplates/resources/pt_kb_ppt_repo.py) | KB PPT prompt 模板 |

### 5.5 `toolkits/`

| 路径 | 作用 |
| --- | --- |
| [toolkits/ragtool/vector_store_tool.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/ragtool/vector_store_tool.py) | 知识库文件 embedding / 向量入库的核心实现 |
| [toolkits/research_tools.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/research_tools.py) | 网页抓取等 research 工具 |
| [toolkits/multimodaltool](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/multimodaltool) | MinerU、OCR、图像理解、视频理解、TTS、多模态 provider 适配等底层能力 |
| [toolkits/drawio_tools.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/drawio_tools.py) | DrawIO 辅助 |
| [toolkits/image2drawio.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/image2drawio.py) | image -> drawio 工具 |
| [toolkits/resources/ops.json](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/resources/ops.json) | 工具 / 算子资源配置 |

### 5.6 其他基础层

| 路径 | 作用 |
| --- | --- |
| [graphbuilder](/root/user/szl/prj/Open-NotebookLM/workflow_engine/graphbuilder) | LangGraph 风格图构建辅助 |
| [llm_callers](/root/user/szl/prj/Open-NotebookLM/workflow_engine/llm_callers) | LLM / VLM 调用封装 |
| [parsers](/root/user/szl/prj/Open-NotebookLM/workflow_engine/parsers) | 输出解析器 |
| [utils](/root/user/szl/prj/Open-NotebookLM/workflow_engine/utils) | workflow 辅助工具 |
| [utils_common.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/utils_common.py) | 历史工具函数集合 |

---

## 6. `frontend_zh/`：当前主前端

这是当前最重要的前端实现。

### 6.1 入口与基础文件

| 文件 | 作用 |
| --- | --- |
| [src/main.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/main.tsx) | 前端启动入口 |
| [src/App.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/App.tsx) | 应用总入口 |
| [src/index.css](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/index.css) | 全局样式 |
| [src/config/api.ts](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/config/api.ts) | `apiFetch()` 封装，统一处理后端 API 调用 |
| [src/lib/supabase.ts](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/lib/supabase.ts) | Supabase 客户端 |
| [src/stores/authStore.ts](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/stores/authStore.ts) | 登录态 store |
| [src/styles/design-tokens.ts](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/styles/design-tokens.ts) | 设计 token |

### 6.2 页面文件

| 文件 | 作用 |
| --- | --- |
| [src/pages/AuthPage.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/pages/AuthPage.tsx) | 登录页 |
| [src/pages/Dashboard.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/pages/Dashboard.tsx) | notebook 列表 / 面板 |
| [src/pages/NotebookView.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/pages/NotebookView.tsx) | notebook 页面入口，实际直接渲染 `ThinkFlowWorkspace` |

### 6.3 ThinkFlow 核心组件

| 文件 | 作用 |
| --- | --- |
| [ThinkFlowWorkspace.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.tsx) | 当前主工作区实现，几乎所有来源、聊天、沉淀、输出编排都在这里 |
| [ThinkFlowWorkspace.css](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowWorkspace.css) | 工作区样式 |
| [ThinkFlowAddSourceModal.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowAddSourceModal.tsx) | 添加来源弹窗 |
| [ThinkFlowLeftSidebar.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowLeftSidebar.tsx) | 左侧来源与导航栏 |
| [ThinkFlowCenterPanel.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowCenterPanel.tsx) | 中间对话区 |
| [ThinkFlowRightPanel.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowRightPanel.tsx) | 右侧工作区面板 |
| [DocumentPanelSection.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/DocumentPanelSection.tsx) | 梳理文档面板 |
| [SummaryPanelSection.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/SummaryPanelSection.tsx) | 摘要面板 |
| [GuidancePanelSection.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/GuidancePanelSection.tsx) | 产出指导面板 |
| [OutputWorkspaceSection.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/OutputWorkspaceSection.tsx) | 输出工作区 |
| [ThinkFlowOutputContextModal.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowOutputContextModal.tsx) | 输出上下文确认弹窗 |
| [ThinkFlowTopBar.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowTopBar.tsx) | 顶栏 |
| [thinkflow-types.ts](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/thinkflow-types.ts) | ThinkFlow 相关类型定义 |

### 6.4 输出查看组件

| 文件 | 作用 |
| --- | --- |
| [MermaidPreview.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/MermaidPreview.tsx) | Mermaid 预览 |
| [ThinkFlowFlashcardStudy.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowFlashcardStudy.tsx) | 闪卡学习界面 |
| [ThinkFlowQuizStudy.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/components/ThinkFlowQuizStudy.tsx) | Quiz 学习界面 |

### 6.5 类型与辅助文件

| 文件 | 作用 |
| --- | --- |
| [src/types/index.ts](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/types/index.ts) | 全局 TS 类型 |
| [src/vite-env.d.ts](/root/user/szl/prj/Open-NotebookLM/frontend_zh/src/vite-env.d.ts) | Vite 环境声明 |

---

## 7. `frontend_en/`：备用 / 旧版英文前端

`frontend_en` 当前不是主工作区实现，但保留了较完整的一套产品界面。

| 文件 | 作用 |
| --- | --- |
| [src/main.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/main.tsx) | 英文前端入口 |
| [src/App.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/App.tsx) | 英文前端根组件 |
| [src/pages/AuthPage.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/pages/AuthPage.tsx) | 登录页 |
| [src/pages/Dashboard.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/pages/Dashboard.tsx) | Dashboard |
| [src/pages/NotebookView.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/pages/NotebookView.tsx) | 英文 notebook 页面，包含较旧的一体式 notebook 逻辑 |
| [src/config/api.ts](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/config/api.ts) | API 调用封装 |
| [src/lib/supabase.ts](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/lib/supabase.ts) | Supabase 客户端 |
| [src/stores/authStore.ts](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/stores/authStore.ts) | 登录态 |
| [src/services/apiSettingsService.ts](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/services/apiSettingsService.ts) | API 设置服务 |
| [src/services/clientCache.ts](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/services/clientCache.ts) | 前端缓存辅助 |
| [src/components/DrawioInlineEditor.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/components/DrawioInlineEditor.tsx) | DrawIO 内嵌编辑 |
| [src/components/SettingsModal.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/components/SettingsModal.tsx) | 设置弹窗 |
| [src/hooks/useToast.tsx](/root/user/szl/prj/Open-NotebookLM/frontend_en/src/hooks/useToast.tsx) | Toast hook |

团队约定上，新增主链功能优先落 `frontend_zh`，除非明确需要同步英文前端。

---

## 8. `scripts/`、`static/`、`supabase/`

### 8.1 `scripts/`

| 文件 | 作用 |
| --- | --- |
| [start.sh](/root/user/szl/prj/Open-NotebookLM/scripts/start.sh) | 全栈启动 |
| [stop.sh](/root/user/szl/prj/Open-NotebookLM/scripts/stop.sh) | 停止脚本 |
| [start_backend.sh](/root/user/szl/prj/Open-NotebookLM/scripts/start_backend.sh) | 后端启动，支持本地 GPU 服务参数 |
| [start_frontend.sh](/root/user/szl/prj/Open-NotebookLM/scripts/start_frontend.sh) | 前端启动 |
| [start_embedding_4b.sh](/root/user/szl/prj/Open-NotebookLM/scripts/start_embedding_4b.sh) | embedding 服务辅助启动 |
| [monitor.sh](/root/user/szl/prj/Open-NotebookLM/scripts/monitor.sh) | 监控脚本 |
| [migrate_to_json_records.py](/root/user/szl/prj/Open-NotebookLM/scripts/migrate_to_json_records.py) | JSON record 迁移 |
| [start_example.md](/root/user/szl/prj/Open-NotebookLM/scripts/start_example.md) | 启动示例文档 |

### 8.2 `static/`

主要是项目展示截图和 README 图片，不承载业务逻辑。

### 8.3 `supabase/`

当前主要是 Supabase 相关占位结构，用于部署或配套函数扩展。

### 8.4 测试相关

当前仓库没有成体系的自动化测试覆盖，更多是：

- 启动脚本
- 局部验证脚本
- 少量 ad-hoc provider / API 测试

因此新增功能后，除了补测试，更现实的要求是：

- 至少补一条可复现的手动验证路径
- 在文档中写清入口、输入、预期输出

---

## 9. `outputs/`：运行时数据的唯一落点

`outputs/` 是当前项目的运行时数据根目录。

请把它理解为：

- 不是源码目录。
- 不是临时缓存目录那么简单。
- 而是 notebook runtime state、workspace state、source、vector store、产出文件的统一承载区。

### 9.1 基本原则

所有“输入”和“产出”都应落在 `outputs/` 下。

这里的“输入”包括：

- 上传的本地文件
- 导入的 URL
- 直接输入保存成的 markdown 来源
- 对这些来源的 `markdown/`、`mineru/`、`sam3/` 等派生数据

这里的“产出”包括：

- 文档工作区数据
- 摘要 / 产出指导 workspace item
- outline / output result
- PPT / report / mindmap / podcast / quiz / flashcard 等实际文件

### 9.2 当前目录原理

路径统一由 [notebook_paths.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/notebook_paths.py) 约束。

核心形式是：

```text
outputs/{user_id}/{safe_title}_{notebook_id}/
├── sources/
├── vector_store/
├── documents/              # 旧布局
├── workspace_items/        # 旧布局
├── outputs_v2/             # 旧布局
├── workspace/              # 新布局，内部再分 documents / notes / outputs
├── ppt/{timestamp}/
├── mindmap/{timestamp}/
├── podcast/{timestamp}/
└── 其他功能目录
```

其中 workspace 相关目录当前是“迁移中过渡态”：

- 旧布局会直接写 `documents/`、`workspace_items/`、`outputs_v2/`
- 新布局会迁移到 `workspace/documents/`、`workspace/notes/`、`workspace/outputs/`

这个迁移逻辑由 [workspace_repository.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/services/workspace_repository.py) 负责。

这套 notebook-centric 设计的意义是：

- 同一个 notebook 的所有 runtime 数据天然聚合在一起。
- source、workspace、output 可以通过路径互相定位。
- 旧功能和新功能都不应该绕开 `NotebookPaths` 自己拼路径。

### 9.3 专题文档

`outputs/` 的实践细节建议直接配合以下文档阅读：

- [thinkflow-upload-file-processing-flow.md](/root/user/szl/prj/Open-NotebookLM/docs/thinkflow-upload-file-processing-flow.md)
- [thinkflow-workflow-source-document-summary-guidance.md](/root/user/szl/prj/Open-NotebookLM/docs/thinkflow-workflow-source-document-summary-guidance.md)

---

## 10. 当前开发原则

这一节是给人和 CC 都看的“行为约束”。

### 10.1 原则一：来源引入、Chat、消费必须解耦

当前代码应当被理解为三个独立子系统：

1. `来源引入`
2. `Chat / 分析`
3. `消费 / 输出`

它们不能直接强耦合成“一次请求从来源直出最终产物”的黑盒。

正确的设计方式是：

- `来源` 进入 notebook source 树
- `Chat` 围绕来源和工作区对象进行分析
- `消费` 通过工作区对象与来源状态构建正式上下文

当前桥接对象主要是：

- `梳理文档`
- `摘要`
- `产出指导`

其中正式产出当前最稳定的桥梁是：

- `梳理文档`
- `产出指导`

### 10.2 原则二：router 薄、service 稳、workflow 重

推荐责任边界：

- `router`：解包 HTTP 请求、参数校验、调 service
- `service`：业务编排、状态持久化、路径组织、调用 workflow 或 provider
- `workflow`：复杂多步 AI 流程、prompt 注入、agent 执行
- `provider`：第三方 API 接口接入

不要做的事：

- 不要在 router 里写 prompt 拼接。
- 不要在 workflow 里直接写固定环境变量读取逻辑。
- 不要在 service 里硬编码第三方 API 细节，除非就是 provider facade。

### 10.3 原则三：所有运行时文件都应走 `NotebookPaths`

任何新功能如果要写文件：

- 先看 [notebook_paths.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/notebook_paths.py)
- 没有合适路径再扩展 `NotebookPaths`
- 不要直接在任意目录下新建散落文件夹

### 10.4 原则四：来源导入统一走 `SourceManager`

无论是：

- 上传文件
- 直接输入文本
- URL 导入

都应尽量统一到 [source_manager.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/source_manager.py) 这条路径上。

这样才能保证：

- source 树结构一致
- 后续 source preview / embedding / output 引用逻辑一致

### 10.5 原则五：workspace 对象是产品级边界，不是临时字符串

`document`、`summary`、`guidance`、`output` 这些对象都已经有稳定的数据结构和持久化形态。

新增功能时：

- 不要直接把 prompt 拼在 query 字符串里冒充正式对象
- 优先复用已有 workspace object 或新增一种正式对象类型

### 10.6 原则六：新增能力优先走 provider pattern

新增外部 API 时，优先路径应是：

1. `.env.example` 补配置说明
2. `settings.py` 补环境变量字段
3. `providers/base.py` 补抽象接口或复用已有接口
4. `providers/` 下新增实现
5. `providers/__init__.py` 或对应 service 中接入选择逻辑
6. `services/` 中增加业务语义封装
7. `routers/` 或 `workflow_engine/toolkits/` 中调用 service / provider

而不是：

- 在某个 workflow 文件里直接硬编码某家 API 的 URL 和 key

### 10.7 原则七：prompt 是模板资产，不是散落字符串

推荐优先级：

- 通用可复用 prompt 放 `workflow_engine/promptstemplates/`
- 仅某个 service 本地使用、且非常短小的 prompt 才允许留在 service 中

如果一个 prompt 已经开始承担产品语义边界，就应该进入 prompt template 层。

### 10.8 原则八：可选依赖失败时要优雅降级

当前 `workflow_engine/workflow/__init__.py` 已经允许某些 workflow 因缺失依赖而跳过加载。参考 [workflow/__init__.py](/root/user/szl/prj/Open-NotebookLM/workflow_engine/workflow/__init__.py#L12)。

后续扩展也应该保持这个方向：

- 能降级就降级
- 能 fallback 就 fallback
- 不要因为可选能力不可用导致整个 API 启动失败

---

## 11. 新增外部 API / Provider 的标准接入方式

这是后续扩展时最重要的操作模板。

### 11.1 场景：新增一种 Search / TTS / Embedding Provider

推荐步骤：

1. 在 [fastapi_app/.env.example](/root/user/szl/prj/Open-NotebookLM/fastapi_app/.env.example) 里补配置示例。
2. 在 [settings.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/config/settings.py) 中补字段。
3. 在 [base.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/base.py) 中确认是否已有合适抽象。
4. 在 `fastapi_app/providers/` 下新增对应实现文件。
5. 在 [providers/__init__.py](/root/user/szl/prj/Open-NotebookLM/fastapi_app/providers/__init__.py) 中注册选择逻辑。
6. 如有必要，在 `services/` 中加 facade，例如 `SearchService` / `TTSService` / `EmbeddingService` 这种层。
7. 由 router 或 workflow 间接调用这个 service。

### 11.2 场景：新增一种多模态底层调用

如果是图片理解、视频理解、OCR、MinerU 一类能力，优先落点通常是：

- [workflow_engine/toolkits/multimodaltool](/root/user/szl/prj/Open-NotebookLM/workflow_engine/toolkits/multimodaltool)

然后由：

- workflow
- source import
- vector store embedding

这些上层链路去调用。

### 11.3 场景：新增一个需要直接给工作流用的外部能力

推荐路径：

1. provider 或 toolkit 先具备可调用接口
2. workflow state 补字段
3. `wf_*.py` 中接入新节点或 pre_tool
4. 如涉及 prompt，补 prompt template
5. 由 service 把需要的参数传入 workflow

---

## 12. 新增功能时的标准落点建议

### 12.1 新增一种来源导入方式

比如：

- 新增网页批量导入
- 新增云盘导入
- 新增录音转来源

推荐落点：

- router：接收请求
- service / router：获取原始内容
- `SourceManager`：导入为标准 source
- 可选：自动 embedding

### 12.2 新增一种工作区对象

比如新增：

- “写作计划”
- “评审意见”
- “演讲口播要求”

推荐落点：

- `thinkflow_workspace_service.py` 或新的 workspace service
- 对应 router
- 前端右侧工作区面板
- outputs-v2 中明确决定它是否参与正式产出

### 12.3 新增一种输出类型

比如新增：

- briefing
- script
- summary report

推荐落点：

1. `output_v2_service.py` 增加 target type 支持
2. 对应 router schema 增加必要字段
3. 如果需要新工作流，则新增 `wf_*.py`
4. 如果只是复用已有文本生成，则补 generation markdown / result shape
5. 前端输出工作区增加入口与展示

### 12.4 新增一种 prompt 约束对象

如果以后要让新的“上下文对象”参与生成，不要直接在前端 query 里塞整段文本。

推荐做法：

1. 定义正式对象类型
2. 持久化成 workspace / document / output context 的一部分
3. 在 outputs-v2 或 workflow query builder 中显式注入

---

## 13. 文档导航建议

这份总览文档适合先读一遍，建立全局概念。

之后建议按主题跳转：

### 13.1 想看 ThinkFlow 工作区对象是怎么衔接的

看：

- [thinkflow-workflow-source-document-summary-guidance.md](/root/user/szl/prj/Open-NotebookLM/docs/thinkflow-workflow-source-document-summary-guidance.md)

### 13.2 想看摘要 / 梳理文档 / 产出指导各自怎么生成、prompt 是什么

看：

- [thinkflow-summary-document-guidance-output-prompts.md](/root/user/szl/prj/Open-NotebookLM/docs/thinkflow-summary-document-guidance-output-prompts.md)

### 13.3 想看上传、文件解析、embedding、不同类型文件如何进入系统

看：

- [thinkflow-upload-file-processing-flow.md](/root/user/szl/prj/Open-NotebookLM/docs/thinkflow-upload-file-processing-flow.md)

### 13.4 想看给 CC 的通用协作提示

看：

- [CLAUDE.md](/root/user/szl/prj/Open-NotebookLM/docs/CLAUDE.md)

---

## 14. 给 CC 的最后约束

如果你是 CC 或任何自动编码代理，在这个仓库里做修改时，应默认遵守下面这些规则：

- 优先保持 `source -> workspace -> output` 这条链清晰，不跨层偷接。
- 涉及文件存储时先找 `NotebookPaths`，不要自己拼 `outputs` 路径。
- 涉及来源导入时先找 `SourceManager`，不要自己写散落导入逻辑。
- 涉及外部 API 接入时先走 `settings -> provider -> service -> router/workflow`。
- 涉及复杂生成流程时优先考虑 `workflow_engine`，而不是在 router/service 里堆 prompt。
- 涉及 prompt 复用时优先放 `promptstemplates/`。
- 涉及正式产出上下文时优先使用工作区对象，不要依赖 query stuffing。
- 涉及新的运行时数据时，默认都应落在 `outputs/` 体系下。

如果要做大改动，建议先判断你要改的是哪一层：

- UI 交互：`frontend_zh`
- API 与持久化：`fastapi_app`
- 多步生成流程：`workflow_engine`
- 外部能力接入：`providers` / `toolkits`

这一层判断做对了，后面的实现大概率就不会偏。
