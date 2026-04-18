import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { KnowledgeNode } from '../types';
import { ImportanceBadge } from './ImportanceBadge';

interface NodeListProps {
  nodes: KnowledgeNode[];
  maxInitial?: number;
}

export const NodeList: React.FC<NodeListProps> = ({ nodes, maxInitial = 50 }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(nodes.length <= maxInitial);

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const visible = showAll ? nodes : nodes.slice(0, maxInitial);

  return (
    <div className="space-y-1">
      {visible.map(node => {
        const open = expandedIds.has(node.node_id);
        return (
          <div key={node.node_id} className="border border-neutral-100 rounded-lg">
            <button
              onClick={() => toggle(node.node_id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 transition-colors"
            >
              {open ? <ChevronDown size={14} className="text-neutral-400 shrink-0" /> : <ChevronRight size={14} className="text-neutral-400 shrink-0" />}
              <ImportanceBadge score={node.importance_score} />
              <span className="text-sm font-medium text-neutral-800 truncate">{node.topic}</span>
              {node.parent_topic !== 'ROOT' && (
                <span className="text-xs text-neutral-400 truncate ml-auto shrink-0">← {node.parent_topic}</span>
              )}
            </button>
            {open && (
              <div className="px-3 pb-2 pl-12 space-y-1">
                <p className="text-xs text-neutral-600">{node.summary}</p>
                <p className="text-xs text-neutral-400">source: {node.source_chunk_id} | id: {node.node_id}</p>
              </div>
            )}
          </div>
        );
      })}
      {!showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full text-center text-xs text-blue-600 hover:text-blue-800 py-2"
        >
          Show all {nodes.length} nodes ({nodes.length - maxInitial} more)
        </button>
      )}
    </div>
  );
};
