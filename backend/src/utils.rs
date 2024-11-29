use std::collections::HashMap;

use async_trait::async_trait;
use aws_sdk_dynamodb::{types::AttributeValue, Client};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};

#[async_trait]
pub trait DynamoDb {
    async fn scan_exercises(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
    async fn put_exercise(&self, table_name: &str, exercise_name: &str) -> Result<(), aws_sdk_dynamodb::Error>;
    async fn put_set(&self, table_name: &str, item: HashMap<String, AttributeValue>) -> Result<(), aws_sdk_dynamodb::Error>;
    async fn scan_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
    async fn delete_set(&self, table_name: &str, workout_id: &str, timestamp: &str) -> Result<(), aws_sdk_dynamodb::Error>;
    async fn query_last_month_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
    async fn put_weight(&self, table_name: &str, item: HashMap<String, AttributeValue>) -> Result<(), aws_sdk_dynamodb::Error>;
}


#[async_trait]
impl DynamoDb for Client {
    async fn scan_exercises(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error> {
        let result = self.scan().table_name(table_name).send().await?;
        Ok(result.items.unwrap_or_default())
    }

    async fn put_exercise(&self, table_name: &str, exercise_name: &str) -> Result<(), aws_sdk_dynamodb::Error> {
        self.put_item()
            .table_name(table_name)
            .item("exerciseName", AttributeValue::S(exercise_name.to_string()))
            .send()
            .await?;
        Ok(())
    }

    async fn put_set(&self, table_name: &str, item: HashMap<String, AttributeValue>) -> Result<(), aws_sdk_dynamodb::Error> {
        self.put_item()
            .table_name(table_name)
            .set_item(Some(item))
            .send()
            .await?;
        Ok(())
    }

    async fn scan_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error> {
        let result = self
            .scan()
            .table_name(table_name)
            .expression_attribute_names("#ts", "timestamp")
            .filter_expression("attribute_exists(#ts)")
            .send()
            .await?;
        Ok(result.items.unwrap_or_default())
    }

    async fn delete_set(&self, table_name: &str, workout_id: &str, timestamp: &str) -> Result<(), aws_sdk_dynamodb::Error> {
        self.delete_item()
            .table_name(table_name)
            .key("workoutId", AttributeValue::S(workout_id.to_string()))
            .key("timestamp", AttributeValue::N(timestamp.to_string()))
            .send()
            .await?;
        Ok(())
    }
    async fn query_last_month_sets(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error> {
        let one_month_ago = Utc::now().timestamp() - Duration::days(30).num_seconds();

        let result = self
            .scan()
            .table_name(table_name)
            .expression_attribute_names("#ts", "timestamp")
            .expression_attribute_values(":one_month_ago", AttributeValue::N(one_month_ago.to_string()))
            .filter_expression("#ts > :one_month_ago")
            .send()
            .await?;
        Ok(result.items.unwrap_or_default())
    }

    async fn put_weight(&self, table_name: &str, item: HashMap<String, AttributeValue>) -> Result<(), aws_sdk_dynamodb::Error> {
        self.put_item()
            .table_name(table_name)
            .set_item(Some(item))
            .send()
            .await?;
        Ok(())
    }
}

#[derive(Deserialize, Debug)]
pub struct RequestBody {
    pub exercise_name: Option<String>,
    pub exercise: Option<String>,
    pub reps: Option<String>,
    pub sets: Option<i32>,
    pub weight: Option<f32>,
    pub action: Option<String>,
}

#[derive(Serialize)]
pub struct Response {
    pub statusCode: u16,
    pub body: String,
    pub headers: HashMap<String, String>,
}

pub fn success_response(statusCode: u16, body: String) -> Response {
    let mut headers = HashMap::new();
    headers.insert("Access-Control-Allow-Origin".to_string(), "*".to_string());
    headers.insert("Content-Type".to_string(), "application/json".to_string());

    Response {
        statusCode,
        body,
        headers,
    }
}

pub fn error_response(status_code: u16, body: String) -> Response {
    success_response(status_code, body)
}