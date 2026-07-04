use std::fs;
use std::path::Path;

use serde::Serialize;
use walkdir::WalkDir;

const MAX_HITS: usize = 200;
const SNIPPET_LEN: usize = 200;

#[derive(Debug, Serialize)]
pub struct SearchHit {
    pub path: String,
    pub line_number: usize,
    pub snippet: String,
}

#[tauri::command]
pub fn search_vault(vault: String, query: String) -> Result<Vec<SearchHit>, String> {
    let root = Path::new(&vault)
        .canonicalize()
        .map_err(|e| format!("vault not accessible: {e}"))?;
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Ok(Vec::new());
    }

    let mut hits = Vec::new();
    'files: for entry in WalkDir::new(&root)
        .into_iter()
        .filter_entry(|e| e.depth() == 0 || !e.file_name().to_string_lossy().starts_with('.'))
        .flatten()
    {
        if !entry.file_type().is_file()
            || entry.path().extension().is_none_or(|e| e != "md")
        {
            continue;
        }
        let path_str = entry.path().to_string_lossy().into_owned();

        // match on file name too, reported as line 0
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if name.contains(&needle) {
            hits.push(SearchHit {
                path: path_str.clone(),
                line_number: 0,
                snippet: entry.file_name().to_string_lossy().into_owned(),
            });
            if hits.len() >= MAX_HITS {
                break 'files;
            }
        }

        let Ok(content) = fs::read_to_string(entry.path()) else {
            continue;
        };
        for (i, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&needle) {
                hits.push(SearchHit {
                    path: path_str.clone(),
                    line_number: i + 1,
                    snippet: truncate_around(line.trim(), &needle),
                });
                if hits.len() >= MAX_HITS {
                    break 'files;
                }
            }
        }
    }
    Ok(hits)
}

/// Keep the snippet short while making sure the match stays visible.
fn truncate_around(line: &str, needle: &str) -> String {
    if line.chars().count() <= SNIPPET_LEN {
        return line.to_string();
    }
    let lower = line.to_lowercase();
    let byte_pos = lower.find(needle).unwrap_or(0);
    let char_pos = line[..byte_pos].chars().count();
    let start = char_pos.saturating_sub(SNIPPET_LEN / 4);
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

        let hits =
            search_vault(dir.path().to_string_lossy().into_owned(), "hello".into()).unwrap();
        assert_eq!(hits.len(), 2);
        assert!(hits.iter().all(|h| h.path.ends_with(".md")));
        // case-insensitive match found in sub/b.md line 2
        assert!(hits.iter().any(|h| h.line_number == 2));
    }

    #[test]
    fn empty_query_returns_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let hits =
            search_vault(dir.path().to_string_lossy().into_owned(), "  ".into()).unwrap();
        assert!(hits.is_empty());
    }
}
