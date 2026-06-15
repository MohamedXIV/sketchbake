'use client';

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  BakeParams,
  BakeResult,
  HistoryTree,
  ShapeKind,
  SketchDoc,
  SketchShape,
  Vec2,
} from '../lib/schema/types';
import { createHistoryTree, createSketchDoc, defaultParams } from '../lib/schema/defaults';
import { commitSnapshot, checkoutNode } from '../lib/history/snapshot';
import { bakeSketch } from '../lib/bake';

export type Tool = 'select' | 'wall' | 'room' | 'dome' | 'arch' | 'stairs' | 'column';

interface SketchState {
  sketch: SketchDoc;
  history: HistoryTree;
  activeTool: Tool;
  selectedShapeIds: string[];
  bakeResult: BakeResult | null;
  isBaking: boolean;

  addShape: (kind: ShapeKind, points: Vec2[]) => void;
  removeShape: (id: string) => void;
  updateShapePoints: (id: string, points: Vec2[]) => void;
  updateShapeParams: (id: string, params: BakeParams) => void;
  setActiveTool: (tool: Tool) => void;
  setSelectedShapes: (ids: string[]) => void;
  commitSnapshot: (label: string) => void;
  checkoutNode: (nodeId: string) => void;
  bake: () => Promise<void>;
  newSketch: (name?: string) => void;
}

export const useSketchStore = create<SketchState>((set, get) => {
  const initialSketch  = createSketchDoc('Untitled');
  const initialHistory = createHistoryTree(initialSketch);

  return {
    sketch: initialSketch,
    history: initialHistory,
    activeTool: 'select',
    selectedShapeIds: [],
    bakeResult: null,
    isBaking: false,

    addShape: (kind, points) => {
      const shape: SketchShape = {
        id: nanoid(),
        kind,
        points,
        params: defaultParams(kind),
      };
      set(s => ({
        sketch: {
          ...s.sketch,
          shapes: [...s.sketch.shapes, shape],
          meta: { ...s.sketch.meta, updatedAt: new Date().toISOString() },
        },
      }));
    },

    removeShape: (id) =>
      set(s => ({
        sketch: { ...s.sketch, shapes: s.sketch.shapes.filter(sh => sh.id !== id) },
        selectedShapeIds: s.selectedShapeIds.filter(sid => sid !== id),
      })),

    updateShapePoints: (id, points) =>
      set(s => ({
        sketch: {
          ...s.sketch,
          shapes: s.sketch.shapes.map(sh => sh.id === id ? { ...sh, points } : sh),
        },
      })),

    updateShapeParams: (id, params) =>
      set(s => ({
        sketch: {
          ...s.sketch,
          shapes: s.sketch.shapes.map(sh => sh.id === id ? { ...sh, params } : sh),
        },
      })),

    setActiveTool: tool => set({ activeTool: tool }),
    setSelectedShapes: ids => set({ selectedShapeIds: ids }),

    commitSnapshot: (label) => {
      const { sketch, history } = get();
      set({ history: commitSnapshot(history, sketch, label) });
    },

    checkoutNode: (nodeId) => {
      const newTree = checkoutNode(get().history, nodeId);
      set({ history: newTree, sketch: newTree.nodes[nodeId].sketch });
    },

    bake: async () => {
      const { sketch, history } = get();
      set({ isBaking: true });
      try {
        const result = await bakeSketch(sketch, history.activeNodeId);
        set({ bakeResult: result });
      } finally {
        set({ isBaking: false });
      }
    },

    newSketch: (name = 'Untitled') => {
      const sketch = createSketchDoc(name);
      set({ sketch, history: createHistoryTree(sketch), bakeResult: null, selectedShapeIds: [] });
    },
  };
});
