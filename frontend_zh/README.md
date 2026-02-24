# NotebookLM v2 - 知识库集成版

这是 NotebookLM 的前端界面，已集成知识库的后端功能。

## 功能特性

- 📚 知识库文件管理（上传、查看、选择）
- 💬 智能问答（基于选中的文件）
- 🎨 PPT 生成
- 🧠 思维导图生成
- 🎙️ 知识播客生成
- 🎬 视频讲解生成
- 🔍 语义检索

## 技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase (用户认证和数据存储)
- Zustand (状态管理)
- Mermaid (思维导图渲染)

## 安装

```bash
# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件，填入你的配置
```

## 环境变量配置

创建 `.env` 文件，内容如下：

```env
# Supabase 配置 (可选 - 如果不设置，将使用模拟用户)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# 后端 API 配置
VITE_API_KEY=df-internal-2024-workflow-key

# LLM 提供商配置
VITE_DEFAULT_LLM_API_URL=https://api.apiyi.com/v1
```

## 开发

```bash
# 启动开发服务器 (默认端口 3001)
npm run dev
```

## 构建

```bash
# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 项目结构

```
src/
├── components/
│   └── knowledge-base/
│       └── tools/          # 知识库工具组件
├── config/
│   └── api.ts             # API 配置
├── lib/
│   └── supabase.ts        # Supabase 客户端
├── pages/
│   ├── Dashboard.tsx      # 一级界面（笔记本列表）
│   └── NotebookView.tsx   # 二级界面（知识库交互）
├── services/
│   └── apiSettingsService.ts  # API 设置服务
├── stores/
│   └── authStore.ts       # 认证状态管理
├── types/
│   └── index.ts           # TypeScript 类型定义
├── App.tsx                # 主应用组件
└── main.tsx               # 应用入口
```

## 后端 API

本项目依赖后端 API 服务（默认运行在 `http://localhost:8000`）。

主要 API 端点：
- `POST /api/v1/kb/upload` - 文件上传
- `POST /api/v1/kb/chat` - 智能问答
- `POST /api/v1/kb/mindmap` - 思维导图生成
- `POST /api/v1/kb/ppt` - PPT 生成
- `POST /api/v1/kb/podcast` - 播客生成

## 注意事项

1. 确保后端服务正在运行
2. 如果不配置 Supabase，将使用模拟用户进行开发
3. 文件上传需要后端服务支持
4. LLM API 密钥需要在设置中配置或使用环境变量

## 开发模式

如果没有配置 Supabase，应用会自动创建一个模拟用户：
- ID: `dev-user-001`
- Email: `dev@notebook.local`

这样可以在没有数据库的情况下进行前端开发。

## License

MIT
