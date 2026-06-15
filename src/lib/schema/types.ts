// ============================================================
// SketchBake — Core Data Schema
// ============================================================

// ------ Primitives ------------------------------------------

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };

// ------ Shape Types -----------------------------------------

/** Every drawable shape type and its corresponding bake output */
export type ShapeKind =
  | 'wall'       // line segment → extruded box
  | 'room'       // closed polygon → extruded floor plan
  | 'dome'       // circle/arc → lathe geometry
  | 'arch'       // arc path → tube geometry
  | 'stairs'     // polyline → stepped extrusion
  | 'column'     // point → cylinder
  | 'custom';    // raw polygon, user-defined bake

// ------ Bake Parameters (per shape type) --------------------

export interface WallParams {
  kind: 'wall';
  height: number;      // world units
  thickness: number;
}

export interface RoomParams {
  kind: 'room';
  floorHeight: number; // slab thickness
  wallHeight: number;
  wallThickness: number;
  ceiling: boolean;
}

export interface DomeParams {
  kind: 'dome';
  height: number;
  segments: number;    // lathe segments
  base: 'open' | 'closed';
}

export interface ArchParams {
  kind: 'arch';
  height: number;
  thickness: number;
  depth: number;       // tunnel depth
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

export interface CustomParams {
  kind: 'custom';
  extrudeDepth: number;
}

export type BakeParams =
  | WallParams
  | RoomParams
  | DomeParams
  | ArchParams
  | StairsParams
  | ColumnParams
  | CustomParams;

// ------ Shape -----------------------------------------------

export interface SketchShape {
  id: string;
  kind: ShapeKind;

  /** 2D points in canvas/world space (metres, Y-up ignored — Z is up after bake) */
  points: Vec2[];

  /** Bake parameters — must match `kind` */
  params: BakeParams;

  /** Optional display label */
  label?: string;

  /** Material tag for export (e.g. 'stone', 'wood') */
  materialTag?: string;
}

// ------ Sketch Document -------------------------------------

export interface SketchDoc {
  id: string;
  name: string;
  shapes: SketchShape[];

  /** Grid size in world units */
  gridSize: number;

  /** Canvas metadata */
  meta: {
    createdAt: string; // ISO
    updatedAt: string;
    author?: string;
  };
}

// ------ History Tree ----------------------------------------

export interface SnapshotNode {
  /** Unique snapshot ID */
  id: string;

  /** Parent snapshot ID — null for root */
  parentId: string | null;

  /** Children snapshot IDs (branches) */
  childrenIds: string[];

  /** Immutable copy of the sketch at this point */
  sketch: SketchDoc;

  /** User-provided label (e.g. 'added dome roof') */
  label: string;

  createdAt: string; // ISO
}

export interface HistoryTree {
  /** All nodes keyed by ID */
  nodes: Record<string, SnapshotNode>;

  /** ID of the root node */
  rootId: string;

  /** ID of the currently active node */
  activeNodeId: string;
}

// ------ Bake Result -----------------------------------------

export interface BakeResult {
  /** ID of the snapshot this was baked from */
  snapshotId: string;

  /** Three.js-ready geometry data per shape */
  meshes: BakedMesh[];

  bakedAt: string; // ISO
}

export interface BakedMesh {
  shapeId: string;
  shapeKind: ShapeKind;
  materialTag?: string;

  /** Flat Float32Array of vertex positions (x,y,z triplets) */
  positions: Float32Array;

  /** Flat Uint32Array of triangle indices */
  indices: Uint32Array;

  /** Optional flat Float32Array of normals */
  normals?: Float32Array;
}
