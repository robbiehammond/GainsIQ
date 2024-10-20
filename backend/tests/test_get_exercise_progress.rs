mod common;
use common::mocks::MockDynamoDb;

use backend_rs::get_exercise_progress;
use aws_sdk_dynamodb::types::AttributeValue;
use std::collections::HashMap;
use mockall::predicate::*;
use chrono::{Utc};

// Helper function to create a timestamp
fn get_timestamp(offset_days: i64) -> String {
    (Utc::now().timestamp() + (offset_days * 86400)).to_string()
}

#[tokio::test]
async fn test_get_exercise_progress_single_day() {
    let mut mock_db = MockDynamoDb::new();
    let table_name = "sets_table";
    let exercise_name = "Bench Press";

    // Set up mock DynamoDB scan result
    let mut items = Vec::new();

    // Example of a set with reps as a number
    let mut set1 = HashMap::new();
    set1.insert("exercise".to_string(), AttributeValue::S(exercise_name.to_string()));
    set1.insert("reps".to_string(), AttributeValue::N("8".to_string()));
    set1.insert("weight".to_string(), AttributeValue::N("100".to_string()));
    set1.insert("timestamp".to_string(), AttributeValue::N(get_timestamp(0))); // Today
    items.push(set1);

    // Example of a set with reps as a string ("5 or below")
    let mut set2 = HashMap::new();
    set2.insert("exercise".to_string(), AttributeValue::S(exercise_name.to_string()));
    set2.insert("reps".to_string(), AttributeValue::S("5 or below".to_string()));
    set2.insert("weight".to_string(), AttributeValue::N("120".to_string()));
    set2.insert("timestamp".to_string(), AttributeValue::N(get_timestamp(0))); // Today
    items.push(set2);

    mock_db
        .expect_scan_sets()
        .with(eq(table_name))
        .times(1)
        .returning(move |_| Ok(items.clone()));

    let response = get_exercise_progress(&mock_db, table_name, exercise_name).await;

    assert_eq!(response.statusCode, 200);

    // Expected Hammond index calculation:
    // Set1: 8 reps * 100 lbs = 800
    // Set2: 5 reps * 120 lbs = 600
    // Average for the day: (800 + 600) / 2 = 700
    let expected_body = serde_json::json!([{
        "date": Utc::now().format("%Y-%m-%d").to_string(),
        "hammond_index": "700"
    }])
    .to_string();

    assert_eq!(response.body, expected_body);
}

#[tokio::test]
async fn test_get_exercise_progress_multiple_days() {
    let mut mock_db = MockDynamoDb::new();
    let table_name = "sets_table";
    let exercise_name = "Squats";

    // Set up mock DynamoDB scan result
    let mut items = Vec::new();

    // Sets for day 1
    let mut set1 = HashMap::new();
    set1.insert("exercise".to_string(), AttributeValue::S(exercise_name.to_string()));
    set1.insert("reps".to_string(), AttributeValue::N("10".to_string()));
    set1.insert("weight".to_string(), AttributeValue::N("200".to_string()));
    set1.insert("timestamp".to_string(), AttributeValue::N(get_timestamp(-1))); // Yesterday
    items.push(set1);

    let mut set2 = HashMap::new();
    set2.insert("exercise".to_string(), AttributeValue::S(exercise_name.to_string()));
    set2.insert("reps".to_string(), AttributeValue::N("8".to_string()));
    set2.insert("weight".to_string(), AttributeValue::N("220".to_string()));
    set2.insert("timestamp".to_string(), AttributeValue::N(get_timestamp(-1))); // Yesterday
    items.push(set2);

    // Sets for day 2
    let mut set3 = HashMap::new();
    set3.insert("exercise".to_string(), AttributeValue::S(exercise_name.to_string()));
    set3.insert("reps".to_string(), AttributeValue::N("12".to_string()));
    set3.insert("weight".to_string(), AttributeValue::N("180".to_string()));
    set3.insert("timestamp".to_string(), AttributeValue::N(get_timestamp(-2))); // 2 days ago
    items.push(set3);

    mock_db
        .expect_scan_sets()
        .with(eq(table_name))
        .times(1)
        .returning(move |_| Ok(items.clone()));

    let response = get_exercise_progress(&mock_db, table_name, exercise_name).await;

    assert_eq!(response.statusCode, 200);

    // Expected Hammond index calculations:
    // Day 1: (10 reps * 200 lbs = 2000) + (8 reps * 220 lbs = 1760) / 2 = 1880
    // Day 2: 12 reps * 180 lbs = 2160
    let expected_body = serde_json::json!([
        {
            "date": Utc::now().checked_sub_signed(chrono::Duration::days(2)).unwrap().format("%Y-%m-%d").to_string(),
            "hammond_index": "2160"
        },
        {
            "date": Utc::now().checked_sub_signed(chrono::Duration::days(1)).unwrap().format("%Y-%m-%d").to_string(),
            "hammond_index": "1880"
        }
    ])
    .to_string();

    assert_eq!(response.body, expected_body);
}

#[tokio::test]
async fn test_get_exercise_progress_no_sets() {
    let mut mock_db = MockDynamoDb::new();
    let table_name = "sets_table";
    let exercise_name = "Deadlifts";

    // No sets returned
    mock_db
        .expect_scan_sets()
        .with(eq(table_name))
        .times(1)
        .returning(move |_| Ok(vec![]));

    let response = get_exercise_progress(&mock_db, table_name, exercise_name).await;

    assert_eq!(response.statusCode, 200);
    assert_eq!(response.body, "[]"); // No data
}