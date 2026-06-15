import { nanoid } from 'nanoid';
import type { HistoryTree, SketchDoc, SnapshotNode } from '../schema/types';

/**
 * Commit the current sketch as a new snapshot child of the active node.
 * Returns the updated tree (immutable — does not mutate input).
 */
export function commitSnapshot(
  tree: HistoryTree,
  sketch: SketchDoc,
  label: string
): HistoryTree {
  const newId = nanoid();
  const parentId = tree.activeNodeId;

  const newNode: SnapshotNode = {
    id: newId,
    parentId,
    childrenIds: [],
    sketch: deepCloneSketch(sketch),
    label,
    createdAt: new Date().toISOString(),
  };

  const updatedParent: SnapshotNode = {
    ...tree.nodes[parentId],
    childrenIds: [...tree.nodes[parentId].childrenIds, newId],
  };

  return {
    ...tree,
    activeNodeId: newId,
    nodes: {
      ...tree.nodes,
      [parentId]: updatedParent,
      [newId]: newNode,
    },
  };
}

/**
 * Branch from any node: makes it the active node without losing current work.
 * The caller should commit their current sketch before branching if needed.
 */
export function checkoutNode(
  tree: HistoryTree,
  nodeId: string
): HistoryTree {
  if (!tree.nodes[nodeId]) throw new Error(`Node ${nodeId} not found`);
  return { ...tree, activeNodeId: nodeId };
}

/** Get the linear ancestor path from root to a given node */
export function getAncestorPath(
  tree: HistoryTree,
  nodeId: string
): SnapshotNode[] {
  const path: SnapshotNode[] = [];
  let current: SnapshotNode | undefined = tree.nodes[nodeId];
  while (current) {
    path.unshift(current);
    current = current.parentId ? tree.nodes[current.parentId] : undefined;
  }
  return path;
}

/** Deep clone a SketchDoc (JSON round-trip — safe for serialisable data) */
function deepCloneSketch(sketch: SketchDoc): SketchDoc {
  return JSON.parse(JSON.stringify(sketch));
}
