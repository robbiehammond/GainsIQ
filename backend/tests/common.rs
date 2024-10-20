pub mod mocks {
    use async_trait::async_trait;
    use aws_sdk_dynamodb::types::AttributeValue;
    use std::collections::HashMap;
    use mockall::mock;
    use backend_rs::DynamoDb;

    mock! {
        pub DynamoDb {}

        #[async_trait]
        impl DynamoDb for DynamoDb {
            async fn scan_exercises(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
            async fn put_exercise(&self, table_name: &str, exercise_name: &str) -> Result<(), aws_sdk_dynamodb::Error>;
            async fn put_set(&self, table_name: &str, item: HashMap<String, AttributeValue>) -> Result<(), aws_sdk_dynamodb::Error>;
            async fn scan_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
            async fn delete_set(&self, table_name: &str, workout_id: &str, timestamp: &str) -> Result<(), aws_sdk_dynamodb::Error>;
            async fn query_last_month_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
        }
    }
}