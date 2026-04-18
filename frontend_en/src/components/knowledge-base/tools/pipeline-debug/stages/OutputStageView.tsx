import React from 'react';
import { StatCard } from '../shared/StatCard';

interface OutputStageViewProps {
  markdown: string;
}

interface HeadingNode {
  level: number;
  text: string;
  children: HeadingNode[];
}

function parseMarkdown(md: string) {
  const lines = md.split('\n').filter(l => l.trim().startsWith('#'));
  const depthDist: Record<number, number> = {};
  let branchCount = 0;
  let maxDepth = 0;
  const headings: { level: number; text: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].trim();
    headings.push({ level, text });
    depthDist[level] = (depthDist[level] || 0) + 1;
    if (level === 2) branchCount++;
    if (level > maxDepth) maxDepth = level;
  }

  // Build tree for first 3 levels
  const tree: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  for (const h of headings) {
    if (h.level > 4) continue; // Show up to ####
    const node: HeadingNode = { level: h.level, text: h.text, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      tree.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  return { totalNodes: headings.length, branchCount, maxDepth, depthDist, tree };
}

const TreePreview: React.FC<{ nodes: HeadingNode[]; depth?: number }> = ({ nodes, depth = 0 }) => (
  <div>
    {nodes.map((node, i) => (
      <div key={i}>
        <div
          className="flex items-center gap-1.5 py-0.5"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          <span className={`text-xs font-mono w-6 text-center rounded ${
            node.level === 1 ? 'bg-neutral-800 text-white' :
            node.level === 2 ? 'bg-neutral-600 text-white' :
            node.level === 3 ? 'bg-neutral-300 text-neutral-700' :
            'bg-neutral-100 text-neutral-500'
          }`}>
            {'#'.repeat(node.level)}
          </span>
          <span className={`text-sm ${node.level <= 2 ? 'font-medium text-neutral-800' : 'text-neutral-600'}`}>
            {node.text}
          </span>
        </div>
        {node.children.length > 0 && <TreePreview nodes={node.children} depth={depth + 1} />}
      </div>
    ))}
  </div>
);

export const OutputStageView: React.FC<OutputStageViewProps> = ({ markdown }) => {
  const { totalNodes, branchCount, maxDepth, depthDist, tree } = parseMarkdown(markdown);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={totalNodes} label="Total Nodes" />
        <StatCard value={branchCount} label="Main Branches" />
        <StatCard value={maxDepth} label="Max Depth" />
      </div>

      {/* Depth distribution */}
      <div>
        <h4 className="text-sm font-medium text-neutral-700 mb-2">Depth Distribution</h4>
        <div className="space-y-1">
          {Object.entries(depthDist)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([level, count]) => {
              const maxCount = Math.max(...Object.values(depthDist), 1);
              return (
                <div key={level} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-neutral-500 w-8 text-right">{'#'.repeat(Number(level))}</span>
                  <div className="flex-1 h-5 bg-neutral-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-neutral-400 rounded"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-neutral-500 w-8">{count}</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Heading hierarchy preview */}
      <div>
        <h4 className="text-sm font-medium text-neutral-700 mb-2">Structure Preview</h4>
        <div className="border border-neutral-200 rounded-lg p-3 max-h-[400px] overflow-y-auto">
          <TreePreview nodes={tree} />
        </div>
      </div>
    </div>
  );
};
