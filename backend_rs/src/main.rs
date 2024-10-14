use aws_lambda_events::http::request;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use lambda_runtime::{service_fn, tracing::subscriber::field::debug, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use uuid::Uuid;
use chrono::{Utc, TimeZone};
use aws_config;
use serde_json::Value;
use log::warn;


#[derive(Deserialize, Debug)]
struct RequestBody {
    exercise_name: Option<String>,
    exercise: Option<String>,
    reps: Option<String>,
    sets: Option<i32>,
    weight: Option<f32>,
    action: Option<String>,
}

#[derive(Serialize)]
struct Response {
    statusCode: u16,
    body: String,
    headers: HashMap<String, String>,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    env_logger::init();
    let func = service_fn(handler);
    lambda_runtime::run(func).await?;
    Ok(())
}

async fn handler(event: LambdaEvent<serde_json::Value>) -> Result<Response, Error> {
    let dynamodb_client = Client::new(&aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await);

    // Read the environment variables for the table names
    let exercises_table_name = env::var("EXERCISES_TABLE").expect("EXERCISES_TABLE not set");
    let sets_table_name = env::var("SETS_TABLE").expect("SETS_TABLE not set");
    let payload_clone = event.payload.clone(); // Clone event.payload
    println!("{}", payload_clone);

    let request_body_json = match payload_clone.get("body") {
        Some(Value::String(body)) => serde_json::from_str::<Value>(body).unwrap_or(Value::Null),
        _ => Value::Null,
    };

    // Safely deserialize the nested "body" into the RequestBody struct, ignoring missing fields
    let request_body: RequestBody = serde_json::from_value(request_body_json.clone()).unwrap_or_else(|_| {
        warn!("Failed to parse request body, using empty defaults");
        RequestBody {
            exercise_name: request_body_json.get("exercise_name").and_then(|v| v.as_str().map(String::from)),
            exercise: request_body_json.get("exercise").and_then(|v| v.as_str().map(String::from)),
            reps: request_body_json.get("reps").and_then(|v| v.as_str().map(String::from)),
            sets: request_body_json.get("sets").and_then(|v| v.as_u64().map(|v| v as i32)),
            weight: request_body_json.get("weight").and_then(|v| v.as_f64().map(|v| v as f32)),
            action: request_body_json.get("action").and_then(|v| v.as_str().map(String::from)),
        }
    });
    println!("{:?}", request_body);



    let response = match payload_clone["httpMethod"].as_str() { // Use cloned payload here
        Some("GET") => get_exercises(&dynamodb_client, &exercises_table_name).await,
        Some("POST") => {
            if let Some(exercise_name) = request_body.exercise_name {
                add_exercise(&dynamodb_client, &exercises_table_name, &exercise_name).await
            } else if request_body.action.as_deref() == Some("pop_last_set") {
                pop_last_set(&dynamodb_client, &sets_table_name).await
            } else if let (Some(exercise), Some(reps), Some(sets), Some(weight)) = (
                request_body.exercise,
                request_body.reps,
                request_body.sets,
                request_body.weight,
            ) {
                log_set(&dynamodb_client, &sets_table_name, &exercise, reps, sets, weight).await
            } else {
                error_response(400, "Invalid request".to_string())
            }
        }
        _ => error_response(400, "Invalid HTTP method".to_string()),
    };

    Ok(response)
}

async fn get_exercises(client: &Client, table_name: &str) -> Response {
    match client.scan().table_name(table_name).send().await {
        Ok(result) => {
            let exercises: Vec<String> = result
                .items
                .unwrap_or_default()
                .into_iter()
                .filter_map(|item| item.get("exerciseName").map(|val| val.as_s().unwrap().to_string()))
                .collect();
            success_response(200, serde_json::to_string(&exercises).unwrap())
        }
        Err(e) => error_response(500, format!("Error fetching exercises: {:?}", e)),
    }
}

async fn add_exercise(client: &Client, table_name: &str, exercise_name: &str) -> Response {
    let result = client
        .put_item()
        .table_name(table_name)
        .item("exerciseName", AttributeValue::S(exercise_name.to_string()))
        .send()
        .await;

    match result {
        Ok(_) => success_response(200, format!("Exercise {} added successfully", exercise_name)),
        Err(e) => error_response(500, format!("Error adding exercise: {:?}", e)),
    }
}

async fn log_set(
    client: &Client,
    table_name: &str,
    exercise: &str,
    reps: String,
    sets: i32,
    weight: f32,
) -> Response {
    let workout_id = Uuid::new_v4().to_string();
    let timestamp = Utc::now().timestamp();

    let result = client
        .put_item()
        .table_name(table_name)
        .item("workoutId", AttributeValue::S(workout_id))
        .item("timestamp", AttributeValue::N(timestamp.to_string()))
        .item("exercise", AttributeValue::S(exercise.to_string()))
        .item("reps", AttributeValue::S(reps.to_string()))
        .item("sets", AttributeValue::N(sets.to_string()))
        .item("weight", AttributeValue::N(weight.to_string()))
        .send()
        .await;

    match result {
        Ok(_) => success_response(200, format!("Set for {} logged successfully", exercise)),
        Err(e) => error_response(500, format!("Error logging set: {:?}", e)),
    }
}

async fn pop_last_set(client: &Client, table_name: &str) -> Response {
    let result = client
        .scan()
        .table_name(table_name)
        .limit(1)
        .expression_attribute_names("#ts", "timestamp")
        .filter_expression("attribute_exists(#ts)")
        .send()
        .await;

    let items = match result {
        Ok(output) => output.items.unwrap_or_default(),
        Err(e) => return error_response(500, format!("Error scanning table: {:?}", e)),
    };

    if let Some(most_recent_set) = items.into_iter().max_by_key(|x| x["timestamp"].as_n().unwrap().parse::<i64>().unwrap()) {
        let workout_id = most_recent_set["workoutId"].as_s().unwrap();
        let timestamp = most_recent_set["timestamp"].as_n().unwrap();

        match client
            .delete_item()
            .table_name(table_name)
            .key("workoutId", AttributeValue::S(workout_id.to_string()))
            .key("timestamp", AttributeValue::N(timestamp.to_string()))
            .send()
            .await
        {
            Ok(_) => success_response(200, format!("Successfully deleted last set for {}", most_recent_set["exercise"].as_s().unwrap())),
            Err(e) => error_response(500, format!("Error deleting last set: {:?}", e)),
        }
    } else {
        error_response(404, "No set found to delete".to_string())
    }
}

fn success_response(statusCode: u16, body: String) -> Response {
    let mut headers = HashMap::new();
    headers.insert("Access-Control-Allow-Origin".to_string(), "*".to_string());
    headers.insert("Content-Type".to_string(), "application/json".to_string());

    Response {
        statusCode,
        body,
        headers,
    }
}

fn error_response(status_code: u16, body: String) -> Response {
    success_response(status_code, body)
}