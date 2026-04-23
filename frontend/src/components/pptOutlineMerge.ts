import type { OutlineSection, ManualEditLog, MergeConflict } from './thinkflow-types';

const MERGE_FIELDS = ['title', 'layout_description', 'key_points', 'asset_ref'] as const;
type MergeField = (typeof MERGE_FIELDS)[number];

function fieldChanged(a: OutlineSection, b: OutlineSection, field: MergeField): boolean {
  const va = JSON.stringify(a[field] ?? '');
  const vb = JSON.stringify(b[field] ?? '');
  return va !== vb;
}

export function mergeOutlineWithManualEdits(
  confirmed: OutlineSection[],
  draft: OutlineSection[],
  manualEdits: ManualEditLog[],
): { merged: OutlineSection[]; conflicts: MergeConflict[] } {
  const conflicts: MergeConflict[] = [];
  const editsByPage = new Map<number, Set<string>>();
  for (const edit of manualEdits) {
    const existing = editsByPage.get(edit.page_index) ?? new Set();
    for (const f of edit.fields) existing.add(f);
    editsByPage.set(edit.page_index, existing);
  }

  const merged: OutlineSection[] = draft.map((draftPage, idx) => {
    const confirmedPage = confirmed[idx];
    if (!confirmedPage) return { ...draftPage };

    const editedFields = editsByPage.get(idx);
    if (!editedFields) return { ...draftPage };

    const result = { ...draftPage };
    for (const field of MERGE_FIELDS) {
      const draftChanged = fieldChanged(confirmedPage, draftPage, field);
      const manualChanged = editedFields.has(field);

      if (!draftChanged && manualChanged) {
        (result as any)[field] = confirmedPage[field];
      } else if (draftChanged && manualChanged) {
        conflicts.push({
          page_index: idx,
          field,
          draft_value: JSON.stringify(draftPage[field]),
          manual_value: JSON.stringify(confirmedPage[field]),
        });
      }
    }
    return result;
  });

  return { merged, conflicts };
}

export function buildEditLogSummary(logs: ManualEditLog[]): string {
  if (logs.length === 0) return '';
  const parts = logs.map((l) => l.summary);
  return `手动修改了大纲: ${parts.join('、')}`;
}

export function formatConflictToast(conflicts: MergeConflict[]): string {
  if (conflicts.length === 0) return '';
  const first = conflicts[0];
  const fieldLabel = first.field === 'title' ? '标题' : first.field === 'key_points' ? '要点' : first.field;
  if (conflicts.length === 1) {
    return `第${first.page_index + 1}页${fieldLabel}的手动修改被AI版本覆盖`;
  }
  return `${conflicts.length}处手动修改被AI版本覆盖`;
}
