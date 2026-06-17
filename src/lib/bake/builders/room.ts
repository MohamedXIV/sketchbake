/**
 * Room builder
 * Closed polygon → floor slab + extruded walls per edge + optional ceiling
 *
 * Uses mergeGeometries to combine all sub-meshes into a single BakedMesh.
 */

import * as THREE from 'three';
import earcut from 'earcut';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BakedMesh, RoomParams, SketchShape } from '../../schema/types';

export function bakeRoom(shape: SketchShape): BakedMesh {
  const params = shape.params as RoomParams;
  const pts    = shape.points;

  if (pts.length < 3) throw new Error('Room requires at least 3 points');

  const geos: THREE.BufferGeometry[] = [];

  // ---- Floor slab ----
  const flatCoords = pts.flatMap(p => [p.x, p.y]);
  const triIndices  = earcut(flatCoords);
  const floorGeo    = new THREE.BufferGeometry();
  floorGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(pts.flatMap(p => [p.x, 0, p.y]), 3),
  );
  floorGeo.setIndex(triIndices);
  floorGeo.computeVertexNormals();
  geos.push(floorGeo);

  // ---- Wall per edge ----
  for (let i = 0; i < pts.length; i++) {
    const a  = pts[i];
    const b  = pts[(i + 1) % pts.length];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) continue;

    const angle   = Math.atan2(dz, dx);
    const wallGeo = new THREE.BoxGeometry(len, params.wallHeight, params.wallThickness);
    const matrix  = new THREE.Matrix4();
    matrix.makeRotationY(-angle);
    matrix.setPosition((a.x + b.x) / 2, params.wallHeight / 2, (a.y + b.y) / 2);
    wallGeo.applyMatrix4(matrix);
    geos.push(wallGeo);
  }

  // ---- Ceiling slab (optional) ----
  if (params.ceiling) {
    const ceilGeo = new THREE.BufferGeometry();
    ceilGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(pts.flatMap(p => [p.x, params.wallHeight, p.y]), 3),
    );
    ceilGeo.setIndex([...triIndices]);
    ceilGeo.computeVertexNormals();
    geos.push(ceilGeo);
  }

  const merged = mergeGeometries(geos, false);
  if (!merged) throw new Error('Room geometry merge failed');
  merged.computeVertexNormals();

  const posAttr = merged.getAttribute('position') as THREE.BufferAttribute;
  const idxAttr = merged.getIndex();

  return {
    shapeId:     shape.id,
    shapeKind:   shape.kind,
    materialTag: shape.materialTag,
    positions:   new Float32Array(posAttr.array),
    indices:     idxAttr ? new Uint32Array(idxAttr.array) : new Uint32Array([]),
  };
}
