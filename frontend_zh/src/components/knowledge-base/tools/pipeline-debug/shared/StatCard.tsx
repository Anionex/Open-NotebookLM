import React from 'react';

interface StatCardProps {
  value: string | number;
  label: string;
}

export const StatCard: React.FC<StatCardProps> = ({ value, label }) => (
  <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-center">
    <div className="font-mono font-semibold text-xl text-neutral-800">
      {typeof value === 'number' ? value.toLocaleString() : value}
    </div>
    <div className="text-xs text-neutral-500 mt-0.5">{label}</div>
  </div>
);
