/**
 * Viewport3D
 * React Three Fiber canvas — shows the baked mesh result.
 * Orbit controls, grid, axes helper.
 */

'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { BakedMeshView } from './BakedMeshView';
import { useSketchStore } from '../../store/useSketchStore';

export function Viewport3D() {
  const bakeResult = useSketchStore(s => s.bakeResult);

  return (
    <div className="w-full h-full bg-neutral-900">
      <Canvas
        camera={{ position: [10, 10, 10], fov: 50 }}
        shadows
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />

        <Grid
          args={[50, 50]}
          cellSize={1}
          cellThickness={0.5}
          sectionSize={5}
          sectionThickness={1}
          fadeDistance={40}
          position={[0, 0, 0]}
        />

        {bakeResult?.meshes.map(mesh => (
          <BakedMeshView key={mesh.shapeId} mesh={mesh} />
        ))}

        <OrbitControls makeDefault />

        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}
