'use client';

import { useSketchStore } from '../../store/useSketchStore';
import type { BakeParams } from '../../lib/schema/types';

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

  return (
    <div className="px-4 py-3 border-t border-neutral-700 bg-neutral-800 shrink-0">
      <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest mb-2">
        {shape.kind} · <span className="text-neutral-600">{shape.id.slice(0, 8)}</span>
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-2">
        {entries.map(([key, value]) => (
          <label key={key} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-500 uppercase">{key}</span>
            {typeof value === 'boolean' ? (
              <input
                type="checkbox"
                checked={value}
                onChange={e =>
                  updateShapeParams(shape.id, { ...params, [key]: e.target.checked } as BakeParams)
                }
                className="mt-1 accent-orange-500"
              />
            ) : typeof value === 'string' ? (
              <input
                type="text"
                value={value}
                onChange={e =>
                  updateShapeParams(shape.id, { ...params, [key]: e.target.value } as BakeParams)
                }
                className="bg-neutral-700 text-neutral-100 text-xs px-2 py-1 rounded border border-neutral-600 focus:border-orange-500 outline-none"
              />
            ) : (
              <input
                type="number"
                step="0.1"
                value={value as number}
                onChange={e =>
                  updateShapeParams(shape.id, {
                    ...params,
                    [key]: parseFloat(e.target.value) || 0,
                  } as BakeParams)
                }
                className="bg-neutral-700 text-neutral-100 text-xs px-2 py-1 rounded border border-neutral-600 focus:border-orange-500 outline-none w-full"
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
