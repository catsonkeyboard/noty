use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::State;
use walkdir::WalkDir;

const MAX_HITS: usize = 200;
const SNIPPET_LEN: usize = 200;

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct SearchHit {
    pub path: String,
    pub line_number: usize,
    pub snippet: String,
}

#[derive(Debug, Clone)]
struct CachedFile {
    mtime_secs: i64,
    size: u64,
    file_name: String,
    file_name_lower: String,
    lines: Vec<String>,
    lines_lower: Vec<String>,
}

#[derive(Default)]
pub struct SearchIndex {
    // vault_root_canonical_path -> (relative_or_abs_path -> CachedFile)
    vaults: Mutex<HashMap<PathBuf, HashMap<PathBuf, CachedFile>>>,
}

impl SearchIndex {
    pub fn new() -> Self {
        Self::default()
    }

    /// Update index incrementally based on mtime and size, remove deleted files,
    /// then search in-memory.
    pub fn search(&self, vault_root: &Path, query: &str) -> Result<Vec<SearchHit>, String> {
        let needle = query.trim().to_lowercase();
        if needle.is_empty() {
            return Ok(Vec::new());
        }

        let mut vaults_guard = self.vaults.lock().map_err(|e| e.to_string())?;
        let file_cache = vaults_guard.entry(vault_root.to_path_buf()).or_default();

        let mut seen_paths = HashSet::new();

        for entry in WalkDir::new(vault_root)
            .into_iter()
            .filter_entry(|e| e.depth() == 0 || !e.file_name().to_string_lossy().starts_with('.'))
            .flatten()
        {
            if !entry.file_type().is_file() || entry.path().extension().is_none_or(|e| e != "md") {
                continue;
            }

            let path = entry.path().to_path_buf();
            seen_paths.insert(path.clone());

            let Ok(meta) = entry.metadata() else {
                continue;
            };

            let mtime_secs = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            let size = meta.len();

            let needs_reload = match file_cache.get(&path) {
                Some(cached) => cached.mtime_secs != mtime_secs || cached.size != size,
                None => true,
            };

            if needs_reload {
                if let Ok(content) = fs::read_to_string(&path) {
                    let file_name = entry.file_name().to_string_lossy().into_owned();
                    let file_name_lower = file_name.to_lowercase();
                    let lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
                    let lines_lower: Vec<String> =
                        lines.iter().map(|l| l.to_lowercase()).collect();

                    file_cache.insert(
                        path,
                        CachedFile {
                            mtime_secs,
                            size,
                            file_name,
                            file_name_lower,
                            lines,
                            lines_lower,
                        },
                    );
                }
            }
        }

        // Drop deleted files from cache
        file_cache.retain(|p, _| seen_paths.contains(p));

        // Now search directly in cache
        let mut hits = Vec::new();
        'files: for (path, cached) in file_cache.iter() {
            let path_str = path.to_string_lossy().into_owned();

            if cached.file_name_lower.contains(&needle) {
                hits.push(SearchHit {
                    path: path_str.clone(),
                    line_number: 0,
                    snippet: cached.file_name.clone(),
                });
                if hits.len() >= MAX_HITS {
                    break 'files;
                }
            }

            for (i, line_lower) in cached.lines_lower.iter().enumerate() {
                if line_lower.contains(&needle) {
                    let original_line = &cached.lines[i];
                    hits.push(SearchHit {
                        path: path_str.clone(),
                        line_number: i + 1,
                        snippet: truncate_around(original_line.trim(), &needle),
                    });
                    if hits.len() >= MAX_HITS {
                        break 'files;
                    }
                }
            }
        }

        // Sort for stable results: filename hits first, then by path and line number
        hits.sort_by(|a, b| {
            let a_is_file = a.line_number == 0;
            let b_is_file = b.line_number == 0;
            b_is_file
                .cmp(&a_is_file)
                .then_with(|| a.path.cmp(&b.path))
                .then_with(|| a.line_number.cmp(&b.line_number))
        });

        Ok(hits)
    }
}

#[tauri::command]
pub fn search_vault(
    vault: String,
    query: String,
    index: State<'_, SearchIndex>,
) -> Result<Vec<SearchHit>, String> {
    let root = Path::new(&vault)
        .canonicalize()
        .map_err(|e| format!("vault not accessible: {e}"))?;
    index.search(&root, &query)
}

/// Keep the snippet short while making sure the match stays visible.
/// `to_lowercase` can change lengths (Turkish "İ" → two chars), so byte or
/// char offsets from the lowered line never slice the original directly.
/// Instead we build a map from lowered char positions back to original
/// char positions, then slice the original by chars.
fn truncate_around(line: &str, needle: &str) -> String {
    if line.chars().count() <= SNIPPET_LEN {
        return line.to_string();
    }
    let lowered = line.to_lowercase();
    let needle_lower: Vec<char> = needle.to_lowercase().chars().collect();

    // map[i] = index (in chars of `line`) of the original char that produced
    // the i-th char of `lowered`
    let mut map = Vec::with_capacity(lowered.chars().count());
    for (i, c) in line.chars().enumerate() {
        for _ in 0..c.to_lowercase().count() {
            map.push(i);
        }
    }

    let lowered_chars: Vec<char> = lowered.chars().collect();
    let hit = lowered_chars
        .windows(needle_lower.len())
        .position(|w| w == needle_lower)
        .unwrap_or(0);
    let orig_pos = map.get(hit).copied().unwrap_or(0);
    let start = orig_pos.saturating_sub(SNIPPET_LEN / 4);
    let taken: String = line.chars().skip(start).take(SNIPPET_LEN).collect();
    if start > 0 {
        format!("…{taken}")
    } else {
        taken
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_matches_across_subfolders() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(dir.path().join("a.md"), "hello world\nsecond line").unwrap();
        fs::write(sub.join("b.md"), "nothing\nHELLO again").unwrap();
        fs::write(sub.join("c.txt"), "hello but not markdown").unwrap();

        let index = SearchIndex::new();
        let hits = index.search(dir.path(), "hello").unwrap();
        assert_eq!(hits.len(), 2);
        assert!(hits.iter().all(|h| h.path.ends_with(".md")));
        // case-insensitive match found in sub/b.md line 2
        assert!(hits.iter().any(|h| h.line_number == 2));
    }

    #[test]
    fn empty_query_returns_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let index = SearchIndex::new();
        let hits = index.search(dir.path(), "  ").unwrap();
        assert!(hits.is_empty());
    }

    #[test]
    fn incremental_index_detects_changes_and_deletions() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("doc.md");
        fs::write(&file, "first version").unwrap();

        let index = SearchIndex::new();
        let hits1 = index.search(dir.path(), "version").unwrap();
        assert_eq!(hits1.len(), 1);
        assert_eq!(hits1[0].snippet, "first version");

        // update file content
        // sleep a tiny bit if needed or modify content to change size
        fs::write(&file, "second version updated").unwrap();
        let hits2 = index.search(dir.path(), "updated").unwrap();
        assert_eq!(hits2.len(), 1);
        assert_eq!(hits2[0].snippet, "second version updated");

        // delete file
        fs::remove_file(&file).unwrap();
        let hits3 = index.search(dir.path(), "version").unwrap();
        assert_eq!(hits3.len(), 0);
    }

    #[test]
    fn truncate_survives_case_folding_length_changes() {
        // 'İ' lowercases to "i̇" (two chars, three bytes) — byte offsets from
        // the lowered line would slice mid-char in the original.
        let long: String = "İ".repeat(300);
        let line = format!("{long} tail");
        let snippet = truncate_around(&line, "tail");
        assert!(snippet.contains("tail"));
        assert!(snippet.starts_with('…'));

        // short lines pass through untouched
        assert_eq!(truncate_around("short", "sh"), "short");
    }

    #[test]
    fn long_ascii_lines_get_centered_snippet() {
        let line = "a".repeat(500) + "needle" + &"b".repeat(500);
        let snippet = truncate_around(&line, "needle");
        assert!(snippet.contains("needle"));
        assert!(snippet.starts_with('…'));
        assert!(snippet.chars().count() <= SNIPPET_LEN + 1);
    }
}
