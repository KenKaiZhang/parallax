import { v4 as uuid } from 'uuid';
import type { LeafNode, PaneNode, SplitNode } from '../types';

export function newLeaf(cwd?: string): LeafNode {
  return { kind: 'leaf', id: uuid(), cwd };
}

type PathStep = { node: SplitNode; key: 'a' | 'b' };

export function findLeafPath(root: PaneNode, leafId: string): PathStep[] | null {
  if (root.kind === 'leaf') return root.id === leafId ? [] : null;
  for (const key of ['a', 'b'] as const) {
    const found = findLeafPath(root[key], leafId);
    if (found) return [{ node: root, key }, ...found];
  }
  return null;
}

export function allLeafIds(root: PaneNode): string[] {
  if (root.kind === 'leaf') return [root.id];
  return [...allLeafIds(root.a), ...allLeafIds(root.b)];
}

export function firstLeafId(root: PaneNode): string {
  return root.kind === 'leaf' ? root.id : firstLeafId(root.a);
}

export function lastLeafId(root: PaneNode): string {
  return root.kind === 'leaf' ? root.id : lastLeafId(root.b);
}

export function splitLeaf(
  root: PaneNode,
  leafId: string,
  dir: 'row' | 'column',
  cwd?: string,
): { root: PaneNode; newLeafId: string } {
  const fresh = newLeaf(cwd);
  const newLeafId = fresh.id;

  function walk(node: PaneNode): PaneNode {
    if (node.kind === 'leaf') {
      if (node.id !== leafId) return node;
      const split: SplitNode = {
        kind: 'split',
        id: uuid(),
        dir,
        ratio: 0.5,
        a: node,
        b: fresh,
      };
      return split;
    }
    return { ...node, a: walk(node.a), b: walk(node.b) };
  }

  return { root: walk(root), newLeafId };
}

export function closeLeaf(
  root: PaneNode,
  leafId: string,
): { root: PaneNode | null; focusFallback: string | null } {
  if (root.kind === 'leaf') {
    return root.id === leafId ? { root: null, focusFallback: null } : { root, focusFallback: null };
  }

  type WalkResult = { node: PaneNode | null; replaced: boolean; fallback: string | null };

  function walk(node: PaneNode): WalkResult {
    if (node.kind === 'leaf') {
      return node.id === leafId
        ? { node: null, replaced: true, fallback: null }
        : { node, replaced: false, fallback: null };
    }
    const aResult = walk(node.a);
    if (aResult.replaced) {
      // If the direct child `a` was the closed leaf, promote sibling `b` and
      // pick the leaf in `b` nearest to where `a` lived (its first leaf).
      // Otherwise `a`'s subtree was rewritten — keep this split with the new `a`
      // and bubble whatever fallback was already chosen deeper.
      if (aResult.node === null) {
        return { node: node.b, replaced: true, fallback: firstLeafId(node.b) };
      }
      return { node: { ...node, a: aResult.node }, replaced: true, fallback: aResult.fallback };
    }
    const bResult = walk(node.b);
    if (bResult.replaced) {
      if (bResult.node === null) {
        return { node: node.a, replaced: true, fallback: lastLeafId(node.a) };
      }
      return { node: { ...node, b: bResult.node }, replaced: true, fallback: bResult.fallback };
    }
    return { node, replaced: false, fallback: null };
  }

  const result = walk(root);
  return { root: result.node, focusFallback: result.fallback };
}

export function swapLeaves(root: PaneNode, idA: string, idB: string): PaneNode {
  if (idA === idB) return root;
  function walk(node: PaneNode): PaneNode {
    if (node.kind === 'leaf') {
      if (node.id === idA) return { ...node, id: idB };
      if (node.id === idB) return { ...node, id: idA };
      return node;
    }
    return { ...node, a: walk(node.a), b: walk(node.b) };
  }
  return walk(root);
}

export function setSplitRatio(root: PaneNode, splitId: string, ratio: number): PaneNode {
  const clamped = Math.max(0.05, Math.min(0.95, ratio));
  function walk(node: PaneNode): PaneNode {
    if (node.kind === 'leaf') return node;
    if (node.id === splitId) return { ...node, ratio: clamped };
    return { ...node, a: walk(node.a), b: walk(node.b) };
  }
  return walk(root);
}
