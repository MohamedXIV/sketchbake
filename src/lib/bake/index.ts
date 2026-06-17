/**
 * SketchBake — Bake Engine
 *
 * One entry point. Dispatches each SketchShape to its geometry builder.
 * All builders are pure, synchronous functions: SketchShape → BakedMesh.
 */

import type { BakeResult, BakedMesh, SketchDoc, SketchShape } from '../schema/types';
import { bakeWall }   from './builders/wall';
import { bakeRoom }   from './builders/room';
import { bakeDome }   from './builders/dome';
import { bakeColumn } from './builders/column';
import { bakeArch }   from './builders/arch';
import { bakeStairs } from './builders/stairs';

export async function bakeSketch(
  sketch: SketchDoc,
  snapshotId: string,
): Promise<BakeResult> {
  const meshes: BakedMesh[] = [];

  for (const shape of sketch.shapes) {
    const mesh = bakeShape(shape);
    if (mesh) meshes.push(mesh);
  }

  return { snapshotId, meshes, bakedAt: new Date().toISOString() };
}

function bakeShape(shape: SketchShape): BakedMesh | null {
  try {
    switch (shape.kind) {
      case 'wall':   return bakeWall(shape);
      case 'room':   return bakeRoom(shape);
      case 'dome':   return bakeDome(shape);
      case 'column': return bakeColumn(shape);
      case 'arch':   return bakeArch(shape);
      case 'stairs': return bakeStairs(shape);
      // 'custom' — TODO
      default:
        console.warn(`[bake] No builder registered for: ${shape.kind}`);
        return null;
    }
  } catch (err) {
    console.error(`[bake] Shape ${shape.id} (${shape.kind}) failed:`, err);
    return null;
  }
}
