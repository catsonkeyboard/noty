use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Frontmatter {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub created: String,
    #[serde(default)]
    pub updated: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

impl Frontmatter {
    pub fn new_now() -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Frontmatter {
            id: uuid::Uuid::new_v4().to_string(),
            created: now.clone(),
            updated: now,
            tags: Vec::new(),
        }
    }
}

/// Split a note file into frontmatter and body.
/// Returns None for the frontmatter when the file has none (or it is invalid);
/// in that case the whole content is the body.
pub fn parse(content: &str) -> (Option<Frontmatter>, String) {
    let Some(rest) = content
        .strip_prefix("---\n")
        .or_else(|| content.strip_prefix("---\r\n"))
    else {
        return (None, content.to_string());
    };

    let (yaml, body) = if let Some((yaml, body)) = rest.split_once("\n---\n") {
        (yaml, body)
    } else if let Some((yaml, body)) = rest.split_once("\r\n---\r\n") {
        (yaml, body)
    } else if let Some(yaml) = rest.strip_suffix("\n---") {
        (yaml, "")
    } else {
        return (None, content.to_string());
    };

    match serde_yaml::from_str::<Frontmatter>(yaml) {
        Ok(fm) => (Some(fm), body.to_string()),
        Err(_) => (None, content.to_string()),
    }
}

/// Serialize frontmatter + body back into file content.
pub fn serialize(fm: &Frontmatter, body: &str) -> String {
    // serde_yaml::to_string ends with a newline, so the closing
    // delimiter lands on its own line.
    let yaml = serde_yaml::to_string(fm).unwrap_or_default();
    format!("---\n{yaml}---\n{body}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let fm = Frontmatter {
            id: "abc-123".into(),
            created: "2026-07-04T10:00:00Z".into(),
            updated: "2026-07-04T11:00:00Z".into(),
            tags: vec!["work".into(), "含中文".into()],
        };
        let body = "# Hello\n\nSome *markdown* here.\n";
        let content = serialize(&fm, body);
        let (parsed, parsed_body) = parse(&content);
        assert_eq!(parsed, Some(fm));
        assert_eq!(parsed_body, body);
    }

    #[test]
    fn file_without_frontmatter() {
        let content = "just a plain note\nwith two lines";
        let (fm, body) = parse(content);
        assert!(fm.is_none());
        assert_eq!(body, content);
    }

    #[test]
    fn invalid_frontmatter_is_treated_as_body() {
        let content = "---\ntags: [unclosed\n---\nbody";
        let (fm, body) = parse(content);
        assert!(fm.is_none());
        assert_eq!(body, content);
    }

    #[test]
    fn missing_keys_get_defaults() {
        let content = "---\nid: only-id\n---\nbody";
        let (fm, body) = parse(content);
        let fm = fm.unwrap();
        assert_eq!(fm.id, "only-id");
        assert!(fm.tags.is_empty());
        assert_eq!(body, "body");
    }
}
