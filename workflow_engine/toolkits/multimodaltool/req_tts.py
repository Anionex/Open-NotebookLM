import os
import re
import wave
import base64
from typing import Optional, List
from workflow_engine.logger import get_logger
from workflow_engine.toolkits.multimodaltool.providers import get_provider
from workflow_engine.toolkits.multimodaltool.req_img import _post_raw

log = get_logger(__name__)

def split_tts_text(content: str, limit: int) -> List[str]:
    if limit is None or limit <= 0:
        return [content]
    if len(content) <= limit:
        return [content]
    # Normalize whitespace
    content = content.replace("\r", "")
    parts: List[str] = []
    paragraphs = [p.strip() for p in content.split("\n") if p.strip()]
    if not paragraphs:
        paragraphs = [content.strip()]

    sentence_splitter = re.compile(r"(?<=[。！？.!?;；])\s+")
    for para in paragraphs:
        if len(para) <= limit:
            parts.append(para)
            continue
        sentences = [s.strip() for s in sentence_splitter.split(para) if s.strip()]
        if not sentences:
            sentences = [para]
        buf = ""
        for sent in sentences:
            if not buf:
                buf = sent
                continue
            if len(buf) + 1 + len(sent) <= limit:
                buf = f"{buf} {sent}"
            else:
                parts.append(buf)
                buf = sent
        if buf:
            parts.append(buf)

    # Hard split if any chunk is still too large
    final_parts: List[str] = []
    for p in parts:
        if len(p) <= limit:
            final_parts.append(p)
        else:
            for i in range(0, len(p), limit):
                final_parts.append(p[i:i + limit])
    return final_parts

async def generate_speech_bytes_async(
    text: str,
    api_url: str,
    api_key: str,
    model: str = "gemini-2.5-pro-preview-tts",
    voice_name: str = "Kore",
    timeout: int = 120,
    **kwargs,
) -> bytes:
    # 优先使用本地 TTS
    use_local = os.getenv("USE_LOCAL_TTS", "0").strip().lower() in ("1", "true", "yes")
    tts_engine = os.getenv("TTS_ENGINE", "qwen").strip().lower()
    log.info(f"[TTS] USE_LOCAL_TTS={use_local}, TTS_ENGINE={tts_engine}")

    if use_local:
        try:
            import sys
            from pathlib import Path
            sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "fastapi_app"))

            if tts_engine == "qwen":
                from qwen_tts_manager import generate_speech, is_available
                log.info(f"[TTS] 使用本地 Qwen3-TTS")
            elif tts_engine == "firered":
                from fireredtts_manager import generate_speech, is_available
                log.info(f"[TTS] 使用本地 FireRedTTS2")
            else:
                log.warning(f"[TTS] 未知引擎 {tts_engine}，回退到 API")
                raise ValueError(f"Unknown TTS engine: {tts_engine}")

            if is_available():
                import asyncio
                audio_bytes = await asyncio.to_thread(generate_speech, text, voice_name)
                return audio_bytes
            else:
                log.warning(f"[TTS] {tts_engine} 不可用，回退到 API")
        except Exception as e:
            log.warning(f"[TTS] 本地 TTS 失败: {e}，回退到 API")

    # 回退到 API-based TTS
    provider = get_provider(api_url, model)
    log.info(f"TTS using Provider: {provider.__class__.__name__}")

    try:
        url, payload, is_stream = provider.build_tts_request(
            api_url=api_url,
            model=model,
            text=text,
            voice_name=voice_name,
            **kwargs
        )
    except NotImplementedError:
        log.error(f"Provider {provider.__class__.__name__} does not support TTS")
        raise

    resp_data = await _post_raw(url, api_key, payload, timeout)
    try:
        audio_bytes = provider.parse_tts_response(resp_data)
    except Exception as e:
        log.error(f"Failed to parse TTS response: {e}")
        log.error(f"Response: {resp_data}")
        raise
    return audio_bytes


async def generate_speech_and_save_async(
    text: str,
    save_path: str,
    api_url: str,
    api_key: str,
    model: str = "gemini-2.5-pro-preview-tts",
    voice_name: str = "Kore", #Aoede, Charon, Fenrir, Kore, Puck, Orbit, Orus, Trochilidae, Zephyr
    timeout: int = 120,
    max_chars: int = 1500,
    **kwargs,
) -> str:
    """
    生成语音并保存为WAV文件
    """
    chunks = split_tts_text(text, max_chars)
    log.info(f"TTS split into {len(chunks)} chunk(s) with max_chars={max_chars}")

    audio_chunks: List[bytes] = []
    for idx, chunk in enumerate(chunks, start=1):
        try:
            audio_bytes = await generate_speech_bytes_async(
                text=chunk,
                api_url=api_url,
                api_key=api_key,
                model=model,
                voice_name=voice_name,
                timeout=timeout,
                **kwargs
            )
        except Exception as e:
            log.error(f"Failed to generate speech (chunk {idx}/{len(chunks)}): {e}")
            raise
        audio_chunks.append(audio_bytes)

    os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)

    # Save as WAV (assuming 24kHz, 16bit, Mono as per user doc)
    with wave.open(save_path, "wb") as wav_file:
        wav_file.setnchannels(1)        # 1 Channel
        wav_file.setsampwidth(2)        # 16 bit = 2 bytes
        wav_file.setframerate(24000)    # 24kHz
        wav_file.writeframes(b"".join(audio_chunks))

    log.info(f"Audio saved to {save_path}")
    return save_path

if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv
    load_dotenv()
    
    async def _test():
        url = os.getenv("DF_API_URL", "https://api.apiyi.com/v1")
        key = os.getenv("DF_API_KEY", "")
        model = os.getenv("DF_TTS_MODEL", "gemini-2.5-pro-preview-tts")
        
        print(f"Testing TTS with URL: {url}, Model: {model}")
        try:
            path = await generate_speech_and_save_async(
                "是的！MCP的设计非常智能，特别是它的动态工具生成机制。开发者可以通过MCP为每个工具动态生成一个Python异步函数，直接调用这些工具就像调用普通函数一样。",
                "test_tts.wav",
                url, key, model
            )
            print(f"Success: {path}")
        except Exception as e:
            print(f"Error: {e}")
            
    asyncio.run(_test())
