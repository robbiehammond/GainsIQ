// tests/test_get_exercises.rs

mod common;
use common::mocks::MockDynamoDb;

use backend_rs::{add_exercise, get_exercises};
use aws_sdk_dynamodb::types::AttributeValue;
use std::collections::HashMap;
use mockall::predicate::*;

#[tokio::test]
async fn test_add_exercise() {
    let mut mock_db = MockDynamoDb::new();
    let table_name = "exercises_table";
    let exercise_name = "Squats";

    mock_db.expect_put_exercise()
        .withf(move |name, exercise| name == table_name && exercise == exercise_name)
        .times(1)
        .returning(|_, _| Ok(()));

    let response = add_exercise(&mock_db, table_name, exercise_name).await;

    assert_eq!(response.statusCode, 200);
    assert_eq!(response.body, format!("Exercise {} added successfully", exercise_name));
}