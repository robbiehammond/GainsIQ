use aws_lambda_events::http::request;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use lambda_runtime::{Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use uuid::Uuid;
use chrono::{Duration, Utc, TimeZone, FixedOffset};
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
    async fn query_last_month_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
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
    async fn query_last_month_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error> {
        let one_month_ago = Utc::now().timestamp() - Duration::days(30).num_seconds();

        let result = self
            .scan()
            .table_name(table_name)
            .expression_attribute_names("#ts", "timestamp")
            .expression_attribute_values(":one_month_ago", AttributeValue::N(one_month_ago.to_string()))
            .filter_expression("#ts > :one_month_ago")
            .send()
            .await?;
        Ok(result.items.unwrap_or_default())
    }

}


pub async fn handler(event: LambdaEvent<serde_json::Value>) -> Result<Response, Error> {
    let dynamodb_client = Client::new(&aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await);

    let exercises_table_name = env::var("EXERCISES_TABLE").expect("EXERCISES_TABLE not set");
    let sets_table_name = env::var("SETS_TABLE").expect("SETS_TABLE not set");
    let payload_clone = event.payload.clone(); 

    let request_body_json = match payload_clone.get("body") {
        Some(Value::String(body)) => serde_json::from_str::<Value>(body).unwrap_or(Value::Null),
        _ => Value::Null,
    };

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
        Some("GET") => {
            get_exercises(&dynamodb_client as &dyn DynamoDb, &exercises_table_name).await
        }
        Some("POST") => {
            if request_body.action.as_deref() == Some("get_progress") {
                if let Some(exercise_name) = request_body.exercise_name {
                    get_exercise_progress(&dynamodb_client as &dyn DynamoDb, &sets_table_name, &exercise_name).await
                } else {
                    error_response(400, "Missing exercise name for progress".to_string())
                }
            }
            else if let Some(exercise_name) = request_body.exercise_name {
                add_exercise(&dynamodb_client as &dyn DynamoDb, &exercises_table_name, &exercise_name).await
            } else if request_body.action.as_deref() == Some("pop_last_set") {
                pop_last_set(&dynamodb_client as &dyn DynamoDb, &sets_table_name).await 
            }
            else if request_body.action.as_deref() == Some("last_month_workouts") {
                get_last_month_workouts(&dynamodb_client as &dyn DynamoDb, &sets_table_name).await // TODO: Don't make this a POST!
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

pub async fn get_last_month_workouts(client: &dyn DynamoDb, table_name: &str) -> Response {
    fn extract_string_or_number(attr_value: &AttributeValue) -> String {
        match attr_value {
            AttributeValue::S(val) => val.to_string(),
            AttributeValue::N(val) => val.to_string(),
            _ => "unknown".to_string(),
        }
    }

    match client.query_last_month_sets(table_name).await {
        Ok(items) => {
            let mut workouts: Vec<HashMap<String, String>> = items
                .into_iter()
                .map(|item| {
                    let mut workout = HashMap::new();

                    workout.insert("exercise".to_string(), item["exercise"].as_s().unwrap().to_string());

                    if let Some(reps_value) = item.get("reps") {
                        workout.insert("reps".to_string(), extract_string_or_number(reps_value));
                    }

                    if let Some(sets_value) = item.get("sets") {
                        workout.insert("sets".to_string(), extract_string_or_number(sets_value));
                    }

                    if let Some(weight_value) = item.get("weight") {
                        workout.insert("weight".to_string(), extract_string_or_number(weight_value));
                    }

                    workout.insert("timestamp".to_string(), item["timestamp"].as_n().unwrap().to_string());

                    workout
                })
                .collect();

            workouts.sort_by_key(|workout| workout["timestamp"].parse::<i64>().unwrap_or(0));

            success_response(200, serde_json::to_string(&workouts).unwrap())
        }
        Err(e) => error_response(500, format!("Error fetching last month workouts: {:?}", e)),
    }
}

pub async fn get_exercise_progress(client: &dyn DynamoDb, table_name: &str, exercise_name: &str) -> Response {
    match client.scan_sets(table_name).await {
        Ok(items) => {
            // Filter only the sets for the specified exercise
            let filtered_sets: Vec<HashMap<String, AttributeValue>> = items.into_iter()
                .filter(|item| {
                    item.get("exercise")
                        .and_then(|val| val.as_s().ok())
                        .map(|val| val == exercise_name)
                        .unwrap_or(false)
                })
                .collect();

            let mut volume_datapoints: HashMap<String, Vec<f32>> = HashMap::new();
            
            for set in filtered_sets {
                if let (Some(reps), Some(weight), Some(timestamp)) = (
                    set.get("reps"),
                    set.get("weight").and_then(|v| v.as_n().ok()),
                    set.get("timestamp").and_then(|v| v.as_n().ok()),
                ) {

                    // for a single set
                    let ts = timestamp.parse::<i64>().unwrap_or(0);
                    let dt = Utc.timestamp(ts, 0).with_timezone(&FixedOffset::west(8 * 3600));
                    let date_str = dt.format("%Y-%m-%d").to_string();

                    // If it's N, should be unwrapple. 
                    // If S, get first thing before whitespace. So 5 corresponds to 5 or less, 16 corresponds to 16 or more.
                    let reps_val: f32 = match reps {
                        AttributeValue::N(val) => val.parse::<f32>().unwrap_or(0.0),
                        AttributeValue::S(val) => val.split_whitespace().next().unwrap_or("0").parse::<f32>().unwrap_or(0.0),
                        _ => 0.0,
                    };
                    let weight_val = weight.parse::<f32>().unwrap_or(0.0);
                    // TODO: Fix me! Weight should be weighted (no pun intended) higher than reps, since weight matters a bit more. Need a formula for it.
                    let volume = reps_val * weight_val;

                    volume_datapoints.entry(date_str).or_insert(vec![]).push(volume);
                }
            }

            let hammond_indicies: Vec<HashMap<String, String>> = volume_datapoints 
                .into_iter()
                .map(|(date, indices)| {
                    // hammond index = avg(reps * weight) for all sets of a given workout. There is 1 Hammond index per workout.
                    let hammond_index = indices.iter().sum::<f32>() / indices.len() as f32;
                    let mut record = HashMap::new();
                    record.insert("date".to_string(), date);
                    record.insert("hammond_index".to_string(), hammond_index.to_string());
                    record
                })
                .collect();

            success_response(200, serde_json::to_string(&hammond_indicies).unwrap())
        }
        Err(e) => error_response(500, format!("Error fetching progress: {:?}", e)),
    }
}