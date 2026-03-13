export type BlockType =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'bulletList'
  | 'numberedList'
  | 'todo'
  | 'quote'
  | 'code'
  | 'divider'
  | 'table'
  | 'image'
  | 'excel'
  | 'video';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  url?: string;
  scale?: number;
  number?: number;
}

export interface NoteDocument {
  id: string;
  title: string;
  coverImage?: string;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
}
