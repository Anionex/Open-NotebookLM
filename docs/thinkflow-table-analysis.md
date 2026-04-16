# 表格分析功能

## 概述

在对话界面中集成了表格分析能力，用户选中 CSV/Excel 文件后可通过自然语言查询数据。底层使用 DuckDB 执行 SQL，LLM 负责将自然语言转为 SQL 并总结结果。

## 使用流程

1. 左侧素材栏点击 CSV/Excel 文件（📊 图标）
2. 中间面板顶部自动切换为「📊 表格分析」模式，显示已连接的文件名
3. 输入自然语言需求（如"统计各地区数量"、"找出销售额前10"、"按月汇总金额"）
4. 系统自动生成 SQL → 执行 → 返回结果表格 + 摘要
5. 可展开查看生成的 SQL，可导出 CSV
6. 点击顶部「💬 对话」切回普通聊天模式

## 架构

```
前端 (React)                          后端 (FastAPI)
─────────────                         ──────────────
ThinkFlowWorkspace                    /api/v1/data-extract/
  ├─ toggleSource()                     ├─ datasources/register   ← 注册文件为 DuckDB 数据源
  │   └─ 检测 type==='dataset'          ├─ sessions/start         ← 创建分析会话
  │       → setActiveDataset()          ├─ sessions/{id}/message  ← 发送查询，返回 SQL+结果
  │       → setChatMode('table-analysis')└─ sessions/{id}/export  ← 导出 CSV
  │
  ├─ useEffect([activeDataset])       DataExtractService
  │   → POST /datasources/register      └─ EmbeddedSQLBotAdapter
  │   → POST /sessions/start                ├─ LLM → SQL 生成
  │                                         ├─ DuckDB 执行
  └─ ThinkFlowCenterPanel                   └─ Fallback SQL（LLM 不可用时）
      └─ TableAnalysisPanel
          ├─ 输入框 + 发送
          ├─ POST /sessions/{id}/message
          └─ TableResultCard (SQL + 表格 + 摘要 + 导出)
```

## 涉及文件

### 后端
| 文件 | 职责 |
|---|---|
| `fastapi_app/routers/data_extract.py` | REST API 路由（已有，未改动） |
| `fastapi_app/services/data_extract_service.py` | 业务逻辑：注册、会话、消息、导出 |
| `fastapi_app/services/embedded_sqlbot.py` | DuckDB 执行引擎，LLM SQL 生成 |
| `fastapi_app/datasources/adapters/csv_datasource.py` | CSV → DuckDB 虚拟表 |
| `fastapi_app/datasources/adapters/excel_datasource.py` | Excel → DuckDB 虚拟表 |
| `fastapi_app/utils/__init__.py` | `_from_outputs_url` 路径转换 |

### 前端
| 文件 | 职责 |
|---|---|
| `frontend_zh/src/components/TableAnalysisPanel.tsx` | 表格分析面板（输入 + 结果列表） |
| `frontend_zh/src/components/TableResultCard.tsx` | 单条结果卡片（SQL + 数据表格 + 摘要） |
| `frontend_zh/src/components/ThinkFlowCenterPanel.tsx` | 对话/表格分析模式切换 |
| `frontend_zh/src/components/ThinkFlowWorkspace.tsx` | 状态管理：activeDataset、chatMode、dataSessionId |
| `frontend_zh/src/components/thinkflow-types.ts` | `ChatMode` 类型定义 |

## 后端 API

### POST /api/v1/data-extract/datasources/register
注册 CSV/Excel 文件为 DuckDB 数据源。

```json
// Request
{ "notebook_id": "...", "user_id": "...", "email": "...", "file_path": "/outputs/.../file.csv", "display_name": "file.csv" }
// Response
{ "success": true, "datasource": { "datasource_id": 14, "rows": 103, "columns": 6, "preview": {...} } }
```

### POST /api/v1/data-extract/sessions/start
创建分析会话，绑定数据源。

```json
// Request
{ "notebook_id": "...", "user_id": "...", "email": "...", "datasource_id": 14 }
// Response
{ "success": true, "session": { "id": "abc123", "chat_id": 1 } }
```

### POST /api/v1/data-extract/sessions/{session_id}/message
发送自然语言查询。

```json
// Request
{ "notebook_id": "...", "user_id": "...", "email": "...", "question": "有多少个国家", "result_format": "json" }
// Response
{ "success": true, "sql": "SELECT COUNT(DISTINCT ...) ...", "rows": [{"country_count": 103}], "columns": ["country_count"], "answer": "共103个国家", "export_url": "/api/v1/data-extract/sessions/.../export?..." }
```

## 支持格式

- `.csv` — 通过 `CSVDataSource` + DuckDB `read_csv_auto`
- `.xlsx` / `.xls` — 通过 `ExcelDataSource` + DuckDB Excel 扩展

## 本次改动中修复的已有 Bug

- `_from_outputs_url` 路径解析：前导 `/` 导致 pathlib 覆盖 PROJECT_ROOT
- `monitor.sh` 使用 `lsof`（系统未安装）导致服务每 30 秒被误杀重启，改为 `ss`
- 来源删除接口：前端 POST+JSON 与后端 DELETE+Form 不匹配，改为新增 `POST /kb/delete-source`
