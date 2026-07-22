//! Vercel Rust 함수 → POST /api/care
use http_body_util::BodyExt;
use serde_json::Value;
use vercel_runtime::{run, service_fn, Error, Request};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}

async fn handler(req: Request) -> Result<Value, Error> {
    let bytes = req
        .into_body()
        .collect()
        .await
        .map(|c| c.to_bytes())
        .unwrap_or_default();
    let payload: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    Ok(closet_api_rs::care_response(&payload).await)
}
