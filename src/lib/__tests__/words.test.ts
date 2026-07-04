import { describe, expect, it } from "vitest";
import { countWords } from "../words";

describe("countWords", () => {
  it("counts latin words", () => {
    expect(countWords("hello world foo")).toBe(3);
  });

  it("counts each CJK char as one word", () => {
    expect(countWords("你好世界")).toBe(4);
  });

  it("counts mixed text", () => {
    expect(countWords("今天开会 discuss roadmap 三件事")).toBe(9);
  });

  it("ignores whitespace and punctuation-only tokens", () => {
    expect(countWords("  \n\n --- !!! ")).toBe(0);
    expect(countWords("")).toBe(0);
  });
});
