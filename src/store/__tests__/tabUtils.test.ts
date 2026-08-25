import { describe, expect, it } from "vitest";
import { pushClosed, pushRecent, reorder } from "@/store/tabUtils";

describe("reorder", () => {
  it("moves an item from lower to higher index", () => {
    expect(reorder(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });
  it("moves an item from higher to lower index", () => {
    expect(reorder(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("no-op on same index", () => {
    expect(reorder(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
  it("no-op on out-of-range index", () => {
    expect(reorder(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(reorder(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });
});

describe("pushRecent", () => {
  it("prepends and dedupes", () => {
    expect(pushRecent(["b", "a"], "a")).toEqual(["a", "b"]);
  });
  it("caps at max", () => {
    const list = Array.from({ length: 10 }, (_, i) => `n${i}`);
    expect(pushRecent(list, "new", 10)).toEqual(["new", ...list.slice(0, 9)]);
  });
});

describe("pushClosed", () => {
  it("appends to the stack", () => {
    expect(pushClosed(["a"], "b")).toEqual(["a", "b"]);
  });
  it("caps at max (oldest dropped)", () => {
    const list = Array.from({ length: 20 }, (_, i) => `n${i}`);
    expect(pushClosed(list, "new", 20)).toEqual([...list.slice(1), "new"]);
  });
});
