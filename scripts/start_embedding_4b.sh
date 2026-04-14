#!/usr/bin/env bash
# 启动 Octen-Embedding-4B vLLM OpenAI API 服务
# 用法: bash start_4b.sh [port] [gpu_mem]
# 示例: bash start_4b.sh 8899 0.8

PORT="${1:-8899}"
GPU_MEM="${2:-0.8}"
MODEL_PATH="/root/models/Octen-Embedding-4B"

export TORCHDYNAMO_DISABLE=1
export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
export HF_ENDPOINT=https://hf-mirror.com

# 检查 config.json 是否已 patch
ARCH=$(python3 -c "import json; print(json.load(open('${MODEL_PATH}/config.json'))['architectures'][0])")
if [ "$ARCH" != "Qwen3ForCausalLM" ]; then
    echo "Patching config.json: ${ARCH} -> Qwen3ForCausalLM"
    python3 -c "
import json
cfg = json.load(open('${MODEL_PATH}/config.json'))
cfg['architectures'] = ['Qwen3ForCausalLM']
json.dump(cfg, open('${MODEL_PATH}/config.json', 'w'), indent=2)
"
fi

echo "Model:    ${MODEL_PATH}"
echo "Port:     ${PORT}"
echo "GPU mem:  ${GPU_MEM}"
echo "---"

exec python3 -c "
import torch
torch.compile = lambda fn=None, *a, **kw: fn if fn else (lambda f: f)

import sys
sys.argv = [
    'vllm', 'serve', '${MODEL_PATH}',
    '--task', 'embed',
    '--trust-remote-code',
    '--enforce-eager',
    '--dtype', 'auto',
    '--gpu-memory-utilization', '${GPU_MEM}',
    '--max-model-len', '1024',
    '--host', '0.0.0.0',
    '--port', '${PORT}',
]
from vllm.scripts import main
main()
"
