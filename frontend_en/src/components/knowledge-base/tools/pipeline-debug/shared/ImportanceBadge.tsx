import React from 'react';

const colorMap: Record<number, string> = {
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-cyan-100 text-cyan-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-orange-100 text-orange-700',
  5: 'bg-red-100 text-red-700',
};

interface ImportanceBadgeProps {
  score: number;
}

export const ImportanceBadge: React.FC<ImportanceBadgeProps> = ({ score }) => {
  const clamped = Math.max(1, Math.min(5, Math.round(score)));
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold shrink-0 ${colorMap[clamped]}`}>
      {clamped}
    </span>
  );
};
