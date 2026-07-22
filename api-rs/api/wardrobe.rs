//! Vercel Rust 함수 → POST /api/wardrobe (옷장/갤러리 사진 → 보유 의류 식별, GPT-4o 비전)
use http_body_util::BodyExt;
use serde_json::Value;
use vercel_runtime::{run, service_fn, Error, Request};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}

async fn handler(req: Request) -> Result<Value, Error> {
    let provided = req
        .headers()
        .get("x-closet-proxy")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let authorized = closet_api_rs::proxy_authorized(provided.as_deref());
    let bytes = req
        .into_body()
        .collect()
        .await
        .map(|c| c.to_bytes())
        .unwrap_or_default();
    let payload: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    Ok(closet_api_rs::wardrobe_response(&payload, authorized).await)
}
