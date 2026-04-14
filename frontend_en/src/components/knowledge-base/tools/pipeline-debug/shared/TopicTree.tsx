import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { KnowledgeNode } from '../types';
import { ImportanceBadge } from './ImportanceBadge';

interface TreeNode {
  node: KnowledgeNode;
  children: TreeNode[];
}

function buildTree(nodes: KnowledgeNode[]): TreeNode[] {
  const topicMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create tree nodes
  for (const n of nodes) {
    topicMap.set(n.topic, { node: n, children: [] });
  }

  // Link parent-child by matching parent_topic to topic
  for (const n of nodes) {
    const treeNode = topicMap.get(n.topic)!;
    if (n.parent_topic === 'ROOT' || !topicMap.has(n.parent_topic)) {
      roots.push(treeNode);
    } else {
      topicMap.get(n.parent_topic)!.children.push(treeNode);
    }
  }

  return roots;
}

const TreeItem: React.FC<{ item: TreeNode; depth: number }> = ({ item, depth }) => {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = item.children.length > 0;

  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className="flex items-center gap-1.5 py-1 hover:bg-neutral-50 rounded w-full text-left"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {hasChildren ? (
          open ? <ChevronDown size={12} className="text-neutral-400 shrink-0" /> : <ChevronRight size={12} className="text-neutral-400 shrink-0" />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <ImportanceBadge score={item.node.importance_score} />
        <span className="text-sm text-neutral-700 truncate">{item.node.topic}</span>
      </button>
      {open && item.children.map(child => (
        <TreeItem key={child.node.node_id} item={child} depth={depth + 1} />
      ))}
    </div>
  );
};

interface TopicTreeProps {
  nodes: KnowledgeNode[];
}

export const TopicTree: React.FC<TopicTreeProps> = ({ nodes }) => {
  const tree = buildTree(nodes);
  return (
    <div className="border border-neutral-200 rounded-lg p-2 max-h-[500px] overflow-y-auto">
      {tree.map(item => (
        <TreeItem key={item.node.node_id} item={item} depth={0} />
      ))}
    </div>
  );
};
