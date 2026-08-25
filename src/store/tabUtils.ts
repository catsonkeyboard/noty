/** Reorder tabs by moving `from` to `to`; returns input untouched if invalid. */
export function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Most-recent-first list, deduped, capped at `max`. */
export function pushRecent(list: string[], path: string, max = 10): string[] {
  return [path, ...list.filter((p) => p !== path)].slice(0, max);
}

/** Closed-tab stack (most recent last), capped at `max`. */
export function pushClosed(list: string[], path: string, max = 20): string[] {
  return [...list.filter((p) => p !== path), path].slice(-max);
}
