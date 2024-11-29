use std::collections::HashMap;

use aws_sdk_dynamodb::types::AttributeValue;
use chrono::Utc;

use crate::utils::{error_response, success_response, DynamoDb, Response};


pub async fn log_weight(
    client: &dyn DynamoDb,
    table_name: &str,
    weight: f32,
) -> Response {
    let timestamp = Utc::now().timestamp();

    let mut item = HashMap::new();
    item.insert("timestamp".to_string(), AttributeValue::N(timestamp.to_string()));
    item.insert("weight".to_string(), AttributeValue::N(weight.to_string()));

    match client.put_weight(table_name, item).await {
        Ok(_) => success_response(200, format!("Weight logged successfully")),
        Err(e) => error_response(500, format!("Error logging weight: {:?}", e)),
    }
}

pub async fn get_weight(client: &dyn DynamoDb, table_name: &str) -> Response {
    match client.scan_weights(table_name).await {
        Ok(items) => {
            // extract timestamp and weight from items
            let weight_entries: Vec<HashMap<String, String>> = items
                .into_iter()
                .map(|item| {
                    let mut weight_entry = HashMap::new();

                    weight_entry.insert("timestamp".to_string(), item["timestamp"].as_n().unwrap().to_string());
                    weight_entry.insert("weight".to_string(), item["weight"].as_n().unwrap().to_string());

                    weight_entry
                })
                .collect();

            success_response(200, serde_json::to_string(&weight_entries).unwrap())
        }
        Err(e) => error_response(500, format!("Error fetching weights: {:?}", e)),
    }
}

pub async fn delete_most_recent_weight(client: &dyn DynamoDb, table_name: &str) -> Response {
    match client.scan_weights(table_name).await {
        Ok(items) => {
            let most_recent_weight = items
                .into_iter()
                .max_by_key(|item| item["timestamp"].as_n().unwrap().parse::<i64>().unwrap())
                .unwrap();

            let timestamp = most_recent_weight["timestamp"].as_n().unwrap();
            match client.delete_weight(table_name, timestamp).await {
                Ok(_) => success_response(200, format!("Most recent weight deleted successfully")),
                Err(e) => error_response(500, format!("Error deleting most recent weight: {:?}", e)),
            }
        }
        Err(e) => error_response(500, format!("Error fetching weights: {:?}", e)),
    }
}