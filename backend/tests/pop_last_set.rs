// tests/test_pop_last_set.rs

mod common;
use common::mocks::MockDynamoDb;

use backend_rs::pop_last_set;
use aws_sdk_dynamodb::types::AttributeValue;
use std::collections::HashMap;
use mockall::predicate::*;

#[tokio::test]
async fn test_pop_last_set_success() {
    let mut mock_db = MockDynamoDb::new();
    let table_name = "sets_table";

    // Set up the mock data
    let mut items = Vec::new();

    // First item
    let mut item1 = HashMap::new();
    item1.insert("workoutId".to_string(), AttributeValue::S("id1".to_string()));
    item1.insert("timestamp".to_string(), AttributeValue::N("100".to_string()));
    item1.insert("exercise".to_string(), AttributeValue::S("Push Ups".to_string()));
    items.push(item1);

    // Second item (most recent)
    let mut item2 = HashMap::new();
    item2.insert("workoutId".to_string(), AttributeValue::S("id2".to_string()));
    item2.insert("timestamp".to_string(), AttributeValue::N("200".to_string()));
    item2.insert("exercise".to_string(), AttributeValue::S("Squats".to_string()));
    items.push(item2);

    // Expect scan_sets to be called once and return our items
    mock_db.expect_scan_sets()
        .with(eq(table_name))
        .times(1)
        .returning(move |_| {
            Ok(items.clone())
        });

    // Expect delete_set to be called with the most recent item's workoutId and timestamp
    mock_db.expect_delete_set()
        .withf(move |name, workout_id, timestamp| {
            name == table_name && workout_id == "id2" && timestamp == "200"
        })
        .times(1)
        .returning(|_, _, _| Ok(()));

    // Call the function under test
    let response = pop_last_set(&mock_db, table_name).await;

    // Assert the response
    assert_eq!(response.statusCode, 200);
    assert_eq!(response.body, "Successfully deleted last set for Squats");
}

#[tokio::test]
async fn test_pop_last_set_no_sets() {
    let mut mock_db = MockDynamoDb::new();
    let table_name = "sets_table";

    // Expect scan_sets to be called once and return an empty vector
    mock_db.expect_scan_sets()
        .with(eq(table_name))
        .times(1)
        .returning(|_| Ok(Vec::new()));

    // Call the function under test
    let response = pop_last_set(&mock_db, table_name).await;

    // Assert the response
    assert_eq!(response.statusCode, 404);
    assert_eq!(response.body, "No set found to delete");
}
