import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Code, Download, Eye, Maximize2, X } from 'lucide-react';
import mermaid from 'mermaid';

type MermaidPreviewProps = {
  mermaidCode: string;
  title?: string;
};

export function MermaidPreview({ mermaidCode, title = '思维导图预览' }: MermaidPreviewProps) {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [showCode, setShowCode] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedSvg, setRenderedSvg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalSvg, setModalSvg] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#0ea5e9',
        primaryTextColor: '#fff',
        primaryBorderColor: '#0284c7',
        lineColor: '#06b6d4',
        secondaryColor: '#0891b2',
        tertiaryColor: '#164e63',
      },
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    });
  }, []);

  useEffect(() => {
    const renderMermaid = async () => {
      if (!mermaidCode || !mermaidRef.current) return;

      try {
        setRenderError(null);
        setRenderedSvg('');
        mermaidRef.current.innerHTML = '';

        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidCode);
        setRenderedSvg(svg);

        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = svg;
        }
      } catch (error: any) {
        console.error('Mermaid render error:', error);
        setRenderError(error.message || 'Failed to render diagram');
        setRenderedSvg('');
      }
    };

    void renderMermaid();
  }, [mermaidCode]);

  const renderSvgForExport = async () => {
    if (renderedSvg) return renderedSvg;
    const id = `mermaid-export-${Date.now()}`;
    const { svg } = await mermaid.render(id, mermaidCode);
    return svg;
  };

  const normalizeSvg = (svg: string) =>
    svg.replace(/<svg([^>]*?)>/i, (match, attrs) => {
      let next = attrs.replace(/\swidth="[^"]*"/i, '').replace(/\sheight="[^"]*"/i, '');

      if (!/preserveAspectRatio=/i.test(next)) {
        next += ' preserveAspectRatio="xMidYMid meet"';
      }

      if (/style="/i.test(next)) {
        next = next.replace(/style="([^"]*)"/i, (_, style) => `style="${style}; width:100%; height:100%;"`);
      } else {
        next += ' style="width:100%; height:100%;"';
      }

      return `<svg${next}>`;
    });

  const handleDownloadSVG = async () => {
    if (!mermaidCode) return;
    try {
      const svgData = await renderSvgForExport();
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mindmap_${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download SVG failed:', error);
    }
  };

  const handleDownloadCode = () => {
    const blob = new Blob([mermaidCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mindmap_${Date.now()}.mmd`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExpand = async () => {
    if (!mermaidCode) return;
    try {
      const svgData = await renderSvgForExport();
      setModalSvg(normalizeSvg(svgData));
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setShowModal(true);
    } catch (error) {
      console.error('Expand preview failed:', error);
    }
  };

  const clampZoom = (value: number) => Math.min(5, Math.max(0.2, value));

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom((previous) => clampZoom(previous * direction));
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
    setDragOrigin(offset);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    setOffset({ x: dragOrigin.x + dx, y: dragOrigin.y + dy });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="border-t border-white/10 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300">{title}</h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExpand()}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10"
          >
            <Maximize2 size={14} />
            放大
          </button>
          <button
            type="button"
            onClick={() => setShowCode((previous) => !previous)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10"
          >
            {showCode ? <Eye size={14} /> : <Code size={14} />}
            {showCode ? '查看图形' : '查看代码'}
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadSVG()}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-300 transition-colors hover:bg-cyan-500/30"
          >
            <Download size={14} />
            下载 SVG
          </button>
          <button
            type="button"
            onClick={handleDownloadCode}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-300 transition-colors hover:bg-cyan-500/30"
          >
            <Download size={14} />
            下载代码
          </button>
        </div>
      </div>

      {showCode ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-xs text-gray-400">Mermaid 代码:</div>
          <pre className="max-h-96 overflow-x-auto rounded bg-black/40 p-3 text-xs text-gray-300">
            {mermaidCode}
          </pre>
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          {renderError ? (
            <div className="py-8 text-center">
              <div className="mb-2 text-sm text-red-400">渲染失败</div>
              <div className="text-xs text-gray-500">{renderError}</div>
              <button
                type="button"
                onClick={() => setShowCode(true)}
                className="mt-4 text-xs text-cyan-400 hover:text-cyan-300"
              >
                查看原始代码
              </button>
            </div>
          ) : (
            <div
              ref={mermaidRef}
              className="flex items-center justify-center overflow-x-auto"
              style={{ minHeight: '200px' }}
            />
          )}
        </div>
      )}

      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6 backdrop-blur-md"
            onClick={() => setShowModal(false)}
          >
            <div
              className="flex h-[90vh] w-[92vw] max-w-none flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b1a] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="text-sm text-gray-300">思维导图放大预览</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoom((previous) => clampZoom(previous * 0.9))}
                    className="rounded-lg bg-white/5 px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
                  >
                    缩小
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((previous) => clampZoom(previous * 1.1))}
                    className="rounded-lg bg-white/5 px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
                  >
                    放大
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setOffset({ x: 0, y: 0 });
                    }}
                    className="rounded-lg bg-white/5 px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
                  >
                    复位
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div
                className="flex-1 overflow-hidden p-6"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                {modalSvg ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div
                      style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                      }}
                      dangerouslySetInnerHTML={{ __html: modalSvg }}
                    />
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">暂无可预览内容</div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
