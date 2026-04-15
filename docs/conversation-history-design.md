# 对话历史持久化设计文档

## 1. 背景与目的

ThinkFlow 的对话区（中间面板）支持用户与 AI 多轮问答。  
早期实现中，对话消息仅存在于组件内存状态（`useState`），关闭页面或切换笔记本后全部丢失。

本文记录完整的持久化方案：数据库建表、后端 API、前端调用链，以及调试过程中踩到的几个坑。

---

## 2. 数据库建表（Supabase）

在 Supabase SQL Editor（项目：`xciveaaildyzbreltihu`）执行以下 SQL：

```sql
-- 对话会话表：每个用户 × 笔记本一条记录
create table if not exists public.kb_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_email  text,
  user_id     text,
  notebook_id text,
  title       text default '对话',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists kb_conversations_user_email_idx  on public.kb_conversations(user_email);
create index if not exists kb_conversations_notebook_id_idx on public.kb_conversations(notebook_id);

-- 消息表：每条 user/assistant 消息一行
create table if not exists public.kb_chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.kb_conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null default '',
  created_at      timestamptz default now()
);

create index if not exists kb_chat_messages_conversation_id_idx on public.kb_chat_messages(conversation_id);

-- 开启 RLS（service_role key 自动绕过，无需额外 policy）
alter table public.kb_conversations enable row level security;
alter table public.kb_chat_messages  enable row level security;
```

### 表结构说明

| 表 | 核心字段 | 说明 |
|---|---|---|
| `kb_conversations` | `user_email`, `notebook_id` | 唯一标识一个用户在一个笔记本下的对话线程 |
| `kb_chat_messages` | `conversation_id`, `role`, `content` | 属于某个线程的单条消息，`role` 限定为 `user`/`assistant` |

**设计决策：每个用户 × 笔记本只维护一条 conversation**  
目前不支持同一笔记本下的多线程会话（类似 ChatGPT 侧边栏切换历史），只有"新对话"功能重置前端状态，但历史记录仍追加到同一 conversation 下。如果未来要支持多线程，需要在 `kb_conversations` 加 `session_tag` 字段，并在前端存储当前 `conversationId`（参见第 5 节）。

---

## 3. 环境变量要求

| 变量 | 用途 | 位置 |
|---|---|---|
| `SUPABASE_URL` | Supabase 项目地址 | `fastapi_app/.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | 写入数据库（绕过 RLS）| `fastapi_app/.env` |

> **注意**：对话历史写入使用 **service_role key**（`get_supabase_admin_client()`），不用 anon key。  
> 如果只配置了 anon key，`get_supabase_admin_client()` 会返回 `None`，所有写入静默失败。

验证方式：

```bash
python3 -c "
import os; os.environ['SUPABASE_URL']='...'; os.environ['SUPABASE_SERVICE_ROLE_KEY']='...'
from fastapi_app.dependencies.auth import get_supabase_admin_client
sb = get_supabase_admin_client()
print(sb.table('kb_conversations').select('id').limit(1).execute())
"
```

---

## 4. 后端 API

全部在 `fastapi_app/routers/kb.py`，路径前缀 `/api/v1/kb`。

### 4.1 核心函数：`_supabase_upsert_conversation`

```python
def _supabase_upsert_conversation(email, user_id, notebook_id) -> Optional[Dict]:
```

- 按 `user_email` + `user_id` + `notebook_id` 三个字段查找已有 conversation
- 找到则更新 `updated_at`，返回该记录
- 找不到则 `insert` 新记录
- 任何异常 `catch` 后返回 `None`（**不会向上抛出**，调用方要检查返回值）

> ⚠️ **坑**：`notebook_id` 必须同时出现在查询过滤条件和插入数据中。若只在插入时写，查询时不过滤，会导致不同笔记本的对话混用同一个 conversation。当前代码（1138-1146 行）已正确实现三字段过滤。

### 4.2 接口一览

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/conversations` | 获取或创建 conversation，返回 `conversation_id` |
| `GET` | `/conversations` | 查询用户的 conversation 列表（支持按 `notebook_id` 过滤）|
| `GET` | `/conversations/{id}/messages` | 读取某个 conversation 的全部消息（按 `created_at` 升序）|
| `POST` | `/conversations/{id}/messages` | 追加消息列表 `[{role, content}]` |

**所有接口都需要 `X-API-Key: df-internal-2024-workflow-key` 请求头**（由 `APIKeyMiddleware` 强制）。  
前端统一通过 `apiFetch()` 调用，该函数自动注入此 header。**不要用原生 `fetch` 直接调用这些接口。**

---

## 5. 前端调用链

代码位置：`frontend_zh/src/components/ThinkFlowWorkspace.tsx`

### 5.1 状态

```typescript
const [conversationId, setConversationId] = useState('');
```

`conversationId` 是组件级状态，组件卸载（切换笔记本、刷新页面）后归零。  
每次归零后，下一条消息发出时会重新调 `ensureConversationId()` 从后端拿到（或创建）当前 conversation。

### 5.2 保存消息：`handleSendMessage` 末尾

```typescript
// 流式响应完成后追加到后端
await appendConversationMessages([
  { role: 'user',      content: query      },
  { role: 'assistant', content: fullAnswer },
]);
```

`appendConversationMessages` 内部先调 `ensureConversationId()`，拿到 `conversationId` 后 POST 到后端。

### 5.3 读取历史：`onOpenHistory`

点击"历史"按钮时：
1. 调 `ensureConversationId()` 确保有 conversation
2. `GET /conversations/{id}/messages` 拉取全量消息
3. 渲染到 `historyOpen` 面板

若 `conversationId` 为空（后端创建失败），回退展示当前会话的内存消息。

### 5.4 完整调用时序

```
用户点发送
  ↓
handleSendMessage()
  ├─ 前端立即渲染 user + assistant(空) 气泡
  ├─ POST /api/v1/kb/chat/stream  ← 流式对话
  └─ 流结束后
       ↓
       appendConversationMessages([user, assistant])
         ↓
         ensureConversationId()
           ├─ conversationId 已有 → 直接用
           └─ 无 → POST /api/v1/kb/conversations → 存 setConversationId
         ↓
         POST /api/v1/kb/conversations/{id}/messages
         ↓
         Supabase: kb_chat_messages.insert([...])
```

---

## 6. 踩坑记录

### 坑 1：`loading` 状态导致 `AuthPage` 重复 mount

**现象**：注册页点"发送验证码"后，整个界面刷新，跳回登录 tab。  
**根因**：`App.tsx` 用 `authStore.loading` 控制 `<LoadingScreen>`，auth 请求期间 `loading=true` 导致 `<AuthPage>` 卸载，请求结束后重新 mount，`mode` 重置为默认值 `'login'`。  
**修复**：引入独立的 `initializing` 状态，只在首次 session 检查完成后置 `false`，之后的 auth 操作不再触发整页切换。

### 坑 2：`signUpWithEmail` 判断逻辑用字符串匹配

**根因**：`authStore.ts` 用 `result.message?.includes("email")` 判断是否需要 OTP 验证，脆弱且不可靠。  
**修复**：后端 `/auth/signup` 明确返回 `needsVerification: boolean` 字段，前端直接读该字段。

### 坑 3：已注册邮箱无提示

**根因**：Supabase 对已注册邮箱的 `sign_up` 调用故意返回相同的成功响应（防邮件枚举攻击），但会将 `result.user.identities` 置为空列表 `[]`。  
**修复**：后端检查 `identities` 是否为空，为空时返回 `{"success": false, "emailExists": true, "message": "该邮箱已注册..."}` 给前端展示。

### 坑 4：对话历史静默失败

**根因**：`kb_conversations` / `kb_chat_messages` 表未在 Supabase 创建。后端所有写入进 `except` 分支，`catch {}` / `except: pass` 静默吞掉错误，前端完全不知道失败。  
**修复**：执行本文第 2 节的建表 SQL。

> **后续建议**：将 `except` 分支改为 `log.error(...)` 而非 `log.warning(...)`，并在 `appendConversationMessages` 失败时给前端返回可感知的错误（目前是完全静默）。

---

## 7. 快速验证清单

部署新环境后，按序执行：

```bash
# 1. 检查环境变量
grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" fastapi_app/.env

# 2. 验证表存在 + admin client 可用
python3 -c "
import os; os.chdir('.')
from fastapi_app.dependencies.auth import get_supabase_admin_client
sb = get_supabase_admin_client()
assert sb, 'admin client is None，检查 SUPABASE_SERVICE_ROLE_KEY'
r = sb.table('kb_conversations').select('id').limit(1).execute()
print('OK, rows:', r.data)
"

# 3. 通过 HTTP 接口验证（需要服务已启动）
curl -s -X POST http://localhost:8213/api/v1/kb/conversations \
  -H "Content-Type: application/json" \
  -H "X-API-Key: df-internal-2024-workflow-key" \
  -d '{"email":"test@example.com","user_id":"uid-1","notebook_id":"nb-1"}' | python3 -m json.tool
# 期望：{"success": true, "conversation_id": "<uuid>", ...}
```
