'use client';

import { useState } from 'react';
import { useSketchStore } from '../../store/useSketchStore';

export function HistoryPanel() {
  const history        = useSketchStore(s => s.history);
  const checkoutNode   = useSketchStore(s => s.checkoutNode);
  const commitSnapshot = useSketchStore(s => s.commitSnapshot);
  const [label, setLabel] = useState('');

  const nodes = Object.values(history.nodes).sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
  );

  const handleCommit = () => {
    commitSnapshot(label.trim() || 'Snapshot');
    setLabel('');
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-neutral-800 border-t border-neutral-700 shrink-0 overflow-x-auto min-w-0">
      <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest shrink-0">
        History
      </span>

      <div className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0">
        {nodes.map((node, i) => (
          <div key={node.id} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="text-neutral-700 text-xs">→</span>}
            <button
              onClick={() => checkoutNode(node.id)}
              className={[
                'px-2 py-0.5 rounded text-[11px] font-mono transition-colors whitespace-nowrap',
                node.id === history.activeNodeId
                  ? 'bg-orange-500 text-white'
                  : 'bg-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-600',
              ].join(' ')}
            >
              {node.label}
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCommit()}
          placeholder="label…"
          className="bg-neutral-700 text-neutral-200 text-xs px-2 py-1 rounded border border-neutral-600 focus:border-orange-500 outline-none w-28"
        />
        <button
          onClick={handleCommit}
          className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300 text-xs transition-colors"
        >
          Commit
        </button>
      </div>
    </div>
  );
}
