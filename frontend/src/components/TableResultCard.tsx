import { useState } from 'react';

export interface TableQueryResult {
  sql: string;
  // 后端返回 rows（数组）或 result_data，兼容两种
  rows?: Record<string, unknown>[];
  result_data?: Record<string, unknown>[];
  // 后端返回 answer 或 summary
  answer?: string;
  summary?: string;
  export_url?: string;
  columns?: string[];
}

interface TableResultCardProps {
  result: TableQueryResult;
  question: string;
}

export function TableResultCard({ result, question }: TableResultCardProps) {
  const [sqlOpen, setSqlOpen] = useState(false);

  // 防御性处理：确保 result 存在
  if (!result) {
    return <div className="rounded-xl border p-4 text-sm text-red-500">结果为空</div>;
  }

  // 兼容后端返回 rows 或 result_data
  const data = result.rows ?? result.result_data ?? [];
  const summaryText = result.answer ?? result.summary ?? '';
  const columns = data.length > 0 ? Object.keys(data[0]) : (result.columns ?? []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* 问题标题 */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <p className="text-sm text-gray-700 font-medium">{question}</p>
      </div>

      {/* SQL 折叠块 */}
      <button
        type="button"
        onClick={() => setSqlOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 text-xs text-gray-500 hover:bg-gray-100 transition-colors border-b border-gray-200"
      >
        <span className="font-mono font-medium">SQL</span>
        <span>{sqlOpen ? '▲' : '▼'}</span>
      </button>
      {sqlOpen && (
        <pre className="px-4 py-3 text-xs font-mono bg-gray-900 text-green-400 overflow-x-auto whitespace-pre-wrap">
          {result.sql}
        </pre>
      )}

      {/* 数据表格 */}
      {columns.length > 0 && data.length > 0 ? (
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap border-b border-gray-200"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-3 py-1.5 text-gray-700 whitespace-nowrap border-b border-gray-100"
                    >
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-4 text-sm text-gray-400 text-center">无数据返回</p>
      )}

      {/* 摘要 + 导出 */}
      <div className="px-4 py-3 flex items-start justify-between gap-3 border-t border-gray-200 bg-gray-50">
        <p className="text-sm text-gray-600 leading-relaxed flex-1">{summaryText}</p>
        {result.export_url && (
          <a
            href={result.export_url}
            download
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-white transition-colors"
          >
            ⬇️ 导出 CSV
          </a>
        )}
      </div>
    </div>
  );
}
