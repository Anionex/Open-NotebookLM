from __future__ import annotations

import logging
import os
import sys
from importlib.util import find_spec


def _should_patch_vllm() -> bool:
    if os.getenv("OPENNOTEBOOK_DISABLE_VLLM_PATCH", "").strip().lower() in {"1", "true", "yes"}:
        return False
    argv0 = os.path.basename(sys.argv[0] if sys.argv else "")
    return "vllm" in argv0


def _patch_vllm_rotary_import_fallback() -> None:
    if not _should_patch_vllm():
        return

    try:
        from vllm.logger import init_logger
        from vllm.model_executor.custom_op import CustomOp
        from vllm.model_executor.layers.rotary_embedding import common as rotary_common
    except Exception:
        return

    if getattr(rotary_common.ApplyRotaryEmb, "_opennotebook_flash_fallback_patched", False):
        return

    logger = init_logger("opennotebook.vllm_patch")

    def patched_init(
        self,
        enforce_enable: bool = False,
        is_neox_style: bool = True,
        enable_fp32_compute: bool = False,
    ) -> None:
        CustomOp.__init__(self, enforce_enable=enforce_enable)
        self.is_neox_style = is_neox_style
        self.enable_fp32_compute = enable_fp32_compute
        self.apply_rotary_emb_flash_attn = None

        if find_spec("flash_attn") is not None:
            try:
                from flash_attn.ops.triton.rotary import apply_rotary
            except Exception as exc:
                logger.warning(
                    "flash_attn rotary import failed, falling back to native rotary: %s",
                    exc,
                )
            else:
                self.apply_rotary_emb_flash_attn = apply_rotary

    def patched_forward_cuda(self, x, cos, sin):
        try:
            from vllm.vllm_flash_attn.layers.rotary import apply_rotary_emb
        except Exception as exc:
            logger.warning(
                "vllm flash rotary import failed on CUDA, falling back to native rotary: %s",
                exc,
            )
            return self.forward_native(x, cos, sin)

        x, cos, sin, origin_shape, origin_dtype = self._pre_process(x, cos, sin)
        interleaved = not self.is_neox_style
        output = apply_rotary_emb(x, cos, sin, interleaved)
        return self._post_process(output, origin_shape, origin_dtype)

    rotary_common.ApplyRotaryEmb.__init__ = patched_init
    rotary_common.ApplyRotaryEmb.forward_cuda = patched_forward_cuda
    rotary_common.ApplyRotaryEmb._opennotebook_flash_fallback_patched = True


_patch_vllm_rotary_import_fallback()
