use aws_sdk_dynamodb::Client as DDBClient;
use aws_sdk_sqs::Client as SQSClient;
use backend_rs::{analysis, api_key_mapper::get_user_for_api_key};
use lambda_runtime::{Error, LambdaEvent};
use log::warn;
use serde_json::Value;
use std::env;
use crate::{weight, exercises, sets, utils::error_response};
use crate::requests::{AddExerciseRequest, DeleteExerciseRequest, LogSetRequest, EditSetRequest, DeleteSetRequest, LogWeightRequest};
use crate::utils::WeightModulation::{Cutting, Bulking};


pub async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let dynamodb_client = DDBClient::new(&aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await);
    let sqs_client = SQSClient::new(&aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await);

    let path = event.payload["path"].as_str().unwrap_or("/");
    let http_method = event.payload["httpMethod"].as_str().unwrap_or("GET");

    let exercises_table_name = env::var("EXERCISES_TABLE").expect("EXERCISES_TABLE not set");
    let sets_table_name = env::var("SETS_TABLE").expect("SETS_TABLE not set");
    let weight_table_name = env::var("WEIGHT_TABLE").expect("WEIGHT_TABLE not set");
    let analysis_table_name = env::var("ANALYSES_TABLE").expect("ANALYSES_TABLE not set");
    let queue_url = env::var("QUEUE_URL").expect("QUEUE_URL not set.");

    let api_key = event.payload.get("headers")
        .and_then(|headers| headers.get("x-api-key"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");


    let username = match get_user_for_api_key(api_key) {
        Some(name) => name,
        None => {
            println!("Unauthorized: Invalid API key: {}", api_key);
            return Ok(serde_json::to_value(error_response(401, "Unauthorized: Invalid API key".to_string()))?);
        }
    };

    println!("Request from user: {}", username);


    // Extract raw request body
    let raw_body = event.payload
        .get("body")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Routing logic. TODO: Fix the unwraps.
    match (http_method, path) {
        // Exercise endpoints
        ("GET", "/exercises") => {
            let response = exercises::get_exercises(&dynamodb_client, &exercises_table_name).await;
            Ok(serde_json::to_value(response)?)
        },
        ("POST", "/exercises") => {
            // Parse the add exercise request
            let req: AddExerciseRequest = match serde_json::from_str(raw_body) {
                Ok(r) => r,
                Err(e) => {
                    warn!("Invalid AddExerciseRequest: {}", e);
                    return Ok(serde_json::to_value(
                        error_response(400, format!("Invalid request: {}", e))
                    )?);
                }
            };
            let response = exercises::add_exercise(
                &dynamodb_client,
                &exercises_table_name,
                &req.exercise_name,
            ).await;
            Ok(serde_json::to_value(response)?)
        },
        ("DELETE", "/exercises") => {
            // Parse the delete exercise request
            let req: DeleteExerciseRequest = match serde_json::from_str(raw_body) {
                Ok(r) => r,
                Err(e) => {
                    warn!("Invalid DeleteExerciseRequest: {}", e);
                    return Ok(serde_json::to_value(
                        error_response(400, format!("Invalid request: {}", e))
                    )?);
                }
            };
            let response = exercises::delete_exercise(
                &dynamodb_client,
                &exercises_table_name,
                &req.exercise_name,
            ).await;
            Ok(serde_json::to_value(response)?)
        },

        // Set endpoints
        ("POST", "/sets/log") => {
            // Parse log set request
            let req: LogSetRequest = match serde_json::from_str(raw_body) {
                Ok(r) => r,
                Err(e) => {
                    warn!("Invalid LogSetRequest: {}", e);
                    return Ok(serde_json::to_value(
                        error_response(400, format!("Invalid request: {}", e))
                    )?);
                }
            };
            let response = sets::log_set(
                &dynamodb_client,
                &sets_table_name,
                req.exercise,
                req.reps,
                req.sets,
                req.weight,
                req.weight_modulation.unwrap_or(Bulking),
            ).await;
            Ok(serde_json::to_value(response)?)
        }
        ("GET", "/sets/last_month") => {
            let response = sets::get_last_month_workouts(&dynamodb_client, &sets_table_name).await;
            Ok(serde_json::to_value(response)?)
        }
        ("POST", "/sets/pop") => {
            let response = sets::pop_last_set(&dynamodb_client, &sets_table_name).await;
            Ok(serde_json::to_value(response)?)
        }
        ("GET", "/sets/by_exercise") => {
            // Read from queryStringParameters
            let query_params = event.payload["queryStringParameters"].clone();
        
            let exercise_name = query_params["exerciseName"].as_str().unwrap_or("");
            let start_str = query_params["start"].as_str().unwrap_or("0");
            let end_str = query_params["end"].as_str().unwrap_or("9999999999");
        
            let start_ts = start_str.parse::<i64>().unwrap_or(0);
            let end_ts = end_str.parse::<i64>().unwrap_or(9999999999);
        
            let response = sets::get_sets_for_exercise(
                &dynamodb_client,
                &sets_table_name,
                exercise_name,
                start_ts,
                end_ts,
            ).await;
        
            Ok(serde_json::to_value(response)?)
        }
        
        ("PUT", "/sets/edit") => {
            // Parse edit set request
            let req: EditSetRequest = match serde_json::from_str(raw_body) {
                Ok(r) => r,
                Err(e) => {
                    warn!("Invalid EditSetRequest: {}", e);
                    return Ok(serde_json::to_value(
                        error_response(400, format!("Invalid request: {}", e))
                    )?);
                }
            };
            let response = sets::edit_set(
                &dynamodb_client,
                &sets_table_name,
                req.workout_id,
                req.timestamp,
                req.reps,
                req.sets,
                req.weight,
            ).await;
            Ok(serde_json::to_value(response)?)
        }
        ("DELETE", "/sets") => {
            // Parse delete set request
            let req: DeleteSetRequest = match serde_json::from_str(raw_body) {
                Ok(r) => r,
                Err(e) => {
                    warn!("Invalid DeleteSetRequest: {}", e);
                    return Ok(serde_json::to_value(
                        error_response(400, format!("Invalid request: {}", e))
                    )?);
                }
            };
            let response = sets::delete_set(
                &dynamodb_client,
                &sets_table_name,
                req.workout_id,
                req.timestamp,
            ).await;
            Ok(serde_json::to_value(response)?)
        }

        // Weight endpoints 
        ("POST", "/weight") => {
            // Parse log weight request
            let req: LogWeightRequest = match serde_json::from_str(raw_body) {
                Ok(r) => r,
                Err(e) => {
                    warn!("Invalid LogWeightRequest: {}", e);
                    return Ok(serde_json::to_value(
                        error_response(400, format!("Invalid request: {}", e))
                    )?);
                }
            };
            let response = weight::log_weight(
                &dynamodb_client,
                &weight_table_name,
                req.weight,
            ).await;
            Ok(serde_json::to_value(response)?)
        }
        ("GET", "/weight") => {
            let response = weight::get_weight(&dynamodb_client, &weight_table_name).await;
            Ok(serde_json::to_value(response)?)
        }
        ("DELETE", "/weight") => {
            let response = weight::delete_most_recent_weight(&dynamodb_client, &weight_table_name).await;
            Ok(serde_json::to_value(response)?)
        }

        // Anlaysis endpoints
        ("GET", "/analysis") => {
            let response = analysis::get_most_recent_analysis(&dynamodb_client, &analysis_table_name).await;
            Ok(serde_json::to_value(response)?)
        }
        ("POST", "/analysis") => { // Generate a new analysis. Maybe make this it's own endpoint? Idk.
            let response = analysis::ping_processing_lambda(&sqs_client, &queue_url).await;
            Ok(serde_json::to_value(response)?)
        }

        // Default response
        _ => Ok(serde_json::to_value(error_response(404, "Route not found".to_string()))?),
    }
}