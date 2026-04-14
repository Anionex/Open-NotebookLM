import React from 'react';
import { RoutingData } from '../types';
import { StatCard } from '../shared/StatCard';

interface RoutingStageViewProps {
  data: RoutingData;
}

const COLORS = [
  'bg-blue-400', 'bg-emerald-400', 'bg-amber-400', 'bg-purple-400',
  'bg-rose-400', 'bg-cyan-400', 'bg-orange-400', 'bg-teal-400',
];

export const RoutingStageView: React.FC<RoutingStageViewProps> = ({ data }) => {
  const totalTokens = data.total_content_tokens;

  return (
    <div className="space-y-6">
      {/* Decision banner */}
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          data.use_mapreduce
            ? 'bg-rose-100 text-rose-700'
            : 'bg-emerald-100 text-emerald-700'
        }`}>
          {data.use_mapreduce ? 'MapReduce' : 'Single-Pass'}
        </span>
        <span className="text-sm text-neutral-500">
          Model: <span className="font-mono text-neutral-700">{data.model || 'unknown'}</span>
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={data.total_content_tokens} label="Total Tokens" />
        <StatCard value={data.context_window_limit} label="Threshold" />
        <StatCard value={data.file_count} label="Files" />
      </div>

      {/* File token bar */}
      {data.file_tokens.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-neutral-700 mb-2">Token Distribution by File</h4>
          <div className="flex h-8 rounded-lg overflow-hidden border border-neutral-200">
            {data.file_tokens.map((tokens, i) => {
              const pct = totalTokens > 0 ? (tokens / totalTokens) * 100 : 0;
              return (
                <div
                  key={i}
                  className={`${COLORS[i % COLORS.length]} flex items-center justify-center text-xs text-white font-medium`}
                  style={{ width: `${pct}%` }}
                  title={`${data.file_names?.[i] || `File ${i}`}: ${tokens.toLocaleString()} tokens`}
                >
                  {pct > 12 ? tokens.toLocaleString() : ''}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {data.file_tokens.map((tokens, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-neutral-600">
                <span className={`w-2.5 h-2.5 rounded-sm ${COLORS[i % COLORS.length]}`} />
                <span className="truncate max-w-[200px]">{data.file_names?.[i] || `File ${i}`}</span>
                <span className="font-mono text-neutral-400">{tokens.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chunk table (MapReduce only) */}
      {data.use_mapreduce && data.chunks_summary.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-neutral-700 mb-2">
            Chunks ({data.chunk_count})
          </h4>
          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-neutral-500 font-medium">Chunk ID</th>
                  <th className="text-left px-3 py-2 text-xs text-neutral-500 font-medium">Source</th>
                  <th className="text-right px-3 py-2 text-xs text-neutral-500 font-medium">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {data.chunks_summary.map(chunk => (
                  <tr key={chunk.chunk_id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-mono text-xs text-neutral-600">{chunk.chunk_id}</td>
                    <td className="px-3 py-2 text-neutral-700 truncate max-w-[200px]">{chunk.source}</td>
                    <td className="px-3 py-2 text-right font-mono text-neutral-600">{chunk.token_count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
