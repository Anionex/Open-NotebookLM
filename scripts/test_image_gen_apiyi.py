#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from workflow_engine.toolkits.multimodaltool.req_img import generate_or_edit_and_save_image_async


def _load_env() -> None:
    load_dotenv(REPO_ROOT / "fastapi_app" / ".env")
    load_dotenv(REPO_ROOT / "fastapi_app" / ".env.local", override=True)


async def _run(model: str, prompt: str, output_path: Path) -> None:
    api_url = os.getenv("IMAGE_GEN_API_URL") or os.getenv("LLM_API_URL") or os.getenv("DF_API_URL") or ""
    api_key = os.getenv("IMAGE_GEN_API_KEY") or os.getenv("LLM_API_KEY") or os.getenv("DF_API_KEY") or ""

    if not api_url or not api_key:
        raise RuntimeError("Missing IMAGE_GEN_API_URL / IMAGE_GEN_API_KEY in fastapi_app/.env")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    await generate_or_edit_and_save_image_async(
        prompt=prompt,
        save_path=str(output_path),
        api_url=api_url,
        api_key=api_key,
        model=model,
        aspect_ratio="16:9",
        resolution="1K",
        timeout=180,
    )


def main() -> None:
    _load_env()
    parser = argparse.ArgumentParser(description="Test APIYI image generation connectivity.")
    parser.add_argument(
        "--model",
        default=os.getenv("IMAGE_GEN_MODEL", "gemini-3-pro-image-preview"),
        help="Image generation model name.",
    )
    parser.add_argument(
        "--prompt",
        default="一张简洁的科技风演示文稿封面，蓝白配色，包含抽象数据流线条。",
        help="Prompt used for connectivity test.",
    )
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parents[1] / "outputs" / "image_gen_smoke_test.png"),
        help="Output file path.",
    )
    args = parser.parse_args()

    out_path = Path(args.output).resolve()
    print(f"[image-gen-test] model={args.model}")
    print(f"[image-gen-test] output={out_path}")
    asyncio.run(_run(args.model, args.prompt, out_path))
    print(f"[image-gen-test] success: {out_path}")


if __name__ == "__main__":
    main()
