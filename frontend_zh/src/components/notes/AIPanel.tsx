import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { apiFetch } from '../../config/api';
import { getApiSettings } from '../../services/apiSettingsService';
import type { KnowledgeFile } from '../../types';

interface AIPanelProps {
  blockId: string;
  files: KnowledgeFile[];
  user: any;
  noteContext: string;
  noteMemory: string;
  onInsertText: (text: string, blockId: string) => void;
  onClose: () => void;
  onUpdateMemory: (memory: string) => void;
}

const ORGANIZE_PRESETS = [
  { label: '提炼要点', value: '将以下内容的关键要点提炼成简洁清晰的结构化列表。' },
  { label: '按主题整理', value: '将以下内容按主要主题进行分类整理，形成结构清晰的章节。' },
  { label: '生成提纲', value: '根据以下内容生成层级清晰的提纲。' },
  { label: '提取行动项', value: '从以下内容中提取所有行动项、任务和后续步骤。' },
  { label: '生成FAQ', value: '基于以下内容生成常见问题解答列表，问题和答案清晰明了。' },
  { label: '展开详述', value: '对以下内容进行展开和深化，增加更多细节和深度。' },
];

export const AIPanel: React.FC<AIPanelProps> = ({
  blockId,
  files,
  user,
  noteContext,
  noteMemory,
  onInsertText,
  onClose,
  onUpdateMemory,
}) => {
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [inputText, setInputText] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const toggleFile = (fileId: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const handleAsk = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setAiResponse('');
    try {
      const apiSettings = getApiSettings(user?.id || null);
      const selectedFilePaths = files
        .filter(f => selectedFileIds.has(f.id))
        .map(f => f.url)
        .filter((url): url is string => Boolean(url));

      const systemContext = noteMemory
        ? `你是一个智能笔记助手。\n\n笔记上下文与历史记录：\n${noteMemory}`
        : `你是一个智能笔记助手，帮助用户撰写和整理笔记。`;

      const noteContextPart = noteContext
        ? `\n\n当前笔记内容：\n${noteContext.slice(0, 800)}`
        : '';

      const fullPrompt = `${systemContext}${noteContextPart}\n\n用户需求：${inputText}\n\n请提供结构清晰、可以直接插入笔记的回复。`;

      const res = await apiFetch('/api/v1/kb/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: selectedFilePaths,
          query: fullPrompt,
          history: [],
          api_key: apiSettings?.apiKey?.trim() || undefined,
          api_url: apiSettings?.apiUrl?.trim() || undefined,
        }),
      });
      const data = await res.json();
      const response = data.answer || data.response || '无回复';
      setAiResponse(response);

      const memoryEntry = `- AI请求："${inputText.slice(0, 80)}"\n  回复摘要："${response.slice(0, 150)}..."`;
      if (!noteMemory) {
        const baseMemory = `## 笔记上下文\n${noteContext.slice(0, 500)}\n\n## 操作历史\n${memoryEntry}`;
        onUpdateMemory(baseMemory);
      } else {
        onUpdateMemory(`${noteMemory}\n${memoryEntry}`.slice(-2000));
      }
    } catch {
      setAiResponse('获取AI回复失败，请检查API设置。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-1 border border-blue-200 bg-blue-50/60 rounded-xl p-3 shadow-sm">
      {/* 来源文件选择 - 横排，小字 */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          <span className="text-xs text-gray-400 shrink-0 font-medium">来源：</span>
          {files.map(f => (
            <button
              key={f.id}
              onClick={() => toggleFile(f.id)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-all ${
                selectedFileIds.has(f.id)
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
              }`}
            >
              {f.name || f.id}
            </button>
          ))}
        </div>
      )}

      {/* 输入区域 */}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="让AI帮你撰写、整理或扩展笔记内容..."
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 resize-none bg-white"
          rows={1}
          onInput={e => {
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
          }}
        />
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
            title="预设指令"
          >
            {showPresets ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={handleAsk}
            disabled={loading || !inputText.trim()}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 预设指令下拉 */}
      {showPresets && (
        <div className="mt-1.5 border border-gray-200 bg-white rounded-lg shadow-sm overflow-hidden">
          {ORGANIZE_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => {
                setInputText(p.value);
                setShowPresets(false);
                textareaRef.current?.focus();
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-blue-50 text-gray-700 border-b border-gray-100 last:border-0 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* AI 回复 */}
      {aiResponse && !loading && (
        <div className="mt-2.5 p-3 bg-white rounded-lg border border-gray-200 text-sm">
          <div className="flex items-center gap-1 text-xs text-blue-500 font-medium mb-1.5">
            <Bot size={12} /> AI 回复
          </div>
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{aiResponse}</p>
          <button
            onClick={() => {
              onInsertText(aiResponse, blockId);
              onClose();
            }}
            className="mt-2 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600 flex items-center gap-1 transition-colors"
          >
            <Copy size={12} /> 粘贴到笔记
          </button>
        </div>
      )}
    </div>
  );
};
