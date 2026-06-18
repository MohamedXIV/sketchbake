/**
 * SketchBake — Bake Engine
 *
 * Two-phase:
 *   1. Bake all solid shapes to BakedMesh
 *   2. Collect all 'cut' shapes, build their Geom3 volumes,
 *      subtract from every intersecting solid mesh via CSG.
 */

import * as THREE from 'three';
import type { BakeResult, BakedMesh, CutParams, SketchDoc, SketchShape } from '../schema/types';
import { bakeWall }   from './builders/wall';
import { bakeRoom }   from './builders/room';
import { bakeDome }   from './builders/dome';
import { bakeColumn } from './builders/column';
import { bakeArch }   from './builders/arch';
import { bakeStairs } from './builders/stairs';
import { buildCutGeom, applyCSGCuts } from './csg';

export async function bakeSketch(
  sketch: SketchDoc,
  snapshotId: string,
): Promise<BakeResult> {
  const solids = sketch.shapes.filter(s => s.kind !== 'cut');
  const cuts   = sketch.shapes.filter(s => s.kind === 'cut');

  // ---- Phase 1: bake solid shapes ----
  const meshes: BakedMesh[] = [];
  for (const shape of solids) {
    const mesh = bakeShape(shape);
    if (mesh) meshes.push(mesh);
  }

  // ---- Phase 2: apply CSG cuts ----
  if (cuts.length > 0 && meshes.length > 0) {
    // Build cut Geom3 volumes (null = malformed cut, skip)
    const cutGeoms = cuts
      .map(c => buildCutGeom(c))
      .filter((g): g is NonNullable<typeof g> => g !== null);

    if (cutGeoms.length > 0) {
      const carved = meshes.map(mesh => carveMesh(mesh, cutGeoms));
      return { snapshotId, meshes: carved, bakedAt: new Date().toISOString() };
    }
  }

  return { snapshotId, meshes, bakedAt: new Date().toISOString() };
}

// ---- Dispatch solid shapes ----
function bakeShape(shape: SketchShape): BakedMesh | null {
  try {
    switch (shape.kind) {
      case 'wall':   return bakeWall(shape);
      case 'room':   return bakeRoom(shape);
      case 'dome':   return bakeDome(shape);
      case 'column': return bakeColumn(shape);
      case 'arch':   return bakeArch(shape);
      case 'stairs': return bakeStairs(shape);
      default:
        console.warn(`[bake] No builder for: ${shape.kind}`);
        return null;
    }
  } catch (err) {
    console.error(`[bake] Shape ${shape.id} (${shape.kind}) failed:`, err);
    return null;
  }
}

// ---- Apply CSG to a single BakedMesh ----
function carveMesh(
  mesh: BakedMesh,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cutGeoms: any[],
): BakedMesh {
  // Organic shapes (dome, arch) are skipped — CSG on curved meshes is unreliable
  const SKIP: BakedMesh['shapeKind'][] = ['dome', 'arch'];
  if (SKIP.includes(mesh.shapeKind)) return mesh;

  try {
    // Reconstruct a BufferGeometry from the BakedMesh data
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions.slice(), 3));
    geo.setIndex(new THREE.BufferAttribute(mesh.indices.slice(), 1));

    const carved = applyCSGCuts(geo, cutGeoms);

    const posAttr = carved.getAttribute('position') as THREE.BufferAttribute;
    const idxAttr = carved.getIndex();

    return {
      ...mesh,
      positions: new Float32Array(posAttr.array),
      indices:   idxAttr ? new Uint32Array(idxAttr.array) : new Uint32Array([]),
      normals:   undefined, // recomputed inside applyCSGCuts
    };
  } catch (err) {
    console.warn(`[bake] CSG carve failed for ${mesh.shapeId}, returning original:`, err);
    return mesh;
  }
}
