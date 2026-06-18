'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useSketchStore } from '../../store/useSketchStore';
import type { Vec2, SketchShape, ShapeKind } from '../../lib/schema/types';

export type CanvasView = 'top' | 'front' | 'side';

const VIEW_META: Record<CanvasView, {
  label: string; hAxis: string; vAxis: string; hColor: string; vColor: string;
}> = {
  top:   { label: 'Top (XZ)',   hAxis: 'X', vAxis: 'Z', hColor: '#ef4444', vColor: '#3b82f6' },
  front: { label: 'Front (XY)', hAxis: 'X', vAxis: 'Y', hColor: '#ef4444', vColor: '#22c55e' },
  side:  { label: 'Side (ZY)',  hAxis: 'Z', vAxis: 'Y', hColor: '#3b82f6', vColor: '#22c55e' },
};

const DEFAULT_PPU = 40;
const MIN_PPU     = 6;
const MAX_PPU     = 320;
const GRID        = 1;

const COLOR: Record<string, string> = {
  wall:   '#60a5fa',
  room:   '#34d399',
  dome:   '#a78bfa',
  arch:   '#f59e0b',
  stairs: '#fb923c',
  column: '#f472b6',
  cut:    '#ef4444',   // red — subtraction volumes
  custom: '#94a3b8',
};

function toWorld(cx: number, cy: number, w: number, h: number, ppu: number, pan: { x: number; y: number }): Vec2 {
  return { x: (cx - w / 2 - pan.x) / ppu, y: (cy - h / 2 - pan.y) / ppu };
}
function toCanvas(wx: number, wy: number, w: number, h: number, ppu: number, pan: { x: number; y: number }): [number, number] {
  return [wx * ppu + w / 2 + pan.x, wy * ppu + h / 2 + pan.y];
}
function snapGrid(v: Vec2): Vec2 {
  return { x: Math.round(v.x / GRID) * GRID, y: Math.round(v.y / GRID) * GRID };
}
function dist2(a: Vec2, b: Vec2) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
function centroid(pts: Vec2[]): Vec2 {
  if (!pts.length) return { x: 0, y: 0 };
  const s = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pts.length, y: s.y / pts.length };
}

interface InProgress { points: Vec2[]; cursor: Vec2 | null; }

const BTN  = 'px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer';
const BTN_ON  = `${BTN} bg-neutral-600 text-white`;
const BTN_OFF = `${BTN} text-neutral-500 hover:bg-neutral-700 hover:text-white`;

export function SketchCanvas() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const coordsRef    = useRef<HTMLSpanElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);

  const [view, setView] = useState<CanvasView>('top');
  const viewRef         = useRef<CanvasView>('top');
  useEffect(() => { viewRef.current = view; }, [view]);

  const sizeRef = useRef({ w: 800, h: 600 });
  const ppuRef  = useRef(DEFAULT_PPU);
  const panRef  = useRef({ x: 0, y: 0 });

  const ip        = useRef<InProgress>({ points: [], cursor: null });
  const renderRef = useRef<() => void>(() => {});

  const isPanning  = useRef(false);
  const panStart   = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const spaceHeld  = useRef(false);

  const sketch            = useSketchStore(s => s.sketch);
  const activeTool        = useSketchStore(s => s.activeTool);
  const selectedShapeIds  = useSketchStore(s => s.selectedShapeIds);
  const addShape          = useSketchStore(s => s.addShape);
  const removeShape       = useSketchStore(s => s.removeShape);
  const setSelectedShapes = useSketchStore(s => s.setSelectedShapes);

  const syncZoomLabel = useCallback(() => {
    if (zoomLabelRef.current)
      zoomLabelRef.current.textContent = `${Math.round(ppuRef.current / DEFAULT_PPU * 100)}%`;
  }, []);

  // ---- Render closure ----
  useEffect(() => {
    renderRef.current = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { w, h } = sizeRef.current;
      const ppu = ppuRef.current;
      const pan = panRef.current;
      const vm  = VIEW_META[viewRef.current];

      canvas.style.cursor =
        isPanning.current ? 'grabbing' :
        spaceHeld.current ? 'grab'     :
        activeTool === 'select' ? 'default' :
        activeTool === 'cut'    ? 'crosshair' : 'crosshair';

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#161622';
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h, ppu, pan, vm);

      for (const shape of sketch.shapes)
        drawShape(ctx, shape, w, h, ppu, pan, selectedShapeIds.includes(shape.id));

      const { points, cursor } = ip.current;
      if (cursor) drawPreview(ctx, activeTool, points, cursor, w, h, ppu, pan);
    };
    renderRef.current();
  }, [sketch, selectedShapeIds, activeTool, view]);

  // ---- Resize observer ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect;
      sizeRef.current = { w, h };
      const c = canvasRef.current;
      if (c) { c.width = w; c.height = h; }
      renderRef.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Zoom (non-passive wheel, zoom to cursor) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const { w, h } = sizeRef.current;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = (mx - w / 2 - panRef.current.x) / ppuRef.current;
      const wy = (my - h / 2 - panRef.current.y) / ppuRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newPPU = Math.max(MIN_PPU, Math.min(MAX_PPU, ppuRef.current * factor));
      panRef.current = { x: mx - w / 2 - wx * newPPU, y: my - h / 2 - wy * newPPU };
      ppuRef.current = newPPU;
      syncZoomLabel();
      renderRef.current();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [syncZoomLabel]);

  // ---- Keyboard ----
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.code === 'Space' && !inInput) { e.preventDefault(); spaceHeld.current = true; renderRef.current(); }
      if (inInput) return;
      if (e.key === 'Escape') { ip.current = { points: [], cursor: null }; renderRef.current(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeIds.length > 0) {
        selectedShapeIds.forEach(id => removeShape(id));
        setSelectedShapes([]);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceHeld.current = false; if (!isPanning.current) renderRef.current(); }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [selectedShapeIds, removeShape, setSelectedShapes]);

  // ---- Helpers ----
  const canvasXY = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { cx: e.clientX - r.left, cy: e.clientY - r.top };
  }, []);
  const worldPos = useCallback((cx: number, cy: number): Vec2 => {
    const { w, h } = sizeRef.current;
    return snapGrid(toWorld(cx, cy, w, h, ppuRef.current, panRef.current));
  }, []);

  // ---- Mouse events ----
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
      e.preventDefault();
      const { cx, cy } = canvasXY(e);
      isPanning.current = true;
      panStart.current  = { mx: cx, my: cy, px: panRef.current.x, py: panRef.current.y };
      renderRef.current();
    }
  }, [canvasXY]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { cx, cy } = canvasXY(e);
    if (isPanning.current) {
      const { mx, my, px, py } = panStart.current;
      panRef.current = { x: px + (cx - mx), y: py + (cy - my) };
      renderRef.current();
      return;
    }
    const pos = worldPos(cx, cy);
    ip.current.cursor = pos;
    renderRef.current();
    if (coordsRef.current) {
      const { hAxis, vAxis } = VIEW_META[view];
      coordsRef.current.textContent = `${hAxis} ${pos.x.toFixed(1)}  ${vAxis} ${pos.y.toFixed(1)}`;
    }
  }, [canvasXY, worldPos, view]);

  const handleMouseUp    = useCallback(() => { if (isPanning.current) { isPanning.current = false; renderRef.current(); } }, []);
  const handleMouseLeave = useCallback(() => {
    isPanning.current = false; ip.current.cursor = null; renderRef.current();
    if (coordsRef.current) coordsRef.current.textContent = '';
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (spaceHeld.current || e.button !== 0) return;
    const { cx, cy } = canvasXY(e);
    const pos = worldPos(cx, cy);

    if (activeTool === 'select') {
      let best: string | null = null, bestD = 1.2;
      for (const shape of sketch.shapes) {
        const d = dist2(centroid(shape.points), pos);
        if (d < bestD) { bestD = d; best = shape.id; }
      }
      setSelectedShapes(best ? [best] : []);
      return;
    }

    if (activeTool === 'room') {
      if (ip.current.points.length >= 3 && dist2(pos, ip.current.points[0]) < 0.7) {
        addShape('room', [...ip.current.points]); ip.current.points = [];
      } else { ip.current.points = [...ip.current.points, pos]; }
      renderRef.current(); return;
    }

    ip.current.points = [...ip.current.points, pos];
    const REQ: Partial<Record<string, number>> = { wall: 2, dome: 2, column: 1, arch: 2, stairs: 2, cut: 2 };
    const need = REQ[activeTool];
    if (need && ip.current.points.length >= need) {
      addShape(activeTool as ShapeKind, [...ip.current.points]);
      ip.current.points = [];
    }
    renderRef.current();
  }, [activeTool, sketch.shapes, addShape, setSelectedShapes, canvasXY, worldPos]);

  const handleDblClick = useCallback(() => {
    if (activeTool === 'room' && ip.current.points.length >= 3) {
      addShape('room', [...ip.current.points]); ip.current.points = []; renderRef.current();
    }
  }, [activeTool, addShape]);

  // ---- View / zoom controls ----
  const handleSetView = useCallback((v: CanvasView) => {
    ppuRef.current = DEFAULT_PPU; panRef.current = { x: 0, y: 0 };
    syncZoomLabel(); setView(v);
  }, [syncZoomLabel]);
  const handleZoomBtn = useCallback((dir: 1 | -1) => {
    const factor = dir > 0 ? 1.25 : 1 / 1.25;
    const newPPU = Math.max(MIN_PPU, Math.min(MAX_PPU, ppuRef.current * factor));
    const ratio  = newPPU / ppuRef.current;
    panRef.current  = { x: panRef.current.x * ratio, y: panRef.current.y * ratio };
    ppuRef.current  = newPPU;
    syncZoomLabel(); renderRef.current();
  }, [syncZoomLabel]);
  const handleResetView = useCallback(() => {
    ppuRef.current = DEFAULT_PPU; panRef.current = { x: 0, y: 0 };
    syncZoomLabel(); renderRef.current();
  }, [syncZoomLabel]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', position: 'absolute', inset: 0 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onDoubleClick={handleDblClick}
        onContextMenu={e => e.preventDefault()}
      />

      {/* View + zoom overlay */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-neutral-900/85 backdrop-blur-sm border border-neutral-700 rounded px-2 py-1">
        {(['top', 'front', 'side'] as CanvasView[]).map(v => (
          <button key={v} onClick={() => handleSetView(v)} className={view === v ? BTN_ON : BTN_OFF}>{v}</button>
        ))}
        <div className="w-px h-3 bg-neutral-700 mx-0.5" />
        <button onClick={() => handleZoomBtn(-1)} className={BTN_OFF}>−</button>
        <span ref={zoomLabelRef} className="text-[10px] font-mono text-neutral-400 w-9 text-center">100%</span>
        <button onClick={() => handleZoomBtn(1)} className={BTN_OFF}>+</button>
        <button onClick={handleResetView} className={BTN_OFF} title="Reset view">⟲</button>
      </div>

      {/* Status bar */}
      <div className="absolute bottom-2 left-2 flex items-center gap-3 pointer-events-none">
        <span className="text-[10px] font-mono text-neutral-700">
          scroll zoom · space+drag pan · mid-mouse pan
        </span>
        <span ref={coordsRef} className="text-[10px] font-mono text-neutral-500" />
      </div>

      {/* Cut tool hint */}
      {activeTool === 'cut' && (
        <div className="absolute top-2 left-2 bg-red-950/80 border border-red-800 rounded px-2 py-1 pointer-events-none">
          <span className="text-[10px] font-mono text-red-400">
            ✂ Cut — click two corners to draw a subtraction volume
          </span>
        </div>
      )}

      {/* Empty state */}
      {sketch.shapes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-3xl mb-3 opacity-20">✏️</div>
            <div className="text-sm text-neutral-600">Pick a tool and click to draw</div>
            <div className="text-xs text-neutral-700 mt-1 font-mono">
              W wall · R room · D dome · C column · A arch · T stairs
            </div>
            <div className="text-xs text-neutral-700 mt-0.5 font-mono">
              X cut · Esc cancel · Del remove · Space pan
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================
// Drawing helpers
// ================================================================

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  ppu: number, pan: { x: number; y: number },
  vm: typeof VIEW_META[CanvasView],
) {
  const step = GRID * ppu;
  const ox = ((w / 2 + pan.x) % step + step) % step;
  const oy = ((h / 2 + pan.y) % step + step) % step;
  ctx.strokeStyle = '#1e1e30'; ctx.lineWidth = 0.5;
  for (let x = ox; x <= w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = oy; y <= h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  const ax = w / 2 + pan.x, ay = h / 2 + pan.y;
  ctx.strokeStyle = vm.hColor + '99'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(w, ay); ctx.stroke();
  ctx.strokeStyle = vm.vColor + '99';
  ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, h); ctx.stroke();
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = vm.hColor + 'cc'; ctx.fillText(vm.hAxis, Math.min(w - 18, Math.max(4, ax + 6)), ay - 5);
  ctx.fillStyle = vm.vColor + 'cc'; ctx.fillText(vm.vAxis, ax + 5, Math.min(h - 4, Math.max(14, ay - 6)));
  if (ax > 0 && ax < w && ay > 0 && ay < h) {
    ctx.fillStyle = '#ffffff33'; ctx.beginPath(); ctx.arc(ax, ay, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: ReturnType<typeof useSketchStore.getState>['sketch']['shapes'][number],
  w: number, h: number,
  ppu: number, pan: { x: number; y: number },
  selected: boolean,
) {
  const col = selected ? '#f97316' : (COLOR[shape.kind] ?? '#94a3b8');
  const pts = shape.points.map(p => toCanvas(p.x, p.y, w, h, ppu, pan));
  ctx.strokeStyle = col; ctx.lineWidth = selected ? 2 : 1.5; ctx.setLineDash([]);

  switch (shape.kind) {
    case 'wall': {
      if (pts.length < 2) return;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.stroke();
      for (const [px, py] of pts) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); }
      const len = dist2(shape.points[0], shape.points[1]).toFixed(1);
      ctx.fillStyle = col + 'aa'; ctx.font = '9px monospace';
      ctx.fillText(`${len}m`, (pts[0][0] + pts[1][0]) / 2 + 4, (pts[0][1] + pts[1][1]) / 2 - 4);
      break;
    }
    case 'room': {
      if (pts.length < 2) return;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.fillStyle = col + '1a'; ctx.fill(); ctx.stroke(); break;
    }
    case 'dome': {
      if (pts.length < 2) return;
      const r = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
      ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], r, 0, Math.PI * 2);
      ctx.fillStyle = col + '1a'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col + 'aa'; ctx.font = '9px monospace';
      ctx.fillText(`r ${(r / ppu).toFixed(1)}m`, pts[0][0] + 4, pts[0][1] - r - 4); break;
    }
    case 'arch': {
      if (pts.length < 2) return;
      const [ax, ay] = pts[0]; const [bx, by] = pts[1];
      ctx.beginPath(); ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - ppu * 1.5, bx, by); ctx.stroke();
      for (const [px, py] of pts) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'column': {
      if (pts.length < 1) return;
      const r = Math.max(4, ppu * 0.15);
      ctx.fillStyle = col + '44'; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
    }
    case 'stairs': {
      if (pts.length < 2) return;
      const STEPS = 4; const [ax2, ay2] = pts[0]; const [bx2, by2] = pts[1];
      ctx.beginPath(); ctx.moveTo(ax2, ay2);
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS; const nx = ax2 + (bx2 - ax2) * t; const ny = ay2 + (by2 - ay2) * t;
        ctx.lineTo(nx - (by2 - ay2) * 0.08 * (STEPS - i + 0.5), ny + (bx2 - ax2) * 0.08 * (STEPS - i + 0.5));
        ctx.lineTo(nx, ny);
      } ctx.stroke();
      for (const [px, py] of pts) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'cut': {
      if (pts.length < 2) return;
      const minX = Math.min(pts[0][0], pts[1][0]), minY = Math.min(pts[0][1], pts[1][1]);
      const rw   = Math.abs(pts[1][0] - pts[0][0]),   rh = Math.abs(pts[1][1] - pts[0][1]);
      ctx.setLineDash([4, 3]);
      ctx.fillStyle = col + '1e'; ctx.fillRect(minX, minY, rw, rh);
      ctx.strokeRect(minX, minY, rw, rh); ctx.setLineDash([]);
      // Dimension labels
      const ww = (rw / ppu).toFixed(1), hh = (rh / ppu).toFixed(1);
      ctx.fillStyle = col + 'bb'; ctx.font = '9px monospace';
      ctx.fillText(`${ww}×${hh}m`, minX + 3, minY - 4);
      // ✂ icon at centre
      ctx.fillStyle = col + '88'; ctx.font = '12px monospace';
      ctx.fillText('✂', minX + rw / 2 - 6, minY + rh / 2 + 5);
      break;
    }
    default: {
      if (pts.length < 2) return;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
  }

  // Kind label
  const c = centroid(shape.points);
  const [lx, ly] = toCanvas(c.x, c.y, w, h, ppu, pan);
  if (shape.kind !== 'cut') {
    ctx.fillStyle = col + 'bb'; ctx.font = '9px monospace';
    ctx.fillText(shape.label ?? shape.kind, lx + 8, ly - 6);
  }
}

function drawPreview(
  ctx: CanvasRenderingContext2D,
  tool: string, points: Vec2[], cursor: Vec2,
  w: number, h: number, ppu: number, pan: { x: number; y: number },
) {
  const col = tool === 'cut' ? '#ef4444' : '#f97316';
  const [curX, curY] = toCanvas(cursor.x, cursor.y, w, h, ppu, pan);
  const pts = points.map(p => toCanvas(p.x, p.y, w, h, ppu, pan));
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);

  switch (tool) {
    case 'wall': {
      if (pts.length > 0) {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(curX, curY); ctx.stroke();
        const len = dist2(points[0], cursor).toFixed(1);
        ctx.setLineDash([]); ctx.fillStyle = col; ctx.font = '9px monospace';
        ctx.fillText(`${len}m`, (pts[0][0] + curX) / 2 + 4, (pts[0][1] + curY) / 2 - 4);
      } break;
    }
    case 'room': {
      ctx.beginPath();
      pts.length > 0 ? (ctx.moveTo(pts[0][0], pts[0][1]), pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y))) : ctx.moveTo(curX, curY);
      ctx.lineTo(curX, curY); ctx.stroke();
      if (pts.length >= 3) { ctx.setLineDash([]); ctx.strokeStyle = col + '55'; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 10, 0, Math.PI * 2); ctx.stroke(); }
      break;
    }
    case 'dome': {
      if (pts.length > 0) {
        const r = Math.hypot(curX - pts[0][0], curY - pts[0][1]);
        ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], r, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = col; ctx.font = '9px monospace';
        ctx.fillText(`r ${(r / ppu).toFixed(1)}m`, pts[0][0] + 4, pts[0][1] - r - 4);
      } break;
    }
    case 'arch': {
      if (pts.length > 0) {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        ctx.quadraticCurveTo((pts[0][0] + curX) / 2, (pts[0][1] + curY) / 2 - ppu * 1.5, curX, curY); ctx.stroke();
      } break;
    }
    case 'cut': {
      if (pts.length > 0) {
        // Live rectangle preview
        const minX = Math.min(pts[0][0], curX), minY = Math.min(pts[0][1], curY);
        const rw   = Math.abs(curX - pts[0][0]),   rh = Math.abs(curY - pts[0][1]);
        ctx.fillStyle = col + '18'; ctx.fillRect(minX, minY, rw, rh);
        ctx.strokeRect(minX, minY, rw, rh);
        // World dimensions
        ctx.setLineDash([]); ctx.fillStyle = col; ctx.font = '9px monospace';
        ctx.fillText(`${(rw / ppu).toFixed(1)}×${(rh / ppu).toFixed(1)}m`, minX + 3, minY - 4);
      } else {
        // First click not placed yet — show cursor cross
        ctx.setLineDash([3, 3]); ctx.strokeStyle = col + '88';
        ctx.beginPath(); ctx.moveTo(curX - 8, curY); ctx.lineTo(curX + 8, curY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(curX, curY - 8); ctx.lineTo(curX, curY + 8); ctx.stroke();
      } break;
    }
    case 'column': {
      ctx.setLineDash([]); const r = Math.max(4, ppu * 0.15);
      ctx.beginPath(); ctx.arc(curX, curY, r, 0, Math.PI * 2); ctx.stroke(); break;
    }
    case 'stairs': {
      if (pts.length > 0) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(curX, curY); ctx.stroke(); } break;
    }
  }

  ctx.setLineDash([]);
  for (const [px, py] of pts) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(curX, curY, 3, 0, Math.PI * 2); ctx.fill();
}
