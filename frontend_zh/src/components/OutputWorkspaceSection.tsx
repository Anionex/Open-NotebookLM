import type { ReactNode } from 'react';

type OutputWorkspaceSectionProps = {
  activeOutput: { target_type: string } | null;
  generatingOutline: string | null;
  generatingOutlineLabel: string;
  outputWorkspaceHeader: ReactNode;
  pptWorkspace: ReactNode;
  directOutputWorkspace: ReactNode;
};

export function OutputWorkspaceSection({
  activeOutput,
  generatingOutline,
  generatingOutlineLabel,
  outputWorkspaceHeader,
  pptWorkspace,
  directOutputWorkspace,
}: OutputWorkspaceSectionProps) {
  return (
    <div className="thinkflow-outline-editor">
      {activeOutput ? (
        <>
          {outputWorkspaceHeader}
          {activeOutput.target_type === 'ppt' ? (
            <div className="thinkflow-output-workspace-body">{pptWorkspace}</div>
          ) : (
            directOutputWorkspace
          )}
        </>
      ) : generatingOutline ? (
        <div className="thinkflow-empty">正在准备并生成{generatingOutlineLabel || '产出'}...</div>
      ) : (
        <div className="thinkflow-empty">从文档页点击一个产出按钮后，这里会直接显示当前结果工作台。</div>
      )}
    </div>
  );
}
