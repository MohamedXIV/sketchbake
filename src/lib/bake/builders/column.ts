/**
 * Column builder
 * Single point → CylinderGeometry
 */

import * as THREE from 'three';
import type { BakedMesh, ColumnParams, SketchShape } from '../../schema/types';

export function bakeColumn(shape: SketchShape): BakedMesh {
  const params = shape.params as ColumnParams;
  const [centre] = shape.points;

  if (!centre) throw new Error('Column requires a centre point');

  const geometry = new THREE.CylinderGeometry(
    params.radius,
    params.radius,
    params.height,
    params.segments
  );
  geometry.applyMatrix4(
    new THREE.Matrix4().setPosition(centre.x, params.height / 2, centre.y)
  );

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
