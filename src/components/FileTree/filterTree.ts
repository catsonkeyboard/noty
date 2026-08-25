import type { TreeNode } from "@/types/vault";

/** Case-insensitive name-substring filter; folders survive if self or any
 *  descendant matches (folder self-match keeps all its children). */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  const walk = (list: TreeNode[]): TreeNode[] =>
    list.flatMap((node) => {
      const self = node.name.toLowerCase().includes(q);
      if (node.is_dir) {
        if (self) return [node];
        const children = walk(node.children ?? []);
        return children.length ? [{ ...node, children }] : [];
      }
      return self ? [node] : [];
    });
  return walk(nodes);
}

/** Every directory path in the tree, recursively. */
export function dirPaths(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) =>
    n.is_dir ? [n.path, ...dirPaths(n.children ?? [])] : [],
  );
}
