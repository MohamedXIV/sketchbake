# SketchBake

A lightweight web-based **2D sketch → 3D mesh** tool for game developers.

Draw structural elements (walls, rooms, domes, arches) on a 2D canvas, annotate them with parameters, then **bake** them into 3D geometry ready to export to Unity or Godot.

## Pipeline

```
Sketch → Annotate → [Snapshot] → Bake → 3D Mesh → Export (glTF)
           ↑              ↗ branch
           └── History Tree (snapshot-based)
```

## Stack

- **Next.js + TypeScript** — app framework
- **React Three Fiber + Drei** — 3D viewport
- **@jscad/modeling** — CSG / boolean operations
- **earcut** — polygon triangulation
- **manifold-3d** — watertight mesh quality
- **Zustand** — global state

## Project Structure

```
src/
  app/             # Next.js app router
  components/
    sketch/        # 2D canvas drawing tools
    viewport/      # 3D R3F viewport
    history/       # Snapshot tree UI
    ui/            # Panels, toolbars, overlays
  lib/
    schema/        # Core data types
    bake/          # Sketch → 3D geometry engine
    history/       # Snapshot store logic
    export/        # glTF exporters
  store/           # Zustand global state
```

## Concepts

- **Sketch** — a flat 2D document containing shapes with metadata
- **Shape** — a drawn element tagged with type, dimensions, and bake parameters
- **Snapshot** — an immutable committed copy of a Sketch
- **Bake** — one-way conversion of a Snapshot into a Three.js mesh
- **History Tree** — branching tree of Snapshots; branch from any node

## Getting Started

```bash
pnpm install
pnpm dev
```

## License

MIT
