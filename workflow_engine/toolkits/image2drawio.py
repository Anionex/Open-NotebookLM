"""
Image to DrawIO utilities
包含图像处理和 DrawIO 转换的工具函数
"""
from typing import Tuple


def bbox_iou_px(
    bbox1: Tuple[float, float, float, float],
    bbox2: Tuple[float, float, float, float]
) -> float:
    """
    计算两个边界框的 IoU (Intersection over Union)

    Args:
        bbox1: 第一个边界框 (x1, y1, x2, y2) 或 (x, y, width, height)
        bbox2: 第二个边界框 (x1, y1, x2, y2) 或 (x, y, width, height)

    Returns:
        IoU 值，范围 [0, 1]
    """
    # 假设输入是 (x1, y1, x2, y2) 格式
    x1_1, y1_1, x2_1, y2_1 = bbox1
    x1_2, y1_2, x2_2, y2_2 = bbox2

    # 计算交集区域
    x_left = max(x1_1, x1_2)
    y_top = max(y1_1, y1_2)
    x_right = min(x2_1, x2_2)
    y_bottom = min(y2_1, y2_2)

    # 如果没有交集
    if x_right < x_left or y_bottom < y_top:
        return 0.0

    # 计算交集面积
    intersection_area = (x_right - x_left) * (y_bottom - y_top)

    # 计算各自面积
    bbox1_area = (x2_1 - x1_1) * (y2_1 - y1_1)
    bbox2_area = (x2_2 - x1_2) * (y2_2 - y1_2)

    # 计算并集面积
    union_area = bbox1_area + bbox2_area - intersection_area

    # 避免除零
    if union_area == 0:
        return 0.0

    # 计算 IoU
    iou = intersection_area / union_area
    return iou
