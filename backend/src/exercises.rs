use serde::{Deserialize, Serialize};

use crate::utils::{error_response, success_response, DynamoDb, Response};


#[derive(Deserialize, Serialize)]
pub struct AddExerciseRequest {
    pub exercise_name: String,
}

pub async fn add_exercise(client: &dyn DynamoDb, table_name: &str, exercise_name: &str) -> Response {
    match client.put_exercise(table_name, exercise_name).await {
        Ok(_) => success_response(200, format!("Exercise {} added successfully", exercise_name)),
        Err(e) => error_response(500, format!("Error adding exercise: {:?}", e)),
    }
}

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

pub async fn delete_exercise(client: &dyn DynamoDb, table_name: &str, exercise_name: &str) -> Response {
    if exercise_name.is_empty() {
        return error_response(400, "Invalid input: exercise_name is required".to_string());
    }

    match client.delete_exercise(table_name, exercise_name).await {
        Ok(_) => success_response(200, format!("Exercise {} deleted successfully", exercise_name)),
        Err(e) => error_response(500, format!("Error deleting exercise: {:?}", e)),
    }
}