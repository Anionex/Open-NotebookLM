import type { Block } from './types';

const defaultGenerateId = () => Math.random().toString(36).slice(2, 11);

export const parseMarkdownToBlocks = (
  text: string,
  generateId: () => string = defaultGenerateId,
): Block[] => {
  const lines = (text || '').split('\n');
  const newBlocks: Block[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let tableLines: string[] = [];

  const removeBold = (value: string) => value.replace(/\*\*(.*?)\*\*/g, '$1');

  const flushTable = () => {
    if (tableLines.length > 0) {
      newBlocks.push({ id: generateId(), type: 'table', content: tableLines.join('\n') });
      tableLines = [];
    }
  };

  lines.forEach(line => {
    if (line.startsWith('```')) {
      flushTable();
      if (inCodeBlock) {
        newBlocks.push({ id: generateId(), type: 'code', content: codeContent.trim() });
        codeContent = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
    } else if (inCodeBlock) {
      codeContent += `${line}\n`;
    } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      tableLines.push(line);
    } else {
      flushTable();
      if (line.startsWith('###### ')) {
        newBlocks.push({ id: generateId(), type: 'heading6', content: removeBold(line.slice(7)) });
      } else if (line.startsWith('##### ')) {
        newBlocks.push({ id: generateId(), type: 'heading5', content: removeBold(line.slice(6)) });
      } else if (line.startsWith('#### ')) {
        newBlocks.push({ id: generateId(), type: 'heading4', content: removeBold(line.slice(5)) });
      } else if (line.startsWith('### ')) {
        newBlocks.push({ id: generateId(), type: 'heading3', content: removeBold(line.slice(4)) });
      } else if (line.startsWith('## ')) {
        newBlocks.push({ id: generateId(), type: 'heading2', content: removeBold(line.slice(3)) });
      } else if (line.startsWith('# ')) {
        newBlocks.push({ id: generateId(), type: 'heading1', content: removeBold(line.slice(2)) });
      } else if (line.match(/^[-*+]\s/)) {
        newBlocks.push({ id: generateId(), type: 'bulletList', content: removeBold(line.slice(2)) });
      } else if (line.match(/^\d+\.\s/)) {
        newBlocks.push({ id: generateId(), type: 'numberedList', content: removeBold(line.replace(/^\d+\.\s+/, '')) });
      } else if (line.match(/^- \[[ xX]\]\s/)) {
        const checked = /^- \[[xX]\]\s/.test(line);
        newBlocks.push({
          id: generateId(),
          type: 'todo',
          content: removeBold(line.replace(/^- \[[ xX]\]\s+/, '')),
          checked,
        });
      } else if (line.startsWith('> ')) {
        newBlocks.push({ id: generateId(), type: 'quote', content: removeBold(line.slice(2)) });
      } else if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
        newBlocks.push({ id: generateId(), type: 'divider', content: '' });
      } else if (line.trim() === '') {
        // Skip empty lines between blocks.
      } else {
        newBlocks.push({ id: generateId(), type: 'text', content: removeBold(line) });
      }
    }
  });

  flushTable();
  if (inCodeBlock && codeContent.trim()) {
    newBlocks.push({ id: generateId(), type: 'code', content: codeContent.trim() });
  }

  return newBlocks.length > 0 ? newBlocks : [{ id: generateId(), type: 'text', content: text || '' }];
};

export const blocksToMarkdown = (blocks: Block[]): string => {
  let numIdx = 0;
  return blocks
    .map(block => {
      if (block.type !== 'numberedList') numIdx = 0;
      switch (block.type) {
        case 'heading1':
          return `# ${block.content}\n`;
        case 'heading2':
          return `## ${block.content}\n`;
        case 'heading3':
          return `### ${block.content}\n`;
        case 'heading4':
          return `#### ${block.content}\n`;
        case 'heading5':
          return `##### ${block.content}\n`;
        case 'heading6':
          return `###### ${block.content}\n`;
        case 'bulletList':
          return `- ${block.content}\n`;
        case 'numberedList':
          numIdx += 1;
          return `${numIdx}. ${block.content}\n`;
        case 'todo':
          return `- [${block.checked ? 'x' : ' '}] ${block.content}\n`;
        case 'quote':
          return `> ${block.content}\n`;
        case 'code':
          return `\`\`\`\n${block.content}\n\`\`\`\n`;
        case 'divider':
          return '---\n';
        case 'table':
          return `${block.content}\n\n`;
        default:
          return `${block.content}\n\n`;
      }
    })
    .join('');
};

export const extractNoteFromMarkdown = (markdown: string, fallbackTitle = '无标题') => {
  const normalized = (markdown || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let title = fallbackTitle;
  let coverImage: string | null = null;
  let titleRemoved = false;
  const bodyLines: string[] = [];

  for (const line of lines) {
    const imageMatch = line.match(/^!\[[^\]]*\]\((.+)\)$/);
    if (!coverImage && imageMatch) {
      coverImage = imageMatch[1];
      continue;
    }
    if (!titleRemoved && line.startsWith('# ')) {
      title = line.slice(2).trim() || fallbackTitle;
      titleRemoved = true;
      continue;
    }
    bodyLines.push(line);
  }

  const bodyMarkdown = bodyLines.join('\n').replace(/^\s+|\s+$/g, '');
  return {
    title,
    coverImage,
    bodyMarkdown,
    blocks: parseMarkdownToBlocks(bodyMarkdown),
  };
};
