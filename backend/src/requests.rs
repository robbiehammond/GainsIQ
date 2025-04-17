use serde::{Deserialize, Serialize};
use crate::utils::WeightModulation;

#[derive(Deserialize, Debug)]
pub struct AddExerciseRequest {
    pub exercise_name: String,
}

#[derive(Deserialize, Debug)]
pub struct DeleteExerciseRequest {
    pub exercise_name: String,
}

#[derive(Deserialize, Debug)]
pub struct LogSetRequest {
    pub exercise: String,
    pub reps: String,
    pub sets: i32,
    pub weight: f32,
    pub weight_modulation: Option<WeightModulation>,
}

#[derive(Deserialize, Debug)]
pub struct EditSetRequest {
    pub workout_id: String,
    pub timestamp: i64,
    pub reps: Option<String>,
    pub sets: Option<i32>,
    pub weight: Option<f32>,
}

#[derive(Deserialize, Debug)]
pub struct DeleteSetRequest {
    pub workout_id: String,
    pub timestamp: i64,
}

#[derive(Deserialize, Debug)]
pub struct LogWeightRequest {
    pub weight: f32,
}