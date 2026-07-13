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
}
