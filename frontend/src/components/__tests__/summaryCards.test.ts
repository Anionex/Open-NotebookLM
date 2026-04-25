import { describe, expect, it } from 'vitest';

import { splitSummaryCards } from '../summaryCards';

describe('splitSummaryCards', () => {
  it('separates the all summary card from item summary cards', () => {
    const result = splitSummaryCards([
      { id: 'item-1', title: '受众', summary_kind: 'item' },
      { id: 'all-1', title: 'All Summary', summary_kind: 'all' },
      { id: 'legacy-1', title: '旧摘要' },
    ]);

    expect(result.allSummary?.id).toBe('all-1');
    expect(result.itemSummaries.map((item) => item.id)).toEqual(['item-1', 'legacy-1']);
  });
});
