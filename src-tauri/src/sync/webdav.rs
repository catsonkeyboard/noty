use quick_xml::events::Event;
use quick_xml::Reader;

/// One entry from a PROPFIND multistatus response, path relative to the sync root.
#[derive(Debug, Clone, PartialEq)]
pub struct RemoteEntry {
    pub rel_path: String,
    pub etag: String,
    pub size: u64,
    pub is_dir: bool,
}

/// Strip surrounding quotes and the weak-validator prefix from an ETag value.
pub fn normalize_etag(raw: &str) -> String {
    raw.trim().trim_start_matches("W/").trim_matches('"').to_string()
}

/// Parse a 207 multistatus body. `root_path` is the percent-decoded server
/// path of the sync root, always with a trailing slash (e.g. "/dav/noty/").
/// Entries outside the root, the root itself and hidden files are skipped.
pub fn parse_multistatus(xml: &str, root_path: &str) -> Result<Vec<RemoteEntry>, String> {
    #[derive(PartialEq)]
    enum Field {
        None,
        Href,
        Etag,
        Length,
    }

    let mut reader = Reader::from_str(xml);
    let mut entries = Vec::new();
    let mut field = Field::None;
    let mut href = String::new();
    let mut etag = String::new();
    let mut size: u64 = 0;
    let mut is_dir = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => match e.local_name().as_ref() {
                b"response" => {
                    href.clear();
                    etag.clear();
                    size = 0;
                    is_dir = false;
                }
                b"href" => field = Field::Href,
                b"getetag" => field = Field::Etag,
                b"getcontentlength" => field = Field::Length,
                b"collection" => is_dir = true,
                _ => {}
            },
            Ok(Event::Empty(e)) if e.local_name().as_ref() == b"collection" => is_dir = true,
            Ok(Event::Text(t)) => {
                let text = t.xml_content().map_err(|e| e.to_string())?.trim().to_string();
                match field {
                    Field::Href => href = text,
                    Field::Etag => etag = text,
                    Field::Length => size = text.parse().unwrap_or(0),
                    Field::None => {}
                }
            }
            Ok(Event::End(e)) => match e.local_name().as_ref() {
                b"href" | b"getetag" | b"getcontentlength" => field = Field::None,
                b"response" => {
                    let decoded = percent_encoding::percent_decode_str(&href)
                        .decode_utf8_lossy()
                        .into_owned();
                    // href may be an absolute path or a full URL — reduce to a path
                    let path = match decoded.split_once("://") {
                        Some((_, rest)) => match rest.split_once('/') {
                            Some((_, p)) => format!("/{p}"),
                            None => "/".to_string(),
                        },
                        None => decoded,
                    };
                    if let Some(rel) = path.strip_prefix(root_path) {
                        let rel = rel.trim_end_matches('/').to_string();
                        let hidden = rel.split('/').any(|s| s.starts_with('.'));
                        if !rel.is_empty() && !hidden {
                            entries.push(RemoteEntry {
                                rel_path: rel,
                                etag: normalize_etag(&etag),
                                size,
                                is_dir,
                            });
                        }
                    }
                }
                _ => {}
            },
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("bad multistatus XML: {e}")),
            _ => {}
        }
    }
    Ok(entries)
}

use std::collections::BTreeMap;

use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};

use super::engine::RemoteFile;

/// Characters to escape inside one path segment of a URL.
const SEGMENT: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'<')
    .add(b'>')
    .add(b'?')
    .add(b'`')
    .add(b'{')
    .add(b'}');

const PROPFIND_BODY: &str = r#"<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:getetag/><D:getcontentlength/><D:resourcetype/></D:prop></D:propfind>"#;

fn method(name: &str) -> reqwest::Method {
    reqwest::Method::from_bytes(name.as_bytes()).expect("valid method name")
}

pub enum Propfind {
    Entries(Vec<RemoteEntry>),
    /// The server rejected this Depth (jianguoyun disallows "infinity").
    Unsupported,
}

pub struct WebdavClient {
    http: reqwest::Client,
    /// Server base URL without trailing slash, e.g. "https://dav.jianguoyun.com/dav"
    base: String,
    /// Path segments of the remote sync dir, e.g. ["noty"]
    root_segments: Vec<String>,
    username: String,
    password: String,
}

impl WebdavClient {
    pub fn new(
        base_url: &str,
        remote_dir: &str,
        username: &str,
        password: &str,
    ) -> Result<Self, String> {
        let base = base_url.trim().trim_end_matches('/').to_string();
        if base.is_empty() {
            return Err("WebDAV URL is not configured".to_string());
        }
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self {
            http,
            base,
            root_segments: remote_dir
                .split('/')
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect(),
            username: username.to_string(),
            password: password.to_string(),
        })
    }

    /// URL for a root-relative path ("" = the sync root itself), no trailing slash.
    fn url_for(&self, rel: &str) -> String {
        let mut url = self.base.clone();
        let segments = self
            .root_segments
            .iter()
            .map(String::as_str)
            .chain(rel.split('/').filter(|s| !s.is_empty()));
        for seg in segments {
            url.push('/');
            url.push_str(&utf8_percent_encode(seg, SEGMENT).to_string());
        }
        url
    }

    /// Percent-decoded server path of the sync root with trailing slash,
    /// used to relativize PROPFIND hrefs (e.g. "/dav/noty/").
    fn root_path(&self) -> String {
        let after_scheme = self.base.split_once("://").map(|(_, r)| r).unwrap_or(&self.base);
        let mut p = match after_scheme.find('/') {
            Some(i) => after_scheme[i..].trim_end_matches('/').to_string(),
            None => String::new(),
        };
        for seg in &self.root_segments {
            p.push('/');
            p.push_str(seg);
        }
        p.push('/');
        p
    }

    fn auth(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        req.basic_auth(&self.username, Some(&self.password))
    }

    /// Send with up to 3 attempts; retries on 429 / 5xx / transport errors
    /// with exponential backoff (jianguoyun rate-limits free accounts).
    async fn send_retry(&self, req: reqwest::RequestBuilder) -> Result<reqwest::Response, String> {
        let mut delay = std::time::Duration::from_millis(500);
        for attempt in 1..=3u32 {
            let cloned = req
                .try_clone()
                .ok_or_else(|| "internal error: request is not cloneable".to_string())?;
            match cloned.send().await {
                Ok(resp) => {
                    let s = resp.status();
                    if attempt < 3 && (s.as_u16() == 429 || s.is_server_error()) {
                        // fall through to backoff
                    } else {
                        return Ok(resp);
                    }
                }
                Err(e) => {
                    if attempt == 3 {
                        return Err(format!("network error: {e}"));
                    }
                }
            }
            tokio::time::sleep(delay).await;
            delay *= 2;
        }
        unreachable!("loop always returns on attempt 3");
    }

    async fn propfind_dir(&self, rel: &str, depth: &str) -> Result<Propfind, String> {
        let url = format!("{}/", self.url_for(rel));
        let req = self
            .auth(self.http.request(method("PROPFIND"), &url))
            .header("Depth", depth)
            .header("Content-Type", "application/xml")
            .body(PROPFIND_BODY);
        let resp = self.send_retry(req).await?;
        match resp.status().as_u16() {
            207 => {
                let text = resp.text().await.map_err(|e| e.to_string())?;
                Ok(Propfind::Entries(parse_multistatus(&text, &self.root_path())?))
            }
            400 | 403 | 501 => Ok(Propfind::Unsupported),
            401 => Err("authentication failed — check username / app password".to_string()),
            404 => Ok(Propfind::Entries(Vec::new())),
            s => Err(format!("PROPFIND failed with status {s}")),
        }
    }

    /// List every file under the sync root. Tries a single Depth:infinity
    /// request first, falls back to a per-directory Depth:1 walk.
    pub async fn list_all(&self) -> Result<BTreeMap<String, RemoteFile>, String> {
        let mut files = BTreeMap::new();
        match self.propfind_dir("", "infinity").await? {
            Propfind::Entries(entries) => {
                for e in entries {
                    if !e.is_dir {
                        files.insert(e.rel_path, RemoteFile { etag: e.etag, size: e.size });
                    }
                }
            }
            Propfind::Unsupported => {
                let mut dirs = vec![String::new()];
                while let Some(dir) = dirs.pop() {
                    let entries = match self.propfind_dir(&dir, "1").await? {
                        Propfind::Entries(e) => e,
                        Propfind::Unsupported => {
                            return Err("server rejected PROPFIND Depth 1".to_string())
                        }
                    };
                    for e in entries {
                        if e.rel_path == dir {
                            continue; // the directory itself
                        }
                        if e.is_dir {
                            dirs.push(e.rel_path);
                        } else {
                            files.insert(e.rel_path, RemoteFile { etag: e.etag, size: e.size });
                        }
                    }
                }
            }
        }
        Ok(files)
    }

    pub async fn get(&self, rel: &str) -> Result<Vec<u8>, String> {
        let resp = self.send_retry(self.auth(self.http.get(self.url_for(rel)))).await?;
        if !resp.status().is_success() {
            return Err(format!("GET {rel} failed with status {}", resp.status()));
        }
        Ok(resp.bytes().await.map_err(|e| e.to_string())?.to_vec())
    }

    /// PUT the file; returns the new ETag when the server sends one back.
    pub async fn put(&self, rel: &str, body: Vec<u8>) -> Result<Option<String>, String> {
        let resp = self
            .send_retry(self.auth(self.http.put(self.url_for(rel))).body(body))
            .await?;
        if !resp.status().is_success() {
            return Err(format!("PUT {rel} failed with status {}", resp.status()));
        }
        Ok(resp
            .headers()
            .get("etag")
            .and_then(|v| v.to_str().ok())
            .map(normalize_etag))
    }

    /// Fetch the current ETag of a single file (fallback after a PUT
    /// whose response carried no ETag header).
    pub async fn file_etag(&self, rel: &str) -> Result<String, String> {
        let req = self
            .auth(self.http.request(method("PROPFIND"), self.url_for(rel)))
            .header("Depth", "0")
            .header("Content-Type", "application/xml")
            .body(PROPFIND_BODY);
        let resp = self.send_retry(req).await?;
        if resp.status().as_u16() != 207 {
            return Err(format!("PROPFIND {rel} failed with status {}", resp.status()));
        }
        let text = resp.text().await.map_err(|e| e.to_string())?;
        let entries = parse_multistatus(&text, &self.root_path())?;
        Ok(entries.into_iter().next().map(|e| e.etag).unwrap_or_default())
    }

    pub async fn delete(&self, rel: &str) -> Result<(), String> {
        let resp = self
            .send_retry(self.auth(self.http.delete(self.url_for(rel))))
            .await?;
        match resp.status().as_u16() {
            200..=299 | 404 => Ok(()),
            s => Err(format!("DELETE {rel} failed with status {s}")),
        }
    }

    /// Create one directory (root-relative). 405 means it already exists.
    pub async fn mkcol(&self, rel: &str) -> Result<(), String> {
        let url = format!("{}/", self.url_for(rel));
        let resp = self
            .send_retry(self.auth(self.http.request(method("MKCOL"), &url)))
            .await?;
        match resp.status().as_u16() {
            200..=299 | 405 => Ok(()),
            s => Err(format!("MKCOL {rel} failed with status {s}")),
        }
    }

    /// Create every level of the remote sync dir itself (e.g. "noty").
    pub async fn ensure_root(&self) -> Result<(), String> {
        for i in 1..=self.root_segments.len() {
            let mut url = self.base.clone();
            for seg in &self.root_segments[..i] {
                url.push('/');
                url.push_str(&utf8_percent_encode(seg, SEGMENT).to_string());
            }
            url.push('/');
            let resp = self
                .send_retry(self.auth(self.http.request(method("MKCOL"), &url)))
                .await?;
            match resp.status().as_u16() {
                200..=299 | 405 => {}
                401 => return Err("authentication failed — check username / app password".to_string()),
                s => return Err(format!("MKCOL failed with status {s}")),
            }
        }
        Ok(())
    }
}

/// Probe URL + credentials with a Depth:0 PROPFIND against the base URL.
pub async fn test_connection(url: &str, username: &str, password: &str) -> Result<(), String> {
    let client = WebdavClient::new(url, "", username, password)?;
    match client.propfind_dir("", "0").await? {
        Propfind::Entries(_) => Ok(()),
        Propfind::Unsupported => Err("server rejected PROPFIND".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const JIANGUOYUN_SAMPLE: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/noty/</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag></D:getetag>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/noty/%E7%AC%94%E8%AE%B0.md</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>"abc123"</D:getetag>
        <D:getcontentlength>42</D:getcontentlength>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/noty/sub/</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>"d1"</D:getetag>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/noty/sub/a.md</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>W/"weak-9"</D:getetag>
        <D:getcontentlength>7</D:getcontentlength>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/noty/.hidden.md</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>"h1"</D:getetag>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>"#;

    #[test]
    fn parses_files_dirs_and_skips_root_and_hidden() {
        let entries = parse_multistatus(JIANGUOYUN_SAMPLE, "/dav/noty/").unwrap();
        assert_eq!(
            entries,
            vec![
                RemoteEntry { rel_path: "笔记.md".into(), etag: "abc123".into(), size: 42, is_dir: false },
                RemoteEntry { rel_path: "sub".into(), etag: "d1".into(), size: 0, is_dir: true },
                RemoteEntry { rel_path: "sub/a.md".into(), etag: "weak-9".into(), size: 7, is_dir: false },
            ]
        );
    }

    #[test]
    fn handles_full_url_hrefs() {
        let xml = r#"<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>https://dav.example.com/dav/noty/a.md</D:href>
    <D:propstat><D:prop><D:getetag>"x"</D:getetag><D:resourcetype/></D:prop></D:propstat>
  </D:response>
</D:multistatus>"#;
        let entries = parse_multistatus(xml, "/dav/noty/").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].rel_path, "a.md");
    }

    #[test]
    fn ignores_entries_outside_root() {
        let xml = r#"<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/other/a.md</D:href>
    <D:propstat><D:prop><D:getetag>"x"</D:getetag><D:resourcetype/></D:prop></D:propstat>
  </D:response>
</D:multistatus>"#;
        assert!(parse_multistatus(xml, "/dav/noty/").unwrap().is_empty());
    }

    #[test]
    fn normalize_etag_strips_quotes_and_weak_prefix() {
        assert_eq!(normalize_etag("\"abc\""), "abc");
        assert_eq!(normalize_etag("W/\"abc\""), "abc");
        assert_eq!(normalize_etag("  abc "), "abc");
    }

    #[test]
    fn rejects_malformed_xml() {
        assert!(parse_multistatus("<not-closed", "/dav/").is_err());
    }

    #[test]
    fn url_for_encodes_segments() {
        let c = WebdavClient::new("https://dav.jianguoyun.com/dav/", "noty", "u", "p").unwrap();
        assert_eq!(c.url_for(""), "https://dav.jianguoyun.com/dav/noty");
        assert_eq!(
            c.url_for("sub dir/笔记#1.md"),
            // percent-encoding encodes non-ASCII bytes too: 笔记 → %E7%AC%94%E8%AE%B0
            "https://dav.jianguoyun.com/dav/noty/sub%20dir/%E7%AC%94%E8%AE%B0%231.md"
        );
    }

    #[test]
    fn root_path_is_decoded_server_path_with_trailing_slash() {
        let c = WebdavClient::new("https://dav.jianguoyun.com/dav/", "noty", "u", "p").unwrap();
        assert_eq!(c.root_path(), "/dav/noty/");
        let c2 = WebdavClient::new("https://dav.example.com", "", "u", "p").unwrap();
        assert_eq!(c2.root_path(), "/");
    }
}
