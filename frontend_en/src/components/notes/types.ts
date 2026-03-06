export type BlockType =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'todo'
  | 'quote'
  | 'code'
  | 'divider'
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
}

export interface NoteDocument {
  id: string;
  title: string;
  coverImage?: string;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
}
