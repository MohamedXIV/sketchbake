/**
 * Room builder
 * Closed polygon → earcut triangulation → extruded floor plan
 * Produces: floor slab + 4 walls per edge
 */

import * as THREE from 'three';
import Earcut from 'earcut';
import type { BakedMesh, RoomParams, SketchShape } from '../../schema/types';

export function bakeRoom(shape: SketchShape): BakedMesh {
  const params = shape.params as RoomParams;
  const pts = shape.points;

  if (pts.length < 3) throw new Error('Room requires at least 3 points');

  const flatCoords = pts.flatMap(p => [p.x, p.y]);
  const triangles = Earcut.triangulate(flatCoords, undefined, 2);

  const vertices: number[] = [];
  const indices: number[] = [];

  // Floor
  for (const pt of pts) vertices.push(pt.x, 0, pt.y);
  for (const idx of triangles) indices.push(idx);

  // TODO: walls per edge, ceiling slab
  // Deferred to next iteration — floor geometry is the foundation

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const idxAttr = geo.getIndex();

  return {
    shapeId: shape.id,
    shapeKind: shape.kind,
    materialTag: shape.materialTag,
    positions: new Float32Array(posAttr.array),
    indices: idxAttr ? new Uint32Array(idxAttr.array) : new Uint32Array([]),
  };
}
