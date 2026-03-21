#!/usr/bin/env python3
"""
迁移脚本：扫描现有 outputs 目录，为每个笔记本生成独立的 JSON 记录
运行方式：python scripts/migrate_to_json_records.py
"""
from pathlib import Path
import sys
import json
import time

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from workflow_engine.utils import get_project_root

def migrate_sources():
    """扫描并迁移源文件"""
    project_root = get_project_root()
    outputs_dir = project_root / "outputs"

    if not outputs_dir.exists():
        print("outputs 目录不存在")
        return 0

    count = 0

    # 扫描: outputs/{user_email}/{notebook_dir}/sources/
    for user_dir in outputs_dir.iterdir():
        if not user_dir.is_dir() or user_dir.name.startswith("_"):
            continue

        for notebook_dir in user_dir.iterdir():
            if not notebook_dir.is_dir():
                continue

            sources_dir = notebook_dir / "sources"
            if not sources_dir.exists():
                continue

            records = []

            # 扫描 sources 下的所有子目录
            for source_stem_dir in sources_dir.iterdir():
                if not source_stem_dir.is_dir():
                    continue

                # 查找 original 目录下的文件
                original_dir = source_stem_dir / "original"
                if original_dir.exists() and original_dir.is_dir():
                    for file_path in original_dir.iterdir():
                        if file_path.is_file():
                            try:
                                rel = file_path.relative_to(project_root)
                                static_url = "/" + rel.as_posix()

                                record = {
                                    "file_name": file_path.name,
                                    "file_path": str(file_path),
                                    "static_url": static_url,
                                    "file_size": file_path.stat().st_size,
                                    "file_type": "",
                                    "created_at": time.time()
                                }
                                records.append(record)
                                count += 1
                                print(f"✓ 源文件: {file_path.name}")
                            except Exception as e:
                                print(f"✗ 失败: {file_path.name} - {e}")

            # 写入笔记本的 _sources.json
            if records:
                sources_file = notebook_dir / "_sources.json"
                with open(sources_file, 'w', encoding='utf-8') as f:
                    json.dump(records, f, ensure_ascii=False, indent=2)

    return count

def migrate_outputs():
    """扫描并迁移产出文件"""
    project_root = get_project_root()
    outputs_dir = project_root / "outputs"

    if not outputs_dir.exists():
        return 0

    count = 0

    # 产出类型和对应文件名
    output_files = {
        "ppt": ["paper2ppt.pdf", "paper2ppt_editable.pptx"],
        "podcast": ["podcast.wav", "podcast.mp3"],
        "mindmap": ["mindmap.mmd"],
        "flashcard": ["flashcards.json"],
        "quiz": ["quiz.json"],
        "deep_research": ["report.pdf", "report.md"]
    }

    # 扫描: outputs/{user_email}/{notebook_dir}/{feature}/{ts}/
    for user_dir in outputs_dir.iterdir():
        if not user_dir.is_dir() or user_dir.name.startswith("_"):
            continue

        for notebook_dir in user_dir.iterdir():
            if not notebook_dir.is_dir():
                continue

            records = []

            # 扫描各个功能目录
            for feature_dir in notebook_dir.iterdir():
                if not feature_dir.is_dir() or feature_dir.name in ["sources", "vector_store"]:
                    continue

                feature_name = feature_dir.name

                # 扫描时间戳目录
                for ts_dir in feature_dir.iterdir():
                    if not ts_dir.is_dir():
                        continue

                    # 根据功能类型查找对应文件
                    for output_type, filenames in output_files.items():
                        if feature_name != output_type:
                            continue

                        for filename in filenames:
                            file_path = ts_dir / filename
                            if file_path.exists():
                                try:
                                    rel = file_path.relative_to(project_root)
                                    download_url = "/" + rel.as_posix()

                                    record = {
                                        "output_type": output_type,
                                        "file_name": filename,
                                        "download_url": download_url,
                                        "created_at": time.time()
                                    }
                                    records.append(record)
                                    count += 1
                                    print(f"✓ 产出: {output_type}/{filename}")
                                except Exception as e:
                                    print(f"✗ 失败: {filename} - {e}")
                                break

            # 写入笔记本的 _outputs.json
            if records:
                outputs_file = notebook_dir / "_outputs.json"
                with open(outputs_file, 'w', encoding='utf-8') as f:
                    json.dump(records, f, ensure_ascii=False, indent=2)

    return count

if __name__ == "__main__":
    print("=" * 60)
    print("开始迁移现有文件到 JSON 记录")
    print("=" * 60)

    print("\n[1/2] 迁移源文件...")
    source_count = migrate_sources()
    print(f"完成: {source_count} 个源文件")

    print("\n[2/2] 迁移产出文件...")
    output_count = migrate_outputs()
    print(f"完成: {output_count} 个产出文件")

    print("\n" + "=" * 60)
    print(f"迁移完成！共 {source_count + output_count} 个文件")
    print("=" * 60)
