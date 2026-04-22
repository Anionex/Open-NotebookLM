import React, { useState } from 'react';
import { List, GitBranch } from 'lucide-react';
import { KnowledgeNode } from '../types';
import { StatCard } from '../shared/StatCard';
import { NodeList } from '../shared/NodeList';
import { TopicTree } from '../shared/TopicTree';

interface ReduceInputStageViewProps {
  data: KnowledgeNode[];
}

export const ReduceInputStageView: React.FC<ReduceInputStageViewProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  const rootTopics = data.filter(n => n.parent_topic === 'ROOT').length;

  // Importance distribution
  const dist: Record<number, number> = {};
  for (const n of data) {
    const s = Math.max(1, Math.min(5, Math.round(n.importance_score)));
    dist[s] = (dist[s] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={data.length} label="Total Nodes" />
        <StatCard value={rootTopics} label="Root Topics" />
        <StatCard value={`${dist[5] || 0} / ${dist[4] || 0} / ${dist[3] || 0}`} label="Score 5 / 4 / 3" />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-500">View:</span>
        <button
          onClick={() => setViewMode('tree')}
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
            viewMode === 'tree' ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          <GitBranch size={12} /> Tree
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
            viewMode === 'list' ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          <List size={12} /> List
        </button>
      </div>

      {/* Content */}
      {viewMode === 'tree' ? (
        <TopicTree nodes={data} />
      ) : (
        <NodeList nodes={[...data].sort((a, b) => b.importance_score - a.importance_score)} />
      )}
    </div>
  );
};
