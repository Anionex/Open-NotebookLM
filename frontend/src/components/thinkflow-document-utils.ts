export type ThinkFlowDocumentSection = {
  id: string;
  heading: string;
  content: string;
  lineStart: number;
  lineEnd: number;
};

export type ThinkFlowFocusState = {
  type: 'full' | 'sections' | 'stash' | 'stash_item';
  section_ids: string[];
  stash_item_ids: string[];
  description: string;
};

export type StructuredPushTargetType = 'focus' | 'section' | 'new_section' | 'stash' | 'document_end';
export type StructuredPushTransform = 'raw_append' | 'ai_append' | 'ai_merge';
export type PushSourceSummaryEntry = {
  messageId?: string;
  role?: 'user' | 'assistant' | string;
  kind?: 'message' | 'selection' | 'qa' | 'multi' | string;
};

export function buildMarkdownSectionId(heading: string, occurrence: number): string {
  const slug =
    String(heading || '')
      .trim()
      .replace(/[^\w\u4e00-\u9fff-]+/gu, '-')
      .replace(/-+/gu, '-')
      .replace(/^-|-$/gu, '')
      .toLowerCase() || 'section';
  return `section-${slug}-${occurrence}`;
}

export function parseMarkdownSections(content: string, headingLevel = 2): ThinkFlowDocumentSection[] {
  const lines = String(content || '').split('\n');
  const headings: Array<{ index: number; heading: string }> = [];
  const level = Math.min(6, Math.max(1, Math.floor(Number(headingLevel) || 2)));
  const headingPattern = new RegExp(`^#{${level}}\\s+(.+?)\\s*$`, 'u');
  lines.forEach((line, index) => {
    const match = line.match(headingPattern);
    if (match) {
      headings.push({ index, heading: match[1].trim() });
    }
  });

  const counts: Record<string, number> = {};
  return headings.map((entry, index) => {
    const occurrence = (counts[entry.heading] || 0) + 1;
    counts[entry.heading] = occurrence;
    const next = headings[index + 1]?.index ?? lines.length;
    return {
      id: buildMarkdownSectionId(entry.heading, occurrence),
      heading: entry.heading,
      content: lines.slice(entry.index, next).join('\n').trim(),
      lineStart: entry.index + 1,
      lineEnd: next,
    };
  });
}

export function detectMarkdownModuleHeadingLevel(content: string): number {
  const counts: Record<number, number> = {};
  String(content || '').split('\n').forEach((line) => {
    const match = line.match(/^(#{1,6})\s+.+?\s*$/u);
    if (!match) return;
    const level = match[1].length;
    counts[level] = (counts[level] || 0) + 1;
  });
  for (let level = 1; level <= 6; level += 1) {
    if ((counts[level] || 0) >= 2) return level;
  }
  for (let level = 1; level <= 6; level += 1) {
    if ((counts[level] || 0) > 0) return level;
  }
  return 2;
}

export function normalizeFocusState(focusState?: Partial<ThinkFlowFocusState> | null): ThinkFlowFocusState {
  const focusType = focusState?.type;
  const type = focusType === 'sections' || focusType === 'stash' || focusType === 'stash_item' ? focusType : 'full';
  const sectionIds = Array.isArray(focusState?.section_ids)
    ? focusState.section_ids.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const stashItemIds = Array.isArray(focusState?.stash_item_ids)
    ? focusState.stash_item_ids.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const description = String(focusState?.description || '').trim() || (type === 'full' ? '焦点：全文' : '焦点：自定义');
  return {
    type,
    section_ids: sectionIds,
    stash_item_ids: stashItemIds,
    description,
  };
}

export function getDefaultPushTarget(focusState?: Partial<ThinkFlowFocusState> | null): StructuredPushTargetType {
  const focus = normalizeFocusState(focusState);
  if (focus.type === 'sections' && focus.section_ids.length > 0) return 'focus';
  if (focus.type === 'stash' || (focus.type === 'stash_item' && focus.stash_item_ids.length > 0)) return 'focus';
  return 'document_end';
}

export function canUsePushTransform(targetType: StructuredPushTargetType, transform: StructuredPushTransform): boolean {
  if (transform !== 'ai_merge') return true;
  return targetType === 'focus' || targetType === 'section';
}

export function coercePushTransform(targetType: StructuredPushTargetType, transform: StructuredPushTransform): StructuredPushTransform {
  return canUsePushTransform(targetType, transform) ? transform : 'ai_append';
}

export function resolveActivePushDocumentId(params: {
  conversationActiveDocumentId?: string;
  activeDocumentId?: string;
  firstDocumentId?: string;
}): string {
  return (
    String(params.conversationActiveDocumentId || '').trim()
    || String(params.activeDocumentId || '').trim()
    || String(params.firstDocumentId || '').trim()
  );
}

export function buildPushSourceSummary(entries: PushSourceSummaryEntry[]): {
  count: number;
  roleLabel: string;
  kindLabel: string;
  label: string;
} {
  const deduped = Array.from(
    new Map(
      entries.map((entry, index) => {
        const key = String(entry.messageId || '').trim() || `entry-${index}`;
        return [key, entry];
      }),
    ).values(),
  );
  const roles = deduped.map((entry) => entry.role);
  const roleParts = [
    roles.includes('user') ? '用户' : '',
    roles.includes('assistant') ? 'AI' : '',
  ].filter(Boolean);
  const kinds = deduped.map((entry) => entry.kind);
  const kindLabel = kinds.includes('qa')
    ? '本轮'
    : kinds.includes('multi')
      ? '多选'
      : kinds.includes('selection')
        ? '划词'
        : '单条';
  const roleLabel = roleParts.join(' + ') || '消息';
  const count = deduped.length;
  return {
    count,
    roleLabel,
    kindLabel,
    label: `${count} 条消息 · ${roleLabel} · ${kindLabel}`,
  };
}

function parseThinkFlowDate(value?: string | number | Date | null): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = String(value || '').trim();
  if (!text) return null;
  const timeOnlyMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeOnlyMatch) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function beijingParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
}

export function formatThinkFlowTime(value?: string | number | Date | null): string {
  const raw = String(value || '').trim();
  const timeOnlyMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeOnlyMatch) return `${timeOnlyMatch[1].padStart(2, '0')}:${timeOnlyMatch[2]}`;
  const date = parseThinkFlowDate(value);
  if (!date) return raw;
  const parts = beijingParts(date);
  return `${parts.hour}:${parts.minute}`;
}

export function formatThinkFlowDateTime(value?: string | number | Date | null): string {
  const date = parseThinkFlowDate(value);
  if (!date) return String(value || '').trim();
  const parts = beijingParts(date);
  return `${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute}`;
}
