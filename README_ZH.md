<div align="center">

<img src="static/readme/logo_small.png" alt="OpenNotebookLM" width="200"/>

# OpenNotebookLM

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Node](https://img.shields.io/badge/Node-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-2F80ED?style=flat-square&logo=apache&logoColor=white)](LICENSE)

中文 | [English](README.md)

**开源的 NotebookLM 替代方案** — 上传文档，智能问答，一键生成 PPT / 思维导图 / 播客 / DrawIO 图表 / 闪卡 / 测试题 / 深度研究报告

</div>

---

## 📅 更新日志

- **2026.03.11** — 代码重构：实行严格的功能分层架构；集成本地 TTS 模型（[Qwen3-TTS](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice)）；新增基于来源的笔记 QA 问答编辑功能（Notion AI 风格）；UI 优化；简化配置文件结构
- **2026.03.08** — 新增用户管理系统：Supabase 邮箱 + OTP 认证登录，多用户数据隔离，用户目录以邮箱命名；清理废弃脚本
- **2026.02.27** — 迁移集成 [Qwen-DeepResearch](https://github.com/Alibaba-NLP/DeepResearch) 深度研究模块；PPT 生成支持 Nano Banana 2 生图模型
- **2026.02.13** — 项目发布

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

---

## ✨ 核心功能

| 功能 | 说明 |
|------|------|
| 📚 **知识库管理** | 上传 PDF 等文档、粘贴网址/文本、联网搜索引入，多源聚合到笔记本 |
| 🔐 **用户管理** | 基于 Supabase 的邮箱注册/登录 + OTP 验证，多用户数据隔离；不配置时可无登录体验全部功能 |
| 💬 **智能问答** | 基于选中文档的 RAG 问答，对话历史持久化 |
| ✍️ **AI 辅助笔记** | Notion 风格块编辑器，支持 AI 润色、改写、解释、基于来源的智能生成，支持 1-6 级标题、列表、代码块等 Markdown 格式 |
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
git clone https://github.com/OpenDCAI/opennotebookLM.git
cd opennotebookLM

# 创建虚拟环境（推荐 Conda）
conda create -n opennotebook python=3.11 -y
conda activate opennotebook

# 安装 Python 依赖
pip install -r requirements-base.txt
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

#### Supabase（可选，用户管理）

用于多用户认证与数据隔离。**如果不配置或留空，系统将自动进入体验模式**（无需登录，单用户本地存储，所有核心功能正常使用）。

配置后支持：邮箱 + 密码注册登录、OTP 邮件验证、多用户数据隔离（每个用户独立目录）。

```env
# 如果不需要多用户功能，可以删除或留空以下配置
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### TTS 语音合成（可选，播客功能）

播客生成功能支持本地 TTS 模型。启用后会自动下载 [Qwen3-TTS](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice) 模型（约 3.4GB）。

```env
# 启用本地 TTS（0=禁用，1=启用）
USE_LOCAL_TTS=1

# TTS 引擎：qwen（推荐）或 firered
TTS_ENGINE=qwen

# 模型空闲自动卸载时间（秒，默认 300 = 5 分钟）
TTS_IDLE_TIMEOUT=300
```

> **提示**：如果不需要播客功能，可以设置 `USE_LOCAL_TTS=0` 或删除此配置以节省磁盘空间。

### 3. 启动后端

```bash
uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8213 --reload
```

后端启动时会自动拉起本地 Embedding 服务（Octen-Embedding-0.6B，默认端口 `26210`），首次启动会下载模型。如需关闭本地 Embedding，设置 `USE_LOCAL_EMBEDDING=0`。

- 健康检查：http://localhost:8213/health
- API 文档：http://localhost:8213/docs

### 4. 启动前端

提供中英双前端，任选其一：

```bash
# 中文前端
cd frontend_zh && npm install && npm run dev

# 英文前端
cd frontend_en && npm install && npm run dev
```

访问 http://localhost:3000（或终端提示的端口）。

> `npm run dev` 默认读取各前端目录下的 `vite.config.ts`，当前默认端口是 `3000`。
> 如果使用仓库自带的 `scripts/start.sh`，脚本会启动**中文前端**并强制使用 `3001` 端口，同时启动后端 `8213` 和 `cpolar` 隧道。

> 前端的 LLM API 地址和 API Key 可在页面右上角设置面板中动态修改，无需重启。

#### 前端配置（可选）

**本地部署**（前后端在同一台机器）：无需配置，默认即可使用。

**公网部署**（通过 cpolar/ngrok 等内网穿透工具）：

前端内置智能检测功能：
- 当 `.env` 配置为 `localhost` 但从公网访问时，会自动使用相对路径（当前域名）
- 开发模式下，Vite 会将 `/api` 和 `/outputs` 代理到本地后端 `http://localhost:8213`
- **推荐方式**：使用 nginx 反向代理，将前端和后端统一到同一域名下，无需额外配置

> **说明**：上面的 `3000`、`3001`、`8080`、`8213` 只是文档示例端口，实际部署时请按你的前端、后端和代理服务的真实监听端口修改对应配置。
> 对于个人测试或轻量使用，`scripts/start.sh + Vite 代理 + cpolar` 已可工作；如需更稳定的公网访问或大规模应用，仍推荐使用 nginx 反向代理方案。
> 当前仓库中的 `scripts/start.sh` 默认使用 `CPOLAR_TUNNEL_NAME=opennotebook`，并显示配置中的 `CPOLAR_PUBLIC_URL`。如果你修改了 cpolar 保留隧道，也请同步修改脚本里的这两个变量。

创建 `frontend_zh/.env`（或 `frontend_en/.env`）：

```env
# 后端 API 基础地址（本地开发）
VITE_API_BASE_URL=http://localhost:8213
```

**部署方式对比：**

| 部署方式 | 配置 | 说明 |
|---------|------|------|
| **本地开发** | `VITE_API_BASE_URL=http://localhost:8213` | 前端和后端都在本地运行 |
| **`scripts/start.sh` 启动** | `VITE_API_BASE_URL=http://localhost:8213` | 当前脚本会启动中文前端 `3001`、后端 `8213`，并通过命名 cpolar 隧道暴露前端 |
| **公网部署（推荐）** | `VITE_API_BASE_URL=http://localhost:8213` | 使用 nginx 反向代理统一域名，智能检测自动切换到相对路径 |
| **公网部署（分离）** | `VITE_API_BASE_URL=https://backend-xxx.cpolar.io` | 前后端使用不同域名，需手动配置后端地址 |

**推荐：使用 nginx 反向代理统一域名**

创建 `nginx.conf`：

```nginx
server {
    listen 8080;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8213/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 后端输出文件
    location /outputs/ {
        proxy_pass http://localhost:8213/outputs/;
    }
}
```

如果你不是直接运行 `npm run dev`，而是沿用当前仓库的 `scripts/start.sh`，请把上面前端反向代理目标从 `http://localhost:3000` 改成 `http://localhost:3001`。

然后使用 cpolar 暴露 nginx 端口：
```bash
cpolar http 8080
```

这样前端和后端在同一域名下，智能检测会自动使用相对路径，无需修改配置。实际部署时请把示例中的端口替换为你的真实端口。

> **注意**：修改 `.env` 后需要重新构建前端（`npm run build`）或重启开发服务器（`npm run dev`）。

---

## 📂 项目结构

```
opennotebookLM/
├── fastapi_app/             # 后端 API（FastAPI）
│   ├── routers/             #   路由：知识库、认证、Paper2PPT、Paper2Drawio 等
│   ├── services/            #   业务逻辑：搜索、闪卡、测试题等
│   ├── config/              #   配置与环境变量
│   ├── dependencies/        #   依赖注入（认证、Supabase 客户端）
│   ├── middleware/           #   中间件（API Key 校验）
│   └── workflow_adapters/   #   工作流适配层
├── workflow_engine/         # 工作流引擎（DataFlow-Agent）
│   ├── agentroles/          #   Agent 角色定义
│   ├── workflow/            #   工作流（Paper2PPT、PDF2PPT、Image2Drawio 等）
│   ├── promptstemplates/    #   提示模板
│   └── toolkits/            #   工具集（搜索、解析等）
├── frontend_en/             # 英文前端（React + Vite + Tailwind）
├── frontend_zh/             # 中文前端
├── database/                # 数据库迁移脚本
├── docs/                    # 文档
├── script/                  # 辅助脚本（数据库初始化等）
├── static/                  # 静态资源
└── outputs/                 # 生成文件输出目录（按用户邮箱隔离）
```

---

## ⚙️ 模型配置

项目采用三层模型配置体系，灵活度从粗到细：

1. **基础模型层** — 定义可用模型名称（`MODEL_GPT_4O`、`MODEL_CLAUDE_HAIKU` 等）
2. **工作流层** — 为每个工作流设置默认模型（`PAPER2PPT_DEFAULT_MODEL` 等）
3. **角色层** — 精细控制工作流中每个角色使用的模型（`PAPER2PPT_OUTLINE_MODEL` 等）

详见 `fastapi_app/.env.example` 中的完整配置说明。

---

## 🗺️ Roadmap

- [x] 知识库管理（上传文件 / 粘贴网址 / 文本）
- [x] RAG 智能问答
- [x] PPT 生成
- [x] 思维导图生成
- [x] DrawIO 图表生成
- [x] 知识播客生成
- [x] 闪卡 & 测试题
- [x] 联网搜索引入来源
- [x] 深度研究报告
- [x] 本地 Embedding 向量检索
- [x] 用户管理（Supabase 邮箱认证 + 多用户隔离）
- [ ] 视频生成（开发中）
- [ ] 视频来源引入（开发中）
- [ ] 音频来源引入（开发中）

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

---

## 💬 交流群

<div align="center">
<img src="static/readme/WX_group.jpg" alt="微信交流群" width="300"/>
<p><em>扫码加入微信交流群</em></p>
</div>
