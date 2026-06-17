/**
 * Stairs builder
 * 2 points define the run direction (foot → top)
 * Generates a stepped mesh: each tread is taller than the last,
 * producing a proper staircase profile.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BakedMesh, SketchShape, StairsParams } from '../../schema/types';

export function bakeStairs(shape: SketchShape): BakedMesh {
  const params = shape.params as StairsParams;
  const [p0, p1] = shape.points;
  if (!p0 || !p1) throw new Error('Stairs requires exactly 2 points');

  const dx       = p1.x - p0.x;
  const dz       = p1.y - p0.y;
  const totalRun = Math.sqrt(dx * dx + dz * dz);
  const angle    = Math.atan2(dz, dx);
  const numSteps = Math.max(1, Math.round(totalRun / params.stepDepth));

  const geos: THREE.BufferGeometry[] = [];

  for (let i = 0; i < numSteps; i++) {
    // Cumulative height up to this step
    const stepH   = (i + 1) * params.stepHeight;
    // Centre of the step along the run
    const localRun = (i + 0.5) * params.stepDepth;

    // Box: length=stepDepth (along run), height=stepH (cumulative), depth=width
    const geo = new THREE.BoxGeometry(params.stepDepth, stepH, params.width);

    const matrix = new THREE.Matrix4();
    matrix.makeRotationY(-angle);
    matrix.setPosition(
      p0.x + localRun * Math.cos(angle),
      stepH / 2,
      p0.y + localRun * Math.sin(angle),
    );
    geo.applyMatrix4(matrix);
    geos.push(geo);
  }

  const merged = mergeGeometries(geos, false);
  if (!merged) throw new Error('Stairs geometry merge failed');
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
