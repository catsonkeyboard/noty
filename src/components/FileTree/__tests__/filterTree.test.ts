import { describe, expect, it } from "vitest";
import { dirPaths, filterTree } from "@/components/FileTree/filterTree";
import type { TreeNode } from "@/types/vault";

const nest = (node: TreeNode, parent: string): TreeNode => ({
  ...node,
  path: `${parent}${node.path}`,
  children: node.children.map((c) => nest(c, `${parent}${node.path}`)),
});

const n = (name: string, is_dir = false, children: TreeNode[] = []): TreeNode => ({
  name,
  is_dir,
  path: `/${name}`,
  children: children.map((c) => nest(c, `/${name}`)),
});

describe("filterTree", () => {
  it("empty query returns the tree untouched", () => {
    const tree = [n("a.md"), n("d", true, [n("b.md")])];
    expect(filterTree(tree, "")).toBe(tree);
  });
  it("keeps a file whose name matches", () => {
    expect(filterTree([n("alpha.md"), n("beta.md")], "alp")).toHaveLength(1);
  });
  it("keeps a folder when a descendant matches, drop non-matching siblings", () => {
    const tree = [n("dir", true, [n("hit.md"), n("miss.md")]), n("miss2.md")];
    const out = filterTree(tree, "hit");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("dir");
    expect(out[0].children).toHaveLength(1);
  });
  it("matches folder names themselves", () => {
    const tree = [n("projects", true, [n("x.md")]), n("other.md")];
    const out = filterTree(tree, "proj");
    expect(out).toHaveLength(1);
    expect(out[0].children).toHaveLength(1); // folder match keeps all children
  });
  it("case-insensitive", () => {
    expect(filterTree([n("README.md")], "readme")).toHaveLength(1);
  });
});

describe("dirPaths", () => {
  it("lists every dir path recursively", () => {
    const tree = [n("a", true, [n("b", true, [n("c.md")])]), n("d.md")];
    expect(dirPaths(tree)).toEqual(["/a", "/a/b"]);
  });
});
