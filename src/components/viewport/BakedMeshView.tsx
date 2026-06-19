/**
 * BakedMeshView
 * Renders a single BakedMesh, coloured by shape kind to match the 2D sketch palette.
 */

'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { BakedMesh, ShapeKind } from '../../lib/schema/types';

interface Props {
  mesh: BakedMesh;
}

// Mirrors the 2D sketch colour palette so 2D ↔ 3D stay visually linked
const KIND_COLOR: Record<ShapeKind, string> = {
  wall:   '#8fa3b8',
  room:   '#7fc9a8',
  dome:   '#b39ddb',
  arch:   '#e0a868',
  stairs: '#e0a06a',
  column: '#d99cb8',
  cut:    '#666666', // never actually rendered — cuts are consumed during bake
  custom: '#9aa5b1',
};

export function BakedMeshView({ mesh }: Props) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    if (mesh.normals) {
      geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    return geo;
  }, [mesh]);

  const color = KIND_COLOR[mesh.shapeKind] ?? '#8fa3b8';

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} side={THREE.DoubleSide} />
    </mesh>
  );
}
