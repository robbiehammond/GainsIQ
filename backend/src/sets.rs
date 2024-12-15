use aws_sdk_dynamodb::{types::AttributeValue, Client};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;
use std::collections::HashMap;
use crate::{utils::success_response, utils::{error_response, DynamoDb}, utils::Response};


#[derive(Deserialize)]
pub struct LogSetRequest {
    pub exercise: String,
    pub reps: String,
    pub sets: i32,
    pub weight: f32,
}

pub async fn log_set(
    client: &dyn DynamoDb,
    table_name: &str,
    exercise: String,
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

                    workout.insert(
                        "workoutId".to_string(),
                        item["workoutId"].as_s().unwrap().to_string()
                    );

                    workout.insert(
                        "exercise".to_string(),
                        item["exercise"].as_s().unwrap().to_string()
                    );

                    if let Some(reps_value) = item.get("reps") {
                        workout.insert("reps".to_string(), extract_string_or_number(reps_value));
                    }

                    if let Some(sets_value) = item.get("sets") {
                        workout.insert("sets".to_string(), extract_string_or_number(sets_value));
                    }

                    if let Some(weight_value) = item.get("weight") {
                        workout.insert("weight".to_string(), extract_string_or_number(weight_value));
                    }

                    workout.insert(
                        "timestamp".to_string(), 
                        item["timestamp"].as_n().unwrap().to_string()
                    );

                    workout
                })
                .collect();

            // Sort by timestamp ascending
            workouts.sort_by_key(|workout| workout["timestamp"].parse::<i64>().unwrap_or(0));

            success_response(200, serde_json::to_string(&workouts).unwrap())
        }
        Err(e) => error_response(500, format!("Error fetching last month workouts: {:?}", e)),
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

pub async fn edit_set(
    client: &dyn DynamoDb,
    table_name: &str,
    workout_id: String,
    timestamp: i64,
    exercise: Option<String>,
    reps: Option<String>,
    sets: Option<i32>,
    weight: Option<f32>,
) -> Response {
    match client.update_set(table_name, &workout_id, timestamp, exercise, reps, sets, weight).await {
        Ok(_) => success_response(200, "Set updated successfully".to_string()),
        Err(e) => error_response(500, format!("Error updating set: {:?}", e)),
    }
}