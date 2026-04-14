import type { ReactNode } from 'react';
import { Save, Trash2 } from 'lucide-react';

import type { WorkspaceItemType } from '../types';

type SummaryPanelSectionProps = {
  summaryItems: Array<{ id: string; title: string }>;
  activeSummaryId: string;
  activeSummary: { id: string; title: string } | null;
  summaryTitle: string;
  summaryContent: string;
  summaryEditMode: boolean;
  workspaceSaving: WorkspaceItemType | null;
  panelGuide: ReactNode;
  onSelectSummary: (id: string) => Promise<void>;
  onCreateSummary: () => Promise<void>;
  onToggleSummaryEdit: () => void;
  onDeleteSummary: (id: string) => Promise<void>;
  onSummaryTitleChange: (value: string) => void;
  onSummaryContentChange: (value: string) => void;
  onSaveSummary: () => Promise<void>;
};

export function SummaryPanelSection({
  summaryItems,
  activeSummaryId,
  activeSummary,
  summaryTitle,
  summaryContent,
  summaryEditMode,
  workspaceSaving,
  panelGuide,
  onSelectSummary,
  onCreateSummary,
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
          <button type="button" className="thinkflow-doc-new-btn" onClick={() => void onCreateSummary()}>
            + 新建
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
            摘要不是默认生成的，它更像 AI 帮你记下来的阅读笔记。
            <br />
            你在中间对话区对某个回答、某组问答或多条消息点击“沉淀”后，它会结合来源整理成可继续编辑的笔记卡。
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
        <span className="thinkflow-output-toolbar-label">摘要</span>
        <span className="thinkflow-output-toolbar-tip">这是 AI 笔记区，用来沉淀你当前理解和后续可追问点。</span>
        <button type="button" className="thinkflow-save-btn" onClick={() => void onSaveSummary()} disabled={!activeSummaryId || workspaceSaving === 'summary'}>
          <Save size={14} />
          {workspaceSaving === 'summary' ? '保存中' : '保存摘要'}
        </button>
      </div>
    </>
  );
}
