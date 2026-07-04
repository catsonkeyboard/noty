const CJK = /[一-鿿㐀-䶿぀-ヿ가-힯]/g;

/** Word count for mixed CJK/latin text: each CJK char counts as one word. */
export function countWords(text: string): number {
  const cjk = text.match(CJK)?.length ?? 0;
  const latin = text
    .replace(CJK, " ")
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;
  return cjk + latin;
}
