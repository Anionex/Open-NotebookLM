import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, BookOpen, AlignLeft, Send, Copy, X } from 'lucide-react';
import { apiFetch } from '../../config/api';
import { getApiSettings } from '../../services/apiSettingsService';
import type { KnowledgeFile } from '../../types';

interface TextSelectionToolbarProps {
  selectedText: string;
  position: { x: number; y: number };
  files: KnowledgeFile[];
  user: any;
  noteMemory: string;
  noteContext: string;
  onDiffResult: (originalText: string, revisedText: string) => void;
  onInsertBelow: (text: string) => void;
  onUpdateMemory: (memory: string) => void;
  onClose: () => void;
}

const POLISH_STYLES = [
  { label: '正式风格', prompt: '将以下文字改写为正式、专业的风格。只返回改写后的内容：' },
  { label: '轻松风格', prompt: '将以下文字改写为轻松、友好的口语化风格。只返回改写后的内容：' },
  { label: '精简版', prompt: '将以下文字精简改写，保留关键信息。只返回改写后的内容：' },
  { label: '学术风格', prompt: '将以下文字改写为学术、严谨的写作风格。只返回改写后的内容：' },
  { label: '生动风格', prompt: '将以下文字改写得更生动有趣、富有感染力。只返回改写后的内容：' },
];

const ORGANIZE_PRESETS = [
  { label: '提炼要点', prompt: '将以下内容的关键要点整理为结构化列表：' },
  { label: '按主题整理', prompt: '将以下内容按主要主题分类，生成清晰的章节结构：' },
  { label: '转为要点列表', prompt: '将以下文字转化为清晰的要点列表：' },
  { label: '生成提纲', prompt: '根据以下内容生成层级分明的提纲：' },
  { label: '展开详述', prompt: '对以下内容进行展开，增加更多细节、案例和深度：' },
];

type ToolbarMode = 'toolbar' | 'polish' | 'understand' | 'organize' | 'result-understand' | 'result-organize';

export const TextSelectionToolbar: React.FC<TextSelectionToolbarProps> = ({
  selectedText,
  position,
  files,
  user,
  noteMemory,
  noteContext,
  onDiffResult,
  onInsertBelow,
  onUpdateMemory,
  onClose,
}) => {
  const [mode, setMode] = useState<ToolbarMode>('toolbar');
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultText, setResultText] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleMouseDown), 100);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const callAI = async (instruction: string): Promise<string> => {
    const apiSettings = getApiSettings(user?.id || null);
    const selectedFilePaths = files
      .filter(f => selectedFileIds.has(f.id))
      .map(f => f.url)
      .filter((url): url is string => Boolean(url));

    const systemContext = noteMemory
      ? `你是一个智能写作助手。\n\n上下文：\n${noteMemory}`
      : `你是一个智能写作助手。`;

    const prompt = `${systemContext}\n\n${instruction}\n\n"${selectedText}"\n\n只返回处理结果，不要添加任何解释或前言。`;

    const res = await apiFetch('/api/v1/kb/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: selectedFilePaths,
        query: prompt,
        history: [],
        api_key: apiSettings?.apiKey?.trim() || undefined,
        api_url: apiSettings?.apiUrl?.trim() || undefined,
      }),
    });
    const data = await res.json();
    return data.answer || data.response || '无回复';
  };

  const handlePolish = async (stylePrompt: string, styleName: string) => {
    setLoading(true);
    try {
      const result = await callAI(stylePrompt);
      onDiffResult(selectedText, result);
      const entry = `- 润色（${styleName}）："${selectedText.slice(0, 60)}..." → "${result.slice(0, 60)}..."`;
      onUpdateMemory(noteMemory ? `${noteMemory}\n${entry}`.slice(-2000) : `## 操作历史\n${entry}`);
      onClose();
    } catch {
      setLoading(false);
    }
  };

  const handleUnderstand = async () => {
    setMode('understand');
    setLoading(true);
    try {
      const result = await callAI(
        '请对以下文字进行清晰、深入的解析。它的含义是什么？关键观点和内涵是什么？'
      );
      setResultText(result);
      setMode('result-understand');
      const entry = `- 理解："${selectedText.slice(0, 60)}..."`;
      onUpdateMemory(noteMemory ? `${noteMemory}\n${entry}`.slice(-2000) : `## 操作历史\n${entry}`);
    } catch {
      setResultText('获取AI回复失败。');
      setMode('result-understand');
    } finally {
      setLoading(false);
    }
  };

  const handleOrganize = async (prompt: string) => {
    setLoading(true);
    try {
      const result = await callAI(prompt);
      setResultText(result);
      setMode('result-organize');
      const entry = `- 整理："${selectedText.slice(0, 60)}..."`;
      onUpdateMemory(noteMemory ? `${noteMemory}\n${entry}`.slice(-2000) : `## 操作历史\n${entry}`);
    } catch {
      setResultText('获取AI回复失败。');
      setMode('result-organize');
    } finally {
      setLoading(false);
    }
  };

  const toggleFile = (fileId: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const left = Math.min(Math.max(position.x, 8), window.innerWidth - 320);
  const top = Math.max(position.y - 48, 8);

  const SourceSelector = () =>
    files.length > 0 ? (
      <div className="px-3 py-2 border-b border-gray-100 max-h-32 overflow-y-auto">
        <span className="text-xs text-gray-400 block mb-1">参考来源（可选）：</span>
        <div className="flex flex-wrap gap-1">
          {files.map(f => (
            <button
              key={f.id}
              onClick={() => toggleFile(f.id)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-all ${
                selectedFileIds.has(f.id)
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
              }`}
            >
              {f.name || f.id}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div
      ref={toolbarRef}
      style={{ position: 'fixed', left, top, zIndex: 1000 }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[280px] max-w-[360px]"
    >
      {mode !== 'toolbar' && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
          <button
            onClick={() => setMode('toolbar')}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            ← 返回
          </button>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X size={14} />
          </button>
        </div>
      )}

      {mode === 'toolbar' && (
        <div className="flex items-center gap-0.5 p-1">
          <button
            onClick={() => setMode('polish')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm hover:bg-purple-50 text-purple-600 rounded-lg font-medium transition-colors"
          >
            <Sparkles size={14} /> 润色
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={handleUnderstand}
            className="flex items-center gap-1.5 px-3 py-2 text-sm hover:bg-blue-50 text-blue-600 rounded-lg font-medium transition-colors"
          >
            <BookOpen size={14} /> 理解
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={() => setMode('organize')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm hover:bg-green-50 text-green-600 rounded-lg font-medium transition-colors"
          >
            <AlignLeft size={14} /> 整理
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={14} />
          </button>
        </div>
      )}

      {mode === 'polish' && (
        <div>
          <SourceSelector />
          <div className="p-1">
            <div className="px-3 py-1.5 text-xs text-gray-400 font-medium uppercase tracking-wider">
              选择润色风格
            </div>
            {POLISH_STYLES.map(s => (
              <button
                key={s.label}
                onClick={() => handlePolish(s.prompt, s.label)}
                disabled={loading}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-purple-50 text-purple-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles size={13} className="opacity-60" />
                )}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'organize' && (
        <div>
          <SourceSelector />
          <div className="p-1">
            <div className="px-3 py-1.5 text-xs text-gray-400 font-medium uppercase tracking-wider">
              笔记整理方式
            </div>
            {ORGANIZE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => handleOrganize(p.prompt)}
                disabled={loading}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-green-50 text-green-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <AlignLeft size={13} className="opacity-60" />
                )}
                {p.label}
              </button>
            ))}
            <div className="flex gap-1.5 mx-1 mt-1.5">
              <input
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && customPrompt.trim() && handleOrganize(customPrompt)}
                placeholder="自定义整理要求..."
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-green-400"
              />
              <button
                onClick={() => customPrompt.trim() && handleOrganize(customPrompt)}
                disabled={loading || !customPrompt.trim()}
                className="px-2.5 py-1.5 bg-green-500 text-white rounded-lg text-xs disabled:opacity-40 hover:bg-green-600 transition-colors"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'understand' && loading && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          分析中...
        </div>
      )}

      {mode === 'result-understand' && (
        <div className="p-3 max-w-sm">
          <div className="text-xs font-medium text-blue-500 mb-2 flex items-center gap-1">
            <BookOpen size={12} /> AI 理解
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
            {resultText}
          </div>
          <button
            onClick={() => {
              onInsertBelow(resultText);
              onClose();
            }}
            className="mt-2.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600 flex items-center gap-1 transition-colors"
          >
            <Copy size={12} /> 粘贴到笔记
          </button>
        </div>
      )}

      {mode === 'result-organize' && (
        <div className="p-3 max-w-sm">
          <div className="text-xs font-medium text-green-500 mb-2 flex items-center gap-1">
            <AlignLeft size={12} /> AI 整理
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
            {resultText}
          </div>
          <button
            onClick={() => {
              onInsertBelow(resultText);
              onClose();
            }}
            className="mt-2.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600 flex items-center gap-1 transition-colors"
          >
            <Copy size={12} /> 粘贴到笔记
          </button>
        </div>
      )}
    </div>
  );
};
