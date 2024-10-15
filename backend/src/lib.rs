// src/lib.rs

use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use lambda_runtime::{Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use uuid::Uuid;
use chrono::Utc;
use aws_config;
use serde_json::Value;
use log::warn;
use async_trait::async_trait;

#[derive(Deserialize, Debug)]
pub struct RequestBody {
    pub exercise_name: Option<String>,
    pub exercise: Option<String>,
    pub reps: Option<String>,
    pub sets: Option<i32>,
    pub weight: Option<f32>,
    pub action: Option<String>,
}

#[derive(Serialize)]
pub struct Response {
    pub statusCode: u16,
    pub body: String,
    pub headers: HashMap<String, String>,
}

// Define the DynamoDb trait
#[async_trait]
pub trait DynamoDb {
    async fn scan_exercises(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
    async fn put_exercise(&self, table_name: &str, exercise_name: &str) -> Result<(), aws_sdk_dynamodb::Error>;
    async fn put_set(&self, table_name: &str, item: HashMap<String, AttributeValue>) -> Result<(), aws_sdk_dynamodb::Error>;
    async fn scan_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
    async fn delete_set(&self, table_name: &str, workout_id: &str, timestamp: &str) -> Result<(), aws_sdk_dynamodb::Error>;
}


// Implement the trait for the real DynamoDB client
#[async_trait]
impl DynamoDb for Client {
    async fn scan_exercises(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error> {
        let result = self.scan().table_name(table_name).send().await?;
        Ok(result.items.unwrap_or_default())
    }

    async fn put_exercise(&self, table_name: &str, exercise_name: &str) -> Result<(), aws_sdk_dynamodb::Error> {
        self.put_item()
            .table_name(table_name)
            .item("exerciseName", AttributeValue::S(exercise_name.to_string()))
            .send()
            .await?;
        Ok(())
    }

    async fn put_set(&self, table_name: &str, item: HashMap<String, AttributeValue>) -> Result<(), aws_sdk_dynamodb::Error> {
        self.put_item()
            .table_name(table_name)
            .set_item(Some(item))
            .send()
            .await?;
        Ok(())
    }

    async fn scan_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error> {
        let result = self
            .scan()
            .table_name(table_name)
            .expression_attribute_names("#ts", "timestamp")
            .filter_expression("attribute_exists(#ts)")
            .send()
            .await?;
        Ok(result.items.unwrap_or_default())
    }

    async fn delete_set(&self, table_name: &str, workout_id: &str, timestamp: &str) -> Result<(), aws_sdk_dynamodb::Error> {
        self.delete_item()
            .table_name(table_name)
            .key("workoutId", AttributeValue::S(workout_id.to_string()))
            .key("timestamp", AttributeValue::N(timestamp.to_string()))
            .send()
            .await?;
        Ok(())
    }
}


// Make the handler public
pub async fn handler(event: LambdaEvent<serde_json::Value>) -> Result<Response, Error> {
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

    let response = match payload_clone["httpMethod"].as_str() {
        Some("GET") => get_exercises(&dynamodb_client as &dyn DynamoDb, &exercises_table_name).await,
        Some("POST") => {
            if let Some(exercise_name) = request_body.exercise_name {
                add_exercise(&dynamodb_client as &dyn DynamoDb, &exercises_table_name, &exercise_name).await
            } else if request_body.action.as_deref() == Some("pop_last_set") {
                pop_last_set(&dynamodb_client as &dyn DynamoDb, &sets_table_name).await
            } else if let (Some(exercise), Some(reps), Some(sets), Some(weight)) = (
                request_body.exercise,
                request_body.reps,
                request_body.sets,
                request_body.weight,
            ) {
                log_set(&dynamodb_client as &dyn DynamoDb, &sets_table_name, &exercise, reps, sets, weight).await
            } else {
                error_response(400, "Invalid request".to_string())
            }
        }
        _ => error_response(400, "Invalid HTTP method".to_string()),
    };

    Ok(response)
}

// Make the following functions public
pub async fn get_exercises(client: &dyn DynamoDb, table_name: &str) -> Response {
    match client.scan_exercises(table_name).await {
        Ok(items) => {
            let exercises: Vec<String> = items
                .into_iter()
                .filter_map(|item| item.get("exerciseName").and_then(|val| val.as_s().ok().map(String::from)))
                .collect();
            success_response(200, serde_json::to_string(&exercises).unwrap())
        }
        Err(e) => error_response(500, format!("Error fetching exercises: {:?}", e)),
    }
}

pub async fn add_exercise(client: &dyn DynamoDb, table_name: &str, exercise_name: &str) -> Response {
    match client.put_exercise(table_name, exercise_name).await {
        Ok(_) => success_response(200, format!("Exercise {} added successfully", exercise_name)),
        Err(e) => error_response(500, format!("Error adding exercise: {:?}", e)),
    }
}

pub async fn log_set(
    client: &dyn DynamoDb,
    table_name: &str,
    exercise: &str,
    reps: String,
    sets: i32,
    weight: f32,
) -> Response {
    let workout_id = Uuid::new_v4().to_string();
    let timestamp = Utc::now().timestamp();

    let mut item = HashMap::new();
    item.insert("workoutId".to_string(), AttributeValue::S(workout_id));
    item.insert("timestamp".to_string(), AttributeValue::N(timestamp.to_string()));
    item.insert("exercise".to_string(), AttributeValue::S(exercise.to_string()));
    item.insert("reps".to_string(), AttributeValue::S(reps.to_string()));
    item.insert("sets".to_string(), AttributeValue::N(sets.to_string()));
    item.insert("weight".to_string(), AttributeValue::N(weight.to_string()));

    match client.put_set(table_name, item).await {
        Ok(_) => success_response(200, format!("Set for {} logged successfully", exercise)),
        Err(e) => error_response(500, format!("Error logging set: {:?}", e)),
    }
}

pub async fn pop_last_set(client: &dyn DynamoDb, table_name: &str) -> Response {
    match client.scan_sets(table_name).await {
        Ok(items) => {
            if let Some(most_recent_set) = items.into_iter().max_by_key(|x| x["timestamp"].as_n().unwrap().parse::<i64>().unwrap()) {
                let workout_id = most_recent_set["workoutId"].as_s().unwrap();
                let timestamp = most_recent_set["timestamp"].as_n().unwrap();
                match client.delete_set(table_name, workout_id, timestamp).await {
                    Ok(_) => success_response(200, format!("Successfully deleted last set for {}", most_recent_set["exercise"].as_s().unwrap())),
                    Err(e) => error_response(500, format!("Error deleting last set: {:?}", e)),
                }
            } else {
                error_response(404, "No set found to delete".to_string())
            }
        }
        Err(e) => error_response(500, format!("Error scanning table: {:?}", e)),
    }
}

pub fn success_response(statusCode: u16, body: String) -> Response {
    let mut headers = HashMap::new();
    headers.insert("Access-Control-Allow-Origin".to_string(), "*".to_string());
    headers.insert("Content-Type".to_string(), "application/json".to_string());

    Response {
        statusCode,
        body,
        headers,
    }
}

pub fn error_response(status_code: u16, body: String) -> Response {
    success_response(status_code, body)
}