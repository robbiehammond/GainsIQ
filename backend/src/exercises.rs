use crate::utils::{error_response, success_response, DynamoDb, Response};


pub async fn add_exercise(client: &dyn DynamoDb, table_name: &str, exercise_name: &str) -> Response {
    match client.put_exercise(table_name, exercise_name).await {
        Ok(_) => {
            let msg = format!(r#"{{"message":"Exercise {} added successfully"}}"#, exercise_name);
            success_response(200, msg)
        }
        Err(e) => {
            let err = format!(r#"{{"error":"Error adding exercise: {:?}"}}"#, e);
            error_response(500, err)
        }
    }
}

pub async fn get_exercises(client: &dyn DynamoDb, table_name: &str) -> Response {
    match client.scan_exercises(table_name).await {
        Ok(items) => {
            let mut exercises: Vec<String> = items
                .into_iter()
                .filter_map(|item| {
                    item.get("exerciseName")
                        .and_then(|val| val.as_s().ok().map(String::from))
                })
                .collect();

            exercises.sort_by_key(|s| s.to_ascii_lowercase());
            let json_body = serde_json::to_string(&exercises).unwrap_or("[]".to_string());
            success_response(200, json_body)
        }
        Err(e) => {
            let err = format!(r#"{{"error":"Error fetching exercises: {:?}"}}"#, e);
            error_response(500, err)
        }
    }
}

pub async fn delete_exercise(client: &dyn DynamoDb, table_name: &str, exercise_name: &str) -> Response {
    if exercise_name.is_empty() {
        // Return a JSON error message for invalid input
        return error_response(400, r#"{"error":"exercise_name is required"}"#.to_string());
    }

    match client.delete_exercise(table_name, exercise_name).await {
        Ok(_) => {
            let msg = format!(r#"{{"message":"Exercise {} deleted successfully"}}"#, exercise_name);
            success_response(200, msg)
        }
        Err(e) => {
            let err = format!(r#"{{"error":"Error deleting exercise: {:?}"}}"#, e);
            error_response(500, err)
        }
    }
}