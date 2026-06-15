'use client';

import { useSketchStore } from '../../store/useSketchStore';

export function BakeButton() {
  const bake       = useSketchStore(s => s.bake);
  const isBaking   = useSketchStore(s => s.isBaking);
  const bakeResult = useSketchStore(s => s.bakeResult);
  const shapes     = useSketchStore(s => s.sketch.shapes);

  return (
    <div className="flex items-center gap-3">
      {bakeResult && (
        <span className="text-xs text-green-400 font-mono">
          ✓ {bakeResult.meshes.length} mesh{bakeResult.meshes.length !== 1 ? 'es' : ''} baked
        </span>
      )}
      <button
        onClick={() => void bake()}
        disabled={isBaking || shapes.length === 0}
        className="px-4 py-1.5 rounded bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
      >
        {isBaking ? '⏳ Baking…' : '▶ Bake'}
      </button>
    </div>
  );
}
