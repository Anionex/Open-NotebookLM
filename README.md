<div align="center">

<img src="static/readme/logo_small.png" alt="OpenNotebookLM" width="200"/>

# OpenNotebookLM

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Node](https://img.shields.io/badge/Node-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-2F80ED?style=flat-square&logo=apache&logoColor=white)](LICENSE)

中文 | [English](README_EN.md)

**开源的 NotebookLM 替代方案** — 上传文档，智能问答，一键生成 PPT / 思维导图 / 播客 / DrawIO 图表 / 闪卡 / 测试题 / 深度研究报告

</div>

---

## 📸 界面预览

<div align="center">
<img src="static/readme/dashboard.png" alt="首页仪表盘" width="90%"/>
<p><em>首页仪表盘 — 笔记本管理</em></p>
</div>

<div align="center">
<img src="static/readme/notebook_view.png" alt="笔记本工作区" width="90%"/>
<p><em>笔记本工作区 — 知识库 + 智能问答 + 一键生成</em></p>
</div>

<details>
<summary>更多截图</summary>

<div align="center">
<img src="static/readme/source_import.png" alt="来源引入" width="90%"/>
<p><em>来源引入 — 上传文件 / 粘贴网址 / 文本 / 联网搜索</em></p>
</div>

<div align="center">
<img src="static/readme/notebook_view_2.png" alt="生成面板" width="90%"/>
<p><em>生成面板 — 多种输出格式</em></p>
</div>

<div align="center">
<img src="static/readme/notebook_view_3.png" alt="对话与知识库" width="90%"/>
<p><em>对话与知识库详情</em></p>
</div>

<div align="center">
<img src="static/readme/ppt.png" alt="PPT 生成" width="90%"/>
<p><em>PPT 生成</em></p>
</div>

<div align="center">
<img src="static/readme/mindmap.png" alt="思维导图" width="90%"/>
<p><em>思维导图</em></p>
</div>

<div align="center">
<img src="static/readme/drawio.png" alt="DrawIO 图表" width="90%"/>
<p><em>DrawIO 图表 — 内嵌编辑器</em></p>
</div>

<div align="center">
<img src="static/readme/podcast.png" alt="知识播客" width="90%"/>
<p><em>知识播客</em></p>
</div>

<div align="center">
<img src="static/readme/flashcard.png" alt="闪卡" width="90%"/>
<p><em>闪卡学习</em></p>
</div>

<div align="center">
<img src="static/readme/quiz.png" alt="测试题" width="90%"/>
<p><em>测试题</em></p>
</div>

<div align="center">
<img src="static/readme/search.png" alt="联网搜索" width="90%"/>
<p><em>联网搜索引入来源</em></p>
</div>

<div align="center">
<img src="static/readme/deep_research.png" alt="深度研究报告" width="90%"/>
<p><em>深度研究报告生成</em></p>
</div>

</details>

---

## ✨ 核心功能

| 功能 | 说明 |
|------|------|
| 📚 **知识库管理** | 上传 PDF 等文档、粘贴网址/文本、联网搜索引入，多源聚合到笔记本 |
| 💬 **智能问答** | 基于选中文档的 RAG 问答，对话历史持久化 |
| 🎨 **PPT 生成** | 从知识库内容一键生成可编辑演示文稿 |
| 🧠 **思维导图** | 生成 Mermaid 思维导图，支持预览与导出 |
| 🎙️ **知识播客** | 将知识库内容转为播客脚本与讲解素材 |
| 🧩 **DrawIO 图表** | 从文本或图片生成可编辑 DrawIO 图表，内嵌编辑器 |
| 🃏 **闪卡** | 基于知识库内容自动生成学习闪卡 |
| 📝 **测试题** | 自动生成选择题，支持作答与评分 |
| 🔍 **联网搜索** | 支持 Serper / SerpAPI / Google CSE / Brave / 博查等多种搜索引擎 |
| 📊 **深度研究报告** | 联网搜索 + LLM 综合分析，生成结构化研究报告 |
| 🔗 **语义检索** | 本地 Embedding 向量检索，支持 Top-K 与多模型 |

---

## 🚀 快速开始

### 1. 克隆与安装

```bash
git clone https://github.com/your-org/opennotebookLM.git
cd opennotebookLM

# 创建虚拟环境（推荐 Conda）
conda create -n opennotebook python=3.11 -y
conda activate opennotebook

# 安装 Python 依赖
pip install -r requirements-base.txt
pip install -e .
```

### 2. 配置 API 密钥

```bash
cp fastapi_app/.env.example fastapi_app/.env
```

编辑 `fastapi_app/.env`，至少配置以下内容：

#### LLM API（必需）

项目通过 OpenAI 兼容接口调用大模型，默认使用 [APIyi](https://www.apiyi.com) 作为中转服务（支持 GPT / Claude / Gemini 等多种模型）。

```env
# LLM API 地址（OpenAI 兼容格式）
DEFAULT_LLM_API_URL=https://api.apiyi.com/v1

# 你的 API Key（在 APIyi 或其他 LLM 提供商处获取）
# 前端设置面板中也可以动态配置
```

> 也可以使用任何 OpenAI 兼容的 API 服务（如 OpenAI 官方、Azure OpenAI、本地 Ollama 等），只需修改 `DEFAULT_LLM_API_URL` 即可。

#### 搜索 API（联网搜索功能需要）

联网搜索和深度研究报告功能需要配置搜索引擎 API。支持以下任一提供商：

| 提供商 | 配置方式 | 获取地址 |
|--------|----------|----------|
| **Serper**（推荐） | 环境变量 `SERPER_API_KEY` | [serper.dev](https://serper.dev) |
| **SerpAPI** | 前端传入 `search_api_key` | [serpapi.com](https://serpapi.com) |
| **Google CSE** | 前端传入 `search_api_key` + `google_cse_id` | [programmablesearchengine.google.com](https://programmablesearchengine.google.com) |
| **Brave Search** | 前端传入 `search_api_key` | [brave.com/search/api](https://brave.com/search/api) |
| **博查** | 前端传入 `search_api_key` | [open.bochaai.com](https://open.bochaai.com) |

Serper 通过后端环境变量配置，其他提供商在前端设置面板中填入对应 API Key 即可。

```env
# Serper（Google 搜索），推荐
SERPER_API_KEY=your_serper_api_key
```

#### Supabase（可选）

用于用户认证与云存储。不配置时使用本地模拟用户，不影响核心功能。

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 启动后端

```bash
uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8000 --reload
```

后端启动时会自动拉起本地 Embedding 服务（Octen-Embedding-0.6B，端口 17997），首次启动会下载模型。如需关闭本地 Embedding，设置 `USE_LOCAL_EMBEDDING=0`。

- 健康检查：http://localhost:8000/health
- API 文档：http://localhost:8000/docs

### 4. 启动前端

提供中英双前端，任选其一：

```bash
# 中文前端
cd frontend_zh && npm install && npm run dev

# 英文前端
cd frontend_en && npm install && npm run dev
```

访问 http://localhost:3000（或终端提示的端口）。

> 前端的 LLM API 地址和 API Key 可在页面右上角设置面板中动态修改，无需重启。

---

## 📂 项目结构

```
opennotebookLM/
├── fastapi_app/             # 后端 API（FastAPI）
│   ├── routers/             #   路由：知识库、Paper2PPT、Paper2Drawio 等
│   ├── services/            #   业务逻辑：搜索、闪卡、测试题等
│   ├── config/              #   配置与环境变量
│   └── workflow_adapters/   #   工作流适配层
├── dataflow_agent/          # 工作流引擎（DataFlow-Agent）
│   ├── agentroles/          #   Agent 角色定义
│   ├── workflow/            #   工作流（Paper2PPT、PDF2PPT、Image2Drawio 等）
│   ├── promptstemplates/    #   提示模板
│   └── toolkits/            #   工具集（搜索、解析等）
├── frontend_en/             # 英文前端（React + Vite + Tailwind）
├── frontend_zh/             # 中文前端
├── database/                # 数据库脚本
├── docs/                    # 文档
├── script/                  # 辅助脚本
├── static/                  # 静态资源
└── outputs/                 # 生成文件输出目录
```

---

## ⚙️ 模型配置

项目采用三层模型配置体系，灵活度从粗到细：

1. **基础模型层** — 定义可用模型名称（`MODEL_GPT_4O`、`MODEL_CLAUDE_HAIKU` 等）
2. **工作流层** — 为每个工作流设置默认模型（`PAPER2PPT_DEFAULT_MODEL` 等）
3. **角色层** — 精细控制工作流中每个角色使用的模型（`PAPER2PPT_OUTLINE_MODEL` 等）

详见 `fastapi_app/.env.example` 中的完整配置说明。

---

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request。详见 [贡献指南](docs/contributing.md)。

---

## 📄 许可证

[Apache License 2.0](LICENSE)

生成功能基于 [OpenDCAI/Paper2Any](https://github.com/OpenDCAI/Paper2Any)。

---

<div align="center">

**若本项目对你有帮助，欢迎 ⭐ Star**

</div>
