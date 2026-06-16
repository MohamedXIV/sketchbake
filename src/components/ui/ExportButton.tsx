'use client';

import { useState } from 'react';
import { useSketchStore } from '../../store/useSketchStore';
import { exportGLTF, downloadBlob } from '../../lib/export/gltf';

export function ExportButton() {
  const bakeResult = useSketchStore(s => s.bakeResult);
  const sketchName = useSketchStore(s => s.sketch.name);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (!bakeResult) return;
    setBusy(true);
    try {
      const blob = await exportGLTF(bakeResult);
      downloadBlob(blob, `${sketchName}.gltf`);
    } catch (err) {
      console.error('[export] glTF failed:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={!bakeResult || busy}
      title="Export baked meshes as glTF (Unity / Godot ready)"
      className="px-3 py-1.5 rounded border border-neutral-600 hover:border-neutral-400 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-400 hover:text-white text-sm transition-colors"
    >
      {busy ? 'Exporting…' : '↓ glTF'}
    </button>
  );
}
