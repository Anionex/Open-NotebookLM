from __future__ import annotations

import fastapi_app.notebook_paths as notebook_paths
from fastapi_app.services.thinkflow_workspace_service import ThinkFlowWorkspaceService


def test_summary_capture_creates_item_summary_card(tmp_path, monkeypatch):
    monkeypatch.setattr(notebook_paths, "get_project_root", lambda: tmp_path)
    service = ThinkFlowWorkspaceService()

    item = service.capture_item(
        notebook_id="nb-1",
        notebook_title="Notebook",
        user_id="user-1",
        item_type="summary",
        title="业务价值判断",
        text_items=["用户明确希望弱化技术细节，强调业务价值。"],
        source_refs=[{"message_id": "m-1", "message_role": "assistant"}],
    )

    assert item["type"] == "summary"
    assert item["summary_kind"] == "item"
    assert item["title"] == "业务价值判断"
    assert "业务价值" in item["content"]


def test_rebuild_all_summary_uses_all_item_cards_and_reuses_existing_card(tmp_path, monkeypatch):
    monkeypatch.setattr(notebook_paths, "get_project_root", lambda: tmp_path)
    service = ThinkFlowWorkspaceService()
    base = {
        "notebook_id": "nb-1",
        "notebook_title": "Notebook",
        "user_id": "user-1",
    }
    first = service.capture_item(
        **base,
        item_type="summary",
        title="受众",
        text_items=["这次产出面向老板，重点讲业务价值。"],
    )
    second = service.capture_item(
        **base,
        item_type="summary",
        title="边界",
        text_items=["需要避免公式和过深模型细节。"],
    )

    all_summary = service.rebuild_all_summary(**base)

    assert all_summary["type"] == "summary"
    assert all_summary["summary_kind"] == "all"
    assert all_summary["source_summary_item_ids"] == [first["id"], second["id"]]
    assert "基于 2 张 item summary 卡片重新总结" in all_summary["content"]
    assert "业务价值" in all_summary["content"]
    assert "避免公式" in all_summary["content"]

    refreshed = service.capture_item(
        **base,
        item_type="summary",
        title="表达",
        text_items=["整体表达要偏决策建议。"],
    )
    rebuilt = service.rebuild_all_summary(**base)
    listed = service.list_items(**base, item_type="summary")
    all_cards = [item for item in listed if item.get("summary_kind") == "all"]

    assert rebuilt["id"] == all_summary["id"]
    assert len(all_cards) == 1
    assert rebuilt["source_summary_item_ids"] == [first["id"], second["id"], refreshed["id"]]
    assert "偏决策建议" in rebuilt["content"]
