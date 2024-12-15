// tests/mocks.rs
use mockall::{mock, predicate::*};
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use std::collections::HashMap;

use backend_rs::utils::DynamoDb;

mock! {
    pub DynamoDbMock {}
    #[async_trait]
    impl DynamoDb for DynamoDbMock {
        async fn scan_exercises(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
        async fn put_exercise(&self, table_name: &str, exercise_name: &str) -> Result<(), aws_sdk_dynamodb::Error>;
        async fn put_set(&self, table_name: &str, item: HashMap<String, AttributeValue>) -> Result<(), aws_sdk_dynamodb::Error>;
        async fn scan_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
        async fn delete_set(&self, table_name: &str, workout_id: &str, timestamp: &str) -> Result<(), aws_sdk_dynamodb::Error>;
        async fn query_last_month_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
        async fn put_weight(&self, table_name: &str, item: HashMap<String, AttributeValue>) -> Result<(), aws_sdk_dynamodb::Error>;
        async fn scan_weights(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
        async fn delete_weight(&self, table_name: &str, timestamp: &str) -> Result<(), aws_sdk_dynamodb::Error>;
        async fn update_set(
            &self,
            table_name: &str,
            workout_id: &str,
            timestamp: i64,
            reps: Option<String>,
            sets: Option<i32>,
            weight: Option<f32>,
        ) -> Result<(), aws_sdk_dynamodb::Error>;
    }
}