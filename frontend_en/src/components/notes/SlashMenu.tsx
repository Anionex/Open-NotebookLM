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
  { type: 'text' as BlockType, label: 'Text', icon: Type, desc: 'Plain text' },
  { type: 'heading1' as BlockType, label: 'Heading 1', icon: Heading1, desc: 'Big section heading' },
  { type: 'heading2' as BlockType, label: 'Heading 2', icon: Heading2, desc: 'Medium section heading' },
  { type: 'heading3' as BlockType, label: 'Heading 3', icon: Heading3, desc: 'Small section heading' },
  { type: 'bulletList' as BlockType, label: 'Bullet List', icon: List, desc: 'Create a simple list' },
  { type: 'numberedList' as BlockType, label: 'Numbered List', icon: ListOrdered, desc: 'Create a numbered list' },
  { type: 'todo' as BlockType, label: 'To-do', icon: CheckSquare, desc: 'Track tasks with a checkbox' },
  { type: 'quote' as BlockType, label: 'Quote', icon: Quote, desc: 'Capture a quote' },
  { type: 'code' as BlockType, label: 'Code', icon: Code, desc: 'Capture a code snippet' },
  { type: 'divider' as BlockType, label: 'Divider', icon: Minus, desc: 'Visually divide blocks' },
  { type: 'image' as BlockType, label: 'Image', icon: Image, desc: 'Embed an image' },
  { type: 'excel' as BlockType, label: 'Excel', icon: FileSpreadsheet, desc: 'Embed an Excel file' },
  { type: 'video' as BlockType, label: 'Video', icon: Video, desc: 'Embed a video' },
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
      const prompt = `Context: ${noteContext || 'User is taking notes.'}\n\nQuestion: ${aiQuestion}\n\nProvide a helpful, concise answer.`;
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
      setAiResponse(data.answer || data.response || 'No response');
    } catch (err) {
      setAiResponse('Failed to get AI response');
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
            placeholder="Ask AI..."
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
              <Copy size={12} /> Paste to note
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
