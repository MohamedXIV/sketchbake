/**
 * Room builder
 * Closed polygon → earcut triangulation → floor slab mesh
 */

import * as THREE from 'three';
import earcut from 'earcut';
import type { BakedMesh, RoomParams, SketchShape } from '../../schema/types';

export function bakeRoom(shape: SketchShape): BakedMesh {
  const params = shape.params as RoomParams;
  const pts = shape.points;

  if (pts.length < 3) throw new Error('Room requires at least 3 points');

  const flatCoords = pts.flatMap(p => [p.x, p.y]);
  const triangles  = earcut(flatCoords);

  // Floor vertices (Y = 0)
  const vertices: number[] = pts.flatMap(p => [p.x, 0, p.y]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(triangles);
  geo.computeVertexNormals();

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const idxAttr = geo.getIndex();

  // TODO: wall extrusion per edge + optional ceiling — next iteration
  void params;

  return {
    shapeId: shape.id,
    shapeKind: shape.kind,
    materialTag: shape.materialTag,
    positions: new Float32Array(posAttr.array),
    indices: idxAttr ? new Uint32Array(idxAttr.array) : new Uint32Array([]),
  };
}
