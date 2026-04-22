export type PipelineStage = 'routing' | 'map' | 'collapse' | 'reduce' | 'output';

export interface ChunkSummary {
  chunk_id: string;
  source: string;
  token_count: number;
}

export interface RoutingData {
  use_mapreduce: boolean;
  total_content_tokens: number;
  context_window_limit: number;
  model: string;
  file_count: number;
  file_tokens: number[];
  file_names: string[];
  chunk_count: number;
  chunks_summary: ChunkSummary[];
}

export interface KnowledgeNode {
  node_id: string;
  topic: string;
  parent_topic: string;
  summary: string;
  importance_score: number;
  source_chunk_id: string;
}

export interface MapChunkResult {
  chunk_id: string;
  nodes: KnowledgeNode[];
}

export interface PipelineDebugData {
  routing: RoutingData | null;
  mapResults: MapChunkResult[] | null;
  collapseRounds: KnowledgeNode[][];
  reduceInput: KnowledgeNode[] | null;
  mindmapMarkdown: string | null;
}
