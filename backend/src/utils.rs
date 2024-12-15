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
    async fn scan_weights(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error>;
    async fn delete_weight(&self, table_name: &str, timestamp: &str) -> Result<(), aws_sdk_dynamodb::Error>;
    async fn update_set(
        &self,
        table_name: &str,
        workout_id: &str,
        timestamp: i64,
        exercise: Option<String>,
        reps: Option<String>,
        sets: Option<i32>,
        weight: Option<f32>,
    ) -> Result<(), aws_sdk_dynamodb::Error>;
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
    
    async fn scan_weights(&self, table_name: &str) -> Result<Vec<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error> {
        let result = self.scan().table_name(table_name).send().await?;
        Ok(result.items.unwrap_or_default())
    }

    async fn delete_weight(&self, table_name: &str, timestamp: &str) -> Result<(), aws_sdk_dynamodb::Error> {
        self.delete_item()
            .table_name(table_name)
            .key("timestamp", AttributeValue::N(timestamp.to_string()))
            .send()
            .await?;
        Ok(())
    }

    async fn update_set(
        &self,
        table_name: &str,
        workout_id: &str,
        timestamp: i64,
        exercise: Option<String>,
        reps: Option<String>,
        sets: Option<i32>,
        weight: Option<f32>,
    ) -> Result<(), aws_sdk_dynamodb::Error> {
        let mut update_expression = String::new();
        let mut expression_values = std::collections::HashMap::new();
        let mut set_clauses = Vec::new();
    
        if let Some(e) = exercise {
            set_clauses.push("exercise = :exercise".to_string());
            expression_values.insert(":exercise".to_string(), AttributeValue::S(e));
        }
    
        if let Some(r) = reps {
            set_clauses.push("reps = :reps".to_string());
            expression_values.insert(":reps".to_string(), AttributeValue::S(r));
        }
    
        if let Some(s) = sets {
            set_clauses.push("sets = :sets".to_string());
            expression_values.insert(":sets".to_string(), AttributeValue::N(s.to_string()));
        }
    
        if let Some(w) = weight {
            set_clauses.push("weight = :weight".to_string());
            expression_values.insert(":weight".to_string(), AttributeValue::N(w.to_string()));
        }
    
        if set_clauses.is_empty() {
            // No fields to update
            return Ok(())
        }
    
        update_expression = format!("SET {}", set_clauses.join(", "));
    
        self.update_item()
            .table_name(table_name)
            .key("workoutId", AttributeValue::S(workout_id.to_string()))
            .key("timestamp", AttributeValue::N(timestamp.to_string()))
            .update_expression(update_expression)
            .set_expression_attribute_values(Some(expression_values))
            .send()
            .await?;
    
        Ok(())
    }
}

#[derive(Deserialize, Debug)]
pub struct RequestBody {
    pub workout_id: Option<String>,
    pub timestamp: Option<i64>,
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