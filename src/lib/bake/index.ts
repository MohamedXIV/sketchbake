/**
 * SketchBake — Bake Engine entry point
 *
 * Converts a SketchDoc into BakedMesh[] by dispatching
 * each shape to its geometry builder.
 *
 * Builders are registered here; add new ShapeKind builders
 * by implementing the BakeBuilder interface and registering below.
 */

import type { BakeResult, BakedMesh, SketchDoc, SketchShape } from '../schema/types';
import { bakeWall }   from './builders/wall';
import { bakeRoom }   from './builders/room';
import { bakeDome }   from './builders/dome';
import { bakeColumn } from './builders/column';

export async function bakeSketch(sketch: SketchDoc, snapshotId: string): Promise<BakeResult> {
  const meshes: BakedMesh[] = [];

  for (const shape of sketch.shapes) {
    const mesh = await bakeShape(shape);
    if (mesh) meshes.push(mesh);
  }

  return { snapshotId, meshes, bakedAt: new Date().toISOString() };
}

async function bakeShape(shape: SketchShape): Promise<BakedMesh | null> {
  try {
    switch (shape.kind) {
      case 'wall':   return bakeWall(shape);
      case 'room':   return bakeRoom(shape);
      case 'dome':   return bakeDome(shape);
      case 'column': return bakeColumn(shape);
      // TODO: arch, stairs, custom
      default:
        console.warn(`[bake] No builder for shape kind: ${shape.kind}`);
        return null;
    }
  } catch (err) {
    console.error(`[bake] Failed to bake shape ${shape.id}:`, err);
    return null;
  }
}
