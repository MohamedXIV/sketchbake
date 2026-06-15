'use client';

import { useEffect } from 'react';
import { useSketchStore, Tool } from '../../store/useSketchStore';

const TOOLS: { id: Tool; label: string; icon: string; key: string }[] = [
  { id: 'select', label: 'Select', icon: '↖', key: 'S' },
  { id: 'wall',   label: 'Wall',   icon: '▬', key: 'W' },
  { id: 'room',   label: 'Room',   icon: '⬜', key: 'R' },
  { id: 'dome',   label: 'Dome',   icon: '◑', key: 'D' },
  { id: 'column', label: 'Column', icon: '⬤', key: 'C' },
  { id: 'arch',   label: 'Arch',   icon: '⌒', key: 'A' },
  { id: 'stairs', label: 'Stairs', icon: '≡', key: 'T' },
];

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
        <button
          key={tool.id}
          title={`${tool.label} [${tool.key}]`}
          onClick={() => setActiveTool(tool.id)}
          className={[
            'w-9 h-9 rounded flex items-center justify-center text-base transition-colors',
            activeTool === tool.id
              ? 'bg-orange-500 text-white'
              : 'text-neutral-400 hover:bg-neutral-700 hover:text-white',
          ].join(' ')}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
