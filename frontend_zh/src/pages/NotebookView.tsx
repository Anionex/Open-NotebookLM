import type { Notebook } from '../components/thinkflow-types';
import ThinkFlowWorkspace from '../components/ThinkFlowWorkspace';

type NotebookViewProps = {
  notebook: Notebook;
  onBack: () => void;
};

export default function NotebookView({ notebook, onBack }: NotebookViewProps) {
  return <ThinkFlowWorkspace notebook={notebook} onBack={onBack} />;
}
