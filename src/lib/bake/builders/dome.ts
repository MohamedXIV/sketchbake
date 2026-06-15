/**
 * Dome builder
 * Circle (centre point + radius from points[1]) → LatheGeometry hemisphere
 */

import * as THREE from 'three';
import type { BakedMesh, DomeParams, SketchShape } from '../../schema/types';

export function bakeDome(shape: SketchShape): BakedMesh {
  const params = shape.params as DomeParams;
  const [centre, edge] = shape.points;

  if (!centre || !edge) throw new Error('Dome requires centre + edge point');

  const dx = edge.x - centre.x;
  const dz = edge.y - centre.y;
  const radius = Math.sqrt(dx * dx + dz * dz);

  // Profile: semicircle in the XY plane for LatheGeometry
  const profilePoints: THREE.Vector2[] = [];
  const steps = params.segments;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 0.5; // quarter-circle for a dome
    profilePoints.push(new THREE.Vector2(
      Math.cos(t) * radius,
      Math.sin(t) * params.height
    ));
  }
  if (params.base === 'closed') {
    profilePoints.push(new THREE.Vector2(0, params.height));
  }

  const geometry = new THREE.LatheGeometry(profilePoints, params.segments);
  geometry.applyMatrix4(new THREE.Matrix4().setPosition(centre.x, 0, centre.y));

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
