import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { apiFetch } from '../../config/api';
import { getApiSettings } from '../../services/apiSettingsService';
import { Badge, BadgeGroup, Button } from '../ui';
import type { KnowledgeFile } from '../../types';

interface AIPanelProps {
  blockId: string;
  files: KnowledgeFile[];
  user: any;
  notebook?: any;
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
  notebook,
  noteContext,
  noteMemory,
  onInsertText,
  onClose,
  onUpdateMemory,
}) => {
  // 默认选中所有文件
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    new Set(files.map(f => f.id))
  );
  const [inputText, setInputText] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 当 files 变化时，更新选中状态（保持之前的选择，新增文件自动选中）
  useEffect(() => {
    setSelectedFileIds(prev => {
      const newIds = new Set(prev);
      files.forEach(f => {
        if (!prev.has(f.id)) {
          newIds.add(f.id);
        }
      });
      return newIds;
    });
  }, [files]);

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

      const requestBody = {
        files: selectedFilePaths,
        query: fullPrompt,
        history: [],
        email: user?.email || user?.id || undefined,
        notebook_id: notebook?.id || undefined,
        api_key: apiSettings?.apiKey?.trim() || undefined,
        api_url: apiSettings?.apiUrl?.trim() || undefined,
      };

      const res = await apiFetch('/api/v1/kb/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
    <div className="mt-1 border border-accent-200 bg-accent-50/40 rounded-xl p-3 shadow-sm">
      {/* 来源文件选择 - 使用 Badge 组件 */}
      {files.length > 0 && (
        <BadgeGroup className="mb-2.5 max-h-24 overflow-y-auto">
          <span className="text-xs text-neutral-500 shrink-0 font-medium">来源：</span>
          {files.map(f => (
            <button
              key={f.id}
              onClick={() => toggleFile(f.id)}
              className="focus:outline-none"
            >
              <Badge
                variant={selectedFileIds.has(f.id) ? 'accent' : 'default'}
                size="sm"
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                {f.name || f.id}
              </Badge>
            </button>
          ))}
        </BadgeGroup>
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
          className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 resize-none bg-white transition-all"
          rows={1}
          onInput={e => {
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
          }}
        />
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
            title="预设指令"
          >
            {showPresets ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={handleAsk}
            disabled={loading || !inputText.trim()}
            className="p-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-40 transition-colors shadow-sm"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 预设指令下拉 */}
      {showPresets && (
        <div className="mt-1.5 border border-neutral-200 bg-white rounded-lg shadow-sm overflow-hidden">
          {ORGANIZE_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => {
                setInputText(p.value);
                setShowPresets(false);
                textareaRef.current?.focus();
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent-50 text-neutral-700 border-b border-neutral-100 last:border-0 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* AI 回复 */}
      {aiResponse && !loading && (
        <div className="mt-2.5 p-3 bg-white rounded-lg border border-neutral-200 text-sm">
          <div className="flex items-center gap-1 text-xs text-accent-600 font-medium mb-1.5">
            <Bot size={12} /> AI 回复
          </div>
          <p className="text-neutral-700 whitespace-pre-wrap leading-relaxed">{aiResponse}</p>
          <button
            onClick={() => {
              onInsertText(aiResponse, blockId);
              onClose();
            }}
            className="mt-2 px-3 py-1.5 bg-success-500 text-white rounded-lg text-xs hover:bg-success-600 flex items-center gap-1 transition-colors shadow-sm"
          >
            <Copy size={12} /> 粘贴到笔记
          </button>
        </div>
      )}
    </div>
  );
};
