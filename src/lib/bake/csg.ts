/**
 * CSG bridge: Three.js BufferGeometry ↔ @jscad/modeling
 *
 * Used by the bake engine to subtract cut volumes from solid meshes.
 * Cut shapes (kind: 'cut') are axis-aligned boxes defined by two 2D
 * corner points in world XZ space, plus height/sillHeight params.
 */

import * as THREE from 'three';
import { booleans, geometries, primitives } from '@jscad/modeling';
import type { CutParams, SketchShape } from '../schema/types';

// ---- Type aliases ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Geom3 = any;

// ================================================================
// Conversion: Three.js → @jscad Geom3
// ================================================================
function threeToGeom3(geo: THREE.BufferGeometry): Geom3 {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const idx = geo.getIndex();

  // Build list of triangles as Vec3[][] for geom3.fromPoints
  const tris: [number, number, number][][] = [];

  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
      tris.push([
        [pos.getX(a), pos.getY(a), pos.getZ(a)],
        [pos.getX(b), pos.getY(b), pos.getZ(b)],
        [pos.getX(c), pos.getY(c), pos.getZ(c)],
      ]);
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      tris.push([
        [pos.getX(i),     pos.getY(i),     pos.getZ(i)],
        [pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)],
        [pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2)],
      ]);
    }
  }

  return geometries.geom3.fromPoints(tris);
}

// ================================================================
// Conversion: @jscad Geom3 → Three.js BufferGeometry
// ================================================================
function geom3ToThree(jGeo: Geom3): THREE.BufferGeometry {
  // toPolygons returns Poly3[] with transforms applied
  const polys: Array<{ vertices: [number, number, number][] }> =
    geometries.geom3.toPolygons(jGeo);

  const verts:   number[] = [];
  const indices: number[] = [];
  let   offset = 0;

  for (const poly of polys) {
    const vs = poly.vertices;
    for (const v of vs) verts.push(v[0], v[1], v[2]);
    // Fan-triangulate quads/ngons
    for (let i = 1; i < vs.length - 1; i++) {
      indices.push(offset, offset + i, offset + i + 1);
    }
    offset += vs.length;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ================================================================
// Build cut box from a CutShape
// ================================================================
export function buildCutGeom(shape: SketchShape): Geom3 | null {
  const params = shape.params as CutParams;
  const [p0, p1] = shape.points;
  if (!p0 || !p1) return null;

  const minX = Math.min(p0.x, p1.x);
  const maxX = Math.max(p0.x, p1.x);
  const minZ = Math.min(p0.y, p1.y); // canvas Y → world Z
  const maxZ = Math.max(p0.y, p1.y);

  const MARGIN = 0.12; // small overshoot so cuts fully punch through

  return primitives.cuboid({
    size: [
      Math.max(0.01, maxX - minX) + MARGIN,
      Math.max(0.01, params.height)  + MARGIN,
      Math.max(0.01, maxZ - minZ)   + MARGIN,
    ],
    center: [
      (minX + maxX) / 2,
      params.sillHeight + params.height / 2,
      (minZ + maxZ) / 2,
    ],
  });
}

// ================================================================
// Apply a list of Geom3 cut boxes to a Three.js BufferGeometry
// ================================================================
export function applyCSGCuts(
  targetGeo: THREE.BufferGeometry,
  cutGeoms: Geom3[],
): THREE.BufferGeometry {
  if (cutGeoms.length === 0) return targetGeo;

  let jGeo: Geom3 = threeToGeom3(targetGeo);

  for (const cut of cutGeoms) {
    try {
      jGeo = booleans.subtract(jGeo, cut);
    } catch (err) {
      console.warn('[csg] subtract failed for one cut — skipping:', err);
    }
  }

  return geom3ToThree(jGeo);
}
