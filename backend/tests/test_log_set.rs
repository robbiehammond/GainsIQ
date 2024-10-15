mod common;
use common::mocks::MockDynamoDb;

use backend_rs::log_set;
use aws_sdk_dynamodb::types::AttributeValue;
use std::collections::HashMap;
use mockall::predicate::*;

#[tokio::test]
async fn test_log_set_success() {
    let mut mock_db = MockDynamoDb::new();
    let table_name = "sets_table";
    let exercise = "Bench Press";
    let reps = "10";
    let sets = 3;
    let weight = 100.0;

    // Expect put_set to be called with specific parameters
    mock_db.expect_put_set()
        .withf(move |name, item| {
            name == table_name &&
            item.get("exercise").unwrap().as_s().unwrap().to_owned() == exercise &&
            item.get("reps").unwrap().as_s().unwrap().to_owned() == reps &&
            item.get("sets").unwrap().as_n().unwrap().to_owned() == sets.to_string() &&
            item.get("weight").unwrap().as_n().unwrap().to_owned() == weight.to_string()
        })
        .times(1)
        .returning(|_, _| Ok(()));

    let response = log_set(&mock_db, table_name, exercise, reps.to_string(), sets, weight).await;

    assert_eq!(response.statusCode, 200);
    assert_eq!(response.body, format!("Set for {} logged successfully", exercise));
}
