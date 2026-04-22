"""Generate complete debug artifacts for the mindmap pipeline report.

Reads existing run outputs in outputs/kb_outputs/default/{run_id}_mindmap/debug/,
re-creates parse_files / chunk samples / prompt samples that are missing,
so the pipeline_report.html can render real I/O at every stage.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from workflow_engine.workflow.wf_kb_mindmap import (
    _build_map_prompt,
    _build_collapse_prompt,
    _build_reduce_prompt,
    _count_tokens,
)
from langchain_text_splitters import RecursiveCharacterTextSplitter

RUN_ID = "1776168414_mindmap"
SOURCE_FILE = PROJECT_ROOT / "outputs/kb_data/default/local_1776129593555_209e57c4/未来简史.txt"
DEBUG_DIR = PROJECT_ROOT / f"outputs/kb_outputs/default/{RUN_ID}/debug"
MMD_FILE = PROJECT_ROOT / f"outputs/kb_outputs/default/{RUN_ID}/mindmap.mmd"

MODEL = "deepseek-v3.2"
LANGUAGE = "zh"
MAX_DEPTH = 5


def main():
    routing = json.loads((DEBUG_DIR / "01_routing.json").read_text(encoding="utf-8"))
    map_results = json.loads((DEBUG_DIR / "02_map_results.json").read_text(encoding="utf-8"))
    collapse = json.loads((DEBUG_DIR / "03_collapse_round1.json").read_text(encoding="utf-8"))

    raw_text = SOURCE_FILE.read_text(encoding="utf-8")
    parse_info = {
        "files": [
            {
                "filename": SOURCE_FILE.name,
                "size_bytes": SOURCE_FILE.stat().st_size,
                "char_count": len(raw_text),
                "token_count": _count_tokens(raw_text, MODEL),
                "preview_first_500": raw_text[:500],
                "preview_last_300": raw_text[-300:],
            }
        ],
        "total_token_count": _count_tokens(raw_text, MODEL),
    }
    (DEBUG_DIR / "00_parse_files.json").write_text(
        json.dumps(parse_info, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    limit = routing["context_window_limit"]
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=limit,
        chunk_overlap=200,
        length_function=lambda t: _count_tokens(t, MODEL),
        separators=["\n\n\n", "\n\n", "\n", "。", ".", "；", ";", " ", ""],
    )
    sub_texts = splitter.split_text(raw_text)
    chunks_full = []
    for j, sub in enumerate(sub_texts):
        chunks_full.append({
            "chunk_id": f"file0_chunk{j}",
            "source": SOURCE_FILE.name,
            "text": sub,
            "token_count": _count_tokens(sub, MODEL),
        })

    chunks_detail = {
        "chunk_count": len(chunks_full),
        "chunks": [
            {
                "chunk_id": c["chunk_id"],
                "source": c["source"],
                "token_count": c["token_count"],
                "char_count": len(c["text"]),
                "preview_first_400": c["text"][:400],
                "preview_last_200": c["text"][-200:],
            }
            for c in chunks_full
        ],
    }
    (DEBUG_DIR / "01b_chunks_detail.json").write_text(
        json.dumps(chunks_detail, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    sample_chunk = chunks_full[0]
    map_prompt = _build_map_prompt(sample_chunk, LANGUAGE)
    map_prompt_excerpt = map_prompt.replace(
        sample_chunk["text"],
        f"[ ... chunk text {len(sample_chunk['text'])} chars / {sample_chunk['token_count']} tokens, see 01b_chunks_detail.json ... ]"
    )
    (DEBUG_DIR / "02_map_prompt_sample.txt").write_text(map_prompt_excerpt, encoding="utf-8")

    sample_map_output = next((r for r in map_results if r["chunk_id"] == sample_chunk["chunk_id"]), map_results[0])
    (DEBUG_DIR / "02_map_output_sample.json").write_text(
        json.dumps(sample_map_output, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    all_map_nodes = []
    for r in map_results:
        all_map_nodes.extend(r.get("nodes", []))
    half = len(all_map_nodes) // 2
    group_a = all_map_nodes[:half][:5]
    group_b = all_map_nodes[half:half + 5]
    collapse_prompt = _build_collapse_prompt(
        json.dumps(group_a, ensure_ascii=False, indent=2),
        json.dumps(group_b, ensure_ascii=False, indent=2),
        LANGUAGE,
    )
    (DEBUG_DIR / "03_collapse_prompt_sample.txt").write_text(collapse_prompt, encoding="utf-8")

    nodes_json = json.dumps(collapse, ensure_ascii=False, indent=2)
    reduce_prompt = _build_reduce_prompt(nodes_json, LANGUAGE, MAX_DEPTH)
    reduce_prompt_excerpt = reduce_prompt.replace(
        nodes_json,
        f"[ ... {len(collapse)} nodes JSON, see 04_reduce_input.json ... ]"
    )
    (DEBUG_DIR / "05_reduce_prompt.txt").write_text(reduce_prompt_excerpt, encoding="utf-8")

    final_md = MMD_FILE.read_text(encoding="utf-8")
    (DEBUG_DIR / "06_final_mindmap.md").write_text(final_md, encoding="utf-8")

    headings = [l for l in final_md.split("\n") if l.lstrip().startswith("#")]
    h_levels = {}
    for h in headings:
        level = len(h) - len(h.lstrip("#"))
        h_levels[level] = h_levels.get(level, 0) + 1
    summary = {
        "run_id": RUN_ID,
        "model": MODEL,
        "language": LANGUAGE,
        "max_depth": MAX_DEPTH,
        "source_file": SOURCE_FILE.name,
        "source_total_tokens": parse_info["total_token_count"],
        "context_window_limit": limit,
        "use_mapreduce": routing["use_mapreduce"],
        "chunk_count": len(chunks_full),
        "map_total_nodes": sum(len(r["nodes"]) for r in map_results),
        "collapse_round_count": 1,
        "collapse_output_nodes": len(collapse),
        "reduce_output_nodes_total": len(headings),
        "reduce_output_by_level": h_levels,
        "final_mindmap_chars": len(final_md),
    }
    (DEBUG_DIR / "00_run_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"Generated additional debug files in {DEBUG_DIR}")
    for f in sorted(DEBUG_DIR.iterdir()):
        print(f"  {f.name}  ({f.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
