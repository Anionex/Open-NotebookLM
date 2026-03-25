"""
Knowledge Base Records - JSON-based storage for sources and outputs
Each notebook has its own JSON files in its directory
"""
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    from fastapi_app.logger import get_logger
    log = get_logger(__name__)
except ImportError:
    import logging
    log = logging.getLogger(__name__)

def _get_notebook_dir(user_email: str, notebook_id: str) -> Optional[Path]:
    """根据 user_email 和 notebook_id 查找笔记本目录"""
    from workflow_engine.utils import get_project_root
    safe_email = user_email.replace("@", "_at_")
    user_dir = get_project_root() / "outputs" / safe_email

    if not user_dir.exists():
        log.warning(f"User dir not found: {user_dir}")
        return None

    # 查找匹配的笔记本目录（目录名以 notebook_id 结尾）
    for nb_dir in user_dir.iterdir():
        if nb_dir.is_dir() and nb_dir.name.endswith(notebook_id):
            log.info(f"Found notebook dir: {nb_dir}")
            return nb_dir

    log.warning(f"Notebook dir not found for {user_email}/{notebook_id}")
    return None

def _read_json(file_path: Path) -> List[Dict[str, Any]]:
    if not file_path.exists():
        return []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        log.warning(f"Failed to read {file_path}: {e}")
        return []

def _write_json(file_path: Path, data: List[Dict[str, Any]]):
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log.error(f"Failed to write {file_path}: {e}")

# ============ Source Records ============

def add_source_record(
    user_email: str,
    notebook_id: str,
    file_name: str,
    file_path: str,
    static_url: str,
    file_size: int = 0,
    file_type: str = ""
):
    notebook_dir = _get_notebook_dir(user_email, notebook_id)
    if not notebook_dir:
        log.warning(f"Notebook dir not found: {user_email}/{notebook_id}")
        return

    sources_file = notebook_dir / "_sources.json"
    records = _read_json(sources_file)

    record = {
        "file_name": file_name,
        "file_path": file_path,
        "static_url": static_url,
        "file_size": file_size,
        "file_type": file_type,
        "created_at": time.time()
    }
    records.append(record)
    _write_json(sources_file, records)

def get_source_records(
    user_email: str,
    notebook_id: str
) -> List[Dict[str, Any]]:
    notebook_dir = _get_notebook_dir(user_email, notebook_id)
    if not notebook_dir:
        return []

    sources_file = notebook_dir / "_sources.json"
    records = _read_json(sources_file)
    return sorted(records, key=lambda x: x.get("created_at", 0), reverse=True)

# ============ Output Records ============

def add_output_record(
    user_email: str,
    notebook_id: str,
    output_type: str,
    file_name: str,
    download_url: str,
    output_id: Optional[str] = None,
    title: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
):
    notebook_dir = _get_notebook_dir(user_email, notebook_id)
    if not notebook_dir:
        log.warning(f"Notebook dir not found: {user_email}/{notebook_id}")
        return

    outputs_file = notebook_dir / "_outputs.json"
    records = _read_json(outputs_file)

    record = {
        "id": output_id,
        "output_type": output_type,
        "file_name": file_name,
        "title": title or file_name,
        "download_url": download_url,
        "created_at": time.time()
    }
    if extra and isinstance(extra, dict):
        record.update(extra)
    records.append(record)
    _write_json(outputs_file, records)

def upsert_output_record(
    user_email: str,
    notebook_id: str,
    output_id: str,
    output_type: str,
    file_name: str,
    download_url: str,
    title: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
):
    notebook_dir = _get_notebook_dir(user_email, notebook_id)
    if not notebook_dir:
        log.warning(f"Notebook dir not found: {user_email}/{notebook_id}")
        return

    outputs_file = notebook_dir / "_outputs.json"
    records = _read_json(outputs_file)
    now = time.time()

    for record in records:
        if record.get("id") != output_id:
            continue
        record.update({
            "id": output_id,
            "output_type": output_type,
            "file_name": file_name,
            "title": title or file_name,
            "download_url": download_url,
            "updated_at": now,
        })
        if extra and isinstance(extra, dict):
            record.update(extra)
        _write_json(outputs_file, records)
        return

    record = {
        "id": output_id,
        "output_type": output_type,
        "file_name": file_name,
        "title": title or file_name,
        "download_url": download_url,
        "created_at": now,
        "updated_at": now,
    }
    if extra and isinstance(extra, dict):
        record.update(extra)
    records.append(record)
    _write_json(outputs_file, records)

def get_output_records(
    user_email: str,
    notebook_id: str
) -> List[Dict[str, Any]]:
    notebook_dir = _get_notebook_dir(user_email, notebook_id)
    if not notebook_dir:
        return []

    outputs_file = notebook_dir / "_outputs.json"
    records = _read_json(outputs_file)
    return sorted(records, key=lambda x: x.get("created_at", 0), reverse=True)
