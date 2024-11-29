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