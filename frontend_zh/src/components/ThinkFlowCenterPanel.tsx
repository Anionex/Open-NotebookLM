import type { MutableRefObject, ReactNode, RefObject } from 'react';
import { History, MessageSquarePlus } from 'lucide-react';

import type {
  SelectionToolbarState,
  ThinkFlowDocument,
  ThinkFlowMessage,
  ThinkFlowOutput,
  WorkspaceMode,
} from './thinkflow-types';

type ThinkFlowCenterPanelProps = {
  workspaceMode: WorkspaceMode;
  rightPanelOpen: boolean;
  activeOutput: ThinkFlowOutput | null;
  chatMessages: ThinkFlowMessage[];
  chatScrollRef: RefObject<HTMLDivElement | null>;
  handleChatSelectionMouseUp: () => void;
  messageRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  focusedMessageId: string;
  selectedMessageIds: string[];
  renderMessageMarkdown: (message: ThinkFlowMessage) => ReactNode;
  openPushPopover: (message: ThinkFlowMessage, event: React.MouseEvent<HTMLButtonElement>) => void;
  openQAPushPopover: (message: ThinkFlowMessage, event: React.MouseEvent<HTMLButtonElement>) => void;
  toggleMessageSelection: (messageId: string) => void;
  selectionToolbar: SelectionToolbarState;
  handleSelectionCopy: () => Promise<void>;
  handleSelectionPush: () => void;
  multiSelectPrompt: string;
  setMultiSelectPrompt: (value: string) => void;
  clearSelectedMessages: () => void;
  openMultiMessagePush: (anchor: HTMLElement) => void;
  chatInput: string;
  setChatInput: (value: string) => void;
  handleSendMessage: () => Promise<void>;
  chatLoading: boolean;
  documents: ThinkFlowDocument[];
  boundDocIds: string[];
  toggleBoundDoc: (docId: string) => void;
  openRightPanelForDocument: () => void;
  openRightPanelForActiveOutput: () => void;
  onOpenHistory: () => void;
  onNewConversation: () => void;
};

export function ThinkFlowCenterPanel({
  workspaceMode,
  rightPanelOpen,
  activeOutput,
  chatMessages,
  chatScrollRef,
  handleChatSelectionMouseUp,
  messageRefs,
  focusedMessageId,
  selectedMessageIds,
  renderMessageMarkdown,
  openPushPopover,
  openQAPushPopover,
  toggleMessageSelection,
  selectionToolbar,
  handleSelectionCopy,
  handleSelectionPush,
  multiSelectPrompt,
  setMultiSelectPrompt,
  clearSelectedMessages,
  openMultiMessagePush,
  chatInput,
  setChatInput,
  handleSendMessage,
  chatLoading,
  documents,
  boundDocIds,
  toggleBoundDoc,
  openRightPanelForDocument,
  openRightPanelForActiveOutput,
  onOpenHistory,
  onNewConversation,
}: ThinkFlowCenterPanelProps) {
  return (
    <main className={`thinkflow-center-panel ${workspaceMode === 'output_immersive' ? 'is-output-immersive' : ''} ${workspaceMode === 'output_focus' ? 'is-output-focus' : ''}`}>
      <div className="thinkflow-chat-header-bar">
        <div className="thinkflow-chat-header-left">
          💬 对话
        </div>
        <div className="thinkflow-chat-header-actions">
          <button
            type="button"
            className="thinkflow-chat-header-btn"
            onClick={onNewConversation}
            title="开始新对话"
          >
            <MessageSquarePlus size={14} />
            新对话
          </button>
          <button
            type="button"
            className="thinkflow-chat-header-btn"
            onClick={onOpenHistory}
            title="查看历史对话"
          >
            <History size={14} />
            历史
          </button>
        </div>
      </div>
      <div className="thinkflow-chat-scroll" ref={chatScrollRef} onMouseUp={handleChatSelectionMouseUp}>
        {chatMessages.map((message) => (
          <div
            key={message.id}
            ref={(node) => {
              messageRefs.current[message.id] = node;
            }}
            data-message-id={message.id}
            className={`thinkflow-message-row ${message.role} ${focusedMessageId === message.id ? 'is-focused' : ''} ${selectedMessageIds.includes(message.id) ? 'is-selected' : ''}`}
          >
            <div className={`thinkflow-message-shell ${message.role}`}>
              <div className={`thinkflow-bubble ${message.role}`}>
                <div className="thinkflow-bubble-meta">
                  <span>{message.role === 'assistant' ? 'AI' : '你'}</span>
                  <span>{message.time}</span>
                </div>
                {renderMessageMarkdown(message)}
              </div>
              {message.role === 'assistant' ? (
                <div className="thinkflow-message-actions">
                  <button
                    type="button"
                    className={`thinkflow-push-trigger ${message.pushed ? 'is-done' : ''}`}
                    onClick={(event) => openPushPopover(message, event)}
                    disabled={!message.content}
                    title="沉淀当前消息"
                  >
                    {message.pushed ? '✓' : '⟩'}
                  </button>
                  <button
                    type="button"
                    className="thinkflow-message-more"
                    onClick={(event) => openQAPushPopover(message, event)}
                    disabled={!message.content}
                    title="沉淀这一轮问答"
                  >
                    本轮
                  </button>
                  <button
                    type="button"
                    className={`thinkflow-message-select ${selectedMessageIds.includes(message.id) ? 'is-active' : ''}`}
                    onClick={() => toggleMessageSelection(message.id)}
                    title="加入多条沉淀"
                  >
                    {selectedMessageIds.includes(message.id) ? '✓' : '+'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {selectionToolbar.show ? (
        <div
          className="thinkflow-selection-toolbar"
          style={{
            left: selectionToolbar.x,
            top: selectionToolbar.y,
          }}
        >
          <button type="button" className="thinkflow-selection-btn" onClick={() => void handleSelectionCopy()}>
            📋 复制
          </button>
          <button type="button" className="thinkflow-selection-btn is-primary" onClick={handleSelectionPush}>
            ⟩ 沉淀
          </button>
        </div>
      ) : null}

      {selectedMessageIds.length > 0 ? (
        <div className="thinkflow-multi-select-bar">
          <div className="thinkflow-multi-select-meta">已选 {selectedMessageIds.length} 条消息，你可以把这组内容作为一次明确沉淀。</div>
          <textarea
            className="thinkflow-multi-select-input"
            value={multiSelectPrompt}
            onChange={(event) => setMultiSelectPrompt(event.target.value)}
            placeholder="可选：补充你希望这组内容如何被整理，例如‘沉淀成产出指导，强调结论和边界条件’"
            rows={2}
          />
          <div className="thinkflow-multi-select-actions">
            <button type="button" className="thinkflow-doc-action-btn" onClick={clearSelectedMessages}>
              取消选择
            </button>
            <button
              type="button"
              className="thinkflow-generate-btn"
              onClick={(event) => openMultiMessagePush(event.currentTarget)}
            >
              ⟩ 沉淀所选内容
            </button>
          </div>
        </div>
      ) : null}

      <div className="thinkflow-chat-input-area">
        <div className="thinkflow-chat-input-box">
          <textarea
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSendMessage();
              }
            }}
            placeholder="输入消息，围绕当前素材梳理你真正想要的结论..."
            className="thinkflow-chat-input"
            rows={2}
          />
          <div className="thinkflow-chat-toolbar">
            <button type="button" className="thinkflow-toolbar-btn">
              🔍 搜索
            </button>
            <div className="thinkflow-toolbar-divider" />
            {documents.map((doc) => (
              <label
                key={doc.id}
                className={`thinkflow-doc-check ${boundDocIds.includes(doc.id) ? 'is-checked' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={boundDocIds.includes(doc.id)}
                  onChange={() => toggleBoundDoc(doc.id)}
                />
                📄 {doc.title}
              </label>
            ))}
            {boundDocIds.length > 0 ? <span className="thinkflow-doc-check-tip">对话将参考此文档</span> : null}
            {!rightPanelOpen && workspaceMode === 'normal' ? (
              <button
                type="button"
                className="thinkflow-toolbar-btn"
                onClick={openRightPanelForDocument}
              >
                + 新建梳理
              </button>
            ) : null}
            <div className="thinkflow-toolbar-spacer" />
            <button type="button" className="thinkflow-send-btn" onClick={() => void handleSendMessage()} disabled={!chatInput.trim() || chatLoading}>
              {chatLoading ? '...' : '↑'}
            </button>
          </div>
        </div>
      </div>

      {!rightPanelOpen && workspaceMode === 'normal' ? (
        <button
          type="button"
          className="thinkflow-open-right-btn"
          onClick={openRightPanelForActiveOutput}
        >
          {activeOutput ? '🧩' : '📄'}
        </button>
      ) : null}
    </main>
  );
}
