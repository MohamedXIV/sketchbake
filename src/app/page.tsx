'use client';

import dynamic from 'next/dynamic';
import { Toolbar }       from '../components/ui/Toolbar';
import { ParamsPanel }   from '../components/ui/ParamsPanel';
import { BakeButton }    from '../components/ui/BakeButton';
import { ExportButton }  from '../components/ui/ExportButton';
import { HistoryPanel }  from '../components/history/HistoryPanel';
import { SketchCanvas }  from '../components/sketch/SketchCanvas';
import { useSketchStore } from '../store/useSketchStore';

const Viewport3D = dynamic(
  () => import('../components/viewport/Viewport3D').then(m => m.Viewport3D),
  { ssr: false }
);

const LABEL = 'text-[10px] text-neutral-600 font-mono uppercase tracking-widest';
const STRIP = 'flex items-center px-3 py-1 bg-neutral-900 border-b border-neutral-700 shrink-0';

export default function Home() {
  const sketchName  = useSketchStore(s => s.sketch.name);
  const shapeCount  = useSketchStore(s => s.sketch.shapes.length);
  const bakeResult  = useSketchStore(s => s.bakeResult);

  return (
    <div className="flex flex-col h-screen overflow-hidden select-none">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-widest text-orange-400">SKETCHBAKE</span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-400 text-sm">{sketchName}</span>
          <span className="text-neutral-700 text-xs font-mono ml-1">
            {shapeCount} shape{shapeCount !== 1 ? 's' : ''}
            {bakeResult ? ` · ${bakeResult.meshes.length} mesh${bakeResult.meshes.length !== 1 ? 'es' : ''}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton />
          <BakeButton />
        </div>
      </header>

      {/* ── Main split ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <Toolbar />

        {/* Left — 2D */}
        <div className="flex flex-col border-r border-neutral-700" style={{ width: '50%' }}>
          <div className={STRIP}>
            <span className={LABEL}>2D Sketch</span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <SketchCanvas />
          </div>
          <ParamsPanel />
        </div>

        {/* Right — 3D */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className={STRIP}>
            <span className={LABEL}>3D Preview</span>
            {!bakeResult && (
              <span className="ml-2 text-[10px] text-neutral-700">
                — press ▶ Bake to render
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <Viewport3D />
          </div>
        </div>
      </div>

      {/* ── History ── */}
      <HistoryPanel />
    </div>
  );
}
