import { useState, useEffect } from 'react';
import { MaterialType, KnowledgeFile, SectionType, ToolType } from './types';
import { Sidebar } from './Sidebar';
import { LibraryView } from './LibraryView';
import { UploadView } from './UploadView';
import { OutputView } from './OutputView';
import { SettingsView } from './SettingsView';
import { RightPanel } from './RightPanel';
import { MermaidPreview } from './tools/MermaidPreview';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../hooks/useToast';
import { X, Eye, Trash2, FileText, Image, Video, Link as LinkIcon, Headphones } from 'lucide-react';
import { apiFetch } from '../../config/api';

const KnowledgeBase = () => {
  const { user } = useAuthStore();
  const { showToast, ToastContainer } = useToast();
  // State
  const [activeSection, setActiveSection] = useState<SectionType>('library');
  const [activeTool, setActiveTool] = useState<ToolType>('chat');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null);
  const [previewSource, setPreviewSource] = useState<'library' | 'output' | null>(null);

  // Data
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [outputFiles, setOutputFiles] = useState<KnowledgeFile[]>([]);
  const [outputsLoaded, setOutputsLoaded] = useState(false);
  const [mindmapDraft, setMindmapDraft] = useState('');
  const [mindmapPreviewCode, setMindmapPreviewCode] = useState('');
  const [mindmapLoading, setMindmapLoading] = useState(false);
  const [mindmapSaving, setMindmapSaving] = useState(false);
  const [mindmapStatus, setMindmapStatus] = useState<string | null>(null);
  const [mindmapError, setMindmapError] = useState<string | null>(null);

  // Fetch files from Supabase on load
  useEffect(() => {
    if (user) {
      fetchLibraryFiles();
    }
  }, [user]);

  useEffect(() => {
    setOutputsLoaded(false);
    const key = getOutputStorageKey();
    if (!key) {
      setOutputFiles([]);
      setOutputsLoaded(true);
      return;
    }
    const raw = localStorage.getItem(key);
    if (!raw) {
      setOutputFiles([]);
      setOutputsLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setOutputFiles(parsed);
      } else {
        setOutputFiles([]);
      }
    } catch {
      setOutputFiles([]);
    }
    setOutputsLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    const key = getOutputStorageKey();
    if (!key || !outputsLoaded) return;
    localStorage.setItem(key, JSON.stringify(outputFiles));
  }, [outputFiles, user?.id, outputsLoaded]);

  const fetchLibraryFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_base_files')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedFiles: KnowledgeFile[] = (data || []).map(row => ({
        id: row.id,
        name: row.file_name,
        type: mapFileType(row.file_type),
        size: formatSize(row.file_size),
        uploadTime: new Date(row.created_at).toLocaleString(),
        isEmbedded: row.is_embedded,
        kbFileId: row.kb_file_id,
        desc: row.description,
        url: row.storage_path.includes('/outputs') ? row.storage_path : `/outputs/kb_data/${user?.email}/${row.file_name}`
      }));

      setFiles(mappedFiles);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  };

  const mapFileType = (mimeOrExt: string): MaterialType => {
    if (!mimeOrExt) return 'doc';
    if (mimeOrExt.includes('image')) return 'image';
    if (mimeOrExt.includes('video')) return 'video';
    if (mimeOrExt.includes('pdf')) return 'doc';
    if (mimeOrExt === 'link') return 'link';
    return 'doc';
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getOutputStorageKey = () => {
    if (!user?.id) return null;
    return `kb_outputs_${user.id}`;
  };

  const isMindmapFile = (file?: KnowledgeFile | null) => {
    if (!file) return false;
    const name = (file.name || '').toLowerCase();
    const url = (file.url || '').toLowerCase();
    return name.endsWith('.mmd') || name.endsWith('.mermaid') || url.includes('.mmd') || url.includes('.mermaid');
  };

  // Handlers
  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleUploadSuccess = () => {
    fetchLibraryFiles();
    setActiveSection('library');
  };

  const handleGenerateSuccess = (file: KnowledgeFile) => {
    setOutputFiles(prev => [file, ...prev]);
    setActiveSection('output');
  };

  const handleDeleteFile = async (file: KnowledgeFile) => {
    if (!confirm(`Delete ${file.name}?`)) return;
    try {
      const { error } = await supabase
        .from('knowledge_base_files')
        .delete()
        .eq('id', file.id);

      if (error) throw error;
      fetchLibraryFiles();
      setPreviewFile(null);
    } catch (err) {
      console.error('Delete error:', err);
      showToast('删除失败', 'error');
    }
  };

  const handleRemoveOutput = (file: KnowledgeFile) => {
    if (!confirm(`从知识产出中移除 ${file.name} 吗？`)) return;
    setOutputFiles(prev => prev.filter(item => item.id !== file.id));
    setPreviewFile(null);
    setPreviewSource(null);
  };

  const handleSaveMindmap = async () => {
    if (!previewFile?.url) {
      setMindmapError('无法获取思维导图文件路径。');
      return;
    }

    try {
      setMindmapSaving(true);
      setMindmapStatus(null);
      setMindmapError(null);

      const res = await apiFetch('/api/v1/kb/save-mindmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: previewFile.url,
          content: mindmapDraft
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || '保存失败');
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error('保存失败');
      }

      if (data.mindmap_path) {
        setPreviewFile({ ...previewFile, url: data.mindmap_path });
      }
      setMindmapStatus('已保存');
    } catch (err: any) {
      setMindmapError(err?.message || '保存失败');
    } finally {
      setMindmapSaving(false);
    }
  };

  useEffect(() => {
    if (!previewFile || !isMindmapFile(previewFile)) {
      setMindmapDraft('');
      setMindmapPreviewCode('');
      setMindmapError(null);
      setMindmapStatus(null);
      setMindmapLoading(false);
      return;
    }

    if (!previewFile.url) {
      setMindmapError('无法获取思维导图文件路径。');
      return;
    }

    let canceled = false;
    const loadMindmap = async () => {
      const tryFetch = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`读取失败: ${res.status}`);
        }
        return res.text();
      };

      try {
        setMindmapLoading(true);
        setMindmapError(null);
        setMindmapStatus(null);
        let text = await tryFetch(previewFile.url);
        const isHtml = text.trim().toLowerCase().startsWith('<!doctype html') || text.trim().toLowerCase().startsWith('<html');
        if (isHtml) {
          const baseUrl = previewFile.url.replace(/\/$/, '');
          if (!baseUrl.toLowerCase().endsWith('.mmd') && !baseUrl.toLowerCase().endsWith('.mermaid')) {
            const fallbackUrl = `${baseUrl}/mindmap.mmd`;
            text = await tryFetch(fallbackUrl);
            if (!canceled) {
              setPreviewFile(prev => prev ? { ...prev, url: fallbackUrl } : prev);
            }
          }
        }
        if (canceled) return;
        setMindmapDraft(text);
        setMindmapPreviewCode(text);
      } catch (err: any) {
        if (canceled) return;
        setMindmapError(err?.message || '读取思维导图失败。');
      } finally {
        if (!canceled) {
          setMindmapLoading(false);
        }
      }
    };

    loadMindmap();
    return () => {
      canceled = true;
    };
  }, [previewFile?.id, previewFile?.url]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'doc': return <FileText size={20} className="text-primary" />;
      case 'image': return <Image size={20} className="text-amber-500" />;
      case 'video': return <Video size={20} className="text-primary/80" />;
      case 'link': return <LinkIcon size={20} className="text-primary" />;
      case 'audio': return <Headphones size={20} className="text-amber-500" />;
      default: return <FileText size={20} className="text-ios-gray-400" />;
    }
  };

  return (
    <div className="w-full h-full flex bg-[linear-gradient(180deg,#f7f1eb_0%,#eef2f8_100%)] text-ios-gray-900 overflow-hidden font-sans relative">
      {ToastContainer}

      {/* 1. Sidebar */}
      <Sidebar 
        activeSection={activeSection} 
        onSectionChange={setActiveSection}
        filesCount={files.length}
        outputCount={outputFiles.length}
      />

      {/* 2. Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
        {/* Header */}
        <div className="h-16 border-b border-primary/10 flex items-center px-8 justify-between backdrop-blur-sm bg-white/55 sticky top-0 z-10">
          <h2 className="text-lg font-medium text-ios-gray-900">
            {activeSection === 'library' && '我的知识库'}
            {activeSection === 'upload' && '上传新素材'}
            {activeSection === 'output' && '知识产出成果'}
            {activeSection === 'settings' && 'API 设置'}
          </h2>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && activeSection === 'library' && (
               <button onClick={() => setSelectedIds(new Set())} className="text-xs px-3 py-1.5 rounded-ios border border-primary/10 hover:bg-primary/5 transition-colors text-ios-gray-700">
                 取消选择 ({selectedIds.size})
               </button>
            )}
          </div>
        </div>

        {/* Views */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeSection === 'library' && (
            <LibraryView
              files={files}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onGoToUpload={() => setActiveSection('upload')}
              onRefresh={fetchLibraryFiles}
              onPreview={(file) => {
                setPreviewFile(file);
                setPreviewSource('library');
              }}
              onDelete={handleDeleteFile}
              activeTool={activeTool}
            />
          )}
          {activeSection === 'upload' && (
            <UploadView 
              onSuccess={handleUploadSuccess}
            />
          )}
          {activeSection === 'output' && (
            <OutputView 
              files={outputFiles} 
              onGoToTool={(tool) => setActiveTool(tool)}
              onPreview={(file) => {
                setPreviewFile(file);
                setPreviewSource('output');
              }}
            />
          )}
          {activeSection === 'settings' && (
            <SettingsView />
          )}
        </div>
      </div>

      {/* 3. Right Panel */}
      <RightPanel 
        activeTool={activeTool} 
        onToolChange={setActiveTool}
        files={files}
        selectedIds={selectedIds}
        onGenerateSuccess={handleGenerateSuccess}
      />

      {/* Preview Drawer - Rendered at top level to be on top of RightPanel */}
      {previewFile && (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-[rgba(61,16,27,0.28)] backdrop-blur-[3px]"
          onClick={() => {
            setPreviewFile(null);
            setPreviewSource(null);
          }}
        >
          <div 
            className="w-full max-w-md h-full bg-[rgba(255,251,247,0.96)] border-l border-primary/10 shadow-ios-xl p-6 flex flex-col animate-in slide-in-from-right duration-300" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-medium text-ios-gray-900">文件详情</h3>
              <button 
                onClick={() => {
                  setPreviewFile(null);
                  setPreviewSource(null);
                }}
                className="p-2 hover:bg-primary/5 rounded-ios text-ios-gray-400 hover:text-primary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col items-center text-center mb-8">
                {previewFile.type === 'image' && previewFile.url ? (
                  <div className="w-full aspect-video rounded-xl overflow-hidden bg-white/70 border border-primary/10 mb-4 group relative">
                    <img src={previewFile.url} alt={previewFile.name} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-white/75 rounded-2xl flex items-center justify-center mb-4 border border-primary/10">
                    {getIcon(previewFile.type)}
                  </div>
                )}
                <h3 className="text-xl font-medium text-ios-gray-900 break-all mb-2">{previewFile.name}</h3>
                <p className="text-sm text-ios-gray-500 flex items-center gap-2">
                  <span className="bg-primary/8 text-primary px-2 py-0.5 rounded text-xs">{previewFile.type.toUpperCase()}</span>
                  <span>{previewFile.size}</span>
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-ios-gray-700 mb-3 flex items-center gap-2">
                    <div className="w-1 h-4 bg-primary rounded-full"></div>
                    基本信息
                  </h4>
                  <div className="bg-white/70 rounded-xl p-4 space-y-3 border border-primary/10">
                    <div className="flex justify-between text-sm">
                      <span className="text-ios-gray-500">上传时间</span>
                      <span className="text-ios-gray-800">{previewFile.uploadTime}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ios-gray-500">文件 ID</span>
                      <span className="text-ios-gray-800 font-mono text-xs">{previewFile.id.slice(0, 12)}...</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ios-gray-500">存储路径</span>
                      <a href={previewFile.url} target="_blank" className="text-primary hover:text-primary-700 truncate max-w-[200px] hover:underline" rel="noreferrer">
                        查看源文件
                      </a>
                    </div>
                  </div>
                </div>

                {previewFile.type === 'audio' && previewFile.url && (
                  <div>
                    <h4 className="text-sm font-medium text-ios-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                      播放预览
                    </h4>
                    <div className="bg-white/70 rounded-xl p-4 border border-primary/10">
                      <audio
                        className="w-full"
                        controls
                        autoPlay
                        preload="metadata"
                        src={`/api/v1/files/stream?url=${encodeURIComponent(previewFile.url)}`}
                      />
                    </div>
                  </div>
                )}

                {previewFile.type === 'doc' && (
                  <div>
                    <h4 className="text-sm font-medium text-ios-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-primary rounded-full"></div>
                      {isMindmapFile(previewFile) ? '思维导图预览与编辑' : '文件预览'}
                    </h4>

                    {isMindmapFile(previewFile) ? (
                      <div className="bg-white/70 rounded-xl p-4 border border-primary/10 space-y-4">
                        {mindmapLoading ? (
                          <div className="text-sm text-ios-gray-500">正在加载思维导图内容...</div>
                        ) : mindmapError ? (
                          <div className="text-sm text-red-400">{mindmapError}</div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setMindmapPreviewCode(mindmapDraft)}
                                className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 transition-colors"
                              >
                                刷新预览
                              </button>
                              <button
                                onClick={handleSaveMindmap}
                                disabled={mindmapSaving}
                                className="px-3 py-1.5 text-xs rounded-lg bg-primary/10 hover:bg-primary/16 text-primary border border-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {mindmapSaving ? '保存中...' : '保存修改'}
                              </button>
                              {mindmapStatus && (
                                <span className="text-xs text-emerald-600">{mindmapStatus}</span>
                              )}
                            </div>

                            <textarea
                              value={mindmapDraft}
                              onChange={(e) => setMindmapDraft(e.target.value)}
                              className="w-full min-h-[180px] bg-white border border-primary/12 rounded-lg p-3 text-xs text-ios-gray-800 font-mono outline-none focus:border-primary"
                            />

                            {mindmapPreviewCode ? (
                              <MermaidPreview mermaidCode={mindmapPreviewCode} title="思维导图预览" />
                            ) : (
                              <div className="text-xs text-ios-gray-500">暂无可预览内容</div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white/70 rounded-xl p-8 text-center border border-dashed border-primary/12">
                        <FileText size={40} className="text-ios-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-ios-gray-500">文档预览暂不支持，请下载后查看</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10 flex gap-3">
              <a 
                href={previewFile.url} 
                target="_blank" 
                rel="noreferrer"
                className="flex-1 py-3 bg-primary text-white hover:bg-primary-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-primary/15"
              >
                <Eye size={18} />
                打开文件
              </a>
              {previewSource === 'library' && (
                <button 
                  onClick={() => handleDeleteFile(previewFile)}
                  className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 size={18} />
                  删除
                </button>
              )}
              {previewSource === 'output' && (
                <button 
                  onClick={() => handleRemoveOutput(previewFile)}
                  className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 size={18} />
                  移除
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
