import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { MapChunkResult } from '../types';
import { StatCard } from '../shared/StatCard';
import { NodeList } from '../shared/NodeList';

interface MapStageViewProps {
  data: MapChunkResult[];
}

const SCORE_COLORS = ['', 'bg-blue-400', 'bg-cyan-400', 'bg-yellow-400', 'bg-orange-400', 'bg-red-400'];

export const MapStageView: React.FC<MapStageViewProps> = ({ data }) => {
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  const totalNodes = data.reduce((sum, c) => sum + c.nodes.length, 0);
  const avgNodes = data.length > 0 ? Math.round(totalNodes / data.length) : 0;

  // Importance distribution
  const dist = [0, 0, 0, 0, 0, 0]; // index 1-5
  for (const chunk of data) {
    for (const node of chunk.nodes) {
      const s = Math.max(1, Math.min(5, Math.round(node.importance_score)));
      dist[s]++;
    }
  }
  const maxDist = Math.max(...dist.slice(1), 1);

  const toggleChunk = (id: string) => {
    setExpandedChunks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={data.length} label="Chunks" />
        <StatCard value={totalNodes} label="Total Nodes" />
        <StatCard value={avgNodes} label="Avg Nodes/Chunk" />
      </div>

      {/* Importance distribution */}
      <div>
        <h4 className="text-sm font-medium text-neutral-700 mb-2">Importance Distribution</h4>
        <div className="flex items-end gap-1 h-16">
          {[1, 2, 3, 4, 5].map(score => (
            <div key={score} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-mono text-neutral-500">{dist[score]}</span>
              <div
                className={`w-full rounded-t ${SCORE_COLORS[score]}`}
                style={{ height: `${(dist[score] / maxDist) * 48}px`, minHeight: dist[score] > 0 ? '4px' : '0' }}
              />
              <span className="text-xs text-neutral-400">{score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-chunk accordion */}
      <div>
        <h4 className="text-sm font-medium text-neutral-700 mb-2">Per-Chunk Results</h4>
        <div className="space-y-1">
          {data.map(chunk => {
            const open = expandedChunks.has(chunk.chunk_id);
            return (
              <div key={chunk.chunk_id} className="border border-neutral-200 rounded-lg">
                <button
                  onClick={() => toggleChunk(chunk.chunk_id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-neutral-50 transition-colors"
                >
                  {open
                    ? <ChevronDown size={14} className="text-neutral-400 shrink-0" />
                    : <ChevronRight size={14} className="text-neutral-400 shrink-0" />}
                  <span className="font-mono text-xs text-neutral-500">{chunk.chunk_id}</span>
                  <span className="text-sm text-neutral-700 font-medium">{chunk.nodes.length} nodes</span>
                </button>
                {open && (
                  <div className="px-3 pb-3">
                    <NodeList nodes={chunk.nodes} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
