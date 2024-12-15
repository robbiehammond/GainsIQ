mod mocks;

use aws_sdk_dynamodb::error::BuildError;
use aws_sdk_dynamodb::Error as DynamoError;
use aws_sdk_dynamodb::types::AttributeValue;
use backend_rs::exercises::{add_exercise, get_exercises};
use crate::mocks::MockDynamoDbMock;
use std::collections::HashMap;
use std::io;

fn generic_build_error() -> DynamoError {
    let build_error = BuildError::other(io::Error::new(io::ErrorKind::Other, "Mock error"));
    build_error.into()
}

#[tokio::test]
async fn test_add_exercise_success() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_put_exercise()
        .returning(|_, _| Ok(()));

    let response = add_exercise(&mock, "ExercisesTable", "Pull-Up").await;
    assert_eq!(response.statusCode, 200);
    assert!(response.body.contains("Exercise Pull-Up added successfully"));
}

#[tokio::test]
async fn test_add_exercise_error() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_put_exercise()
        .returning(|_, _| Err(generic_build_error()));

    let response = add_exercise(&mock, "ExercisesTable", "Pull-Up").await;
    assert_eq!(response.statusCode, 500);
    assert!(response.body.contains("Error adding exercise"));
}

#[tokio::test]
async fn test_get_exercises_success() {
    let mut mock = MockDynamoDbMock::new();
    let item = HashMap::from([
        ("exerciseName".to_string(), AttributeValue::S("Bench Press".to_string()))
    ]);
    mock.expect_scan_exercises()
        .returning(move |_| Ok(vec![item.clone()]));

    let response = get_exercises(&mock, "ExercisesTable").await;
    assert_eq!(response.statusCode, 200);
    assert!(response.body.contains("Bench Press"));
}

#[tokio::test]
async fn test_get_exercises_error() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_scan_exercises()
        .returning(|_| Err(generic_build_error()));

    let response = get_exercises(&mock, "ExercisesTable").await;
    assert_eq!(response.statusCode, 500);
    assert!(response.body.contains("Error fetching exercises"));
}