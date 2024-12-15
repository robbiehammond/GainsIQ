use aws_sdk_dynamodb::Client;
use lambda_runtime::{Error, LambdaEvent};
use log::warn;
use serde_json::Value;
use std::env;
use crate::{weight, exercises, sets, utils::{error_response, RequestBody}};


pub async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let dynamodb_client = Client::new(&aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await);

    let path = event.payload["path"].as_str().unwrap_or("/");
    let http_method = event.payload["httpMethod"].as_str().unwrap_or("GET");

    let exercises_table_name = env::var("EXERCISES_TABLE").expect("EXERCISES_TABLE not set");
    let sets_table_name = env::var("SETS_TABLE").expect("SETS_TABLE not set");
    let weight_table_name = env::var("WEIGHT_TABLE").expect("WEIGHT_TABLE not set");
    let payload_clone = event.payload.clone(); 


    let request_body_json = match payload_clone.get("body") {
        Some(Value::String(body)) => serde_json::from_str::<Value>(body).unwrap_or(Value::Null),
        _ => Value::Null,
    };

    let body: RequestBody = serde_json::from_value(request_body_json.clone()).unwrap_or_else(|_| {
        warn!("Failed to parse request body, using empty defaults");
        RequestBody {
            timestamp: request_body_json.get("timestamp").and_then(|v| v.as_u64().map(|v| v as i64)),
            workout_id: request_body_json.get("workoutId").and_then(|v| v.as_str().map(String::from)),
            exercise_name: request_body_json.get("exercise_name").and_then(|v| v.as_str().map(String::from)),
            exercise: request_body_json.get("exercise").and_then(|v| v.as_str().map(String::from)),
            reps: request_body_json.get("reps").and_then(|v| v.as_str().map(String::from)),
            sets: request_body_json.get("sets").and_then(|v| v.as_u64().map(|v| v as i32)),
            weight: request_body_json.get("weight").and_then(|v| v.as_f64().map(|v| v as f32)),
            action: request_body_json.get("action").and_then(|v| v.as_str().map(String::from)),
        }
    });
    println!("Request path: {}", path);
    println!("Request method: {}", http_method);
    println!("Request body: {:?}", body);

    // Routing logic. TODO: Fix the unwraps.
    match (http_method, path) {
        // Exercise endpoints
        ("GET", "/exercises") => {
            let response = exercises::get_exercises(&dynamodb_client, &exercises_table_name).await;
            Ok(serde_json::to_value(response)?)
        },
        ("POST", "/exercises") => {
            let response = exercises::add_exercise(&dynamodb_client, &exercises_table_name, &body.exercise_name.unwrap()).await;
            Ok(serde_json::to_value(response)?)
        }

        // Set endpoints
        ("POST", "/sets/log") => {
            let response = sets::log_set(&dynamodb_client, &sets_table_name, body.exercise.unwrap(), body.reps.unwrap(), body.sets.unwrap(), body.weight.unwrap()).await;
            Ok(serde_json::to_value(response)?)
        }
        ("GET", "/sets/last_month") => {
            let response = sets::get_last_month_workouts(&dynamodb_client, &sets_table_name).await;
            Ok(serde_json::to_value(response)?)
        }
        ("POST", "/sets/pop") => {
            let response = sets::pop_last_set(&dynamodb_client, &sets_table_name).await;
            Ok(serde_json::to_value(response)?)
        }
        ("PUT", "/sets/edit") => {
            // TODO: Error handling here.
            let workout_id = body.workout_id.unwrap_or("".to_string());
            let timestamp= body.timestamp.unwrap_or(0);
    
            let response = sets::edit_set(
                &dynamodb_client,
                &sets_table_name,
                workout_id,
                timestamp,
                body.exercise.clone(),
                body.reps.clone(),
                body.sets,
                body.weight
            ).await;
            Ok(serde_json::to_value(response)?)
        }

        // Weight endpoints 
        ("POST", "/weight") => {
            let response = weight::log_weight(&dynamodb_client, &weight_table_name, body.weight.unwrap()).await;
            Ok(serde_json::to_value(response)?)
        }
        ("GET", "/weight") => {
            let response = weight::get_weight(&dynamodb_client, &weight_table_name).await;
            Ok(serde_json::to_value(response)?)
        }
        ("DELETE", "/weight") => {
            let response = weight::delete_most_recent_weight(&dynamodb_client, &weight_table_name).await;
            Ok(serde_json::to_value(response)?)
        }

        // Default response
        _ => Ok(serde_json::to_value(error_response(404, "Route not found".to_string()))?),
    }
}