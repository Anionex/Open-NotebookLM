import { useRef, useState } from 'react';
import { apiFetch, parseJson } from '../config/api';
import type { KnowledgeFile } from '../types';
import { TableResultCard, type TableQueryResult } from './TableResultCard';

// ─── 共享的 Notebook 上下文（由父组件传入）────────────────────────────────────

export interface NotebookContext {
  notebookId: string;
  notebookTitle: string;
  userId: string;
  userEmail: string;
}

// ─── 历史记录条目 ─────────────────────────────────────────────────────────────

interface HistoryItem {
  question: string;
  result: TableQueryResult;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TableAnalysisPanelProps {
  sessionId: string | null;
  dataset: KnowledgeFile;
  notebookContext: NotebookContext;
}

// ─── 组件 ─────────────────────────────────────────────────────────────────────

export function TableAnalysisPanel({
  sessionId,
  dataset,
  notebookContext,
}: TableAnalysisPanelProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const isReady = Boolean(sessionId);

  const handleSubmit = async () => {
    const trimmed = query.trim();
    if (!trimmed || !sessionId || loading) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await apiFetch(`/api/v1/data-extract/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebook_id: notebookContext.notebookId,
          notebook_title: notebookContext.notebookTitle,
          user_id: notebookContext.userId,
          email: notebookContext.userEmail,
          question: trimmed,
          result_format: 'json',
        }),
      });

      const data = await parseJson<TableQueryResult & { success?: boolean }>(resp);
      setHistory((prev) => [{ question: trimmed, result: data }, ...prev]);
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败，请重试');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── 顶部提示横幅 ── */}
      <div className="px-4 py-3 border-b border-indigo-100 bg-indigo-50 shrink-0">
        <div className="flex items-start gap-2.5">
          <span className="text-xl shrink-0 mt-0.5">📊</span>
          <div>
            <p className="text-sm font-medium text-indigo-800">
              已连接 <span className="font-bold">{dataset.name}</span>
              {!isReady && <span className="ml-2 text-amber-600 font-normal text-xs">正在准备会话…</span>}
            </p>
            <p className="text-xs text-indigo-600 mt-0.5 leading-relaxed">
              直接描述你想做的事，我来取数、处理和分析。例如：统计各月销售额、找出前10名产品、计算各地区占比…
            </p>
          </div>
        </div>
      </div>

      {/* ── 历史结果（可滚动，最新在前）── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-16 select-none">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-sm">告诉我你想了解什么</p>
          </div>
        )}
        {history.map((item, i) => (
          <TableResultCard key={i} question={item.question} result={item.result} />
        ))}
      </div>

      {/* ── 输入区 ── */}
      <div className="border-t border-gray-200 px-4 py-3 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                       placeholder:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
            placeholder={isReady ? '描述你的需求，例如：找出销售额最高的10个客户…' : '正在准备会话…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            disabled={!isReady || loading}
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!isReady || loading || !query.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium
                       hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors shrink-0"
          >
            {loading ? '…' : '↑'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      </div>
    </div>
  );
}
