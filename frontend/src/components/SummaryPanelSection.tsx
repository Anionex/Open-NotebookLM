import type { ReactNode } from 'react';
import { RefreshCw, Save, Trash2 } from 'lucide-react';

import type { WorkspaceItemType } from './thinkflow-types';

type SummaryListItem = {
  id: string;
  title: string;
  summary_kind?: string;
};

type SummaryPanelSectionProps = {
  summaryItems: SummaryListItem[];
  allSummary: SummaryListItem | null;
  activeSummaryId: string;
  activeSummary: SummaryListItem | null;
  summaryTitle: string;
  summaryContent: string;
  summaryEditMode: boolean;
  workspaceSaving: WorkspaceItemType | null;
  rebuildingAllSummary: boolean;
  panelGuide: ReactNode;
  onSelectSummary: (id: string) => Promise<void>;
  onCreateSummary: () => Promise<void>;
  onRebuildAllSummary: () => Promise<void>;
  onToggleSummaryEdit: () => void;
  onDeleteSummary: (id: string) => Promise<void>;
  onSummaryTitleChange: (value: string) => void;
  onSummaryContentChange: (value: string) => void;
  onSaveSummary: () => Promise<void>;
};

export function SummaryPanelSection({
  summaryItems,
  allSummary,
  activeSummaryId,
  activeSummary,
  summaryTitle,
  summaryContent,
  summaryEditMode,
  workspaceSaving,
  rebuildingAllSummary,
  panelGuide,
  onSelectSummary,
  onCreateSummary,
  onRebuildAllSummary,
  onToggleSummaryEdit,
  onDeleteSummary,
  onSummaryTitleChange,
  onSummaryContentChange,
  onSaveSummary,
}: SummaryPanelSectionProps) {
  return (
    <>
      <div className="thinkflow-doc-header">
        <div className="thinkflow-doc-tabs">
          {allSummary ? (
            <button
              key={allSummary.id}
              type="button"
              className={`thinkflow-doc-tab is-all-summary ${activeSummaryId === allSummary.id ? 'is-active' : ''}`}
              onClick={() => void onSelectSummary(allSummary.id)}
            >
              总 Summary
            </button>
          ) : null}
          {summaryItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`thinkflow-doc-tab ${activeSummaryId === item.id ? 'is-active' : ''}`}
              onClick={() => void onSelectSummary(item.id)}
            >
              {item.title}
            </button>
          ))}
        </div>
        <div className="thinkflow-doc-header-actions">
          <button
            type="button"
            className="thinkflow-doc-action-btn"
            onClick={() => void onRebuildAllSummary()}
            disabled={summaryItems.length === 0 || rebuildingAllSummary}
            title={summaryItems.length === 0 ? '先从对话中生成 item summary' : '根据所有 item summary 重新生成总 Summary'}
          >
            <RefreshCw size={14} />
            {rebuildingAllSummary ? '总结中' : '重算总 Summary'}
          </button>
          <button type="button" className="thinkflow-doc-new-btn" onClick={() => void onCreateSummary()}>
            + 手动 item
          </button>
          {activeSummary ? (
            <div className="thinkflow-doc-actions">
              <button type="button" className={`thinkflow-doc-action-btn ${summaryEditMode ? 'is-active' : ''}`} onClick={onToggleSummaryEdit}>
                {summaryEditMode ? '完成编辑' : '编辑摘要'}
              </button>
              <button type="button" className="thinkflow-doc-action-btn is-danger" onClick={() => void onDeleteSummary(activeSummary.id)}>
                <Trash2 size={14} />
                删除
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {activeSummary ? (
        <div className="thinkflow-doc-title-row">
          <input
            className="thinkflow-doc-title-input"
            value={summaryTitle}
            onChange={(event) => onSummaryTitleChange(event.target.value)}
            placeholder="摘要名称由你决定，也可以先留空后再改"
          />
        </div>
      ) : null}

      {panelGuide}

      <div className="thinkflow-doc-body">
        {!activeSummary ? (
          <div className="thinkflow-empty">
            Summary 是多级卡片，不会自动生成。
            <br />
            先在中间对话区选择有价值内容并沉淀为 item summary，再点击“重算总 Summary”生成 all summary。
          </div>
        ) : summaryEditMode ? (
          <textarea
            className="thinkflow-doc-editor"
            value={summaryContent}
            onChange={(event) => onSummaryContentChange(event.target.value)}
            placeholder="这里是 AI 笔记的可编辑区。"
          />
        ) : (
          <div className="thinkflow-note-board">
            <div className="thinkflow-note-copy">
              <pre className="thinkflow-markdown">{summaryContent}</pre>
            </div>
          </div>
        )}
      </div>

      <div className="thinkflow-output-toolbar">
        <span className="thinkflow-output-toolbar-label">Summary</span>
        <span className="thinkflow-output-toolbar-tip">
          {allSummary ? `当前有 ${summaryItems.length} 张 item summary，已生成总 Summary。` : `当前有 ${summaryItems.length} 张 item summary。`}
        </span>
        <button type="button" className="thinkflow-save-btn" onClick={() => void onSaveSummary()} disabled={!activeSummaryId || workspaceSaving === 'summary'}>
          <Save size={14} />
          {workspaceSaving === 'summary' ? '保存中' : '保存摘要'}
        </button>
      </div>
    </>
  );
}
