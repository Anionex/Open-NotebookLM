import React, { useRef, useEffect, KeyboardEvent, useState } from 'react';
import { Block, BlockType } from './types';
import { Check, Square, GripVertical, ZoomIn, ZoomOut, Plus, Trash2 } from 'lucide-react';

interface BlockEditorProps {
  block: Block;
  onChange: (id: string, content: string, url?: string, scale?: number) => void;
  onTypeChange: (id: string, type: BlockType) => void;
  onDelete: (id: string) => void;
  onEnter: (id: string, remainingContent?: string) => void;
  onBackspace: (id: string) => void;
  onSlashCommand: (id: string) => void;
  showSlashMenu: boolean;
  onDragStart?: (id: string) => void;
  onDragOver?: (id: string) => void;
  onDrop?: (id: string) => void;
  onToggleTodo?: (id: string) => void;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  onChange,
  onTypeChange,
  onDelete,
  onEnter,
  onBackspace,
  onSlashCommand,
  showSlashMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onToggleTodo
}) => {
  const inputRef = useRef<HTMLDivElement | HTMLTextAreaElement | HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(block.scale || 100);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (inputRef.current && 'focus' in inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement | HTMLInputElement;
      const cursorPos = target.selectionStart || 0;
      const beforeCursor = block.content.substring(0, cursorPos);
      const afterCursor = block.content.substring(cursorPos);
      onChange(block.id, beforeCursor);
      onEnter(block.id, afterCursor);
    } else if (e.key === 'Backspace' && block.content === '') {
      onBackspace(block.id);
    }
  };

  const handleInput = (e: any) => {
    const content = e.target.value || e.target.textContent || '';
    onChange(block.id, content);
    if (content.endsWith('/')) {
      onSlashCommand(block.id);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => onChange(block.id, file.name, reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleScaleChange = (delta: number) => {
    const newScale = Math.max(20, Math.min(200, scale + delta));
    setScale(newScale);
    onChange(block.id, block.content, block.url, newScale);
  };

  const renderBlock = () => {
    const commonProps = {
      ref: inputRef as any,
      onKeyDown: handleKeyDown,
      className: 'w-full outline-none bg-transparent',
      placeholder: showSlashMenu ? '输入 / 查看命令' : '输入内容...'
    };

    switch (block.type) {
      case 'heading1':
        return (
          <input
            {...commonProps}
            value={block.content}
            onChange={handleInput}
            className={`${commonProps.className} text-3xl font-bold`}
          />
        );
      case 'heading2':
        return (
          <input
            {...commonProps}
            value={block.content}
            onChange={handleInput}
            className={`${commonProps.className} text-2xl font-bold`}
          />
        );
      case 'heading3':
        return (
          <input
            {...commonProps}
            value={block.content}
            onChange={handleInput}
            className={`${commonProps.className} text-xl font-semibold`}
          />
        );
      case 'code':
        return (
          <textarea
            {...commonProps}
            value={block.content}
            onChange={handleInput}
            className={`${commonProps.className} font-mono bg-gray-100 p-2 rounded`}
            rows={3}
          />
        );
      case 'quote':
        return (
          <div className="border-l-4 border-gray-300 pl-4">
            <input
              {...commonProps}
              value={block.content}
              onChange={handleInput}
              className={`${commonProps.className} italic text-gray-700`}
            />
          </div>
        );
      case 'todo':
        return (
          <div className="flex items-start gap-2">
            <button
              onClick={() => onToggleTodo?.(block.id)}
              className="mt-1"
            >
              {block.checked ? <Check size={18} className="text-blue-500" /> : <Square size={18} />}
            </button>
            <input
              {...commonProps}
              value={block.content}
              onChange={handleInput}
              className={`${commonProps.className} ${block.checked ? 'line-through text-gray-400' : ''}`}
            />
          </div>
        );
      case 'bulletList':
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <input {...commonProps} value={block.content} onChange={handleInput} />
          </div>
        );
      case 'numberedList':
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1">1.</span>
            <input {...commonProps} value={block.content} onChange={handleInput} />
          </div>
        );
      case 'divider':
        return <hr className="my-4 border-gray-300" />;
      case 'image':
        return (
          <div>
            {!block.url ? (
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-blue-500 text-white rounded">
                上传图片
              </button>
            ) : (
              <div className="relative inline-block">
                <img src={block.url} alt={block.content} style={{ width: `${scale}%` }} className="max-w-full" />
                <div className="absolute top-2 right-2 flex gap-1 bg-white rounded shadow">
                  <button onClick={() => handleScaleChange(-10)} className="p-1 hover:bg-gray-100"><ZoomOut size={16} /></button>
                  <button onClick={() => handleScaleChange(10)} className="p-1 hover:bg-gray-100"><ZoomIn size={16} /></button>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </div>
        );
      case 'excel':
        return (
          <div>
            {!block.url ? (
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-green-500 text-white rounded">
                上传Excel
              </button>
            ) : (
              <div className="p-4 bg-gray-100 rounded flex items-center gap-2">
                <span>📊 {block.content}</span>
                <a href={block.url} download className="text-blue-500 underline">下载</a>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
          </div>
        );
      case 'video':
        return (
          <div>
            {!block.url ? (
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-purple-500 text-white rounded">
                上传视频
              </button>
            ) : (
              <video src={block.url} controls style={{ width: `${scale}%` }} className="max-w-full" />
            )}
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
          </div>
        );
      default:
        return (
          <textarea
            {...commonProps}
            value={block.content}
            onChange={handleInput}
            className={`${commonProps.className} resize-none overflow-hidden break-words whitespace-pre-wrap`}
            rows={1}
            style={{ minHeight: '24px' }}
            onInput={(e) => {
              e.currentTarget.style.height = 'auto';
              e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
            }}
          />
        );
    }
  };

  return (
    <div
      className="py-1 px-2 hover:bg-gray-50 rounded group relative"
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(block.id); }}
      onDrop={() => onDrop?.(block.id)}
    >
      <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1">
        <button
          onClick={() => onEnter(block.id)}
          className="p-0.5 hover:bg-gray-200 rounded"
        >
          <Plus size={14} className="text-gray-400" />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            draggable
            onDragStart={() => onDragStart?.(block.id)}
            className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-200 rounded"
          >
            <GripVertical size={16} className="text-gray-400" />
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 z-50 whitespace-nowrap">
              <button
                onClick={() => { onDelete(block.id); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
              >
                <Trash2 size={14} /> 删除
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="pl-10">
        {renderBlock()}
      </div>
    </div>
  );
};
