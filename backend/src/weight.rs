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
        // Return a small JSON object on success
        Ok(_) => success_response(200, r#"{"message":"Weight logged successfully"}"#.to_string()),
        // Return a JSON object with an "error" field on failure
        Err(e) => {
            let err = format!(r#"{{"error":"Error logging weight: {:?}"}}"#, e);
            error_response(500, err)
        }
    }
}

pub async fn get_weight(client: &dyn DynamoDb, table_name: &str) -> Response {
    match client.scan_weights(table_name).await {
        Ok(items) => {
            // Convert DynamoDB items into a list of { timestamp, weight } maps
            let weight_entries: Vec<HashMap<String, String>> = items
                .into_iter()
                .map(|item| {
                    let mut weight_entry = HashMap::new();
                    weight_entry.insert(
                        "timestamp".to_string(),
                        item["timestamp"].as_n().unwrap().to_string()
                    );
                    weight_entry.insert(
                        "weight".to_string(),
                        item["weight"].as_n().unwrap().to_string()
                    );
                    weight_entry
                })
                .collect();

            let json_body = serde_json::to_string(&weight_entries).unwrap_or("[]".to_string());
            success_response(200, json_body)
        }
        Err(e) => {
            let err = format!(r#"{{"error":"Error fetching weights: {:?}"}}"#, e);
            error_response(500, err)
        }
    }
}

pub async fn delete_most_recent_weight(client: &dyn DynamoDb, table_name: &str) -> Response {
    match client.scan_weights(table_name).await {
        Ok(items) => {
            // Find the maximum timestamp
            if let Some(most_recent_weight) = items.into_iter().max_by_key(|item| {
                item["timestamp"].as_n().unwrap().parse::<i64>().unwrap()
            }) {
                let timestamp = most_recent_weight["timestamp"].as_n().unwrap();
                match client.delete_weight(table_name, timestamp).await {
                    Ok(_) => success_response(
                        200,
                        r#"{"message":"Most recent weight deleted successfully"}"#.to_string()
                    ),
                    Err(e) => {
                        let err = format!(r#"{{"error":"Error deleting most recent weight: {:?}"}}"#, e);
                        error_response(500, err)
                    }
                }
            } else {
                // If the table is empty and we can't find a max timestamp
                error_response(404, r#"{"error":"No weight found to delete"}"#.to_string())
            }
        }
        Err(e) => {
            let err = format!(r#"{{"error":"Error fetching weights: {:?}"}}"#, e);
            error_response(500, err)
        }
    }
}