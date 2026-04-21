import type { ReactNode, RefObject } from 'react';
import { Save, Target, Trash2 } from 'lucide-react';

import type { ThinkFlowOutputButton } from './thinkflow-types';

type DocumentPanelSectionProps = {
  documents: Array<{ id: string; title: string }>;
  activeDocumentId: string;
  activeDocument: { id: string; title: string } | null;
  documentTitle: string;
  documentContent: string;
  editMode: boolean;
  showVersionPanel: boolean;
  versions: Array<{ id: string; reason?: string; created_at: string }>;
  panelGuide: ReactNode;
  documentSections: any[];
  renderDocumentSection: (section: any) => ReactNode;
  docBodyRef: RefObject<HTMLDivElement | null>;
  guidanceItems: Array<{ id: string; title: string }>;
  selectedGuidanceIds: string[];
  outputButtons: ThinkFlowOutputButton[];
  generatingOutline: string | null;
  documentSaving: boolean;
  onSelectDocument: (id: string) => Promise<void>;
  onCreateDocument: () => Promise<void>;
  onToggleDocumentEdit: () => void;
  onToggleVersionPanel: () => void;
  onDeleteDocument: (id: string) => Promise<void>;
  onDocumentTitleChange: (value: string) => void;
  onDocumentContentChange: (value: string) => void;
  onRestoreVersion: (versionId: string) => Promise<void>;
  onToggleGuidanceSelection: (id: string) => void;
  onOutputAction: (type: string) => Promise<void>;
  onSaveDocument: () => Promise<void>;
};

export function DocumentPanelSection({
  documents,
  activeDocumentId,
  activeDocument,
  documentTitle,
  documentContent,
  editMode,
  showVersionPanel,
  versions,
  panelGuide,
  documentSections,
  renderDocumentSection,
  docBodyRef,
  guidanceItems,
  selectedGuidanceIds,
  outputButtons,
  generatingOutline,
  documentSaving,
  onSelectDocument,
  onCreateDocument,
  onToggleDocumentEdit,
  onToggleVersionPanel,
  onDeleteDocument,
  onDocumentTitleChange,
  onDocumentContentChange,
  onRestoreVersion,
  onToggleGuidanceSelection,
  onOutputAction,
  onSaveDocument,
}: DocumentPanelSectionProps) {
  return (
    <>
      <div className="thinkflow-doc-header">
        <div className="thinkflow-doc-tabs">
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className={`thinkflow-doc-tab ${activeDocumentId === doc.id ? 'is-active' : ''}`}
              onClick={() => void onSelectDocument(doc.id)}
            >
              {doc.title}
            </button>
          ))}
        </div>
        <div className="thinkflow-doc-header-actions">
          <button type="button" className="thinkflow-doc-new-btn" onClick={() => void onCreateDocument()}>
            + 新建
          </button>
          <div className="thinkflow-doc-actions">
            <button type="button" className={`thinkflow-doc-action-btn ${editMode ? 'is-active' : ''}`} onClick={onToggleDocumentEdit}>
              {editMode ? '编辑中' : '编辑全文'}
            </button>
            <button type="button" className={`thinkflow-doc-action-btn ${showVersionPanel ? 'is-active' : ''}`} onClick={onToggleVersionPanel} disabled={versions.length <= 1}>
              历史{versions.length > 1 ? `(${versions.length})` : ''}
            </button>
            {activeDocument ? (
              <button type="button" className="thinkflow-doc-action-btn is-danger" onClick={() => void onDeleteDocument(activeDocument.id)}>
                <Trash2 size={14} />
                删除
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {activeDocument ? (
        <div className="thinkflow-doc-title-row">
          <input
            className="thinkflow-doc-title-input"
            value={documentTitle}
            onChange={(event) => onDocumentTitleChange(event.target.value)}
            placeholder="为这份梳理输入标题，或稍后从对话内容整理命名"
          />
        </div>
      ) : null}

      {panelGuide}

      <div className="thinkflow-doc-body" ref={docBodyRef}>
        {!activeDocument ? (
        <div className="thinkflow-empty">
            来源是主输入；梳理文档用于沉淀结构化理解，也可以作为后续产出的增强上下文。
            <br />
            先在中间持续对话，再把真正有价值的段落或回答推送到这里。
          </div>
        ) : !documentContent.trim() ? (
          <div className="thinkflow-empty">
            在左边对话中选中内容，点击 <strong>⟩</strong> 推送到这里。
          </div>
        ) : editMode ? (
          <textarea className="thinkflow-doc-editor" value={documentContent} onChange={(event) => onDocumentContentChange(event.target.value)} />
        ) : (
          <div className="thinkflow-doc-sections">{documentSections.map(renderDocumentSection)}</div>
        )}
      </div>

      {showVersionPanel && versions.length > 1 ? (
        <div className="thinkflow-version-panel">
          {versions.map((version, index) => (
            <div key={version.id} className={`thinkflow-version-item ${index === 0 ? 'is-current' : ''}`}>
              <div className="thinkflow-version-main">
                <div className="thinkflow-version-title">{version.reason || 'update'}</div>
                <div className="thinkflow-version-time">{new Date(version.created_at).toLocaleString()}</div>
              </div>
              {index > 0 ? (
                <button type="button" className="thinkflow-version-restore" onClick={() => void onRestoreVersion(version.id)}>
                  恢复
                </button>
              ) : (
                <span className="thinkflow-version-current">当前</span>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="thinkflow-output-toolbar">
        <span className="thinkflow-output-toolbar-label">产出</span>
        <span className="thinkflow-output-toolbar-tip">来源是主输入；当前梳理文档和产出指导会作为可选增强上下文</span>
        <div className="thinkflow-guidance-strip">
          {guidanceItems.length === 0 ? <span className="thinkflow-doc-check-tip">暂无产出指导</span> : null}
          {guidanceItems.map((item) => (
            <label key={item.id} className={`thinkflow-doc-check ${selectedGuidanceIds.includes(item.id) ? 'is-checked' : ''}`}>
              <input type="checkbox" checked={selectedGuidanceIds.includes(item.id)} onChange={() => onToggleGuidanceSelection(item.id)} />
              <Target size={12} /> {item.title}
            </label>
          ))}
        </div>
        {outputButtons.map((button) => (
          <button key={button.type} type="button" className="thinkflow-output-toolbar-btn" onClick={() => void onOutputAction(button.type)} disabled={generatingOutline !== null}>
            {button.icon}
            {generatingOutline === button.type ? `生成${button.label}中` : button.label}
          </button>
        ))}
        <button type="button" className="thinkflow-save-btn" onClick={() => void onSaveDocument()} disabled={documentSaving}>
          <Save size={14} />
          {documentSaving ? '保存中' : '保存文档'}
        </button>
      </div>
    </>
  );
}
