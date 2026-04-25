type OutlineLike = {
  id?: string;
  pageNum?: number;
  title?: string;
  summary?: string;
  bullets?: string[];
  layout_description?: string;
  key_points?: string[];
  asset_ref?: string | null;
};

type OutlineDirectiveLike = {
  id?: string;
  scope?: string;
  type?: string;
  label?: string;
  instruction?: string;
  page_num?: number | null;
};

export type PptOutlineDiffKind = 'added' | 'removed' | 'modified';

export type PptOutlineDiffEntry = {
  key: string;
  kind: PptOutlineDiffKind;
  pageNum: number;
  title: string;
  detailLines: string[];
};

export type PptOutlineDiffResult = {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  totalCount: number;
  entries: PptOutlineDiffEntry[];
};

export type PptDirectiveDiffKind = 'added' | 'removed';

export type PptDirectiveDiffEntry = {
  key: string;
  kind: PptDirectiveDiffKind;
  label: string;
  type: string;
  pageNum?: number;
};

export type PptDirectiveDiffResult = {
  addedCount: number;
  removedCount: number;
  totalCount: number;
  entries: PptDirectiveDiffEntry[];
};

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizePoints(item: OutlineLike): string[] {
  const raw = Array.isArray(item.key_points) && item.key_points.length > 0 ? item.key_points : item.bullets;
  return Array.isArray(raw) ? raw.map((entry) => normalizeText(entry)).filter(Boolean) : [];
}

function signature(item: OutlineLike): string {
  return JSON.stringify({
    title: normalizeText(item.title),
    summary: normalizeText(item.summary || item.layout_description),
    points: normalizePoints(item),
    asset: normalizeText(item.asset_ref),
  });
}

function normalizeOutlineKey(item: OutlineLike, index: number): string {
  return normalizeText(item.id) || `${Number(item.pageNum) || index + 1}:${normalizeText(item.title)}`;
}

export function diffPptOutline(confirmedOutline: OutlineLike[] = [], draftOutline: OutlineLike[] = []): PptOutlineDiffResult {
  const beforeMap = new Map(confirmedOutline.map((item, index) => [normalizeOutlineKey(item, index), { item, index }]));
  const afterMap = new Map(draftOutline.map((item, index) => [normalizeOutlineKey(item, index), { item, index }]));
  const entries: PptOutlineDiffEntry[] = [];

  draftOutline.forEach((item, index) => {
    const key = normalizeOutlineKey(item, index);
    const before = beforeMap.get(key);
    const pageNum = Number(item.pageNum) || index + 1;
    const title = normalizeText(item.title) || `第 ${pageNum} 页`;
    if (!before) {
      entries.push({ key: `added_${key}`, kind: 'added', pageNum, title, detailLines: ['新增页面'] });
      return;
    }
    if (before.index !== index || signature(before.item) !== signature(item)) {
      entries.push({ key: `modified_${key}`, kind: 'modified', pageNum, title, detailLines: ['页面内容已调整'] });
    }
  });

  confirmedOutline.forEach((item, index) => {
    const key = normalizeOutlineKey(item, index);
    if (!afterMap.has(key)) {
      const pageNum = Number(item.pageNum) || index + 1;
      entries.push({
        key: `removed_${key}`,
        kind: 'removed',
        pageNum,
        title: normalizeText(item.title) || `第 ${pageNum} 页`,
        detailLines: ['该页面将从正式大纲中移除'],
      });
    }
  });

  const addedCount = entries.filter((entry) => entry.kind === 'added').length;
  const removedCount = entries.filter((entry) => entry.kind === 'removed').length;
  const modifiedCount = entries.filter((entry) => entry.kind === 'modified').length;
  return { addedCount, removedCount, modifiedCount, totalCount: entries.length, entries };
}

function normalizeDirective(item: OutlineDirectiveLike, index: number) {
  return {
    id: normalizeText(item.id) || `directive_${index}`,
    scope: normalizeText(item.scope) || 'global',
    type: normalizeText(item.type) || 'custom',
    label: normalizeText(item.label || item.instruction),
    pageNum: Number(item.page_num) || undefined,
  };
}

export function diffPptGlobalDirectives(
  confirmedDirectives: OutlineDirectiveLike[] = [],
  draftDirectives: OutlineDirectiveLike[] = [],
): PptDirectiveDiffResult {
  const before = confirmedDirectives.map(normalizeDirective).filter((item) => item.label);
  const after = draftDirectives.map(normalizeDirective).filter((item) => item.label);
  const beforeKeys = new Set(before.map((item) => `${item.scope}:${item.type}:${item.label}:${item.pageNum || ''}`));
  const afterKeys = new Set(after.map((item) => `${item.scope}:${item.type}:${item.label}:${item.pageNum || ''}`));
  const entries: PptDirectiveDiffEntry[] = [];

  after.forEach((item) => {
    const key = `${item.scope}:${item.type}:${item.label}:${item.pageNum || ''}`;
    if (!beforeKeys.has(key)) {
      entries.push({ key: `directive_added_${item.id}`, kind: 'added', label: item.label, type: item.type, pageNum: item.pageNum });
    }
  });
  before.forEach((item) => {
    const key = `${item.scope}:${item.type}:${item.label}:${item.pageNum || ''}`;
    if (!afterKeys.has(key)) {
      entries.push({ key: `directive_removed_${item.id}`, kind: 'removed', label: item.label, type: item.type, pageNum: item.pageNum });
    }
  });

  return {
    addedCount: entries.filter((item) => item.kind === 'added').length,
    removedCount: entries.filter((item) => item.kind === 'removed').length,
    totalCount: entries.length,
    entries,
  };
}

export function getPptOutlineDiffKindLabel(kind: PptOutlineDiffKind): string {
  if (kind === 'added') return '新增';
  if (kind === 'removed') return '删除';
  return '修改';
}

export function getPptDirectiveDiffKindLabel(kind: PptDirectiveDiffKind): string {
  return kind === 'added' ? '新增规则' : '移除规则';
}
