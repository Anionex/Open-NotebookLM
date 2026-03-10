import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

interface DiffPreviewPanelProps {
  originalText: string;
  revisedText: string;
  blockId: string;
  onAccept: (blockId: string, text: string) => void;
  onReject: () => void;
}

export const DiffPreviewPanel: React.FC<DiffPreviewPanelProps> = ({
  originalText,
  revisedText,
  blockId,
  onAccept,
  onReject,
}) => {
  const [editedText, setEditedText] = useState(revisedText);

  return (
    <div className="flex flex-col bg-white border-l border-gray-200 h-full overflow-hidden" style={{ minWidth: 320, maxWidth: 420 }}>
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">AI 润色预览</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">查看改动</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onAccept(blockId, editedText)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium shadow-sm"
          >
            <Check size={14} /> 接受
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            <X size={14} /> 拒绝
          </button>
        </div>
      </div>

      {/* 差异对比内容 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 改前 */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">改前</span>
          </div>
          <div className="relative p-3.5 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed line-through opacity-75">
              {originalText}
            </p>
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-300 rounded-l-xl" />
          </div>
        </div>

        {/* 分隔箭头 */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="h-px w-8 bg-gray-200" />
            AI 改写
            <div className="h-px w-8 bg-gray-200" />
          </div>
        </div>

        {/* 改后（可编辑） */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs font-semibold text-green-500 uppercase tracking-wider">改后</span>
            <span className="text-xs text-gray-400 ml-auto">（可编辑）</span>
          </div>
          <div className="relative">
            <textarea
              value={editedText}
              onChange={e => setEditedText(e.target.value)}
              className="w-full p-3.5 pl-5 bg-green-50 border border-green-200 rounded-xl text-sm text-gray-700 leading-relaxed resize-none outline-none focus:ring-2 focus:ring-green-300 transition-shadow"
              rows={Math.max(4, editedText.split('\n').length + 2)}
              style={{ minHeight: 120 }}
            />
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-300 rounded-l-xl pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 底部提示 */}
      <div className="px-4 py-2 border-t border-gray-100 shrink-0">
        <p className="text-xs text-gray-400">
          您可以在接受前直接编辑上方的改写内容。
        </p>
      </div>
    </div>
  );
};
