//! 로컬/포터블 axum 서버 (cargo run --features server --bin server).
//! Vercel 배포는 api/*.rs 함수를 쓰고, 이 서버는 로컬 검증 및 Fly/Shuttle 등 타 호스팅용이다.
//! 두 경로 모두 closet_api_rs::{scan_response, care_response} 동일 코어를 호출한다.

use axum::{
    routing::{get, post},
    Json, Router,
};
use serde_json::Value;

async fn scan_route(Json(payload): Json<Value>) -> Json<Value> {
    Json(closet_api_rs::scan_response(&payload).await)
}

async fn care_route(Json(payload): Json<Value>) -> Json<Value> {
    Json(closet_api_rs::care_response(&payload).await)
}

async fn style_route(Json(payload): Json<Value>) -> Json<Value> {
    Json(closet_api_rs::style_response(&payload).await)
}

async fn wardrobe_route(Json(payload): Json<Value>) -> Json<Value> {
    Json(closet_api_rs::wardrobe_response(&payload).await)
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/scan", post(scan_route))
        .route("/api/care", post(care_route))
        .route("/api/style", post(style_route))
        .route("/api/wardrobe", post(wardrobe_route));

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8787);
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("cloSET Rust API (axum) listening on http://{}", addr);
    axum::serve(listener, app).await.unwrap();
}
