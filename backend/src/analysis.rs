use crate::utils::{error_response, not_implemented_response, success_response, DynamoDb, Response};

// TODO: Write tests.
pub async fn get_most_recent_analysis(client: &dyn DynamoDb, table_name: &str) -> Response {
    match client.query_last_month_sets(table_name).await {
        Ok(items) => {
            if let Some(most_recent_analysis) = items.into_iter().max_by_key(|x| x["timestamp"].as_n().unwrap().parse::<i64>().unwrap()) {
                let analysis_text = most_recent_analysis["analysis"].as_s().unwrap();
                success_response(200, analysis_text.to_string())
            } else {
                error_response(404, "No analyses to retrieve.".to_string())
            }
        }
        Err(e) => error_response(500, format!("Error scanning table: {:?}", e))

    }
}

pub async fn ping_processing_lambda() -> Response {
    not_implemented_response()
}