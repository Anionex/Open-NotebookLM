import React, { useState, useCallback } from 'react';
import { Block, BlockType } from './types';
import { BlockEditor } from './BlockEditor';
import { SlashMenu } from './SlashMenu';
import { AIPanel } from './AIPanel';
import { TextSelectionToolbar } from './TextSelectionToolbar';
import { DiffPreviewPanel } from './DiffPreviewPanel';
import { Image, Download, Save, X, Maximize2, Minimize2 } from 'lucide-react';
import { apiFetch } from '../../config/api';
import { useToast } from '../../hooks/useToast';
import type { KnowledgeFile } from '../../types';

interface NotionEditorProps {
  onClose: () => void;
  notebook: any;
  user: any;
  files?: KnowledgeFile[];
  onSaved?: (noteInfo: { title: string; fileName: string }) => void;
  initialTitle?: string;
  initialBlocks?: Block[];
}

export const NotionEditor: React.FC<NotionEditorProps> = ({
  onClose,
  notebook,
  user,
  files = [],
  onSaved,
  initialTitle = '无标题',
  initialBlocks = [{ id: '1', type: 'text', content: '' }],
}) => {
  const { showToast, ToastContainer } = useToast();
  const [title, setTitle] = useState(initialTitle);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [slashMenuBlock, setSlashMenuBlock] = useState<string | null>(null);
  const [aiPanelBlock, setAiPanelBlock] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);

  // AI 上下文记忆
  const [noteMemory, setNoteMemory] = useState<string>('');

  // 文本选中工具栏
  const [textSelection, setTextSelection] = useState<{
    blockId: string;
    text: string;
    position: { x: number; y: number };
  } | null>(null);

  // 差异对比面板（右侧）
  const [diffPreview, setDiffPreview] = useState<{
    blockId: string;
    originalText: string;
    revisedText: string;
  } | null>(null);

  const coverInputRef = React.useRef<HTMLInputElement>(null);

  const generateId = () => Math.random().toString(36).slice(2, 11);

  const updateBlock = (id: string, content: string, url?: string, scale?: number) => {
    setBlocks(prev =>
      prev.map(b => (b.id === id ? { ...b, content, url: url ?? b.url, scale: scale ?? b.scale } : b))
    );
    if (content !== '/' && content !== '／') {
      setSlashMenuBlock(null);
    }
  };

  const toggleTodo = (id: string) => {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, checked: !b.checked } : b)));
  };

  const changeBlockType = (id: string, type: BlockType, newContent?: string) => {
    setBlocks(prev =>
      prev.map(b =>
        b.id === id
          ? {
              ...b,
              type,
              content: newContent !== undefined
                ? newContent
                : b.content.endsWith('/') ? b.content.slice(0, -1) : b.content,
            }
          : b
      )
    );
    setSlashMenuBlock(null);
  };

  const addBlock = (afterId: string, remainingContent?: string) => {
    const index = blocks.findIndex(b => b.id === afterId);
    const currentType = blocks[index]?.type;
    // Continue list type when pressing Enter in list blocks
    const newType: BlockType = (currentType === 'bulletList' || currentType === 'numberedList' || currentType === 'todo')
      ? currentType
      : 'text';
    const newBlock: Block = { id: generateId(), type: newType, content: remainingContent || '' };
    setBlocks(prev => [...prev.slice(0, index + 1), newBlock, ...prev.slice(index + 1)]);
  };

  const deleteBlock = (id: string) => {
    if (blocks.length === 1) {
      setBlocks([{ id: blocks[0].id, type: 'text', content: '' }]);
      return;
    }
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const handleDragStart = (id: string) => setDraggedBlock(id);
  const handleDragOver = (_id: string) => {};
  const handleDrop = (targetId: string) => {
    if (!draggedBlock || draggedBlock === targetId) return;
    const dragIdx = blocks.findIndex(b => b.id === draggedBlock);
    const targetIdx = blocks.findIndex(b => b.id === targetId);
    const newBlocks = [...blocks];
    const [removed] = newBlocks.splice(dragIdx, 1);
    newBlocks.splice(targetIdx, 0, removed);
    setBlocks(newBlocks);
    setDraggedBlock(null);
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setCoverImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSpaceKeyEmpty = (blockId: string) => {
    if (aiPanelBlock === blockId) {
      // 已打开AI面板，关闭并插入空格
      setAiPanelBlock(null);
      updateBlock(blockId, ' ');
    } else {
      // 未打开，打开AI面板
      setSlashMenuBlock(null);
      setAiPanelBlock(blockId);
    }
  };

  // Container-level mouseup: catches selections released anywhere (inside or outside a textarea)
  const handleEditorMouseUp = useCallback((e: React.MouseEvent) => {
    // 首先尝试获取 window selection（支持跨块选择）
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 检查是否有有效的位置
      if (rect.width > 0 && rect.height > 0) {
        let blockEl = range.startContainer.parentElement?.closest('[data-block-id]');
        const blockId = blockEl?.getAttribute('data-block-id') ?? '';

        setTextSelection({
          blockId,
          text: selectedText,
          position: {
            x: Math.max(rect.left, 10),
            y: Math.max(rect.top - 10, 10)
          },
        });
        return;
      }
    }

    // 回退：检查 textarea/input 内的选择
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
      const start = active.selectionStart ?? 0;
      const end = active.selectionEnd ?? 0;
      if (end > start) {
        const text = active.value.substring(start, end).trim();
        if (text) {
          const blockEl = active.closest('[data-block-id]');
          const blockId = blockEl?.getAttribute('data-block-id') ?? '';
          if (blockId) {
            setTextSelection({
              blockId,
              text,
              position: {
                x: Math.max(e.clientX, 10),
                y: Math.max(e.clientY - 60, 10)
              },
            });
          }
        }
      }
    }
  }, []);

  const handleTextSelection = useCallback(
    (blockId: string, text: string, rect: DOMRect) => {
      setTextSelection({
        blockId,
        text,
        position: { x: rect.left, y: rect.top },
      });
    },
    []
  );

  const handleCloseTextSelection = useCallback(() => {
    setTextSelection(null);
  }, []);

  const handleDiffResult = (originalText: string, revisedText: string) => {
    if (!textSelection) return;
    setDiffPreview({ blockId: textSelection.blockId, originalText, revisedText });
    setTextSelection(null);
  };

  const handleAcceptDiff = (blockId: string, revisedText: string) => {
    if (!diffPreview) return;
    setBlocks(prev =>
      prev.map(b => {
        if (b.id !== blockId) return b;
        const replaced = b.content.replace(diffPreview.originalText, revisedText);
        return { ...b, content: replaced !== b.content ? replaced : revisedText };
      })
    );
    setDiffPreview(null);
  };

  const handleRejectDiff = () => {
    setDiffPreview(null);
  };

  const handleInsertText = (text: string, blockId: string) => {
    const newBlocks = parseMarkdownToBlocks(text);
    const index = blocks.findIndex(b => b.id === blockId);
    const targetBlock = blocks[index];
    if (targetBlock && targetBlock.content === '') {
      setBlocks(prev => [
        ...prev.slice(0, index),
        ...newBlocks,
        ...prev.slice(index + 1),
      ]);
    } else {
      setBlocks(prev => [
        ...prev.slice(0, index + 1),
        ...newBlocks,
        ...prev.slice(index + 1),
      ]);
    }
    setSlashMenuBlock(null);
    setAiPanelBlock(null);
  };

  const handleInsertBelow = (text: string) => {
    if (!textSelection) {
      const newBlocks = parseMarkdownToBlocks(text);
      setBlocks(prev => [...prev, ...newBlocks]);
      return;
    }
    handleInsertText(text, textSelection.blockId);
    setTextSelection(null);
  };

  /**
   * 解析 Markdown 为 Block[]
   * 修复：bulletList 使用 textarea 支持长文换行；
   *       numberedList 去除原始数字，编号由 numberedIndex 动态计算。
   */
  const parseMarkdownToBlocks = (text: string): Block[] => {
    const lines = text.split('\n');
    const newBlocks: Block[] = [];
    let inCodeBlock = false;
    let codeContent = '';
    let tableLines: string[] = [];

    const removeBold = (s: string) => s.replace(/\*\*(.*?)\*\*/g, '$1');

    const flushTable = () => {
      if (tableLines.length > 0) {
        newBlocks.push({ id: generateId(), type: 'table', content: tableLines.join('\n') });
        tableLines = [];
      }
    };

    lines.forEach(line => {
      if (line.startsWith('```')) {
        flushTable();
        if (inCodeBlock) {
          newBlocks.push({ id: generateId(), type: 'code', content: codeContent.trim() });
          codeContent = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
      } else if (inCodeBlock) {
        codeContent += line + '\n';
      } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        // Markdown table row — accumulate lines
        tableLines.push(line);
      } else {
        flushTable();
        if (line.startsWith('###### ')) {
          newBlocks.push({ id: generateId(), type: 'heading6', content: removeBold(line.slice(7)) });
        } else if (line.startsWith('##### ')) {
          newBlocks.push({ id: generateId(), type: 'heading5', content: removeBold(line.slice(6)) });
        } else if (line.startsWith('#### ')) {
          newBlocks.push({ id: generateId(), type: 'heading4', content: removeBold(line.slice(5)) });
        } else if (line.startsWith('### ')) {
          newBlocks.push({ id: generateId(), type: 'heading3', content: removeBold(line.slice(4)) });
        } else if (line.startsWith('## ')) {
          newBlocks.push({ id: generateId(), type: 'heading2', content: removeBold(line.slice(3)) });
        } else if (line.startsWith('# ')) {
          newBlocks.push({ id: generateId(), type: 'heading1', content: removeBold(line.slice(2)) });
        } else if (line.match(/^[-*+]\s/)) {
          newBlocks.push({ id: generateId(), type: 'bulletList', content: removeBold(line.slice(2)) });
        } else if (line.match(/^\d+\.\s/)) {
          newBlocks.push({ id: generateId(), type: 'numberedList', content: removeBold(line.replace(/^\d+\.\s+/, '')) });
        } else if (line.startsWith('> ')) {
          newBlocks.push({ id: generateId(), type: 'quote', content: removeBold(line.slice(2)) });
        } else if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
          newBlocks.push({ id: generateId(), type: 'divider', content: '' });
        } else if (line.trim() === '') {
          // 跳过空行
        } else {
          newBlocks.push({ id: generateId(), type: 'text', content: removeBold(line) });
        }
      }
    });

    flushTable();
    if (inCodeBlock && codeContent.trim()) {
      newBlocks.push({ id: generateId(), type: 'code', content: codeContent.trim() });
    }

    return newBlocks.length > 0 ? newBlocks : [{ id: generateId(), type: 'text', content: text }];
  };

  const getNoteContext = () => `标题：${title}\n\n${blocksToMarkdown()}`;

  const blocksToMarkdown = (): string => {
    let numIdx = 0;
    return blocks
      .map(block => {
        if (block.type !== 'numberedList') numIdx = 0;
        switch (block.type) {
          case 'heading1': return `# ${block.content}\n`;
          case 'heading2': return `## ${block.content}\n`;
          case 'heading3': return `### ${block.content}\n`;
          case 'heading4': return `#### ${block.content}\n`;
          case 'heading5': return `##### ${block.content}\n`;
          case 'heading6': return `###### ${block.content}\n`;
          case 'bulletList': return `- ${block.content}\n`;
          case 'numberedList': {
            numIdx++;
            return `${numIdx}. ${block.content}\n`;
          }
          case 'todo': return `- [${block.checked ? 'x' : ' '}] ${block.content}\n`;
          case 'quote': return `> ${block.content}\n`;
          case 'code': return `\`\`\`\n${block.content}\n\`\`\`\n`;
          case 'divider': return `---\n`;
          case 'table': return `${block.content}\n\n`;
          default: return `${block.content}\n\n`;
        }
      })
      .join('');
  };

  const getNumberedIndex = (blockIndex: number): number => {
    let count = 0;
    for (let i = blockIndex; i >= 0; i--) {
      const t = blocks[i].type;
      if (t === 'numberedList') {
        count++;
      } else {
        // 遇到任何非 numberedList 块就停止
        break;
      }
    }
    return count;
  };

  const handleSave = async () => {
    if (!notebook?.id) return;
    setSaving(true);
    try {
      const content = blocksToMarkdown();
      const mdContent = coverImage
        ? `![封面](${coverImage})\n\n# ${title}\n\n${content}`
        : `# ${title}\n\n${content}`;
      const blob = new Blob([mdContent], { type: 'text/markdown' });
      const fileName = `${title}_${Date.now()}.md`;
      const file = new File([blob], fileName, { type: 'text/markdown' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('email', user?.email || user?.id || 'default');
      formData.append('user_id', user?.id || 'default');
      formData.append('notebook_id', notebook.id);
      formData.append('notebook_title', notebook?.title || notebook?.name || '');

      const res = await apiFetch('/api/v1/kb/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('保存失败');

      showToast('笔记已保存到知识库！', 'success');
      onSaved?.({ title, fileName });
      onClose();
    } catch {
      showToast('保存笔记失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const content = blocksToMarkdown();
    const mdContent = coverImage
      ? `![封面](${coverImage})\n\n# ${title}\n\n${content}`
      : `# ${title}\n\n${content}`;
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {ToastContainer}
      <div
        className={`flex flex-col h-full bg-white w-full ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}
      >
      <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => coverInputRef.current?.click()}
            className="p-2 hover:bg-gray-100 rounded group relative"
            title="添加封面"
          >
            <Image size={18} />
            <span className="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
              点击添加封面图片
            </span>
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 hover:bg-gray-100 rounded"
            title={isFullScreen ? '退出全屏' : '全屏'}
          >
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1"
          >
            <Download size={16} /> 导出
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X size={18} />
          </button>
        </div>
      </div>

      <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />

      {coverImage && (
        <div className="relative shrink-0">
          <img src={coverImage} alt="封面" className="w-full h-64 object-cover" />
          <button
            onClick={() => setCoverImage(null)}
            className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs"
          >
            移除
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div
          className="flex-1 overflow-y-auto px-24 py-12"
          onMouseUp={handleEditorMouseUp}
        >
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-4xl font-bold outline-none w-full mb-4 bg-transparent"
            placeholder="无标题"
          />

          {blocks.map((block, blockIndex) => (
            <div key={block.id} className="relative">
              <BlockEditor
                block={block}
                onChange={updateBlock}
                onTypeChange={changeBlockType}
                onDelete={deleteBlock}
                onEnter={addBlock}
                onBackspace={deleteBlock}
                onSlashCommand={id => {
                  setAiPanelBlock(null);
                  setSlashMenuBlock(id);
                }}
                onSpaceKeyEmpty={handleSpaceKeyEmpty}
                onTextSelection={handleTextSelection}
                showSlashMenu={slashMenuBlock === block.id}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onToggleTodo={toggleTodo}
                numberedIndex={
                  block.type === 'numberedList' ? getNumberedIndex(blockIndex) : undefined
                }
              />

              {slashMenuBlock === block.id && (
                <SlashMenu
                  onSelect={type => changeBlockType(block.id, type)}
                  onClose={() => setSlashMenuBlock(null)}
                  onInsertText={text => handleInsertText(text, block.id)}
                  noteContext={getNoteContext()}
                  user={user}
                />
              )}

              {aiPanelBlock === block.id && (
                <AIPanel
                  blockId={block.id}
                  files={files}
                  user={user}
                  noteContext={getNoteContext()}
                  noteMemory={noteMemory}
                  onInsertText={handleInsertText}
                  onClose={() => setAiPanelBlock(null)}
                  onUpdateMemory={setNoteMemory}
                />
              )}
            </div>
          ))}
        </div>

        {diffPreview && (
          <DiffPreviewPanel
            originalText={diffPreview.originalText}
            revisedText={diffPreview.revisedText}
            blockId={diffPreview.blockId}
            onAccept={handleAcceptDiff}
            onReject={handleRejectDiff}
          />
        )}
      </div>

      {textSelection && (
        <TextSelectionToolbar
          selectedText={textSelection.text}
          position={textSelection.position}
          files={files}
          user={user}
          noteMemory={noteMemory}
          noteContext={getNoteContext()}
          onDiffResult={handleDiffResult}
          onInsertBelow={handleInsertBelow}
          onUpdateMemory={setNoteMemory}
          onClose={handleCloseTextSelection}
        />
      )}
    </div>
    </>
  );
};
