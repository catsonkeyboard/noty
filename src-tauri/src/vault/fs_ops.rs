use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Manager;

use super::frontmatter::{self, Frontmatter};
use super::resolve_in_vault;

#[derive(Debug, Serialize)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<TreeNode>,
}

#[derive(Debug, Serialize)]
pub struct NoteFile {
    pub frontmatter: Frontmatter,
    pub body: String,
}

#[tauri::command]
pub fn ensure_default_vault(app: tauri::AppHandle) -> Result<String, String> {
    let docs = app
        .path()
        .document_dir()
        .map_err(|e| format!("cannot locate Documents directory: {e}"))?;
    let vault = docs.join("Noty");
    fs::create_dir_all(&vault).map_err(|e| e.to_string())?;
    Ok(vault.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn list_vault(vault: String) -> Result<Vec<TreeNode>, String> {
    let root = Path::new(&vault)
        .canonicalize()
        .map_err(|e| format!("vault not accessible: {e}"))?;
    build_tree(&root)
}

fn build_tree(dir: &Path) -> Result<Vec<TreeNode>, String> {
    let mut nodes: Vec<TreeNode> = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            nodes.push(TreeNode {
                name,
                path: path.to_string_lossy().into_owned(),
                is_dir: true,
                children: build_tree(&path)?,
            });
        } else if path.extension().is_some_and(|e| e == "md") {
            nodes.push(TreeNode {
                name,
                path: path.to_string_lossy().into_owned(),
                is_dir: false,
                children: Vec::new(),
            });
        }
    }
    nodes.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(nodes)
}

#[tauri::command]
pub fn read_note(vault: String, path: String) -> Result<NoteFile, String> {
    let path = resolve_in_vault(&vault, &path)?;
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let (fm, body) = frontmatter::parse(&content);
    let frontmatter = fm.unwrap_or_else(Frontmatter::new_now);
    Ok(NoteFile { frontmatter, body })
}

#[tauri::command]
pub fn write_note(
    vault: String,
    path: String,
    mut frontmatter: Frontmatter,
    body: String,
) -> Result<Frontmatter, String> {
    let path = resolve_in_vault(&vault, &path)?;
    frontmatter.updated = chrono::Utc::now().to_rfc3339();
    if frontmatter.id.is_empty() {
        frontmatter.id = uuid::Uuid::new_v4().to_string();
    }
    let content = frontmatter::serialize(&frontmatter, &body);
    atomic_write(&path, &content)?;
    Ok(frontmatter)
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let tmp = path.with_extension("md.tmp");
    fs::write(&tmp, content).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// Replace characters that are illegal in file names on macOS/Windows/Linux.
fn slugify(title: &str) -> String {
    let cleaned: String = title
        .trim()
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            c => c,
        })
        .collect();
    let cleaned = cleaned.trim_matches('.').trim().to_string();
    if cleaned.is_empty() {
        "Untitled".to_string()
    } else {
        cleaned
    }
}

/// Find a free path by appending " 1", " 2", ... before the extension.
fn dedupe_path(dir: &Path, stem: &str, extension: Option<&str>) -> PathBuf {
    let make = |suffix: &str| match extension {
        Some(ext) => dir.join(format!("{stem}{suffix}.{ext}")),
        None => dir.join(format!("{stem}{suffix}")),
    };
    let mut candidate = make("");
    let mut i = 1;
    while candidate.exists() {
        candidate = make(&format!(" {i}"));
        i += 1;
    }
    candidate
}

#[tauri::command]
pub fn create_note(vault: String, dir: String, title: String) -> Result<String, String> {
    let dir = resolve_in_vault(&vault, &dir)?;
    if !dir.is_dir() {
        return Err("target directory does not exist".to_string());
    }
    let stem = slugify(&title);
    let path = dedupe_path(&dir, &stem, Some("md"));
    let fm = Frontmatter::new_now();
    let content = frontmatter::serialize(&fm, "");
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn create_folder(vault: String, dir: String, name: String) -> Result<String, String> {
    let dir = resolve_in_vault(&vault, &dir)?;
    if !dir.is_dir() {
        return Err("target directory does not exist".to_string());
    }
    let path = dedupe_path(&dir, &slugify(&name), None);
    fs::create_dir(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn rename_entry(vault: String, path: String, new_name: String) -> Result<String, String> {
    let path = resolve_in_vault(&vault, &path)?;
    if !path.exists() {
        return Err("entry does not exist".to_string());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "invalid path".to_string())?
        .to_path_buf();
    let stem = slugify(&new_name);
    let target = if path.is_dir() {
        parent.join(&stem)
    } else {
        parent.join(format!("{stem}.md"))
    };
    if target == path {
        return Ok(path.to_string_lossy().into_owned());
    }
    if target.exists() {
        return Err("an entry with that name already exists".to_string());
    }
    fs::rename(&path, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn delete_entry(vault: String, path: String) -> Result<(), String> {
    let path = resolve_in_vault(&vault, &path)?;
    if path.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn move_entry(vault: String, from: String, to_dir: String) -> Result<String, String> {
    let from = resolve_in_vault(&vault, &from)?;
    let to_dir = resolve_in_vault(&vault, &to_dir)?;
    if !to_dir.is_dir() {
        return Err("target directory does not exist".to_string());
    }
    let name = from
        .file_name()
        .ok_or_else(|| "invalid source path".to_string())?;
    let target = to_dir.join(name);
    if target == from {
        return Ok(from.to_string_lossy().into_owned());
    }
    if target.exists() {
        return Err("an entry with that name already exists in the target folder".to_string());
    }
    if from.is_dir() && target.starts_with(&from) {
        return Err("cannot move a folder into itself".to_string());
    }
    fs::rename(&from, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_strips_illegal_chars() {
        assert_eq!(slugify("a/b:c*d"), "a-b-c-d");
        assert_eq!(slugify("   "), "Untitled");
        assert_eq!(slugify("中文标题"), "中文标题");
    }

    #[test]
    fn dedupe_appends_counter() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("Note.md"), "").unwrap();
        fs::write(dir.path().join("Note 1.md"), "").unwrap();
        let p = dedupe_path(dir.path(), "Note", Some("md"));
        assert_eq!(p.file_name().unwrap().to_str().unwrap(), "Note 2.md");
    }
}
