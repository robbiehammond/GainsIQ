use crate::utils::{success_response, error_response, Response};
use serde_json::json;
use reqwest::Client;

/// Log a predefined workout to the Oura API using a personal access token.
pub async fn log_workout(token: &str) -> Response {
    let workout = json!({
        "activity_type": "strength_training",
        "start_time": "2023-11-01T08:00:00Z",
        "end_time": "2023-11-01T08:45:00Z",
        "details": {
            "weight": 225,
            "repetitions": 10,
            "sets": 3
        }
    });

    let client = Client::new();
    match client
        .post("https://api.ouraring.com/v1/user-workouts")
        .bearer_auth(token)
        .json(&workout)
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            if status.is_success() {
                success_response(status.as_u16(), body)
            } else {
                let err_body = format!(r#"{{"error":"Oura API returned status {}: {}"}}"#, status.as_u16(), body);
                error_response(status.as_u16(), err_body)
            }
        }
        Err(e) => {
            let err_body = format!(r#"{{"error":"Error calling Oura API: {}"}}"#, e);
            error_response(500, err_body)
        }
    }
}