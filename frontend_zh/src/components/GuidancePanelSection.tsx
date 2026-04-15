import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

type GuidancePanelSectionProps = {
  guidanceItems: Array<{ id: string; title: string }>;
  activeGuidanceId: string;
  activeGuidance: { id: string; title: string } | null;
  guidanceTitle: string;
  guidanceContent: string;
  panelGuide: ReactNode;
  onSelectGuidance: (id: string) => Promise<void>;
  onCreateGuidance: () => Promise<void>;
  onDeleteGuidance: (id: string) => Promise<void>;
};

export function GuidancePanelSection({
  guidanceItems,
  activeGuidanceId,
  activeGuidance,
  guidanceTitle,
  guidanceContent,
  panelGuide,
  onSelectGuidance,
  onCreateGuidance,
  onDeleteGuidance,
}: GuidancePanelSectionProps) {
  return (
    <>
      <div className="thinkflow-doc-header">
        <div className="thinkflow-doc-tabs">
          {guidanceItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`thinkflow-doc-tab ${activeGuidanceId === item.id ? 'is-active' : ''}`}
              onClick={() => void onSelectGuidance(item.id)}
            >
              {item.title}
            </button>
          ))}
        </div>
        <div className="thinkflow-doc-header-actions">
          <button type="button" className="thinkflow-doc-new-btn" onClick={() => void onCreateGuidance()}>
            + 新建
          </button>
          {activeGuidance ? (
            <div className="thinkflow-doc-actions">
              <button type="button" className="thinkflow-doc-action-btn is-danger" onClick={() => void onDeleteGuidance(activeGuidance.id)}>
                <Trash2 size={14} />
                删除
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {activeGuidance ? (
        <div className="thinkflow-doc-title-row">
          <div className="thinkflow-guidance-title">
            <span className="thinkflow-guidance-title-label">当前指导</span>
            <strong>{guidanceTitle}</strong>
          </div>
        </div>
      ) : null}

      {panelGuide}

      <div className="thinkflow-doc-body">
        {!activeGuidance ? (
          <div className="thinkflow-empty">
            产出指导不是聊天副本，而是你从对话里抽出来的高权重 brief。
            <br />
            它会在你生成大纲和正式产出时强约束参与，建议通过“本轮”或多条沉淀生成。
          </div>
        ) : (
          <div className="thinkflow-guidance-brief">
            <div className="thinkflow-guidance-copy">
              <pre className="thinkflow-markdown">{guidanceContent}</pre>
            </div>
          </div>
        )}
      </div>

      <div className="thinkflow-output-toolbar">
        <span className="thinkflow-output-toolbar-label">产出指导</span>
        <span className="thinkflow-output-toolbar-tip">这是只读的高权重上下文，不允许直接编辑；需要改动时请重新从对话沉淀。</span>
      </div>
    </>
  );
}
