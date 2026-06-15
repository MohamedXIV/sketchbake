/**
 * BakedMeshView
 * Renders a single BakedMesh as a Three.js BufferGeometry mesh.
 */

'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { BakedMesh } from '../../lib/schema/types';

interface Props {
  mesh: BakedMesh;
}

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

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#8fa3b8" />
    </mesh>
  );
}
