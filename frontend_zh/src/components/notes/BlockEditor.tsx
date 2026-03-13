import React, { useRef, useEffect, KeyboardEvent, useState } from 'react';
import { Block, BlockType } from './types';
import { Check, Square, GripVertical, ZoomIn, ZoomOut, Plus, Trash2 } from 'lucide-react';

interface BlockEditorProps {
  block: Block;
  onChange: (id: string, content: string, url?: string, scale?: number) => void;
  onTypeChange: (id: string, type: BlockType, newContent?: string) => void;
  onDelete: (id: string) => void;
  onEnter: (id: string, remainingContent?: string) => void;
  onBackspace: (id: string) => void;
  onSlashCommand: (id: string) => void;
  onSpaceKeyEmpty?: (id: string) => void;
  onTextSelection?: (id: string, text: string, rect: DOMRect) => void;
  showSlashMenu: boolean;
  onDragStart?: (id: string) => void;
  onDragOver?: (id: string) => void;
  onDrop?: (id: string) => void;
  onToggleTodo?: (id: string) => void;
  numberedIndex?: number;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  onChange,
  onTypeChange,
  onDelete,
  onEnter,
  onBackspace,
  onSlashCommand,
  onSpaceKeyEmpty,
  onTextSelection: _onTextSelection,
  showSlashMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onToggleTodo,
  numberedIndex,
}) => {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(block.scale || 100);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (inputRef.current && 'focus' in inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' && block.content === '' && onSpaceKeyEmpty) {
      e.preventDefault();
      onSpaceKeyEmpty(block.id);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement | HTMLInputElement;
      const cursorPos = target.selectionStart || 0;
      const beforeCursor = block.content.substring(0, cursorPos);
      const afterCursor = block.content.substring(cursorPos);
      onChange(block.id, beforeCursor);
      onEnter(block.id, afterCursor);
    } else if (e.key === 'Backspace') {
      const target = e.target as HTMLTextAreaElement | HTMLInputElement;
      const cursorPos = target.selectionStart || 0;

      if (cursorPos === 0) {
        const actualContent = target.value || '';
        if (actualContent === '') {
          e.preventDefault();
          onBackspace(block.id);
        } else if (['bulletList', 'numberedList', 'todo', 'quote'].includes(block.type)) {
          e.preventDefault();
          onTypeChange(block.id, 'text');
        }
      }
    }
  };

  const handleInput = (e: any) => {
    const target = e.target as HTMLTextAreaElement | HTMLInputElement;
    const content = target.value;

    // Auto resize textarea
    if (target instanceof HTMLTextAreaElement) {
      autoResize(target);
    }

    // Live markdown shortcuts (only convert from text blocks)
    if (block.type === 'text') {
      if (content === '- ' || content === '* ' || content === '+ ') {
        onTypeChange(block.id, 'bulletList', '');
        return;
      }
      if (/^\d+\. $/.test(content)) {
        onTypeChange(block.id, 'numberedList', '');
        return;
      }
      if (content === '> ') {
        onTypeChange(block.id, 'quote', '');
        return;
      }
      if (content === '[ ] ' || content === '[] ') {
        onTypeChange(block.id, 'todo', '');
        return;
      }
      if (content.startsWith('###### ')) {
        onTypeChange(block.id, 'heading6', content.slice(7));
        return;
      }
      if (content.startsWith('##### ')) {
        onTypeChange(block.id, 'heading5', content.slice(6));
        return;
      }
      if (content.startsWith('#### ')) {
        onTypeChange(block.id, 'heading4', content.slice(5));
        return;
      }
      if (content.startsWith('### ')) {
        onTypeChange(block.id, 'heading3', content.slice(4));
        return;
      }
      if (content.startsWith('## ')) {
        onTypeChange(block.id, 'heading2', content.slice(3));
        return;
      }
      if (content.startsWith('# ')) {
        onTypeChange(block.id, 'heading1', content.slice(2));
        return;
      }
    }

    onChange(block.id, content);
    if (content === '/' || content === '／') {
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

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const placeholder = showSlashMenu
    ? '输入 / 查看命令'
    : '按空格启用AI，或输入"/"启用命令';

  const renderBlock = () => {
    const baseTextareaProps = {
      ref: inputRef as React.Ref<HTMLTextAreaElement>,
      value: block.content,
      onChange: handleInput,
      onKeyDown: handleKeyDown,
      className: 'w-full outline-none bg-transparent resize-none overflow-hidden',
      rows: 1,
    };

    switch (block.type) {
      case 'heading1':
        return (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            value={block.content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full outline-none bg-transparent text-3xl font-bold"
          />
        );
      case 'heading2':
        return (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            value={block.content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full outline-none bg-transparent text-2xl font-bold"
          />
        );
      case 'heading3':
        return (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            value={block.content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full outline-none bg-transparent text-xl font-semibold"
          />
        );
      case 'heading4':
        return (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            value={block.content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full outline-none bg-transparent text-lg font-semibold"
          />
        );
      case 'heading5':
        return (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            value={block.content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full outline-none bg-transparent text-base font-semibold"
          />
        );
      case 'heading6':
        return (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            value={block.content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full outline-none bg-transparent text-sm font-semibold"
          />
        );
      case 'code':
        return (
          <textarea
            {...baseTextareaProps}
            placeholder="输入代码..."
            className="w-full outline-none bg-transparent font-mono bg-gray-100 p-2 rounded resize-none"
            rows={3}
            onInput={undefined}
          />
        );
      case 'quote':
        return (
          <div className="border-l-4 border-gray-300 pl-4">
            <textarea
              {...baseTextareaProps}
              placeholder={placeholder}
              className="w-full outline-none bg-transparent italic text-gray-700 resize-none overflow-hidden"
            />
          </div>
        );
      case 'todo':
        return (
          <div className="flex items-start gap-2">
            <button onClick={() => onToggleTodo?.(block.id)} className="mt-1 shrink-0">
              {block.checked ? (
                <Check size={18} className="text-blue-500" />
              ) : (
                <Square size={18} />
              )}
            </button>
            <textarea
              {...baseTextareaProps}
              placeholder="待办事项..."
              className={`w-full outline-none bg-transparent resize-none overflow-hidden ${block.checked ? 'line-through text-gray-400' : ''}`}
            />
          </div>
        );
      case 'bulletList':
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1 shrink-0 text-gray-500">•</span>
            <textarea
              {...baseTextareaProps}
              placeholder={placeholder}
              className="w-full outline-none bg-transparent resize-none overflow-hidden"
            />
          </div>
        );
      case 'numberedList':
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1 shrink-0 text-gray-500 min-w-[1.5rem] text-right">
              {numberedIndex !== undefined ? `${numberedIndex}.` : '1.'}
            </span>
            <textarea
              {...baseTextareaProps}
              placeholder={placeholder}
              className="w-full outline-none bg-transparent resize-none overflow-hidden"
            />
          </div>
        );
      case 'divider':
        return <hr className="my-4 border-gray-300" />;
      case 'image':
        return (
          <div>
            {!block.url ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                上传图片
              </button>
            ) : (
              <div className="relative inline-block">
                <img src={block.url} alt={block.content} style={{ width: `${scale}%` }} className="max-w-full" />
                <div className="absolute top-2 right-2 flex gap-1 bg-white rounded shadow">
                  <button onClick={() => handleScaleChange(-10)} className="p-1 hover:bg-gray-100">
                    <ZoomOut size={16} />
                  </button>
                  <button onClick={() => handleScaleChange(10)} className="p-1 hover:bg-gray-100">
                    <ZoomIn size={16} />
                  </button>
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
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-green-500 text-white rounded"
              >
                上传Excel
              </button>
            ) : (
              <div className="p-4 bg-gray-100 rounded flex items-center gap-2">
                <span>📊 {block.content}</span>
                <a href={block.url} download className="text-blue-500 underline">
                  下载
                </a>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        );
      case 'video':
        return (
          <div>
            {!block.url ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-purple-500 text-white rounded"
              >
                上传视频
              </button>
            ) : (
              <video src={block.url} controls style={{ width: `${scale}%` }} className="max-w-full" />
            )}
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
          </div>
        );
      case 'table': {
        // Parse markdown table rows into header + body
        const rows = block.content
          .split('\n')
          .map(r => r.trim())
          .filter(r => r.startsWith('|') && r.endsWith('|'));
        const parsedRows = rows
          .filter(r => !r.replace(/\|/g, '').trim().match(/^[-:\s]+$/))
          .map(r =>
            r
              .slice(1, -1)
              .split('|')
              .map(cell => cell.trim())
          );
        if (parsedRows.length === 0) return <div className="text-gray-400 text-sm italic">空表格</div>;
        const [headerCells, ...bodyCells] = parsedRows;
        return (
          <div className="overflow-x-auto my-1">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  {headerCells.map((cell, ci) => (
                    <th key={ci} className="border border-gray-300 bg-gray-100 px-3 py-1.5 text-left font-semibold">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyCells.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-gray-50'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-gray-300 px-3 py-1.5">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return (
          <textarea
            {...baseTextareaProps}
            placeholder={placeholder}
            className="w-full outline-none bg-transparent resize-none overflow-hidden break-words whitespace-pre-wrap"
            style={{ minHeight: '24px' }}
          />
        );
    }
  };

  return (
    <div
      data-block-id={block.id}
      className="py-1 px-2 hover:bg-gray-50 rounded group relative"
      onDragOver={e => {
        e.preventDefault();
        onDragOver?.(block.id);
      }}
      onDrop={() => onDrop?.(block.id)}
    >
      <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1">
        <button onClick={() => onEnter(block.id)} className="p-0.5 hover:bg-gray-200 rounded">
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
                onClick={() => {
                  onDelete(block.id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
              >
                <Trash2 size={14} /> 删除
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="pl-10">{renderBlock()}</div>
    </div>
  );
};
