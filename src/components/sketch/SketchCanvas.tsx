'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useSketchStore } from '../../store/useSketchStore';
import type {
  Vec2, SketchShape, ShapeKind,
  WallParams, RoomParams, ColumnParams, CutParams, DomeParams, ArchParams, StairsParams,
} from '../../lib/schema/types';

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
  wall: '#60a5fa', room: '#34d399', dome: '#a78bfa', arch: '#f59e0b',
  stairs: '#fb923c', column: '#f472b6', cut: '#ef4444', custom: '#94a3b8',
};

// ---- Pure coordinate helpers (canvas <-> "view space") ----
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

// ================================================================
// ELEVATION PROJECTION ENGINE
//
// Every non-top view (front/side) computes a shape's *actual* 3D
// footprint + height, then flattens it onto the relevant plane.
// This is what makes "switch to Side" genuinely show the side of
// the structure, instead of just relabelling the same plan view.
//
// Convention fed into toCanvas: (h, -trueHeight)
//   h           = the world coordinate along the view's horizontal axis
//   -trueHeight = negated so larger height draws higher on screen
//                 (canvas Y grows downward)
// ================================================================

type ElevationOutline =
  | { kind: 'rect'; hMin: number; hMax: number; yMin: number; yMax: number }
  | { kind: 'curve'; points: { h: number; y: number }[]; fillBaseline?: boolean; lineWidthWorld?: number };

function getElevationOutline(shape: SketchShape, view: 'front' | 'side'): ElevationOutline | null {
  const hOf = (p: Vec2) => (view === 'front' ? p.x : p.y); // p.y always holds world Z

  switch (shape.kind) {
    case 'wall': {
      const params = shape.params as WallParams;
      const [p0, p1] = shape.points;
      if (!p0 || !p1) return null;
      const dx = p1.x - p0.x, dz = p1.y - p0.y;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) return null;
      const angle = Math.atan2(dz, dx);
      const perp  = angle + Math.PI / 2;
      const hx = Math.cos(perp) * params.thickness / 2;
      const hz = Math.sin(perp) * params.thickness / 2;
      // True footprint corners — same box math as the wall bake builder
      const corners: Vec2[] = [
        { x: p0.x + hx, y: p0.y + hz },
        { x: p0.x - hx, y: p0.y - hz },
        { x: p1.x + hx, y: p1.y + hz },
        { x: p1.x - hx, y: p1.y - hz },
      ];
      const hs = corners.map(hOf);
      return { kind: 'rect', hMin: Math.min(...hs), hMax: Math.max(...hs), yMin: 0, yMax: params.height };
    }

    case 'room': {
      const params = shape.params as RoomParams;
      if (shape.points.length < 3) return null;
      const hs = shape.points.map(hOf);
      return { kind: 'rect', hMin: Math.min(...hs), hMax: Math.max(...hs), yMin: 0, yMax: params.wallHeight };
    }

    case 'column': {
      const params = shape.params as ColumnParams;
      const [c] = shape.points;
      if (!c) return null;
      const h = hOf(c);
      return { kind: 'rect', hMin: h - params.radius, hMax: h + params.radius, yMin: 0, yMax: params.height };
    }

    case 'cut': {
      const params = shape.params as CutParams;
      const [p0, p1] = shape.points;
      if (!p0 || !p1) return null;
      const hs = [hOf(p0), hOf(p1)];
      return {
        kind: 'rect',
        hMin: Math.min(...hs), hMax: Math.max(...hs),
        yMin: params.sillHeight, yMax: params.sillHeight + params.height,
      };
    }

    case 'dome': {
      // Rotationally symmetric — front and side views share the identical
      // profile curve (any vertical plane through the axis cuts the same shape).
      const params = shape.params as DomeParams;
      const [centre, edge] = shape.points;
      if (!centre || !edge) return null;
      const radius  = dist2(centre, edge);
      const hCentre = hOf(centre);
      const N = 24;
      const points: { h: number; y: number }[] = [];
      for (let i = 0; i <= N; i++) {
        const s = -1 + (2 * i) / N;
        const y = params.height * Math.sqrt(Math.max(0, 1 - s * s));
        points.push({ h: hCentre + s * radius, y });
      }
      return { kind: 'curve', points, fillBaseline: true };
    }

    case 'arch': {
      // Same arc math as the arch bake builder, projected onto the view axis.
      // If the arch runs perpendicular to the view, h0≈h1 and the curve
      // naturally degenerates into a thin vertical band — i.e. you're
      // looking at the arch end-on, which is exactly correct.
      const params = shape.params as ArchParams;
      const [p0, p1] = shape.points;
      if (!p0 || !p1) return null;
      const h0 = hOf(p0), h1 = hOf(p1);
      const N = 24;
      const points: { h: number; y: number }[] = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * Math.PI;
        const u = Math.cos(Math.PI - t); // -1..1
        points.push({ h: h0 + (h1 - h0) * (u + 1) / 2, y: Math.sin(t) * params.height });
      }
      return { kind: 'curve', points, lineWidthWorld: params.thickness };
    }

    case 'stairs': {
      const params = shape.params as StairsParams;
      const [p0, p1] = shape.points;
      if (!p0 || !p1) return null;
      const totalRun = dist2(p0, p1);
      if (totalRun < 1e-6) return null;
      const numSteps    = Math.max(1, Math.round(totalRun / params.stepDepth));
      const totalHeight = numSteps * params.stepHeight;
      const h0 = hOf(p0), h1 = hOf(p1);
      const hDelta = h1 - h0;
      const isEndOn = Math.abs(hDelta) < totalRun * 0.15; // run is mostly perpendicular to this view

      if (isEndOn) {
        const hc = (h0 + h1) / 2;
        return { kind: 'rect', hMin: hc - params.width / 2, hMax: hc + params.width / 2, yMin: 0, yMax: totalHeight };
      }

      // Real stepped silhouette: tread → riser → tread → riser…
      const points: { h: number; y: number }[] = [{ h: h0, y: 0 }];
      for (let i = 1; i <= numSteps; i++) {
        const h = h0 + hDelta * (i / numSteps);
        points.push({ h, y: (i - 1) * params.stepHeight });
        points.push({ h, y: i * params.stepHeight });
      }
      return { kind: 'curve', points };
    }

    default:
      return null; // 'custom' — not yet supported in elevation
  }
}

/** Hit-test distance for click selection in elevation views. 0 = inside/on. */
function elevationHit(pos: Vec2, outline: ElevationOutline): number {
  if (outline.kind === 'rect') {
    const trueY = -pos.y;
    const insideH = pos.x >= outline.hMin - 0.05 && pos.x <= outline.hMax + 0.05;
    const insideY = trueY >= outline.yMin - 0.05 && trueY <= outline.yMax + 0.05;
    if (insideH && insideY) return 0;
    const dx = Math.max(outline.hMin - pos.x, 0, pos.x - outline.hMax);
    const dy = Math.max(outline.yMin - trueY, 0, trueY - outline.yMax);
    return Math.hypot(dx, dy);
  }
  let best = Infinity;
  for (const p of outline.points) {
    const d = Math.hypot(p.h - pos.x, -p.y - pos.y);
    if (d < best) best = d;
  }
  return best;
}

/** Bounding centre of an outline, in the same (h, -trueHeight) space as cursor pos */
function getElevationCenter(outline: ElevationOutline): Vec2 {
  if (outline.kind === 'rect') {
    return { x: (outline.hMin + outline.hMax) / 2, y: -(outline.yMin + outline.yMax) / 2 };
  }
  const n = outline.points.length;
  const sum = outline.points.reduce((a, p) => ({ h: a.h + p.h, y: a.y + p.y }), { h: 0, y: 0 });
  return { x: sum.h / n, y: -(sum.y / n) };
}

function drawShapeElevation(
  ctx: CanvasRenderingContext2D,
  shape: SketchShape,
  w: number, h: number,
  ppu: number, pan: { x: number; y: number },
  selected: boolean,
  view: 'front' | 'side',
) {
  const outline = getElevationOutline(shape, view);
  if (!outline) return;
  const col = selected ? '#f97316' : (COLOR[shape.kind] ?? '#94a3b8');

  if (outline.kind === 'rect') {
    const [x0, y0] = toCanvas(outline.hMin, -outline.yMax, w, h, ppu, pan); // top-left
    const [x1, y1] = toCanvas(outline.hMax, -outline.yMin, w, h, ppu, pan); // bottom-right
    const rx = Math.min(x0, x1), ry = Math.min(y0, y1);
    const rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);

    ctx.setLineDash(shape.kind === 'cut' ? [4, 3] : []);
    ctx.strokeStyle = col;
    ctx.lineWidth   = selected ? 2 : 1.5;
    ctx.fillStyle   = col + (shape.kind === 'cut' ? '18' : '22');
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);

    ctx.fillStyle = col + 'cc'; ctx.font = '9px monospace';
    ctx.fillText(`${(outline.hMax - outline.hMin).toFixed(1)}×${(outline.yMax - outline.yMin).toFixed(1)}m`, rx + 3, ry - 4);
  } else {
    ctx.setLineDash([]);
    ctx.strokeStyle = col;
    ctx.lineWidth   = outline.lineWidthWorld ? Math.max(2, outline.lineWidthWorld * ppu) : (selected ? 2 : 1.5);

    const pts = outline.points.map(p => toCanvas(p.h, -p.y, w, h, ppu, pan));
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);

    if (outline.fillBaseline) {
      const [bx, by] = toCanvas(outline.points[outline.points.length - 1].h, 0, w, h, ppu, pan);
      const [ax, ay] = toCanvas(outline.points[0].h, 0, w, h, ppu, pan);
      ctx.lineTo(bx, by);
      ctx.lineTo(ax, ay);
      ctx.closePath();
      ctx.fillStyle = col + '22';
      ctx.fill();
    }
    ctx.stroke();
  }

  if (shape.kind !== 'cut') {
    const center = getElevationCenter(outline);
    const [lx, ly] = toCanvas(center.x, center.y, w, h, ppu, pan);
    ctx.fillStyle = col + 'bb'; ctx.font = '9px monospace';
    ctx.fillText(shape.label ?? shape.kind, lx + 8, ly - 6);
  }
}

interface InProgress { points: Vec2[]; cursor: Vec2 | null; }

const BTN = 'px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer';
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

  const isPanning = useRef(false);
  const panStart  = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const spaceHeld = useRef(false);

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
      const v   = viewRef.current;
      const vm  = VIEW_META[v];

      canvas.style.cursor =
        isPanning.current ? 'grabbing' :
        spaceHeld.current ? 'grab' :
        activeTool === 'select' ? 'default' : 'crosshair';

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#161622';
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h, ppu, pan, vm);

      for (const shape of sketch.shapes) {
        const selected = selectedShapeIds.includes(shape.id);
        if (v === 'top') drawShapeTop(ctx, shape, w, h, ppu, pan, selected);
        else drawShapeElevation(ctx, shape, w, h, ppu, pan, selected, v);
      }

      const { points, cursor } = ip.current;
      if (cursor && v === 'top') drawPreview(ctx, activeTool, points, cursor, w, h, ppu, pan);
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
      const vVal = view === 'top' ? pos.y : -pos.y; // elevation: show true height, not the flipped internal value
      coordsRef.current.textContent = `${hAxis} ${pos.x.toFixed(1)}  ${vAxis} ${vVal.toFixed(1)}`;
    }
  }, [canvasXY, worldPos, view]);

  const handleMouseUp = useCallback(() => { if (isPanning.current) { isPanning.current = false; renderRef.current(); } }, []);
  const handleMouseLeave = useCallback(() => {
    isPanning.current = false; ip.current.cursor = null; renderRef.current();
    if (coordsRef.current) coordsRef.current.textContent = '';
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (spaceHeld.current || e.button !== 0) return;
    const { cx, cy } = canvasXY(e);
    const pos = worldPos(cx, cy);

    // ---- Select: works in every view, using the right hit-test per view ----
    if (activeTool === 'select') {
      let best: string | null = null;
      let bestD = view === 'top' ? 1.2 : 1.0;
      for (const shape of sketch.shapes) {
        if (view === 'top') {
          const d = dist2(centroid(shape.points), pos);
          if (d < bestD) { bestD = d; best = shape.id; }
        } else {
          const outline = getElevationOutline(shape, view);
          if (!outline) continue;
          const d = elevationHit(pos, outline);
          if (d < bestD) { bestD = d; best = shape.id; }
        }
      }
      setSelectedShapes(best ? [best] : []);
      return;
    }

    // ---- Drawing is plan-only: shapes are sketched in Top view, then
    //      Front/Side just show the computed result. No-op elsewhere. ----
    if (view !== 'top') return;

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
  }, [activeTool, sketch.shapes, addShape, setSelectedShapes, canvasXY, worldPos, view]);

  const handleDblClick = useCallback(() => {
    if (view === 'top' && activeTool === 'room' && ip.current.points.length >= 3) {
      addShape('room', [...ip.current.points]); ip.current.points = []; renderRef.current();
    }
  }, [activeTool, addShape, view]);

  // ---- View / zoom controls ----
  const handleSetView = useCallback((v: CanvasView) => {
    ppuRef.current = DEFAULT_PPU;
    panRef.current = { x: 0, y: 0 };
    ip.current     = { points: [], cursor: null }; // discard any in-progress draw on view switch
    syncZoomLabel();
    setView(v);
  }, [syncZoomLabel]);

  const handleZoomBtn = useCallback((dir: 1 | -1) => {
    const factor = dir > 0 ? 1.25 : 1 / 1.25;
    const newPPU  = Math.max(MIN_PPU, Math.min(MAX_PPU, ppuRef.current * factor));
    const ratio   = newPPU / ppuRef.current;
    panRef.current = { x: panRef.current.x * ratio, y: panRef.current.y * ratio };
    ppuRef.current = newPPU;
    syncZoomLabel(); renderRef.current();
  }, [syncZoomLabel]);

  const handleResetView = useCallback(() => {
    ppuRef.current = DEFAULT_PPU; panRef.current = { x: 0, y: 0 };
    syncZoomLabel(); renderRef.current();
  }, [syncZoomLabel]);

  const drawingDisabled = view !== 'top' && activeTool !== 'select';

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
          <button key={v} onClick={() => handleSetView(v)} className={view === v ? BTN_ON : BTN_OFF} title={VIEW_META[v].label}>
            {v}
          </button>
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

      {/* Mode hints */}
      {drawingDisabled ? (
        <div className="absolute top-2 left-2 bg-neutral-900/85 border border-neutral-700 rounded px-2 py-1 pointer-events-none">
          <span className="text-[10px] font-mono text-neutral-400">
            {VIEW_META[view].label} is a live preview — switch to <b className="text-orange-400">Top</b> to draw
          </span>
        </div>
      ) : activeTool === 'cut' && view === 'top' && (
        <div className="absolute top-2 left-2 bg-red-950/80 border border-red-800 rounded px-2 py-1 pointer-events-none">
          <span className="text-[10px] font-mono text-red-400">
            ✂ Cut — click two corners to draw a subtraction volume
          </span>
        </div>
      )}

      {/* Empty state */}
      {sketch.shapes.length === 0 && view === 'top' && (
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
// Top-view (plan) drawing — unchanged from before
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

function drawShapeTop(
  ctx: CanvasRenderingContext2D,
  shape: SketchShape,
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
      ctx.fillStyle = col + 'bb'; ctx.font = '9px monospace';
      ctx.fillText(`${(rw / ppu).toFixed(1)}×${(rh / ppu).toFixed(1)}m`, minX + 3, minY - 4);
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
        const minX = Math.min(pts[0][0], curX), minY = Math.min(pts[0][1], curY);
        const rw = Math.abs(curX - pts[0][0]), rh = Math.abs(curY - pts[0][1]);
        ctx.fillStyle = col + '18'; ctx.fillRect(minX, minY, rw, rh);
        ctx.strokeRect(minX, minY, rw, rh);
        ctx.setLineDash([]); ctx.fillStyle = col; ctx.font = '9px monospace';
        ctx.fillText(`${(rw / ppu).toFixed(1)}×${(rh / ppu).toFixed(1)}m`, minX + 3, minY - 4);
      } else {
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
