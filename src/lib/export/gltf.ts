/**
 * glTF exporter
 *
 * Converts a BakeResult into a .gltf JSON blob the user can download
 * and import directly into Unity, Godot, or Blender.
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { BakeResult } from '../schema/types';

/** Build a Three.js Scene from a BakeResult and export as glTF JSON. */
export async function exportGLTF(result: BakeResult): Promise<Blob> {
  const scene = new THREE.Scene();

  for (const mesh of result.meshes) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    if (mesh.normals) {
      geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    } else {
      geo.computeVertexNormals();
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0x8fa3b8,
      roughness: 0.8,
      metalness: 0.1,
    });

    const obj  = new THREE.Mesh(geo, mat);
    obj.name   = `${mesh.shapeKind}_${mesh.shapeId.slice(0, 6)}`;
    if (mesh.materialTag) obj.userData.materialTag = mesh.materialTag;
    scene.add(obj);
  }

  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      gltf => {
        if (gltf instanceof ArrayBuffer) {
          resolve(new Blob([gltf], { type: 'model/gltf-binary' }));
        } else {
          resolve(new Blob([JSON.stringify(gltf, null, 2)], { type: 'model/gltf+json' }));
        }
      },
      err => reject(err),
      { binary: false },
    );
  });
}

/** Trigger a browser file download for any Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
