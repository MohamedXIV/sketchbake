// ============================================================
// SketchBake — Core Data Schema
// ============================================================

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };

// ------ Shape Kinds -----------------------------------------

export type ShapeKind =
  | 'wall'
  | 'room'
  | 'dome'
  | 'arch'
  | 'stairs'
  | 'column'
  | 'cut'      // boolean subtraction volume
  | 'custom';

// ------ Bake Parameters (per shape type) --------------------

export interface WallParams {
  kind: 'wall';
  height: number;
  thickness: number;
}
export interface RoomParams {
  kind: 'room';
  floorHeight: number;
  wallHeight: number;
  wallThickness: number;
  ceiling: boolean;
}
export interface DomeParams {
  kind: 'dome';
  height: number;
  segments: number;
  base: 'open' | 'closed';
}
export interface ArchParams {
  kind: 'arch';
  height: number;
  thickness: number;
  depth: number;
}
export interface StairsParams {
  kind: 'stairs';
  stepHeight: number;
  stepDepth: number;
  width: number;
}
export interface ColumnParams {
  kind: 'column';
  radius: number;
  height: number;
  segments: number;
}

/**
 * Cut: a rectangular box volume subtracted from every intersecting mesh.
 * sillHeight = 0  → door (starts at floor)
 * sillHeight > 0  → window (raised opening)
 */
export interface CutParams {
  kind: 'cut';
  height: number;      // height of the opening
  sillHeight: number;  // Y distance from floor to bottom of opening
}

export interface CustomParams {
  kind: 'custom';
  extrudeDepth: number;
}

export type BakeParams =
  | WallParams | RoomParams | DomeParams | ArchParams
  | StairsParams | ColumnParams | CutParams | CustomParams;

// ------ Shape -----------------------------------------------

export interface SketchShape {
  id: string;
  kind: ShapeKind;
  points: Vec2[];
  params: BakeParams;
  label?: string;
  materialTag?: string;
}

// ------ Sketch Document -------------------------------------

export interface SketchDoc {
  id: string;
  name: string;
  shapes: SketchShape[];
  gridSize: number;
  meta: { createdAt: string; updatedAt: string; author?: string };
}

// ------ History Tree ----------------------------------------

export interface SnapshotNode {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  sketch: SketchDoc;
  label: string;
  createdAt: string;
}
export interface HistoryTree {
  nodes: Record<string, SnapshotNode>;
  rootId: string;
  activeNodeId: string;
}

// ------ Bake Result -----------------------------------------

export interface BakeResult {
  snapshotId: string;
  meshes: BakedMesh[];
  bakedAt: string;
}
export interface BakedMesh {
  shapeId: string;
  shapeKind: ShapeKind;
  materialTag?: string;
  positions: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
}
