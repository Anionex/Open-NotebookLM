export type SummaryCardKind = 'item' | 'all';

export type SummaryCardListItem = {
  id: string;
  title: string;
  summary_kind?: SummaryCardKind | string;
};

export function getSummaryCardKind(item: SummaryCardListItem): SummaryCardKind {
  return item.summary_kind === 'all' ? 'all' : 'item';
}

export function splitSummaryCards<T extends SummaryCardListItem>(items: T[]) {
  const itemSummaries: T[] = [];
  let allSummary: T | null = null;

  items.forEach((item) => {
    if (getSummaryCardKind(item) === 'all') {
      if (!allSummary) allSummary = item;
      return;
    }
    itemSummaries.push(item);
  });

  return { itemSummaries, allSummary };
}
