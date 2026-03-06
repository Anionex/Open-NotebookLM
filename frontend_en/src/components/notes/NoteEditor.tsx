import React, { useState, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Code, Quote, Image, FileText, Download, Save } from 'lucide-react';
import { apiFetch } from '../../config/api';

interface NoteEditorProps {
  onClose: () => void;
  notebook: any;
  user: any;
  onSaved?: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ onClose, notebook, user, onSaved }) => {
  const [title, setTitle] = useState('Untitled');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setCoverImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleMdEmbed = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        if (editorRef.current) {
          editorRef.current.innerHTML += `<pre>${content}</pre>`;
        }
      };
      reader.readAsText(file);
    }
  };

  const htmlToMarkdown = (html: string): string => {
    let md = html
      .replace(/<h1>(.*?)<\/h1>/g, '# $1\n')
      .replace(/<h2>(.*?)<\/h2>/g, '## $1\n')
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<b>(.*?)<\/b>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<i>(.*?)<\/i>/g, '*$1*')
      .replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n')
      .replace(/<pre>(.*?)<\/pre>/gs, '```\n$1\n```\n')
      .replace(/<code>(.*?)<\/code>/g, '`$1`')
      .replace(/<li>(.*?)<\/li>/g, '- $1\n')
      .replace(/<ul>|<\/ul>|<ol>|<\/ol>/g, '')
      .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]+>/g, '');
    return md.trim();
  };

  const handleSave = async () => {
    if (!editorRef.current || !notebook?.id) return;
    setSaving(true);
    try {
      const content = htmlToMarkdown(editorRef.current.innerHTML);
      const mdContent = coverImage ? `![Cover](${coverImage})\n\n# ${title}\n\n${content}` : `# ${title}\n\n${content}`;
      const blob = new Blob([mdContent], { type: 'text/markdown' });
      const file = new File([blob], `${title}.md`, { type: 'text/markdown' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('email', user?.email || user?.id || 'default');
      formData.append('user_id', user?.id || 'default');
      formData.append('notebook_id', notebook.id);
      formData.append('notebook_title', notebook?.title || notebook?.name || '');

      const res = await apiFetch('/api/v1/kb/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Save failed');

      alert('Note saved to knowledge base!');
      onSaved?.();
      onClose();
    } catch (err) {
      alert('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (!editorRef.current) return;
    const content = htmlToMarkdown(editorRef.current.innerHTML);
    const mdContent = coverImage ? `![Cover](${coverImage})\n\n# ${title}\n\n${content}` : `# ${title}\n\n${content}`;
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-2xl font-bold outline-none flex-1"
          placeholder="Untitled"
        />
        <div className="flex gap-2">
          <button onClick={handleExport} className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1">
            <Download size={16} /> Export
          </button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1 disabled:opacity-50">
            <Save size={16} /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose} className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
            Done
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 border-b bg-gray-50">
        <button onClick={() => coverInputRef.current?.click()} className="p-2 hover:bg-gray-200 rounded" title="Add Cover">
          <Image size={18} />
        </button>
        <button onClick={() => mdInputRef.current?.click()} className="p-2 hover:bg-gray-200 rounded" title="Embed Markdown">
          <FileText size={18} />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button onClick={() => execCommand('bold')} className="p-2 hover:bg-gray-200 rounded" title="Bold">
          <Bold size={18} />
        </button>
        <button onClick={() => execCommand('italic')} className="p-2 hover:bg-gray-200 rounded" title="Italic">
          <Italic size={18} />
        </button>
        <button onClick={() => execCommand('formatBlock', 'h1')} className="p-2 hover:bg-gray-200 rounded" title="Heading 1">
          <Heading1 size={18} />
        </button>
        <button onClick={() => execCommand('formatBlock', 'h2')} className="p-2 hover:bg-gray-200 rounded" title="Heading 2">
          <Heading2 size={18} />
        </button>
        <button onClick={() => execCommand('insertUnorderedList')} className="p-2 hover:bg-gray-200 rounded" title="Bullet List">
          <List size={18} />
        </button>
        <button onClick={() => execCommand('insertOrderedList')} className="p-2 hover:bg-gray-200 rounded" title="Numbered List">
          <ListOrdered size={18} />
        </button>
        <button onClick={() => execCommand('formatBlock', 'blockquote')} className="p-2 hover:bg-gray-200 rounded" title="Quote">
          <Quote size={18} />
        </button>
        <button onClick={() => execCommand('formatBlock', 'pre')} className="p-2 hover:bg-gray-200 rounded" title="Code Block">
          <Code size={18} />
        </button>
      </div>

      <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
      <input ref={mdInputRef} type="file" accept=".md,.markdown" onChange={handleMdEmbed} className="hidden" />

      {coverImage && (
        <div className="relative">
          <img src={coverImage} alt="Cover" className="w-full h-48 object-cover" />
          <button onClick={() => setCoverImage(null)} className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
            Remove
          </button>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        className="flex-1 p-8 outline-none overflow-auto prose prose-lg max-w-none"
        style={{ minHeight: '400px' }}
        suppressContentEditableWarning
      >
        <p>Start typing...</p>
      </div>
    </div>
  );
};
