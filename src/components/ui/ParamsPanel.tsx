'use client';

import { useSketchStore } from '../../store/useSketchStore';
import type { BakeParams, CutParams } from '../../lib/schema/types';

// Quick presets for the most common cut shapes — saves manual entry
const CUT_PRESETS: { label: string; height: number; sillHeight: number }[] = [
  { label: 'Door',        height: 2.1, sillHeight: 0   },
  { label: 'Wide Door',   height: 2.4, sillHeight: 0   },
  { label: 'Window',      height: 1.2, sillHeight: 0.9 },
  { label: 'Low Window',  height: 0.8, sillHeight: 0.5 },
  { label: 'Arch Top',    height: 2.6, sillHeight: 0   },
];

export function ParamsPanel() {
  const sketch            = useSketchStore(s => s.sketch);
  const selectedShapeIds  = useSketchStore(s => s.selectedShapeIds);
  const updateShapeParams = useSketchStore(s => s.updateShapeParams);

  const shape = sketch.shapes.find(s => selectedShapeIds.includes(s.id));

  if (!shape) {
    return (
      <div className="px-4 py-2 border-t border-neutral-700 bg-neutral-800 text-neutral-600 text-xs shrink-0">
        Select a shape to edit its parameters
      </div>
    );
  }

  const params  = shape.params;
  const entries = Object.entries(params).filter(([k]) => k !== 'kind');
  const isCut   = shape.kind === 'cut';

  return (
    <div className="px-4 py-3 border-t border-neutral-700 bg-neutral-800 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">
          {shape.kind} · <span className="text-neutral-600">{shape.id.slice(0, 8)}</span>
        </div>
        {isCut && (
          <div className="text-[10px] text-red-400 font-mono">✂ subtracted from intersecting shapes</div>
        )}
      </div>

      {/* Presets — only for cut shapes */}
      {isCut && (
        <div className="flex gap-1 mb-2.5">
          {CUT_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() =>
                updateShapeParams(shape.id, {
                  kind: 'cut',
                  height: p.height,
                  sillHeight: p.sillHeight,
                } as CutParams)
              }
              className="px-2 py-1 rounded bg-neutral-700 hover:bg-red-500/80 text-[10px] text-neutral-300 hover:text-white transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-x-3 gap-y-2">
        {entries.map(([key, value]) => (
          <label key={key} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-500 uppercase">
              {key === 'sillHeight' ? 'sill height' : key}
            </span>
            {typeof value === 'boolean' ? (
              <input
                type="checkbox"
                checked={value}
                onChange={e => updateShapeParams(shape.id, { ...params, [key]: e.target.checked } as BakeParams)}
                className="mt-1 accent-orange-500"
              />
            ) : typeof value === 'string' ? (
              <input
                type="text"
                value={value}
                onChange={e => updateShapeParams(shape.id, { ...params, [key]: e.target.value } as BakeParams)}
                className="bg-neutral-700 text-neutral-100 text-xs px-2 py-1 rounded border border-neutral-600 focus:border-orange-500 outline-none"
              />
            ) : (
              <input
                type="number"
                step="0.1"
                value={value as number}
                onChange={e => updateShapeParams(shape.id, { ...params, [key]: parseFloat(e.target.value) || 0 } as BakeParams)}
                className={[
                  'text-xs px-2 py-1 rounded border outline-none w-full bg-neutral-700 text-neutral-100',
                  isCut ? 'border-red-700/50 focus:border-red-500' : 'border-neutral-600 focus:border-orange-500',
                ].join(' ')}
              />
            )}
          </label>
        ))}
      </div>

      {isCut && (
        <p className="text-[10px] text-neutral-600 mt-2 leading-snug">
          Sill height 0 = starts at floor (door). Raise it to float the opening (window).
          Drag the cut rectangle over any wall, room edge, column, or stairs in the 2D view — it punches through on bake.
        </p>
      )}
    </div>
  );
}
