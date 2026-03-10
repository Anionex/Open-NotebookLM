"""
Qwen3-TTS Manager
懒加载 + 自动卸载
"""
import os
import time
import threading
import torch

REPO_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"  # CustomVoice 支持预定义说话人
IDLE_TIMEOUT = int(os.getenv("TTS_IDLE_TIMEOUT", "300"))

_model = None
_device = None
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
    global _model, _device, _last_used

    if _model is not None:
        _last_used = time.time()
        _schedule_unload()
        return _model, _device

    print(f"[TTS] 加载 Qwen3-TTS 模型: {REPO_ID}")

    try:
        from qwen_tts import Qwen3TTSModel
    except ImportError as e:
        raise RuntimeError(f"qwen_tts 未安装: {e}\n运行: pip install qwen-tts")

    _device = _pick_device()
    dtype = torch.bfloat16 if _device.startswith("cuda") else torch.float32
    print(f"[TTS] 使用设备: {_device}, dtype: {dtype}")

    try:
        _model = Qwen3TTSModel.from_pretrained(
            REPO_ID,
            device_map=_device,
            dtype=dtype,
        )
    except Exception as e:
        print(f"[TTS] 加载失败: {e}")
        raise

    _last_used = time.time()
    _schedule_unload()
    print(f"[TTS] 模型加载完成")

    return _model, _device


def generate_speech(text: str, voice_name: str = "vivian", language: str = "Chinese") -> bytes:
    """
    生成语音，返回 WAV 音频字节

    Args:
        text: 文本内容
        voice_name: 说话人名称（默认 vivian）
                   支持: aiden, dylan, eric, ono_anna, ryan, serena, sohee, uncle_fu, vivian
        language: 语言（Chinese/English，默认 Chinese）

    Returns:
        WAV 格式音频字节
    """
    with _lock:
        model, device = _load_model()

    # 确保 voice_name 是小写且在支持列表中
    supported_speakers = ['aiden', 'dylan', 'eric', 'ono_anna', 'ryan', 'serena', 'sohee', 'uncle_fu', 'vivian']
    voice_name = voice_name.lower()
    if voice_name not in supported_speakers:
        voice_name = 'vivian'

    # 播客风格指令
    instruct = "用自然、亲切的播客主播语气讲述，语速适中，富有感染力" if language == "Chinese" else "Speak in a natural, friendly podcast host tone with moderate pace and engaging delivery"

    # 生成音频
    wavs, sr = model.generate_custom_voice(
        text=text.strip(),
        language=language,
        speaker=voice_name,
        instruct=instruct,
    )

    # 转换为 WAV 字节
    import io
    import soundfile as sf
    buf = io.BytesIO()
    sf.write(buf, wavs[0], sr, format="wav")
    buf.seek(0)
    return buf.read()


def is_available() -> bool:
    """检查 Qwen3-TTS 是否可用"""
    try:
        from qwen_tts import Qwen3TTSModel
        return True
    except ImportError:
        return False


def check_and_download_model():
    """启动时检查并下载 Qwen3-TTS 模型"""
    print(f"[TTS] 检查模型: {REPO_ID}")
    print(f"[TTS] 首次使用时将自动从 HuggingFace 下载或使用本地缓存")
