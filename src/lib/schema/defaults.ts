import type { BakeParams, ShapeKind, SketchDoc, HistoryTree } from './types';
import { nanoid } from 'nanoid';

/** Default bake parameters for each shape kind */
export function defaultParams(kind: ShapeKind): BakeParams {
  switch (kind) {
    case 'wall':   return { kind: 'wall',   height: 3,     thickness: 0.2 };
    case 'room':   return { kind: 'room',   floorHeight: 0.2, wallHeight: 3, wallThickness: 0.2, ceiling: false };
    case 'dome':   return { kind: 'dome',   height: 4,     segments: 32, base: 'open' };
    case 'arch':   return { kind: 'arch',   height: 3,     thickness: 0.3, depth: 1 };
    case 'stairs': return { kind: 'stairs', stepHeight: 0.2, stepDepth: 0.3, width: 1.2 };
    case 'column': return { kind: 'column', radius: 0.15,  height: 3, segments: 12 };
    case 'cut':    return { kind: 'cut',    height: 2.1,   sillHeight: 0 }; // door by default
    case 'custom': return { kind: 'custom', extrudeDepth: 1 };
  }
}

/** Create a blank SketchDoc */
export function createSketchDoc(name = 'Untitled'): SketchDoc {
  const now = new Date().toISOString();
  return { id: nanoid(), name, shapes: [], gridSize: 1, meta: { createdAt: now, updatedAt: now } };
}

/** Create a new HistoryTree with one root snapshot */
export function createHistoryTree(sketch: SketchDoc): HistoryTree {
  const rootId = nanoid();
  return {
    rootId,
    activeNodeId: rootId,
    nodes: {
      [rootId]: {
        id: rootId, parentId: null, childrenIds: [],
        sketch, label: 'Initial sketch',
        createdAt: new Date().toISOString(),
      },
    },
  };
}
