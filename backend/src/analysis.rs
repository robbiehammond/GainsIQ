use aws_sdk_sqs::Client;
use aws_sdk_dynamodb::types::AttributeValue;
use crate::utils::{error_response, success_response, DynamoDb, Response};

/// Fetches the most recent analysis from the `analysis_table_name`.
pub async fn get_most_recent_analysis(client: &dyn DynamoDb, table_name: &str) -> Response {
    match client.query_most_recent_analysis(table_name).await {
        Ok(items) => {
            // Find item with the largest timestamp
            if let Some(most_recent_analysis) = items.into_iter()
                .max_by_key(|item| item["timestamp"].as_n().unwrap().parse::<i64>().unwrap())
            {
                // Extract the "analysis" field as a string
                if let Some(analysis_val) = most_recent_analysis.get("analysis") {
                    if let Ok(analysis_text) = analysis_val.as_s() {
                        // 1) Build a serde_json Value
                        let body_val = serde_json::json!({
                            "analysis": analysis_text
                        });
                
                        // 2) Convert that Value to a string, letting serde handle escapes
                        let json_body = serde_json::to_string(&body_val).unwrap();
                
                        return success_response(200, json_body);
                    }
                }
                // If "analysis" key doesn't exist or isn't a string
                error_response(500, r#"{"error":"No 'analysis' field found in the item"}"#.to_string())
            } else {
                // If no items in table
                error_response(404, r#"{"error":"No analyses to retrieve"}"#.to_string())
            }
        }
        Err(e) => {
            let msg = format!(r#"{{"error":"Error scanning table: {:?}"}}"#, e);
            error_response(500, msg)
        }
    }
}

/// Sends a message to the queue to trigger analysis.  
pub async fn ping_processing_lambda(sqs_client: &Client, queue_url: &str) -> Response {
    match sqs_client
        .send_message()
        .queue_url(queue_url)
        .message_body("Triggering SQS from ping_processing_lambda!")
        .send()
        .await
    {
        Ok(response) => {
            if let Some(message_id) = response.message_id() {
                // Return JSON with "message"
                let json_body = format!(r#"{{"message":"Message sent! ID: {}"}}"#, message_id);
                success_response(200, json_body)
            } else {
                // SQS succeeded but no ID returned
                success_response(200, r#"{"message":"Message sent, but no MessageId returned"}"#.to_string())
            }
        }
        Err(e) => {
            let err = format!(r#"{{"error":"Failed to send message to SQS queue: {:?}"}}"#, e);
            error_response(500, err)
        }
    }
}