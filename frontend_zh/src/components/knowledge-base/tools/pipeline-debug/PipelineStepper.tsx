import React from 'react';
import { GitBranch, Layers, Shrink, Filter, FileText } from 'lucide-react';
import { PipelineStage } from './types';

const STAGES: { key: PipelineStage; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { key: 'routing', label: 'Routing', icon: GitBranch },
  { key: 'map', label: 'Map', icon: Layers },
  { key: 'collapse', label: 'Collapse', icon: Shrink },
  { key: 'reduce', label: 'Reduce', icon: Filter },
  { key: 'output', label: 'Output', icon: FileText },
];

interface PipelineStepperProps {
  activeStage: PipelineStage;
  availableStages: Set<PipelineStage>;
  onStageClick: (stage: PipelineStage) => void;
}

export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  activeStage,
  availableStages,
  onStageClick,
}) => {
  return (
    <div className="flex items-center justify-center gap-0">
      {STAGES.map((stage, i) => {
        const available = availableStages.has(stage.key);
        const active = stage.key === activeStage;
        const Icon = stage.icon;

        return (
          <React.Fragment key={stage.key}>
            {i > 0 && (
              <div className={`w-8 h-px mx-1 ${available ? 'bg-neutral-300' : 'border-t border-dashed border-neutral-300'}`} />
            )}
            <button
              onClick={() => available && onStageClick(stage.key)}
              disabled={!available}
              className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                active
                  ? 'bg-rose-50 ring-2 ring-rose-400'
                  : available
                    ? 'hover:bg-neutral-50 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                active
                  ? 'bg-rose-500 text-white'
                  : available
                    ? 'bg-neutral-200 text-neutral-600'
                    : 'bg-neutral-100 text-neutral-400'
              }`}>
                <Icon size={16} />
              </div>
              <span className={`text-xs font-medium ${
                active ? 'text-rose-600' : available ? 'text-neutral-600' : 'text-neutral-400'
              }`}>
                {stage.label}
              </span>
              {!available && (
                <span className="text-[10px] text-neutral-400 -mt-1">Skipped</span>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};
