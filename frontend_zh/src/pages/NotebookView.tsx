import React from 'react';

import ThinkFlowWorkspace from '../components/thinkflow/ThinkFlowWorkspace';

const NotebookView = ({ notebook, onBack }: { notebook: any; onBack: () => void }) => {
  return <ThinkFlowWorkspace notebook={notebook} onBack={onBack} />;
};

export default NotebookView;
