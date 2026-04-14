import React from 'react';

type Props = {
  confirmLabel: string;
  description: string;
  documentEmptyLabel: string;
  documentTitles: string[];
  errorMessage: string;
  guidanceTitles: string[];
  hint: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  sourceNames: string[];
  title: string;
};

function renderList(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return <div className="thinkflow-empty">{emptyLabel}</div>;
  }
  return items.map((item) => (
    <div key={item} className="thinkflow-output-lock-item">
      {item}
    </div>
  ));
}

export function ThinkFlowOutputContextModal({
  confirmLabel,
  description,
  documentEmptyLabel,
  documentTitles,
  errorMessage,
  guidanceTitles,
  hint,
  loading,
  onClose,
  onConfirm,
  sourceNames,
  title,
}: Props) {
  return (
    <>
      <div className="thinkflow-popover-overlay" onClick={onClose} />
      <div className="thinkflow-output-context-modal thinkflow-output-lock-modal">
        <div className="thinkflow-output-context-modal-header">
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <button type="button" className="thinkflow-push-close" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="thinkflow-output-context-modal-body">
          {loading ? (
            <div className="thinkflow-empty">正在整理这次来源快照...</div>
          ) : errorMessage ? (
            <div className="thinkflow-empty">{errorMessage}</div>
          ) : (
            <>
              <section className="thinkflow-output-context-group">
                <div className="thinkflow-output-context-group-title">来源文件</div>
                <div className="thinkflow-output-lock-list">{renderList(sourceNames, '未选择来源文件')}</div>
              </section>

              <section className="thinkflow-output-context-group">
                <div className="thinkflow-output-context-group-title">梳理文档 / 参考文档</div>
                <div className="thinkflow-output-lock-list">{renderList(documentTitles, documentEmptyLabel)}</div>
              </section>

              <section className="thinkflow-output-context-group">
                <div className="thinkflow-output-context-group-title">产出指导</div>
                <div className="thinkflow-output-lock-list">{renderList(guidanceTitles, '未选择产出指导')}</div>
              </section>
            </>
          )}
        </div>

        <div className="thinkflow-output-context-modal-footer">
          <span className="thinkflow-output-context-hint">{hint}</span>
          <div className="thinkflow-output-context-actions">
            <button type="button" className="thinkflow-doc-action-btn" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="thinkflow-generate-btn"
              onClick={() => void onConfirm()}
              disabled={loading || Boolean(errorMessage)}
            >
              {loading ? '整理来源中...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
