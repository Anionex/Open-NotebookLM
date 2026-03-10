"""
FireRedTTS2 Manager
懒加载 + 自动卸载
"""
import os
import time
import threading
import torch

REPO_ID = "FireRedTeam/FireRedTTS2"
IDLE_TIMEOUT = int(os.getenv("TTS_IDLE_TIMEOUT", "300"))

_model = None
_device = None
_model_path = None
_last_used = None
_lock = threading.Lock()
_unload_timer = None


def _pick_device():
    """选择最优GPU"""
    if not torch.cuda.is_available():
        return "cpu"

    try:
        import subprocess
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=index,memory.free", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5
        )
        lines = [l.strip() for l in result.stdout.strip().split("\n") if l.strip()]
        if not lines:
            return "cuda:0"

        gpu_mem = []
        for line in lines:
            parts = line.split(",")
            if len(parts) == 2:
                idx, mem = parts[0].strip(), parts[1].strip()
                gpu_mem.append((int(idx), int(mem)))

        if gpu_mem:
            best_gpu = max(gpu_mem, key=lambda x: x[1])
            return f"cuda:{best_gpu[0]}"
    except Exception:
        pass

    return "cuda:0"


def _schedule_unload():
    """调度自动卸载"""
    global _unload_timer
    if _unload_timer is not None:
        _unload_timer.cancel()

    def _unload():
        global _model, _device, _last_used
        with _lock:
            if _last_used and (time.time() - _last_used >= IDLE_TIMEOUT):
                print(f"[TTS] 空闲 {IDLE_TIMEOUT}s，卸载模型")
                _model = None
                _device = None
                _last_used = None
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()

    _unload_timer = threading.Timer(IDLE_TIMEOUT, _unload)
    _unload_timer.daemon = True
    _unload_timer.start()


def _load_model():
    """懒加载模型"""
    global _model, _device, _model_path, _last_used

    if _model is not None:
        _last_used = time.time()
        _schedule_unload()
        return _model, _device, _model_path

    print(f"[TTS] 加载 FireRedTTS2 模型: {REPO_ID}")

    try:
        from fireredtts2.fireredtts2 import FireRedTTS2
    except ImportError as e:
        raise RuntimeError(f"fireredtts2 未安装: {e}\n运行: pip install fireredtts2")

    # 下载模型到 HuggingFace 缓存
    try:
        from huggingface_hub import snapshot_download
        _model_path = snapshot_download(
            repo_id=REPO_ID,
            resume_download=True,
            local_files_only=False
        )
        print(f"[TTS] 模型已下载到: {_model_path}")
    except Exception as e:
        print(f"[TTS] 模型下载失败: {e}")
        raise

    _device = _pick_device()
    print(f"[TTS] 使用设备: {_device}")

    try:
        _model = FireRedTTS2(
            pretrained_dir=_model_path,
            gen_type="dialogue",
            device=_device,
        )
    except Exception as e:
        print(f"[TTS] 加载失败: {e}")
        raise

    _last_used = time.time()
    _schedule_unload()
    print(f"[TTS] 模型加载完成")

    return _model, _device, _model_path


def generate_speech(text: str, voice_name: str = "S1", temperature: float = 0.9) -> bytes:
    """
    生成语音，返回 WAV 音频字节

    Args:
        text: 文本内容，必须包含说话人标签格式 "[S1]text\n[S2]text"
        voice_name: 未使用（保留参数兼容性）
        temperature: 生成温度

    Returns:
        WAV 格式音频字节 (24kHz, 16-bit, mono)
    """
    with _lock:
        model, device, model_path = _load_model()

    # 解析文本为对话列表，并分割过长的行
    text_list = []
    max_line_len = 200  # 每行最多200字符
    for line in text.strip().split("\n"):
        line = line.strip()
        if line and (line.startswith("[S1]") or line.startswith("[S2]")):
            speaker = line[:4]  # [S1] or [S2]
            content = line[4:].strip()
            # 分割过长内容
            if len(content) <= max_line_len:
                text_list.append(line)
            else:
                # 按句子分割
                import re
                sentences = re.split(r'([。！？.!?])', content)
                current = ""
                for i in range(0, len(sentences), 2):
                    sent = sentences[i]
                    punct = sentences[i+1] if i+1 < len(sentences) else ""
                    if len(current) + len(sent) + len(punct) <= max_line_len:
                        current += sent + punct
                    else:
                        if current:
                            text_list.append(f"{speaker}{current}")
                        current = sent + punct
                if current:
                    text_list.append(f"{speaker}{current}")

    if not text_list:
        raise ValueError("No valid dialogue lines found in text")

    print(f"[TTS] 生成 {len(text_list)} 行对话，总长度: {sum(len(t) for t in text_list)}")

    # 生成音频（使用模型默认音色）
    import torchaudio
    import io
    audio = model.generate_dialogue(
        text_list=text_list,
        temperature=temperature,
        topk=30,
    )

    # 保存为 WAV 字节
    buf = io.BytesIO()
    torchaudio.save(buf, audio, 24000, format="wav")
    return buf.getvalue()


def is_available() -> bool:
    """检查 FireRedTTS2 是否可用"""
    try:
        from fireredtts2.fireredtts2 import FireRedTTS2
        return True
    except ImportError:
        return False


def check_and_download_model():
    """启动时检查并自动下载 FireRedTTS2 模型"""
    # 检查并安装 fireredtts2
    try:
        import fireredtts2
        print(f"[TTS] fireredtts2 已安装")
    except ImportError:
        print(f"[TTS] 正在安装 fireredtts2...")
        import subprocess
        import sys
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "fireredtts2"])
            print(f"[TTS] fireredtts2 安装完成")
        except Exception as e:
            print(f"[TTS] fireredtts2 安装失败: {e}")
            return

    print(f"[TTS] 检查模型: {REPO_ID}")
    print(f"[TTS] 首次使用时将自动从 HuggingFace 下载或使用本地缓存")


