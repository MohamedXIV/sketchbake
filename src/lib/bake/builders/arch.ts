/**
 * Arch builder
 * 2 points (base endpoints) → TubeGeometry along a semi-elliptical arc
 *
 * The arch rises from p0 and p1 up to `params.height` at its peak.
 * `params.thickness` controls the tube radius (structural thickness).
 */

import * as THREE from 'three';
import type { ArchParams, BakedMesh, SketchShape } from '../../schema/types';

export function bakeArch(shape: SketchShape): BakedMesh {
  const params = shape.params as ArchParams;
  const [p0, p1] = shape.points;
  if (!p0 || !p1) throw new Error('Arch requires exactly 2 points');

  // Base geometry
  const cx    = (p0.x + p1.x) / 2;
  const cz    = (p0.y + p1.y) / 2;
  const span  = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);
  const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const halfSpan = span / 2;

  // Build arc path in 3D (semi-ellipse)
  const SEG = 32;
  const pathPts: THREE.Vector3[] = [];
  for (let i = 0; i <= SEG; i++) {
    const t  = (i / SEG) * Math.PI;   // 0 → π
    const u  = Math.cos(Math.PI - t); // -1 → 1 along span
    const px = cx + u * halfSpan * Math.cos(angle);
    const py = Math.sin(t) * params.height; // Y = up
    const pz = cz + u * halfSpan * Math.sin(angle);
    pathPts.push(new THREE.Vector3(px, py, pz));
  }

  const path     = new THREE.CatmullRomCurve3(pathPts);
  const geometry = new THREE.TubeGeometry(
    path,
    SEG,
    Math.max(0.05, params.thickness / 2),
    8,
    false,
  );

  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const idxAttr = geometry.getIndex();

  return {
    shapeId:     shape.id,
    shapeKind:   shape.kind,
    materialTag: shape.materialTag,
    positions:   new Float32Array(posAttr.array),
    indices:     idxAttr ? new Uint32Array(idxAttr.array) : new Uint32Array([]),
  };
}
