import React, { useState, useEffect } from 'react';
import { BlockType } from './types';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code, Minus, Image, FileSpreadsheet, Video, Type
} from 'lucide-react';

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
  { type: 'quote' as BlockType, label: '引用', icon: Quote, desc: '捕获引用内容' },
  { type: 'code' as BlockType, label: '代码', icon: Code, desc: '捕获代码片段' },
  { type: 'divider' as BlockType, label: '分隔线', icon: Minus, desc: '视觉分隔块' },
  { type: 'image' as BlockType, label: '图片', icon: Image, desc: '嵌入图片' },
  { type: 'excel' as BlockType, label: 'Excel', icon: FileSpreadsheet, desc: '嵌入Excel文件' },
  { type: 'video' as BlockType, label: '视频', icon: Video, desc: '嵌入视频' },
];

export const SlashMenu: React.FC<SlashMenuProps> = ({ onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % commands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + commands.length) % commands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelect(commands[selectedIndex].type);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, onSelect, onClose]);

  return (
    <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg w-72 max-h-80 overflow-y-auto">
      <div className="px-3 py-2 border-b border-gray-100">
        <span className="text-xs text-gray-400 font-medium">块类型</span>
      </div>
      {commands.map((cmd, idx) => (
        <button
          key={cmd.type}
          onClick={() => onSelect(cmd.type)}
          className={`w-full px-3 py-2 text-left flex items-start gap-3 transition-colors ${
            idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
          }`}
        >
          <cmd.icon size={18} className="mt-0.5 text-gray-500 shrink-0" />
          <div>
            <div className="font-medium text-sm text-gray-800">{cmd.label}</div>
            <div className="text-xs text-gray-400">{cmd.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
};
