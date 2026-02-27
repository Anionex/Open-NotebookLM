# Paper2Any 项目文档

<div align="center">

**从论文到多模态输出的智能化工作流平台**

<!-- ![Paper2Any Logo](static/new_logo_bgrm.png) -->

</div>

---

## 💡 项目简介

**Paper2Any** 是一个基于深度学习的智能化工作流平台，专注于将学术论文转换为多种形式的输出，包括示意图、PPT、视频、技术报告等。通过集成最新的多模态大模型和计算机视觉技术，Paper2Any 能够自动解析论文内容并生成高质量的视觉和文本输出。

### 核心优势

- 🎯 **多模态输出**：支持从论文生成示意图(Figure)、PPT、视频(Video)、技术报告(Technical Report)等多种格式
- 🔌 **模块化设计**：基于 DataFlow-Agent 框架，工作流可灵活组合和扩展
- 🎨 **高质量生成**：集成前沿的视觉生成模型和文本生成模型，确保输出质量
- ⚡ **高效处理**：支持批量处理和并行计算，快速处理大量论文
- 🔄 **灵活部署**：提供 Docker 容器化部署和本地部署选项

---

## ✨ 核心功能

### 📊 Paper2Figure
从论文中提取关键信息，自动生成高质量的示意图和图表，支持学术演示和论文插图需求。

### 📽️ Paper2PPT
基于论文内容自动生成结构化的 PowerPoint 演示文稿，包括封面、目录、内容页和参考文献页。

### 🎬 Paper2Video
将论文内容转换为讲解视频，自动生成脚本、配音和视觉内容，适合快速了解论文核心思想。

### 📝 Paper2Technical
提取论文的技术细节，生成详细的技术报告、方法描述和实现指南。

### 🔧 其他功能
- **PDF2PPT**：将现有的PDF文件转换为可编辑的PPT演示文稿
- **Paper2ExpFigure**：为论文生成实验数据图表
- **Paper2PageContent**：提取论文页面内容，用于知识库构建

---

## 🚀 快速开始

### 环境要求

- **Python**: 3.10 或更高版本（[下载 Python](https://www.python.org/downloads/)）
- **操作系统**: Linux (推荐) / Windows / macOS
- **GPU**: 推荐 NVIDIA GPU（用于视觉生成任务）
- **内存**: 至少 16GB RAM

### 安装步骤

#### 1. 克隆仓库

```bash
git clone https://github.com/OpenDCAI/Paper2Any.git
cd Paper2Any
```

#### 2. 创建虚拟环境（推荐）

```bash
# 使用 venv
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 或使用 conda
conda create -n paper2any python=3.10
conda activate paper2any
```

#### 3. 安装依赖

```bash
# 安装基础依赖
pip install -r requirements-base.txt

# 安装开发依赖（可选）
pip install -r requirements-dev.txt

```

#### 4. 配置模型服务

某些功能需要运行额外的模型服务。请参考[安装指南](installation.md)的详细说明。

#### 5. 启动应用

```bash
# 启动 Gradio Web 界面（推荐用于测试）
python gradio_app/app.py
```

访问 **http://127.0.0.1:7860** 使用可视化界面。

或者使用 FastAPI 后端：

```bash
# 启动 FastAPI 后端
cd fastapi_app
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 📖 文档导航

- **[快速开始](quickstart.md)** - 新手入门指南
- **[安装指南](installation.md)** - 详细安装和配置说明
- **[功能指南](guides/)** - 各功能模块的详细使用说明
  - [Paper2Figure](guides/paper2figure.md)
  - [Paper2PPT](guides/paper2ppt.md)
  - [Paper2Video](guides/paper2video.md)
  - [Paper2Technical](guides/paper2technical.md)
- **[CLI工具](cli.md)** - 命令行工具使用说明
- **[常见问题解答](faq.md)** - 常见问题解决方法
- **[贡献指南](contributing.md)** - 参与项目开发的指南
- **[更新日志](changelog.md)** - 版本更新记录

---

## 🏗️ 系统架构

```
Paper2Any/
├── dataflow_agent/          # 底层工作流引擎
│   ├── agentroles/          # Agent 角色定义
│   ├── workflow/            # 工作流定义 (wf_*.py)
│   ├── toolkits/            # 工具集
│   └── ...
├── fastapi_app/             # FastAPI 后端服务
│   ├── routers/             # API 路由
│   ├── workflow_adapters/   # 工作流适配器
│   └── ...
├── gradio_app/              # Gradio Web 界面
│   ├── app.py               # 主应用入口
│   └── pages/               # 页面模块
├── frontend-workflow/       # 前端界面 (Vite + TypeScript)
├── script/                  # 运行脚本
├── docs/                    # 项目文档
├── tests/                   # 测试文件
└── outputs/                 # 输出目录
```


---

## 🤝 参与贡献

我们欢迎任何形式的贡献！无论是提交 Bug、提出新功能建议，还是改进文档。

### 贡献流程

1. **Fork 本仓库**并克隆到本地
2. **创建功能分支**: `git checkout -b feature/amazing-feature`
3. **提交代码**: `git commit -m 'Add amazing feature'`
4. **推送到分支**: `git push origin feature/amazing-feature`
5. **提交 Pull Request**

### 代码规范

- 遵循 PEP 8 Python 代码风格
- 为新功能添加单元测试
- 更新相关文档（包括 docstring 和 MkDocs 文档）
- 提交信息清晰描述变更内容

详见 [贡献指南](contributing.md)。

---

## 📄 开源协议

本项目采用 **Apache License 2.0** 开源协议。详情请查看 [LICENSE](LICENSE) 文件。

---

## 🙏 致谢

感谢所有为本项目做出贡献的开发者和使用者！

特别鸣谢：
- [DataFlow-Agent](https://github.com/OpenDCAI/Paper2Any) - 底层工作流框架
- [Gradio](https://gradio.app/) - 优秀的 Web 界面框架
- [FastAPI](https://fastapi.tiangolo.com/) - 高性能 API 框架
- [LangGraph](https://github.com/langchain-ai/langgraph) - 工作流编排灵感来源

---

## 📞 联系我们

- **问题反馈**: [GitHub Issues](https://github.com/OpenDCAI/Paper2Any/issues)
- **讨论交流**: [GitHub Discussions](https://github.com/OpenDCAI/Paper2Any/discussions)

---

<div align="center">

**如果这个项目对你有帮助，请给我们一个 ⭐️ Star！**

Made with ❤️ by Paper2Any Team

</div>
