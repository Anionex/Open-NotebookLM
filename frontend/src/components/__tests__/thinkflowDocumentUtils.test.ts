import { describe, expect, it } from 'vitest';

import {
  buildPushSourceSummary,
  buildMarkdownSectionId,
  canUsePushTransform,
  detectMarkdownModuleHeadingLevel,
  formatThinkFlowDateTime,
  formatThinkFlowTime,
  getDefaultPushTarget,
  parseMarkdownSections,
  resolveActivePushDocumentId,
} from '../thinkflow-document-utils';

describe('thinkflow document utils', () => {
  it('parses markdown sections with backend-compatible heading ids', () => {
    const sections = parseMarkdownSections('# 竞品\n\n## 市场\n\n内容\n\n## 市场\n\n补充\n\n## Pricing & GTM\n\nText');

    expect(sections.map((section) => section.id)).toEqual([
      'section-市场-1',
      'section-市场-2',
      'section-pricing-gtm-1',
    ]);
    expect(buildMarkdownSectionId('市场', 1)).toBe('section-市场-1');
    expect(sections[0].lineStart).toBe(3);
  });

  it('can parse output document modules by first-level headings', () => {
    const sections = parseMarkdownSections('# 执行摘要\n\n内容\n\n## 细节\n\n更多\n\n# 技术路线\n\n正文', 1);

    expect(sections.map((section) => section.heading)).toEqual(['执行摘要', '技术路线']);
    expect(sections[0].content).toContain('## 细节');
    expect(sections[1].lineStart).toBe(9);
  });

  it('detects module heading level below a single document title', () => {
    const content = '# 总标题\n\n### 模块一\n\n内容\n\n### 模块二\n\n内容';

    expect(detectMarkdownModuleHeadingLevel(content)).toBe(3);
    expect(parseMarkdownSections(content, detectMarkdownModuleHeadingLevel(content)).map((section) => section.heading)).toEqual(['模块一', '模块二']);
  });

  it('defaults push target to focus only when focus is concrete', () => {
    expect(getDefaultPushTarget({ type: 'full', section_ids: [], stash_item_ids: [], description: '焦点：全文' })).toBe('document_end');
    expect(getDefaultPushTarget({ type: 'sections', section_ids: ['section-市场-1'], stash_item_ids: [], description: '焦点：市场' })).toBe('focus');
    expect(getDefaultPushTarget({ type: 'stash', section_ids: [], stash_item_ids: [], description: '焦点：暂存区' })).toBe('focus');
  });

  it('restricts ai merge to existing section-like targets', () => {
    expect(canUsePushTransform('section', 'ai_merge')).toBe(true);
    expect(canUsePushTransform('focus', 'ai_merge')).toBe(true);
    expect(canUsePushTransform('stash', 'ai_merge')).toBe(false);
    expect(canUsePushTransform('new_section', 'ai_merge')).toBe(false);
    expect(canUsePushTransform('document_end', 'ai_merge')).toBe(false);
  });

  it('resolves push target document from conversation active document first', () => {
    expect(resolveActivePushDocumentId({
      conversationActiveDocumentId: 'doc-active',
      activeDocumentId: 'doc-visible',
      firstDocumentId: 'doc-first',
    })).toBe('doc-active');
    expect(resolveActivePushDocumentId({
      activeDocumentId: 'doc-visible',
      firstDocumentId: 'doc-first',
    })).toBe('doc-visible');
    expect(resolveActivePushDocumentId({
      firstDocumentId: 'doc-first',
    })).toBe('doc-first');
  });

  it('deduplicates push source entries into a compact summary', () => {
    expect(buildPushSourceSummary([
      { messageId: 'm1', role: 'user', kind: 'multi' },
      { messageId: 'm1', role: 'user', kind: 'multi' },
      { messageId: 'm2', role: 'assistant', kind: 'qa' },
    ])).toEqual({
      count: 2,
      roleLabel: '用户 + AI',
      kindLabel: '本轮',
      label: '2 条消息 · 用户 + AI · 本轮',
    });
  });

  it('formats UTC timestamps as Beijing display time', () => {
    expect(formatThinkFlowTime('2026-04-27T07:30:12Z')).toBe('15:30');
    expect(formatThinkFlowTime('15:30:12')).toBe('15:30');
    expect(formatThinkFlowDateTime('2026-04-27T07:30:12Z')).toBe('4月27日 15:30');
  });
});
