"""
Data Loader for Consumption Layer
从引入层的manifest读取已处理的文件，不直接解析原始文件
"""
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from workflow_engine.logger import get_logger

log = get_logger(__name__)


class ProcessedDataLoader:
    """从引入层加载已处理的数据"""

    def __init__(self, manifest_path: str):
        self.manifest_path = Path(manifest_path)
        self.manifest = self._load_manifest()

    def _load_manifest(self) -> Dict[str, Any]:
        if not self.manifest_path.exists():
            raise FileNotFoundError(f"Manifest not found: {self.manifest_path}")
        with open(self.manifest_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def get_file_record(self, file_id: str) -> Optional[Dict[str, Any]]:
        """获取文件记录"""
        for file_rec in self.manifest.get("files", []):
            if file_rec.get("id") == file_id:
                return file_rec
        return None

    def get_mineru_markdown(self, file_id: str) -> Optional[str]:
        """获取MinerU处理后的markdown内容"""
        record = self.get_file_record(file_id)
        if not record:
            return None

        parsers = record.get("parsers", {})
        mineru = parsers.get("mineru", {})
        md_path = mineru.get("md_path")

        if not md_path or not Path(md_path).exists():
            # Fallback to legacy field
            md_path = record.get("processed_md_path")
            if not md_path or not Path(md_path).exists():
                return None

        try:
            return Path(md_path).read_text(encoding='utf-8')
        except Exception as e:
            log.error(f"Failed to read markdown: {e}")
            return None

    def get_mineru_images_dir(self, file_id: str) -> Optional[Path]:
        """获取MinerU提取的图片目录"""
        record = self.get_file_record(file_id)
        if not record:
            return None

        parsers = record.get("parsers", {})
        mineru = parsers.get("mineru", {})
        images_dir = mineru.get("images_dir")

        if not images_dir:
            images_dir = record.get("images_dir")

        if images_dir and Path(images_dir).exists():
            return Path(images_dir)
        return None

    def list_all_files(self) -> List[Dict[str, Any]]:
        """列出所有已处理的文件"""
        return self.manifest.get("files", [])

    def get_embedded_files(self) -> List[Dict[str, Any]]:
        """获取所有成功embedding的文件"""
        return [f for f in self.list_all_files() if f.get("status") == "embedded"]
