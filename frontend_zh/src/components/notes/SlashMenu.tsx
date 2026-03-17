import React, { useState, useEffect } from 'react';
import { BlockType } from './types';
import { Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Code, Minus, Image, FileSpreadsheet, Video, Send, Copy, Type } from 'lucide-react';
import { apiFetch } from '../../config/api';
import { getApiSettings } from '../../services/apiSettingsService';

interface SlashMenuProps {
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  onInsertText?: (text: string) => void;
  noteContext?: string;
  user?: any;
}

const commands = [
  { type: 'text' as BlockType, label: '文本', icon: Type, desc: '普通文本' },
  { type: 'heading1' as BlockType, label: '标题 1', icon: Heading1, desc: '大标题' },
  { type: 'heading2' as BlockType, label: '标题 2', icon: Heading2, desc: '中标题' },
  { type: 'heading3' as BlockType, label: '标题 3', icon: Heading3, desc: '小标题' },
  { type: 'bulletList' as BlockType, label: '项目符号列表', icon: List, desc: '创建简单列表' },
  { type: 'numberedList' as BlockType, label: '编号列表', icon: ListOrdered, desc: '创建编号列表' },
  { type: 'todo' as BlockType, label: '待办事项', icon: CheckSquare, desc: '用复选框跟踪任务' },
  { type: 'quote' as BlockType, label: '引用', icon: Quote, desc: '捕获引用' },
  { type: 'code' as BlockType, label: '代码', icon: Code, desc: '捕获代码片段' },
  { type: 'divider' as BlockType, label: '分隔线', icon: Minus, desc: '视觉分隔块' },
  { type: 'image' as BlockType, label: '图片', icon: Image, desc: '嵌入图片' },
  { type: 'excel' as BlockType, label: 'Excel', icon: FileSpreadsheet, desc: '嵌入Excel文件' },
  { type: 'video' as BlockType, label: '视频', icon: Video, desc: '嵌入视频' },
];

export const SlashMenu: React.FC<SlashMenuProps> = ({ onSelect, onClose, onInsertText, noteContext, user }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % commands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + commands.length) % commands.length);
      } else if (e.key === 'Enter' && !aiQuestion) {
        e.preventDefault();
        onSelect(commands[selectedIndex].type);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, onSelect, onClose, aiQuestion]);

  const handleAskAI = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    try {
      const apiSettings = getApiSettings(user?.id || null);
      const prompt = `上下文：${noteContext || '用户正在做笔记。'}\n\n问题：${aiQuestion}\n\n请提供有帮助的、简洁的回答。`;
      const res = await apiFetch('/api/v1/kb/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [],
          query: prompt,
          history: [],
          api_key: apiSettings?.apiKey?.trim() || undefined,
          api_url: apiSettings?.apiUrl?.trim() || undefined
        })
      });
      const data = await res.json();
      setAiResponse(data.answer || data.response || '无响应');
    } catch (err) {
      setAiResponse('获取AI响应失败');
    } finally {
      setAiLoading(false);
    }
  };
  return (
    <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg w-80 max-h-96 overflow-y-auto">
      <div className="p-3 border-b border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
            placeholder="问AI..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAskAI}
            disabled={aiLoading || !aiQuestion.trim()}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
        {aiResponse && (
          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
            <p className="text-gray-700">{aiResponse}</p>
            <button
              onClick={() => { onInsertText?.(aiResponse); onClose(); }}
              className="mt-2 px-2 py-1 bg-green-500 text-white rounded text-xs flex items-center gap-1 hover:bg-green-600"
            >
              <Copy size={12} /> 粘贴到笔记
            </button>
          </div>
        )}
      </div>
      {commands.map((cmd, idx) => (
        <button
          key={cmd.type}
          onClick={() => onSelect(cmd.type)}
          className={`w-full px-3 py-2 text-left flex items-start gap-3 ${idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
        >
          <cmd.icon size={18} className="mt-0.5 text-gray-600" />
          <div>
            <div className="font-medium text-sm">{cmd.label}</div>
            <div className="text-xs text-gray-500">{cmd.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
};
