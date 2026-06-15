/**
 * Wall builder
 * Line segment (2 points) → extruded box mesh
 *
 * The wall is built along the XZ plane (Y = up).
 * Direction: from points[0] to points[1]
 */

import * as THREE from 'three';
import type { BakedMesh, SketchShape, WallParams } from '../../schema/types';

export function bakeWall(shape: SketchShape): BakedMesh {
  const params = shape.params as WallParams;
  const [p0, p1] = shape.points;

  if (!p0 || !p1) throw new Error('Wall requires exactly 2 points');

  const dx = p1.x - p0.x;
  const dz = p1.y - p0.y; // canvas Y maps to world Z
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);

  const geometry = new THREE.BoxGeometry(
    length,
    params.height,
    params.thickness
  );

  // Rotate and position
  const matrix = new THREE.Matrix4();
  matrix.makeRotationY(-angle);
  matrix.setPosition(
    (p0.x + p1.x) / 2,
    params.height / 2,
    (p0.y + p1.y) / 2
  );
  geometry.applyMatrix4(matrix);

  return geometryToBakedMesh(shape, geometry);
}

function geometryToBakedMesh(shape: SketchShape, geometry: THREE.BufferGeometry): BakedMesh {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const idxAttr = geometry.getIndex();

  return {
    shapeId: shape.id,
    shapeKind: shape.kind,
    materialTag: shape.materialTag,
    positions: new Float32Array(posAttr.array),
    indices: idxAttr ? new Uint32Array(idxAttr.array) : new Uint32Array([]),
  };
}
