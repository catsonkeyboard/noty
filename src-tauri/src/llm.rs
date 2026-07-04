use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmRequest {
    pub base_url: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum LlmEvent {
    #[serde(rename = "delta")]
    Delta(String),
    #[serde(rename = "done")]
    Done,
    #[serde(rename = "error")]
    Error(String),
}

/// Holds the cancellation token of the stream currently in flight.
#[derive(Default)]
pub struct LlmState(std::sync::Mutex<Option<CancellationToken>>);

fn chat_completions_url(base_url: &str) -> String {
    format!("{}/chat/completions", base_url.trim_end_matches('/'))
}

/// Extract the content deltas from one SSE `data:` payload.
fn delta_from_sse_data(data: &str) -> Option<String> {
    let json: serde_json::Value = serde_json::from_str(data).ok()?;
    json["choices"][0]["delta"]["content"]
        .as_str()
        .map(|s| s.to_string())
}

#[tauri::command]
pub async fn llm_stream(
    request: LlmRequest,
    on_event: Channel<LlmEvent>,
    state: State<'_, LlmState>,
) -> Result<(), String> {
    let api_key = crate::secrets::get_api_key()?
        .ok_or_else(|| "no API key configured".to_string())?;

    // cancel any stream still running and register our own token
    let token = CancellationToken::new();
    {
        let mut guard = state.0.lock().unwrap();
        if let Some(old) = guard.take() {
            old.cancel();
        }
        *guard = Some(token.clone());
    }

    run_stream(request, &api_key, token, |event| {
        let _ = on_event.send(event);
    })
    .await
}

/// Core streaming loop, factored out of the command so it is testable
/// without a Tauri runtime.
async fn run_stream(
    request: LlmRequest,
    api_key: &str,
    token: CancellationToken,
    emit: impl Fn(LlmEvent),
) -> Result<(), String> {
    let body = serde_json::json!({
        "model": request.model,
        "messages": request.messages.iter().map(|m| {
            serde_json::json!({ "role": m.role, "content": m.content })
        }).collect::<Vec<_>>(),
        "stream": true,
    });

    let client = reqwest::Client::new();
    let response = client
        .post(chat_completions_url(&request.base_url))
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        let msg = format!("API error {status}: {}", text.chars().take(300).collect::<String>());
        emit(LlmEvent::Error(msg.clone()));
        return Err(msg);
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    loop {
        tokio::select! {
            _ = token.cancelled() => {
                emit(LlmEvent::Done);
                return Ok(());
            }
            chunk = stream.next() => {
                match chunk {
                    None => break,
                    Some(Err(e)) => {
                        emit(LlmEvent::Error(format!("stream error: {e}")));
                        return Err(e.to_string());
                    }
                    Some(Ok(bytes)) => {
                        buffer.push_str(&String::from_utf8_lossy(&bytes));
                        // SSE events are separated by a blank line
                        while let Some(pos) = buffer.find("\n\n") {
                            let event = buffer[..pos].to_string();
                            buffer.drain(..pos + 2);
                            for line in event.lines() {
                                let Some(data) = line.strip_prefix("data:").map(str::trim_start) else {
                                    continue;
                                };
                                if data == "[DONE]" {
                                    emit(LlmEvent::Done);
                                    return Ok(());
                                }
                                if let Some(delta) = delta_from_sse_data(data) {
                                    if !delta.is_empty() {
                                        emit(LlmEvent::Delta(delta));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    emit(LlmEvent::Done);
    Ok(())
}

#[tauri::command]
pub fn llm_cancel(state: State<'_, LlmState>) {
    if let Some(token) = state.0.lock().unwrap().take() {
        token.cancel();
    }
}

#[tauri::command]
pub async fn list_models(base_url: String) -> Result<Vec<String>, String> {
    let api_key = crate::secrets::get_api_key()?.unwrap_or_default();
    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .bearer_auth(&api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("API error {}", response.status()));
    }
    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let models = json["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["id"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    Ok(models)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_openai_style_delta() {
        let data = r#"{"choices":[{"delta":{"content":"Hello"},"index":0}]}"#;
        assert_eq!(delta_from_sse_data(data), Some("Hello".to_string()));
    }

    #[test]
    fn ignores_non_content_events() {
        // role-only first chunk
        let data = r#"{"choices":[{"delta":{"role":"assistant"},"index":0}]}"#;
        assert_eq!(delta_from_sse_data(data), None);
        assert_eq!(delta_from_sse_data("not json"), None);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn streams_deltas_from_mock_sse_server() {
        use std::io::{Read, Write};

        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 8192];
            let _ = stream.read(&mut buf);
            let body = concat!(
                "data: {\"choices\":[{\"delta\":{\"role\":\"assistant\"}}]}\n\n",
                "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n",
                "data: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\n",
                "data: [DONE]\n\n",
            );
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream.write_all(response.as_bytes()).unwrap();
        });

        let events = std::sync::Mutex::new(Vec::new());
        let request = LlmRequest {
            base_url: format!("http://{addr}"),
            model: "test-model".into(),
            messages: vec![ChatMessage {
                role: "user".into(),
                content: "hi".into(),
            }],
        };
        run_stream(request, "test-key", CancellationToken::new(), |e| {
            events.lock().unwrap().push(e);
        })
        .await
        .unwrap();

        let events = events.into_inner().unwrap();
        assert_eq!(
            events,
            vec![
                LlmEvent::Delta("Hello".into()),
                LlmEvent::Delta(" world".into()),
                LlmEvent::Done,
            ]
        );
    }

    #[test]
    fn builds_url_without_double_slash() {
        assert_eq!(
            chat_completions_url("https://api.openai.com/v1/"),
            "https://api.openai.com/v1/chat/completions"
        );
        assert_eq!(
            chat_completions_url("http://localhost:11434/v1"),
            "http://localhost:11434/v1/chat/completions"
        );
    }
}
