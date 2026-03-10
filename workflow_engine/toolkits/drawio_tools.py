"""
DrawIO 工具函数
用于处理 DrawIO XML 格式
"""
import re
import xml.etree.ElementTree as ET
from typing import Optional


def validate_xml(xml_content: str) -> bool:
    """
    验证 XML 格式是否正确

    Args:
        xml_content: XML 内容

    Returns:
        是否为有效的 XML
    """
    if not xml_content or not xml_content.strip():
        return False

    try:
        ET.fromstring(xml_content)
        return True
    except ET.ParseError:
        return False


def export_drawio_png(xml_content: str, output_path: str) -> bool:
    """
    导出 DrawIO 为 PNG 图片（占位函数）

    注意：实际的 PNG 导出需要 drawio 命令行工具或浏览器渲染
    这里只是一个占位函数，返回 False 表示不支持

    Args:
        xml_content: DrawIO XML 内容
        output_path: 输出路径

    Returns:
        是否成功导出
    """
    # 这个功能需要 drawio CLI 或者浏览器自动化，暂时不支持
    return False


def wrap_xml(raw_xml: str) -> str:
    """
    将原始 mxGraphModel XML 包装成完整的 DrawIO 文件格式

    Args:
        raw_xml: 原始的 mxGraphModel XML 或单元格 XML

    Returns:
        完整的 DrawIO XML 格式
    """
    if not raw_xml or not raw_xml.strip():
        return ""

    # 如果已经是完整的 DrawIO 格式，直接返回
    if "<mxfile" in raw_xml.lower():
        return raw_xml

    # 如果包含 diagram 标签但没有 mxfile，添加 mxfile 包装
    if "<diagram" in raw_xml.lower():
        return f'''<mxfile host="app.diagrams.net" modified="2024-01-01T00:00:00.000Z" agent="AI" version="1.0.0" etag="" type="device">
{raw_xml}
</mxfile>'''

    # 如果只有 mxGraphModel，添加完整的包装
    if "<mxGraphModel" in raw_xml:
        return f'''<mxfile host="app.diagrams.net" modified="2024-01-01T00:00:00.000Z" agent="AI" version="1.0.0" etag="" type="device">
  <diagram id="generated" name="Page-1">
{raw_xml}
  </diagram>
</mxfile>'''

    # 如果只有 root 或单元格，添加 mxGraphModel 和完整包装
    return f'''<mxfile host="app.diagrams.net" modified="2024-01-01T00:00:00.000Z" agent="AI" version="1.0.0" etag="" type="device">
  <diagram id="generated" name="Page-1">
    <mxGraphModel dx="1434" dy="844" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
{raw_xml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>'''


def extract_cells(xml_content: str) -> str:
    """
    从完整的 DrawIO XML 中提取单元格定义部分

    Args:
        xml_content: 完整的 DrawIO XML 内容

    Returns:
        提取的单元格 XML（不包含 mxfile/diagram/mxGraphModel 包装）
    """
    if not xml_content or not xml_content.strip():
        return ""

    # 如果已经没有包装，直接返回
    if "<mxfile" not in xml_content.lower() and "<diagram" not in xml_content.lower():
        return xml_content

    # 尝试提取 root 标签内的内容
    root_match = re.search(r'<root[^>]*>(.*?)</root>', xml_content, re.DOTALL | re.IGNORECASE)
    if root_match:
        root_content = root_match.group(1).strip()
        # 移除默认的 id="0" 和 id="1" 单元格定义
        root_content = re.sub(r'<mxCell\s+id="0"\s*/>', '', root_content)
        root_content = re.sub(r'<mxCell\s+id="1"\s+parent="0"\s*/>', '', root_content)
        return root_content.strip()

    # 如果找不到 root 标签，尝试提取 mxGraphModel 内容
    model_match = re.search(r'<mxGraphModel[^>]*>(.*?)</mxGraphModel>', xml_content, re.DOTALL | re.IGNORECASE)
    if model_match:
        return model_match.group(1).strip()

    # 如果都找不到，返回原内容
    return xml_content
