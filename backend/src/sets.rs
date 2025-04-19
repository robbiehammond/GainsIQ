use aws_sdk_dynamodb::{types::AttributeValue, Client};
use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

use crate::{utils::{error_response, success_response, DynamoDb, Response, WeightModulation}, weight};


pub async fn log_set(
    client: &dyn DynamoDb,
    table_name: &str,
    exercise: String,
    reps: String,
    sets: i32,
    weight: f32,
    weight_modulation: WeightModulation
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
    item.insert("weight_modulation".to_string(), AttributeValue::S(weight_modulation.to_string()));

    match client.put_set(table_name, item).await {
        Ok(_) => {
            // Return a JSON object with a "message" field.
            let body = format!(r#"{{"message":"Set for {} logged successfully"}}"#, exercise);
            success_response(200, body)
        },
        Err(e) => {
            // Return a JSON object with an "error" field.
            let err = format!(r#"{{"error":"Error logging set: {:?}"}}"#, e);
            error_response(500, err)
        },
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

                    if let Some(weight_modulation) = item.get("weight_modulation") {
                        workout.insert("weight_modulation".to_string(), extract_string_or_number(weight_modulation));
                    }

                    workout.insert(
                        "timestamp".to_string(),
                        item["timestamp"].as_n().unwrap().to_string()
                    );

                    workout
                })
                .collect();

            // Sort by timestamp ascending
            workouts.sort_by_key(|w| w["timestamp"].parse::<i64>().unwrap_or(0));

            // Return the array as a JSON string
            let json_body = serde_json::to_string(&workouts).unwrap_or("[]".to_string());
            success_response(200, json_body)
        },
        Err(e) => {
            let err = format!(r#"{{"error":"Error fetching last month workouts: {:?}"}}"#, e);
            error_response(500, err)
        },
    }
}

pub async fn pop_last_set(client: &dyn DynamoDb, table_name: &str) -> Response {
    match client.scan_sets(table_name).await {
        Ok(items) => {
            // Find the set with the largest timestamp
            if let Some(most_recent_set) = items.into_iter()
                .max_by_key(|x| x["timestamp"].as_n().unwrap().parse::<i64>().unwrap())
            {
                let workout_id = most_recent_set["workoutId"].as_s().unwrap();
                let timestamp = most_recent_set["timestamp"].as_n().unwrap();

                match client.delete_set(table_name, workout_id, timestamp).await {
                    Ok(_) => {
                        // Return a success JSON message
                        success_response(200, r#"{"message":"Successfully deleted last set"}"#.to_string())
                    },
                    Err(e) => {
                        let err = format!(r#"{{"error":"Error deleting last set: {:?}"}}"#, e);
                        error_response(500, err)
                    },
                }
            } else {
                // No set found -> 404 with JSON error
                error_response(404, r#"{"error":"No set found to delete"}"#.to_string())
            }
        },
        Err(e) => {
            let err = format!(r#"{{"error":"Error scanning table: {:?}"}}"#, e);
            error_response(500, err)
        },
    }
}

pub async fn edit_set(
    client: &dyn DynamoDb,
    table_name: &str,
    workout_id: String,
    timestamp: i64,
    reps: Option<String>,
    sets: Option<i32>,
    weight: Option<f32>,
) -> Response {
    match client.update_set(table_name, &workout_id, timestamp, reps, sets, weight).await {
        Ok(_) => {
            success_response(200, r#"{"message":"Set updated successfully"}"#.to_string())
        },
        Err(e) => {
            let err = format!(r#"{{"error":"Error updating set: {:?}"}}"#, e);
            error_response(500, err)
        },
    }
}

pub async fn delete_set(
    client: &dyn DynamoDb,
    table_name: &str,
    workout_id: String,
    timestamp: i64,
) -> Response {
    if workout_id.is_empty() || timestamp == 0 {
        return error_response(400, r#"{"error":"Invalid input: workoutId and timestamp are required"}"#.to_string());
    }

    match client.delete_set(table_name, &workout_id, &timestamp.to_string()).await {
        Ok(_) => {
            let msg = format!(r#"{{"message":"Set with workoutId {} and timestamp {} deleted successfully"}}"#, workout_id, timestamp);
            success_response(200, msg)
        },
        Err(e) => {
            let err = format!(r#"{{"error":"Error deleting set: {:?}"}}"#, e);
            error_response(500, err)
        },
    }
}

pub async fn get_sets_for_exercise(
    client: &dyn DynamoDb,
    table_name: &str,
    exercise_name: &str,
    start_timestamp: i64,
    end_timestamp: i64
) -> Response {
    fn extract_attr_string(attr: &AttributeValue) -> String {
        match attr {
            AttributeValue::S(val) => val.to_string(),
            AttributeValue::N(val) => val.to_string(),
            _ => "unknown".to_string(),
        }
    }

    if exercise_name.is_empty() {
        return error_response(400, r#"{"error":"exercise_name cannot be empty"}"#.to_string());
    }

    match client.query_sets_for_exercise(table_name, exercise_name, start_timestamp, end_timestamp).await {
        Ok(items) => {
            let mut sets_list: Vec<HashMap<String, String>> = items
                .into_iter()
                .map(|item| {
                    let mut set_map = HashMap::new();
                    if let Some(val) = item.get("workoutId") {
                        set_map.insert("workoutId".to_string(), extract_attr_string(val));
                    }
                    if let Some(val) = item.get("exercise") {
                        set_map.insert("exercise".to_string(), extract_attr_string(val));
                    }
                    if let Some(val) = item.get("reps") {
                        set_map.insert("reps".to_string(), extract_attr_string(val));
                    }
                    if let Some(val) = item.get("sets") {
                        set_map.insert("sets".to_string(), extract_attr_string(val));
                    }
                    if let Some(val) = item.get("weight") {
                        set_map.insert("weight".to_string(), extract_attr_string(val));
                    }
                    if let Some(val) = item.get("timestamp") {
                        set_map.insert("timestamp".to_string(), extract_attr_string(val));
                    }
                    if let Some(val) = item.get("weight_modulation") {
                        set_map.insert("weight_modulation".to_string(), extract_attr_string(val));
                    }
                    set_map
                })
                .collect();

            // Sort by ascending timestamp
            sets_list.sort_by_key(|s| s["timestamp"].parse::<i64>().unwrap_or(0));

            let json_body = serde_json::to_string(&sets_list).unwrap_or("[]".to_string());
            success_response(200, json_body)
        },
        Err(e) => {
            let err = format!(r#"{{"error":"Error querying sets for {}: {:?}"}}"#, exercise_name, e);
            error_response(500, err)
        },
    }
}