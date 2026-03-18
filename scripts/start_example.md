# OpenNotebook 启动脚本使用指南

## 基本用法

### 1. 使用默认配置（.env 文件）
```bash
./scripts/start.sh
```

### 2. 指定 GPU（推荐）

```bash
# 启用 MinerU 和 Embedding
./scripts/start.sh --mineru-gpu 6 --embedding-gpu 7

# 启用全部三个服务
./scripts/start.sh --tts-gpu 6 --embedding-gpu 7 --mineru-gpu 6

# 只启用 MinerU
./scripts/start.sh --mineru-gpu 6
```

### 3. 查看帮助
```bash
./scripts/start.sh --help
```

## GPU 配置说明

当前可用 GPU（显存充足）：
- **GPU 6**: ~49 GiB 可用 ✨
- **GPU 7**: ~49 GiB 可用 ✨

推荐配置：
- **MinerU**: GPU 6 (需要约 23 GiB，gpu-memory-utilization=0.5)
- **Embedding**: GPU 7 (需要约 4.7 GiB，gpu-memory-utilization=0.1)
- **TTS**: GPU 6 (可与 MinerU 共享，各占一部分显存)

## MinerU 配置详解

### 默认配置（.env）
```bash
USE_LOCAL_MINERU=0                                    # 默认禁用
LOCAL_MINERU_MODEL=opendatalab/MinerU2.5-2509-1.2B   # 模型路径
LOCAL_MINERU_PORT=26215                               # 端口
LOCAL_MINERU_CUDA_VISIBLE_DEVICES=6                   # GPU ID
LOCAL_MINERU_GPU_MEMORY_UTILIZATION=0.5               # 显存利用率
```

### vLLM 启动参数
参考 Paper2Any 项目，MinerU vLLM 启动时使用以下参数：
- `--served-model-name mineru`
- `--logits-processors mineru_vl_utils:MinerULogitsProcessor`
- `--gpu-memory-utilization 0.5`
- `--max-num-seqs 64`
- `--trust-remote-code`
- `--enforce-eager`

## 环境变量优先级

1. `.env.local` (命令行参数生成) - **最高优先级**
2. `.env` (默认配置)

## 示例场景

### 场景 1: 开发测试（禁用本地服务）
```bash
# 编辑 .env，设置
USE_LOCAL_TTS=0
USE_LOCAL_EMBEDDING=0
USE_LOCAL_MINERU=0

# 启动
./scripts/start.sh
```

### 场景 2: 启用 MinerU 进行文档解析
```bash
./scripts/start.sh --mineru-gpu 6
```

这会：
1. 自动生成 `fastapi_app/.env.local`
2. 设置 `USE_LOCAL_MINERU=1`
3. 设置 `LOCAL_MINERU_CUDA_VISIBLE_DEVICES=6`
4. 启动后端时会自动启动 MinerU vLLM 服务

### 场景 3: 全功能启用
```bash
./scripts/start.sh --tts-gpu 6 --embedding-gpu 7 --mineru-gpu 6
```

## Python 代码中使用 MinerU

启用本地 MinerU 后，可以这样调用：

```python
import os
from workflow_engine.toolkits.multimodaltool.mineru_tool import run_two_step_extract

# 端口会自动从环境变量读取
port = int(os.getenv("LOCAL_MINERU_PORT", "26215"))

# 调用 MinerU
result = run_two_step_extract(image_path="/path/to/image.png", port=port)
print(result)
```

或使用异步版本：
```python
import asyncio
from workflow_engine.toolkits.multimodaltool.mineru_tool import run_aio_two_step_extract

async def process_image():
    port = int(os.getenv("LOCAL_MINERU_PORT", "26215"))
    result = await run_aio_two_step_extract(image_path="/path/to/image.png", port=port)
    return result

result = asyncio.run(process_image())
```

## 停止服务

```bash
./scripts/stop.sh
```

会自动清理所有进程（包括 MinerU vLLM）。

## 日志查看

```bash
# 后端日志（包含 MinerU 启动信息）
tail -f logs/backend.log

# 前端日志
tail -f logs/frontend.log
```

## 故障排查

### MinerU 启动失败
1. 检查模型是否下载：
   ```bash
   ls -lh ~/.cache/huggingface/hub/ | grep MinerU
   ```

2. 如果没有，下载模型：
   ```bash
   huggingface-cli download opendatalab/MinerU2.5-2509-1.2B --local-dir ~/.cache/huggingface/hub/models--opendatalab--MinerU2.5-2509-1.2B
   ```

3. 检查 GPU 显存：
   ```bash
   nvidia-smi
   ```

### 端口冲突
脚本会自动检测端口占用并切换到可用端口，日志中会显示实际使用的端口。
