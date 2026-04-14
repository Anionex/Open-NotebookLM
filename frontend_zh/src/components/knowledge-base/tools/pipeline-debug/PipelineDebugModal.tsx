import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from '../../../ui/Modal';
import { apiFetch } from '../../../../config/api';
import { PipelineStage, PipelineDebugData, RoutingData, MapChunkResult, KnowledgeNode } from './types';
import { PipelineStepper } from './PipelineStepper';
import { RoutingStageView } from './stages/RoutingStageView';
import { MapStageView } from './stages/MapStageView';
import { CollapseStageView } from './stages/CollapseStageView';
import { ReduceInputStageView } from './stages/ReduceInputStageView';
import { OutputStageView } from './stages/OutputStageView';

interface PipelineDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  resultPath: string;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await apiFetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await apiFetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export const PipelineDebugModal: React.FC<PipelineDebugModalProps> = ({
  isOpen,
  onClose,
  resultPath,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PipelineDebugData>({
    routing: null,
    mapResults: null,
    collapseRounds: [],
    reduceInput: null,
    mindmapMarkdown: null,
  });
  const [activeStage, setActiveStage] = useState<PipelineStage>('routing');

  const debugBase = `${resultPath}/debug`;

  const loadData = useCallback(async () => {
    setLoading(true);

    // Fetch routing first to know the path
    const [routing, mindmap] = await Promise.all([
      fetchJson<RoutingData>(`${debugBase}/01_routing.json`),
      fetchText(`${resultPath}/mindmap.mmd`),
    ]);

    const result: PipelineDebugData = {
      routing,
      mapResults: null,
      collapseRounds: [],
      reduceInput: null,
      mindmapMarkdown: mindmap,
    };

    // If MapReduce, fetch remaining files
    if (routing?.use_mapreduce) {
      const [mapResults, reduceInput] = await Promise.all([
        fetchJson<MapChunkResult[]>(`${debugBase}/02_map_results.json`),
        fetchJson<KnowledgeNode[]>(`${debugBase}/04_reduce_input.json`),
      ]);
      result.mapResults = mapResults;
      result.reduceInput = reduceInput;

      // Scan collapse rounds (1-5)
      const rounds: KnowledgeNode[][] = [];

      // Try skipped first
      const skipped = await fetchJson<KnowledgeNode[]>(`${debugBase}/03_collapse_skipped_all_nodes.json`);
      if (skipped) {
        rounds.push(skipped);
      } else {
        for (let i = 1; i <= 5; i++) {
          const round = await fetchJson<KnowledgeNode[]>(`${debugBase}/03_collapse_round${i}.json`);
          if (!round) break;
          rounds.push(round);
        }
      }
      result.collapseRounds = rounds;
    }

    setData(result);
    setLoading(false);

    // Auto-select first available stage
    if (!routing) {
      setActiveStage('output');
    } else {
      setActiveStage('routing');
    }
  }, [debugBase, resultPath]);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  // Compute available stages
  const availableStages = new Set<PipelineStage>();
  if (data.routing) availableStages.add('routing');
  if (data.mapResults) availableStages.add('map');
  if (data.collapseRounds.length > 0) availableStages.add('collapse');
  if (data.reduceInput) availableStages.add('reduce');
  if (data.mindmapMarkdown) availableStages.add('output');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pipeline Debug"
      subtitle={data.routing ? (data.routing.use_mapreduce ? 'MapReduce path' : 'Single-pass path') : undefined}
      size="full"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stepper */}
          <PipelineStepper
            activeStage={activeStage}
            availableStages={availableStages}
            onStageClick={setActiveStage}
          />

          {/* Divider */}
          <div className="border-t border-neutral-200" />

          {/* Stage content */}
          <div className="min-h-[300px]">
            {activeStage === 'routing' && data.routing && (
              <RoutingStageView data={data.routing} />
            )}
            {activeStage === 'map' && data.mapResults && (
              <MapStageView data={data.mapResults} />
            )}
            {activeStage === 'collapse' && (
              <CollapseStageView rounds={data.collapseRounds} />
            )}
            {activeStage === 'reduce' && data.reduceInput && (
              <ReduceInputStageView data={data.reduceInput} />
            )}
            {activeStage === 'output' && data.mindmapMarkdown && (
              <OutputStageView markdown={data.mindmapMarkdown} />
            )}
            {!availableStages.has(activeStage) && (
              <div className="text-center py-12 text-neutral-400 text-sm">
                This stage was not executed (single-pass path).
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
