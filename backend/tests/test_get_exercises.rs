
mod common;
use common::mocks::MockDynamoDb;

use backend_rs::get_exercises;
use aws_sdk_dynamodb::types::AttributeValue;
use std::collections::HashMap;
use mockall::predicate::*;

#[tokio::test]
async fn test_get_exercises_single() {
    // Existing test...
}

#[tokio::test]
async fn test_get_exercises_multiple() {
    let mut mock_db = MockDynamoDb::new();
    let table_name = "exercises_table";

    // Set up the expected call and return value
    let mut items = Vec::new();

    let exercises = vec!["Push Ups", "Squats", "Pull Ups"];
    for exercise in &exercises {
        let mut item = HashMap::new();
        item.insert("exerciseName".to_string(), AttributeValue::S(exercise.to_string()));
        items.push(item);
    }

    mock_db.expect_scan_exercises()
        .with(eq(table_name))
        .times(1)
        .returning(move |_| {
            Ok(items.clone())
        });

    let response = get_exercises(&mock_db, table_name).await;

    assert_eq!(response.statusCode, 200);
    let expected_body = serde_json::to_string(&exercises).unwrap();
    assert_eq!(response.body, expected_body);
}
