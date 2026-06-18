'use client';

import { useEffect } from 'react';
import { useSketchStore, Tool } from '../../store/useSketchStore';

const TOOLS: { id: Tool; icon: string; key: string; label: string }[] = [
  { id: 'select', icon: '↖', key: 'S', label: 'Select' },
  { id: 'wall',   icon: '▬', key: 'W', label: 'Wall' },
  { id: 'room',   icon: '⬜', key: 'R', label: 'Room' },
  { id: 'dome',   icon: '◑', key: 'D', label: 'Dome' },
  { id: 'column', icon: '⬤', key: 'C', label: 'Column' },
  { id: 'arch',   icon: '⌒', key: 'A', label: 'Arch' },
  { id: 'stairs', icon: '≡', key: 'T', label: 'Stairs' },
  // divider then cut
  { id: 'cut',    icon: '□', key: 'X', label: 'Cut (subtract)' },
];

// Index of the last solid tool before the divider
const DIVIDER_BEFORE = 'cut';

export function Toolbar() {
  const activeTool    = useSketchStore(s => s.activeTool);
  const setActiveTool = useSketchStore(s => s.setActiveTool);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const t = TOOLS.find(t => t.key === e.key.toUpperCase());
      if (t) setActiveTool(t.id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveTool]);

  return (
    <div className="flex flex-col gap-1 p-1.5 bg-neutral-800 border-r border-neutral-700 shrink-0">
      {TOOLS.map(tool => (
        <>
          {tool.id === DIVIDER_BEFORE && (
            <div key="divider" className="w-full h-px bg-neutral-700 my-0.5" />
          )}
          <button
            key={tool.id}
            title={`${tool.label} [${tool.key}]`}
            onClick={() => setActiveTool(tool.id)}
            className={[
              'w-9 h-9 rounded flex items-center justify-center text-base transition-colors',
              activeTool === tool.id
                ? tool.id === 'cut'
                  ? 'bg-red-500 text-white'
                  : 'bg-orange-500 text-white'
                : 'text-neutral-400 hover:bg-neutral-700 hover:text-white',
            ].join(' ')}
          >
            {tool.icon}
          </button>
        </>
      ))}
    </div>
  );
}
