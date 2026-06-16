'use client';

import dynamic from 'next/dynamic';
import { Toolbar }       from '../components/ui/Toolbar';
import { ParamsPanel }   from '../components/ui/ParamsPanel';
import { BakeButton }    from '../components/ui/BakeButton';
import { ExportButton }  from '../components/ui/ExportButton';
import { HistoryPanel }  from '../components/history/HistoryPanel';
import { SketchCanvas }  from '../components/sketch/SketchCanvas';
import { useSketchStore } from '../store/useSketchStore';

// R3F Canvas must be client-only (no SSR)
const Viewport3D = dynamic(
  () => import('../components/viewport/Viewport3D').then(m => m.Viewport3D),
  { ssr: false }
);

export default function Home() {
  const sketchName = useSketchStore(s => s.sketch.name);

  return (
    <div className="flex flex-col h-screen overflow-hidden select-none">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-widest text-orange-400">SKETCHBAKE</span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-400 text-sm">{sketchName}</span>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton />
          <BakeButton />
        </div>
      </header>

      {/* ── Main split ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <Toolbar />

        {/* Left — 2D sketch */}
        <div className="flex flex-col border-r border-neutral-700" style={{ width: '50%' }}>
          <div className="flex items-center px-3 py-1 bg-neutral-850 border-b border-neutral-700 shrink-0">
            <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest">2D Sketch</span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <SketchCanvas />
          </div>
          <ParamsPanel />
        </div>

        {/* Right — 3D viewport */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center px-3 py-1 bg-neutral-850 border-b border-neutral-700 shrink-0">
            <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest">3D Preview</span>
          </div>
          <div className="flex-1 min-h-0">
            <Viewport3D />
          </div>
        </div>
      </div>

      {/* ── History strip ── */}
      <HistoryPanel />
    </div>
  );
}
