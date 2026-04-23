import { describe, it, expect } from 'vitest';
import { mergeOutlineWithManualEdits, buildEditLogSummary, formatConflictToast } from '../pptOutlineMerge';
import type { OutlineSection, ManualEditLog } from '../thinkflow-types';

function makeSection(overrides: Partial<OutlineSection> & { id: string; title: string }): OutlineSection {
  return { key_points: [], layout_description: '', asset_ref: null, ...overrides };
}

describe('mergeOutlineWithManualEdits', () => {
  it('uses draft value when no manual edit on that field', () => {
    const confirmed = [makeSection({ id: '1', title: 'Old Title' })];
    const draft = [makeSection({ id: '1', title: 'AI Title' })];
    const edits: ManualEditLog[] = [];
    const { merged, conflicts } = mergeOutlineWithManualEdits(confirmed, draft, edits);
    expect(merged[0].title).toBe('AI Title');
    expect(conflicts).toHaveLength(0);
  });

  it('keeps manual edit when draft did not change that field', () => {
    const confirmed = [makeSection({ id: '1', title: 'Original' })];
    const draft = [makeSection({ id: '1', title: 'Original' })];
    const edits: ManualEditLog[] = [
      { page_index: 0, fields: ['title'], summary: '第1页(标题)', timestamp: new Date().toISOString() },
    ];
    const { merged } = mergeOutlineWithManualEdits(confirmed, draft, edits);
    // When draft didn't change the field but manual did, keep the confirmed version
    // (which is what the user sees after their manual edit)
    expect(merged[0].title).toBe('Original');
  });

  it('draft wins on conflict, records it', () => {
    const confirmed = [makeSection({ id: '1', title: 'Base' })];
    const draft = [makeSection({ id: '1', title: 'AI Version' })];
    const edits: ManualEditLog[] = [
      { page_index: 0, fields: ['title'], summary: '第1页(标题)', timestamp: new Date().toISOString() },
    ];
    const { merged, conflicts } = mergeOutlineWithManualEdits(confirmed, draft, edits);
    expect(merged[0].title).toBe('AI Version');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].field).toBe('title');
  });

  it('preserves new pages from draft', () => {
    const confirmed = [makeSection({ id: '1', title: 'Page 1' })];
    const draft = [makeSection({ id: '1', title: 'Page 1' }), makeSection({ id: '2', title: 'New Page' })];
    const { merged } = mergeOutlineWithManualEdits(confirmed, draft, []);
    expect(merged).toHaveLength(2);
    expect(merged[1].title).toBe('New Page');
  });
});

describe('buildEditLogSummary', () => {
  it('joins multiple edit summaries', () => {
    const logs: ManualEditLog[] = [
      { page_index: 2, fields: ['title', 'key_points'], summary: '第3页(标题、要点)', timestamp: '' },
      { page_index: 4, fields: ['title'], summary: '第5页(标题)', timestamp: '' },
    ];
    expect(buildEditLogSummary(logs)).toBe('手动修改了大纲: 第3页(标题、要点)、第5页(标题)');
  });

  it('returns empty for no logs', () => {
    expect(buildEditLogSummary([])).toBe('');
  });
});

describe('formatConflictToast', () => {
  it('formats single conflict', () => {
    const result = formatConflictToast([{ page_index: 2, field: 'title', draft_value: '', manual_value: '' }]);
    expect(result).toContain('第3页');
    expect(result).toContain('标题');
  });

  it('formats multiple conflicts', () => {
    const result = formatConflictToast([
      { page_index: 0, field: 'title', draft_value: '', manual_value: '' },
      { page_index: 1, field: 'key_points', draft_value: '', manual_value: '' },
    ]);
    expect(result).toContain('2处');
  });
});
