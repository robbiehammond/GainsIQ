mod mocks;

use aws_sdk_dynamodb::error::BuildError;
use aws_sdk_dynamodb::error::SdkError;
use aws_sdk_dynamodb::operation::put_item::PutItemError;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Error as DynamoError;
use backend_rs::utils::Response;
use backend_rs::weight::{delete_most_recent_weight, get_weight, log_weight};
use crate::mocks::MockDynamoDbMock;
use std::collections::HashMap;
use std::error::Error as StdError;
use std::io;
use std::sync::Arc;

fn generic_build_error() -> DynamoError {
    let build_error = BuildError::other(io::Error::new(
        io::ErrorKind::Other,
        "blah",
    ));
    build_error.into()
}

#[tokio::test]
async fn test_log_weight_success() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_put_weight()
        .returning(|_, _| Ok(()));
    let response = log_weight(&mock, "WeightTable", 180.0).await;
    assert_eq!(response.statusCode, 200);
    assert!(response.body.contains("Weight logged successfully"));
}

#[tokio::test]
async fn test_log_weight_error() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_put_weight()
        .returning(|_, _| Err(generic_build_error()));
    let response = log_weight(&mock, "WeightTable", 180.0).await;
    assert_eq!(response.statusCode, 500);
    assert!(response.body.contains("Error logging weight"));
}

#[tokio::test]
async fn test_get_weight_success() {
    let mut mock = MockDynamoDbMock::new();
    let item = HashMap::from([
        ("timestamp".to_string(), AttributeValue::N("12345".to_string())),
        ("weight".to_string(), AttributeValue::N("180".to_string()))
    ]);

    mock.expect_scan_weights().returning(move |_| Ok(vec![item.clone()]));
    let response = get_weight(&mock, "WeightTable").await;
    assert_eq!(response.statusCode, 200);
    assert!(response.body.contains("180"));
}

#[tokio::test]
async fn test_get_weight_error() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_scan_weights()
        .returning(|_| Err(generic_build_error()));
    let response = get_weight(&mock, "WeightTable").await;
    assert_eq!(response.statusCode, 500);
    assert!(response.body.contains("Error fetching weights"));
}

#[tokio::test]
async fn test_delete_most_recent_weight_success() {
    let mut mock = MockDynamoDbMock::new();
    let older = HashMap::from([
        ("timestamp".to_string(), AttributeValue::N("100".to_string())),
        ("weight".to_string(), AttributeValue::N("170".to_string()))
    ]);
    let newer = HashMap::from([
        ("timestamp".to_string(), AttributeValue::N("200".to_string())),
        ("weight".to_string(), AttributeValue::N("180".to_string()))
    ]);

    mock.expect_scan_weights().returning(move |_| Ok(vec![older.clone(), newer.clone()]));
    mock.expect_delete_weight()
        .returning(|_, _| Ok(()));

    let response = delete_most_recent_weight(&mock, "WeightTable").await;
    assert_eq!(response.statusCode, 200);
    assert!(response.body.contains("Most recent weight deleted successfully"));
}

#[tokio::test]
async fn test_delete_most_recent_weight_error() {
    let mut mock = MockDynamoDbMock::new();
    mock.expect_scan_weights()
        .returning(|_| Err(generic_build_error()));
    let response = delete_most_recent_weight(&mock, "WeightTable").await;
    assert_eq!(response.statusCode, 500);
    assert!(response.body.contains("Error fetching weights"));
}