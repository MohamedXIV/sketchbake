'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useSketchStore } from '../../store/useSketchStore';
import type { Vec2, SketchShape, ShapeKind } from '../../lib/schema/types';

const PPU = 40; // pixels per world unit
const GRID = 1;  // world units per grid cell

// ---- Coord helpers ----
function toWorld(cx: number, cy: number, w: number, h: number): Vec2 {
  return { x: (cx - w / 2) / PPU, y: (cy - h / 2) / PPU };
}
function toCanvas(wx: number, wy: number, w: number, h: number): [number, number] {
  return [wx * PPU + w / 2, wy * PPU + h / 2];
}
function snap(v: Vec2): Vec2 {
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

// ---- Colors ----
const COLOR: Record<string, string> = {
  wall:   '#60a5fa',
  room:   '#34d399',
  dome:   '#a78bfa',
  arch:   '#f59e0b',
  stairs: '#fb923c',
  column: '#f472b6',
  custom: '#94a3b8',
};

interface InProgress { points: Vec2[]; cursor: Vec2 | null; }

export function SketchCanvas() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sizeRef      = useRef({ w: 800, h: 600 });
  const ip           = useRef<InProgress>({ points: [], cursor: null });
  const renderRef    = useRef<() => void>(() => {});

  const sketch           = useSketchStore(s => s.sketch);
  const activeTool       = useSketchStore(s => s.activeTool);
  const selectedShapeIds = useSketchStore(s => s.selectedShapeIds);
  const addShape         = useSketchStore(s => s.addShape);
  const setSelectedShapes = useSketchStore(s => s.setSelectedShapes);

  // Keep renderRef up to date with latest state
  useEffect(() => {
    renderRef.current = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { w, h } = sizeRef.current;

      ctx.clearRect(0, 0, w, h);
      drawBackground(ctx, w, h);
      drawGrid(ctx, w, h);
      for (const shape of sketch.shapes)
        drawShape(ctx, shape, w, h, selectedShapeIds.includes(shape.id));
      const { points, cursor } = ip.current;
      if (cursor) drawPreview(ctx, activeTool, points, cursor, w, h);
    };
    renderRef.current();
  }, [sketch, selectedShapeIds, activeTool]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      sizeRef.current = { w, h };
      const canvas = canvasRef.current;
      if (canvas) { canvas.width = w; canvas.height = h; }
      renderRef.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Vec2 => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    return snap(toWorld(e.clientX - rect.left, e.clientY - rect.top, w, h));
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    ip.current.cursor = getPos(e);
    renderRef.current();
  }, [getPos]);

  const handleMouseLeave = useCallback(() => {
    ip.current.cursor = null;
    renderRef.current();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);

    // Select tool: pick closest shape
    if (activeTool === 'select') {
      let best: string | null = null;
      let bestD = 1.2;
      for (const shape of sketch.shapes) {
        const d = dist2(centroid(shape.points), pos);
        if (d < bestD) { bestD = d; best = shape.id; }
      }
      setSelectedShapes(best ? [best] : []);
      return;
    }

    // Room: accumulate points, close on click near origin or dbl-click
    if (activeTool === 'room') {
      if (ip.current.points.length >= 3 && dist2(pos, ip.current.points[0]) < 0.7) {
        addShape('room', [...ip.current.points]);
        ip.current.points = [];
      } else {
        ip.current.points = [...ip.current.points, pos];
      }
      renderRef.current();
      return;
    }

    // Other tools: collect required points then commit
    ip.current.points = [...ip.current.points, pos];
    const required: Partial<Record<string, number>> = { wall: 2, dome: 2, column: 1, arch: 2 };
    const need = required[activeTool];
    if (need && ip.current.points.length >= need) {
      addShape(activeTool as ShapeKind, [...ip.current.points]);
      ip.current.points = [];
    }
    renderRef.current();
  }, [activeTool, sketch.shapes, addShape, setSelectedShapes, getPos]);

  const handleDblClick = useCallback(() => {
    if (activeTool === 'room' && ip.current.points.length >= 3) {
      addShape('room', [...ip.current.points]);
      ip.current.points = [];
      renderRef.current();
    }
  }, [activeTool, addShape]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          position: 'absolute',
          inset: 0,
          cursor: activeTool === 'select' ? 'default' : 'crosshair',
        }}
      />
      <div className="absolute bottom-2 left-2 text-[10px] text-neutral-600 font-mono pointer-events-none">
        {PPU}px = 1m · snap {GRID}m
      </div>
    </div>
  );
}

// Attach imperative events after mount so we don't re-bind on every render
// (we use the canvas element directly via ref in handlers above via useCallback)
// Note: we attach them as React synthetic events on the canvas element below.
// Actually they are attached via JSX — re-adding them properly:

// ---- Draw helpers ----

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#161622';
  ctx.fillRect(0, 0, w, h);
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const step = GRID * PPU;
  const ox = (w / 2) % step;
  const oy = (h / 2) % step;

  ctx.strokeStyle = '#22223a';
  ctx.lineWidth = 0.5;
  for (let x = ox; x <= w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = oy; y <= h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  ctx.strokeStyle = '#2e2e4a';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: SketchShape,
  w: number,
  h: number,
  selected: boolean,
) {
  const col = selected ? '#f97316' : (COLOR[shape.kind] ?? '#94a3b8');
  const pts = shape.points.map(p => toCanvas(p.x, p.y, w, h));
  ctx.strokeStyle = col;
  ctx.lineWidth = selected ? 2 : 1.5;
  ctx.setLineDash([]);

  switch (shape.kind) {
    case 'wall': {
      if (pts.length < 2) return;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.stroke();
      for (const [px, py] of pts) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'room': {
      if (pts.length < 2) return;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = col + '22'; ctx.fill();
      ctx.stroke();
      break;
    }
    case 'dome': {
      if (pts.length < 2) return;
      const r = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
      ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], r, 0, Math.PI * 2);
      ctx.fillStyle = col + '22'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'column': {
      if (pts.length < 1) return;
      ctx.fillStyle = col + '55';
      ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }
    default: {
      if (pts.length < 2) return;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  }

  // Shape label
  const c = centroid(shape.points);
  const [lx, ly] = toCanvas(c.x, c.y, w, h);
  ctx.fillStyle = col;
  ctx.font = '10px monospace';
  ctx.fillText(shape.label ?? shape.kind, lx + 8, ly - 6);
}

function drawPreview(
  ctx: CanvasRenderingContext2D,
  tool: string,
  points: Vec2[],
  cursor: Vec2,
  w: number,
  h: number,
) {
  const col = '#f97316';
  const [curX, curY] = toCanvas(cursor.x, cursor.y, w, h);
  const pts = points.map(p => toCanvas(p.x, p.y, w, h));

  ctx.strokeStyle = col;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);

  switch (tool) {
    case 'wall': {
      if (pts.length > 0) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(curX, curY); ctx.stroke(); }
      break;
    }
    case 'room': {
      ctx.beginPath();
      if (pts.length > 0) {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      } else { ctx.moveTo(curX, curY); }
      ctx.lineTo(curX, curY);
      ctx.stroke();
      // Close hint ring when near first point
      if (pts.length >= 3) {
        ctx.setLineDash([]);
        ctx.strokeStyle = col + '60';
        ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 10, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case 'dome': {
      if (pts.length > 0) {
        const r = Math.hypot(curX - pts[0][0], curY - pts[0][1]);
        ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], r, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case 'column': {
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(curX, curY, 8, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'arch': {
      if (pts.length > 0) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(curX, curY); ctx.stroke(); }
      break;
    }
  }

  ctx.setLineDash([]);
  // Committed points
  for (const [px, py] of pts) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); }
  // Cursor dot
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(curX, curY, 3, 0, Math.PI * 2); ctx.fill();
}
