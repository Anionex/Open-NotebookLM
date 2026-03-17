import React, { useState } from 'react';
import { Block, BlockType, NoteDocument } from './types';
import { BlockEditor } from './BlockEditor';
import { SlashMenu } from './SlashMenu';
import { Image, Download, Save, X, Maximize2, Minimize2 } from 'lucide-react';
import { apiFetch } from '../../config/api';

interface NotionEditorProps {
  onClose: () => void;
  notebook: any;
  user: any;
  onSaved?: () => void;
}

export const NotionEditor: React.FC<NotionEditorProps> = ({ onClose, notebook, user, onSaved }) => {
  const [title, setTitle] = useState('无标题');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([
    { id: '1', type: 'text', content: '' }
  ]);
  const [slashMenuBlock, setSlashMenuBlock] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);

  const coverInputRef = React.useRef<HTMLInputElement>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const updateBlock = (id: string, content: string, url?: string, scale?: number) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content, url, scale } : b));
    if (!content.endsWith('/')) {
      setSlashMenuBlock(null);
    }
  };

  const toggleTodo = (id: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, checked: !b.checked } : b));
  };

  const changeBlockType = (id: string, type: BlockType) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, type, content: b.content.endsWith('/') ? b.content.slice(0, -1) : b.content } : b));
    setSlashMenuBlock(null);
  };

  const addBlock = (afterId: string, remainingContent?: string) => {
    const index = blocks.findIndex(b => b.id === afterId);
    const newBlock: Block = { id: generateId(), type: 'text', content: remainingContent || '' };
    setBlocks([...blocks.slice(0, index + 1), newBlock, ...blocks.slice(index + 1)]);
  };

  const deleteBlock = (id: string) => {
    if (blocks.length === 1) {
      setBlocks([{ id: blocks[0].id, type: 'text', content: '' }]);
      return;
    }
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const handleDragStart = (id: string) => setDraggedBlock(id);
  const handleDragOver = (id: string) => {};
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

  const handleInsertText = (text: string, blockId: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    const newBlocks: Block[] = [];
    let inCodeBlock = false;
    let codeContent = '';

    const removeBold = (str: string) => str.replace(/\*\*(.*?)\*\*/g, '$1');

    lines.forEach(line => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          newBlocks.push({ id: generateId(), type: 'code', content: codeContent.trim() });
          codeContent = '';
        }
        inCodeBlock = !inCodeBlock;
      } else if (inCodeBlock) {
        codeContent += line + '\n';
      } else if (line.startsWith('# ')) {
        newBlocks.push({ id: generateId(), type: 'heading1', content: removeBold(line.slice(2)) });
      } else if (line.startsWith('## ')) {
        newBlocks.push({ id: generateId(), type: 'heading2', content: removeBold(line.slice(3)) });
      } else if (line.startsWith('### ')) {
        newBlocks.push({ id: generateId(), type: 'heading3', content: removeBold(line.slice(4)) });
      } else if (line.match(/^[-*]\s/)) {
        newBlocks.push({ id: generateId(), type: 'bulletList', content: removeBold(line.slice(2)) });
      } else if (line.match(/^\d+\.\s/)) {
        newBlocks.push({ id: generateId(), type: 'numberedList', content: removeBold(line.replace(/^\d+\.\s/, '')) });
      } else if (line.startsWith('> ')) {
        newBlocks.push({ id: generateId(), type: 'quote', content: removeBold(line.slice(2)) });
      } else {
        newBlocks.push({ id: generateId(), type: 'text', content: removeBold(line) });
      }
    });

    const index = blocks.findIndex(b => b.id === blockId);
    setBlocks([...blocks.slice(0, index), ...newBlocks, ...blocks.slice(index + 1)]);
    setSlashMenuBlock(null);
  };

  const getNoteContext = () => {
    return `标题：${title}\n\n${blocksToMarkdown()}`;
  };

  const blocksToMarkdown = (): string => {
    return blocks.map(block => {
      switch (block.type) {
        case 'heading1': return `# ${block.content}\n`;
        case 'heading2': return `## ${block.content}\n`;
        case 'heading3': return `### ${block.content}\n`;
        case 'bulletList': return `- ${block.content}\n`;
        case 'numberedList': return `1. ${block.content}\n`;
        case 'todo': return `- [${block.checked ? 'x' : ' '}] ${block.content}\n`;
        case 'quote': return `> ${block.content}\n`;
        case 'code': return `\`\`\`\n${block.content}\n\`\`\`\n`;
        case 'divider': return `---\n`;
        default: return `${block.content}\n\n`;
      }
    }).join('');
  };

  const handleSave = async () => {
    if (!notebook?.id) return;
    setSaving(true);
    try {
      const content = blocksToMarkdown();
      const mdContent = coverImage ? `![封面](${coverImage})\n\n# ${title}\n\n${content}` : `# ${title}\n\n${content}`;
      const blob = new Blob([mdContent], { type: 'text/markdown' });
      const file = new File([blob], `${title}.md`, { type: 'text/markdown' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('email', user?.email || user?.id || 'default');
      formData.append('user_id', user?.id || 'default');
      formData.append('notebook_id', notebook.id);
      formData.append('notebook_title', notebook?.title || notebook?.name || '');

      const res = await apiFetch('/api/v1/kb/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('保存失败');

      alert('笔记已保存到知识库！');
      onSaved?.();
      onClose();
    } catch (err) {
      alert('保存笔记失败');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const content = blocksToMarkdown();
    const mdContent = coverImage ? `![封面](${coverImage})\n\n# ${title}\n\n${content}` : `# ${title}\n\n${content}`;
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col h-full bg-white w-full ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
      <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => coverInputRef.current?.click()} className="p-2 hover:bg-gray-100 rounded group relative" title="添加封面">
            <Image size={18} />
            <span className="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
              点击添加封面图片
            </span>
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 hover:bg-gray-100 rounded" title={isFullScreen ? "退出全屏" : "全屏"}>
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button onClick={handleExport} className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1">
            <Download size={16} /> 导出
          </button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1 disabled:opacity-50">
            <Save size={16} /> {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X size={18} />
          </button>
        </div>
      </div>

      <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />

      {coverImage && (
        <div className="relative">
          <img src={coverImage} alt="封面" className="w-full h-64 object-cover" />
          <button onClick={() => setCoverImage(null)} className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
            移除
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-24 py-12">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-4xl font-bold outline-none w-full mb-4"
          placeholder="无标题"
        />

        {blocks.map((block) => (
          <div key={block.id} className="relative">
            <BlockEditor
              block={block}
              onChange={updateBlock}
              onTypeChange={changeBlockType}
              onDelete={deleteBlock}
              onEnter={addBlock}
              onBackspace={deleteBlock}
              onSlashCommand={(id) => setSlashMenuBlock(id)}
              showSlashMenu={slashMenuBlock === block.id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onToggleTodo={toggleTodo}
            />
            {slashMenuBlock === block.id && (
              <SlashMenu
                onSelect={(type) => changeBlockType(block.id, type)}
                onClose={() => setSlashMenuBlock(null)}
                onInsertText={(text) => handleInsertText(text, block.id)}
                noteContext={getNoteContext()}
                user={user}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
