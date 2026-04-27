import { useCallback, useState } from 'react';

export type ConversationSourceRef = {
  id: string;
  type: 'material' | 'document' | 'output_document';
  title: string;
  path?: string;
  metadata?: Record<string, any>;
};

export function useConversationSourceRefs() {
  const [conversationSourceRefs, setConversationSourceRefs] = useState<ConversationSourceRef[]>([]);
  const [sourceRowExpanded, setSourceRowExpanded] = useState(false);

  const toggleSourceRow = useCallback(() => {
    setSourceRowExpanded((previous) => !previous);
  }, []);

  const clearConversationSourceRefs = useCallback(() => {
    setConversationSourceRefs([]);
  }, []);

  return {
    conversationSourceRefs,
    setConversationSourceRefs,
    sourceRowExpanded,
    setSourceRowExpanded,
    toggleSourceRow,
    clearConversationSourceRefs,
  };
}
