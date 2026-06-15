'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { BakedMeshView } from './BakedMeshView';
import { useSketchStore } from '../../store/useSketchStore';

export function Viewport3D() {
  const bakeResult = useSketchStore(s => s.bakeResult);

  return (
    <div className="w-full h-full bg-neutral-900">
      <Canvas camera={{ position: [12, 10, 12], fov: 50 }} shadows>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />

        <Grid
          infiniteGrid
          cellSize={1}
          cellThickness={0.4}
          cellColor="#2a2a4a"
          sectionSize={5}
          sectionThickness={0.8}
          sectionColor="#3a3a6a"
          fadeDistance={50}
          fadeStrength={1}
        />

        {bakeResult?.meshes.map(mesh => (
          <BakedMeshView key={mesh.shapeId} mesh={mesh} />
        ))}

        <OrbitControls makeDefault />

        <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
          <GizmoViewport />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}
