import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "@/lib/fuzzy";

describe("fuzzyMatch", () => {
  it("returns null when query is not a subsequence", () => {
    expect(fuzzyMatch("xyz", "abstract")).toBeNull();
    expect(fuzzyMatch("abc", "cab")).toBeNull();
  });
  it("empty query matches everything with score 0", () => {
    expect(fuzzyMatch("", "anything")).toEqual({ score: 0 });
  });
  it("case-insensitive", () => {
    expect(fuzzyMatch("NT", "noty")).not.toBeNull();
  });
  it("prefix beats scattered match", () => {
    const prefix = fuzzyMatch("not", "noty-app");
    const scattered = fuzzyMatch("not", "new-old-thing");
    expect(prefix!.score).toBeGreaterThan(scattered!.score);
  });
  it("consecutive run beats scattered match", () => {
    const tight = fuzzyMatch("abc", "xx abc yy");
    const loose = fuzzyMatch("abc", "a1b2c3");
    expect(tight!.score).toBeGreaterThan(loose!.score);
  });
  it("word-boundary chars (/-/_/space/case change) add bonus", () => {
    const boundary = fuzzyMatch("fb", "foo-bar");
    const inner = fuzzyMatch("fb", "xxfxxbxx".slice(0, 8));
    expect(boundary!.score).toBeGreaterThan(inner!.score);
  });
  it("exact equal string scores highest of same length options", () => {
    const exact = fuzzyMatch("readme", "readme");
    const longer = fuzzyMatch("readme", "readme-extra");
    expect(exact!.score).toBeGreaterThan(longer!.score);
  });
});
