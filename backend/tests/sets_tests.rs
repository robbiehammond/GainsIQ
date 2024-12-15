mod mocks;

use aws_sdk_dynamodb::error::BuildError;
use aws_sdk_dynamodb::Error as DynamoError;
use aws_sdk_dynamodb::types::AttributeValue;
use backend_rs::utils::Response;
use backend_rs::sets::{log_set, get_last_month_workouts, pop_last_set, edit_set};
use crate::mocks::MockDynamoDbMock;
use std::collections::HashMap;
use std::io;

fn generic_build_error() -> DynamoError {
    let build_error = BuildError::other(io::Error::new(io::ErrorKind::Other, "Mock error"));
    build_error.into()
}

#[tokio::test]
async fn test_log_set_success() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_put_set()
        .returning(|_, _| Ok(()));
    let response = log_set(&mock, "WorkoutsTable", "BenchPress".to_string(), "10".to_string(), 3, 225.0).await;
    assert_eq!(response.statusCode, 200);
    assert!(response.body.contains("Set for BenchPress logged successfully"));
}

#[tokio::test]
async fn test_log_set_error() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_put_set()
        .returning(|_, _| Err(generic_build_error()));

    let response = log_set(&mock, "WorkoutsTable", "BenchPress".to_string(), "10".to_string(), 3, 225.0).await;
    assert_eq!(response.statusCode, 500);
    assert!(response.body.contains("Error logging set"));
}

#[tokio::test]
async fn test_get_last_month_workouts_success() {
    let mut mock = MockDynamoDbMock::new();
    let item = HashMap::from([
        ("workoutId".to_string(), AttributeValue::S("some-uuid".to_string())),
        ("exercise".to_string(), AttributeValue::S("Squat".to_string())),
        ("reps".to_string(), AttributeValue::S("8".to_string())),
        ("sets".to_string(), AttributeValue::N("3".to_string())),
        ("weight".to_string(), AttributeValue::N("315".to_string())),
        ("timestamp".to_string(), AttributeValue::N("1234567890".to_string())),
    ]);
    mock.expect_query_last_month_sets()
        .returning(move |_| Ok(vec![item.clone()]));

    let response = get_last_month_workouts(&mock, "WorkoutsTable").await;
    assert_eq!(response.statusCode, 200);
    assert!(response.body.contains("Squat"));
    assert!(response.body.contains("1234567890"));
}

#[tokio::test]
async fn test_get_last_month_workouts_error() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_query_last_month_sets()
        .returning(|_| Err(generic_build_error()));

    let response = get_last_month_workouts(&mock, "WorkoutsTable").await;
    assert_eq!(response.statusCode, 500);
    assert!(response.body.contains("Error fetching last month workouts"));
}

#[tokio::test]
async fn test_pop_last_set_success() {
    let mut mock = MockDynamoDbMock::new();
    let older = HashMap::from([
        ("workoutId".to_string(), AttributeValue::S("old-uuid".to_string())),
        ("exercise".to_string(), AttributeValue::S("Deadlift".to_string())),
        ("timestamp".to_string(), AttributeValue::N("100".to_string())),
        ("weight".to_string(), AttributeValue::N("400".to_string()))
    ]);
    let newer = HashMap::from([
        ("workoutId".to_string(), AttributeValue::S("new-uuid".to_string())),
        ("exercise".to_string(), AttributeValue::S("Deadlift".to_string())),
        ("timestamp".to_string(), AttributeValue::N("200".to_string())),
        ("weight".to_string(), AttributeValue::N("405".to_string()))
    ]);

    mock.expect_scan_sets()
        .returning(move |_| Ok(vec![older.clone(), newer.clone()]));
    mock.expect_delete_set()
        .returning(|_, _, _| Ok(()));

    let response = pop_last_set(&mock, "WorkoutsTable").await;
    assert_eq!(response.statusCode, 200);
    assert!(response.body.contains("Successfully deleted last set"));
}

#[tokio::test]
async fn test_pop_last_set_no_sets_found() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_scan_sets()
        .returning(|_| Ok(vec![]));

    let response = pop_last_set(&mock, "WorkoutsTable").await;
    assert_eq!(response.statusCode, 404);
    assert!(response.body.contains("No set found to delete"));
}

#[tokio::test]
async fn test_pop_last_set_error() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_scan_sets()
        .returning(|_| Err(generic_build_error()));

    let response = pop_last_set(&mock, "WorkoutsTable").await;
    assert_eq!(response.statusCode, 500);
    assert!(response.body.contains("Error scanning table"));
}

#[tokio::test]
async fn test_edit_set_success() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_update_set()
        .returning(|_, _, _, _, _, _, _| Ok(()));
    let response = edit_set(&mock, "WorkoutsTable", "test-uuid".to_string(), 1234567890, Some("Squat".to_string()), Some("8".to_string()), Some(3), Some(315.0)).await;
    assert_eq!(response.statusCode, 200);
    assert!(response.body.contains("Set updated successfully"));
}

#[tokio::test]
async fn test_edit_set_error() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_update_set()
        .returning(|_, _, _, _, _, _, _| Err(generic_build_error()));

    let response = edit_set(&mock, "WorkoutsTable", "test-uuid".to_string(), 1234567890, None, Some("8".to_string()), None, None).await;
    assert_eq!(response.statusCode, 500);
    assert!(response.body.contains("Error updating set"));
}