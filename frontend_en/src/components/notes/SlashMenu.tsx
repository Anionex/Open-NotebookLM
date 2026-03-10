import React, { useState, useEffect } from 'react';
import { BlockType } from './types';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code, Minus, Image, FileSpreadsheet, Video, Type
} from 'lucide-react';

interface SlashMenuProps {
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  // kept for API compatibility but unused here
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
        <span className="text-xs text-gray-400 font-medium">Block types</span>
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
