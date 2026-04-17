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

  function walk(node: PaneNode): { node: PaneNode | null; replaced: boolean } {
    if (node.kind === 'leaf') {
      return node.id === leafId
        ? { node: null, replaced: true }
        : { node, replaced: false };
    }
    const aResult = walk(node.a);
    if (aResult.replaced) {
      // If the direct child `a` was the closed leaf, promote sibling `b`.
      // Otherwise `a`'s subtree was rewritten — keep this split with the new `a`.
      const next = aResult.node === null ? node.b : { ...node, a: aResult.node };
      return { node: next, replaced: true };
    }
    const bResult = walk(node.b);
    if (bResult.replaced) {
      const next = bResult.node === null ? node.a : { ...node, b: bResult.node };
      return { node: next, replaced: true };
    }
    return { node, replaced: false };
  }

  const result = walk(root);
  if (!result.replaced || !result.node) {
    return { root: result.node, focusFallback: result.node ? firstLeafId(result.node) : null };
  }
  return { root: result.node, focusFallback: firstLeafId(result.node) };
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
