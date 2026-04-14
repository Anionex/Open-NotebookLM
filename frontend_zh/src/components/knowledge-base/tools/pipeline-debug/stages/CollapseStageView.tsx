import React, { useState } from 'react';
import { KnowledgeNode } from '../types';
import { StatCard } from '../shared/StatCard';
import { NodeList } from '../shared/NodeList';

interface CollapseStageViewProps {
  rounds: KnowledgeNode[][];
}

export const CollapseStageView: React.FC<CollapseStageViewProps> = ({ rounds }) => {
  const [activeRound, setActiveRound] = useState(rounds.length - 1);

  if (rounds.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500 text-sm">
        Collapse was skipped — all nodes fit within context window.
      </div>
    );
  }

  const maxNodes = Math.max(...rounds.map(r => r.length), 1);

  return (
    <div className="space-y-6">
      {/* Round summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={rounds.length} label="Rounds" />
        <StatCard value={rounds[0]?.length || 0} label="Initial Nodes" />
        <StatCard value={rounds[rounds.length - 1]?.length || 0} label="Final Nodes" />
      </div>

      {/* Node count reduction chart */}
      <div>
        <h4 className="text-sm font-medium text-neutral-700 mb-2">Node Count by Round</h4>
        <div className="flex items-end gap-2 h-24">
          {rounds.map((round, i) => (
            <button
              key={i}
              onClick={() => setActiveRound(i)}
              className={`flex-1 flex flex-col items-center gap-1 group`}
            >
              <span className="text-xs font-mono text-neutral-500">{round.length}</span>
              <div
                className={`w-full rounded-t transition-colors ${
                  i === activeRound ? 'bg-rose-400' : 'bg-neutral-300 group-hover:bg-neutral-400'
                }`}
                style={{ height: `${(round.length / maxNodes) * 72}px`, minHeight: '8px' }}
              />
              <span className="text-xs text-neutral-400">R{i + 1}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Round selector tabs */}
      <div>
        <div className="flex gap-1 mb-3 border-b border-neutral-200">
          {rounds.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveRound(i)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                i === activeRound
                  ? 'text-rose-600 border-rose-500'
                  : 'text-neutral-400 border-transparent hover:text-neutral-600'
              }`}
            >
              Round {i + 1}
            </button>
          ))}
        </div>
        <NodeList nodes={rounds[activeRound] || []} />
      </div>
    </div>
  );
};
