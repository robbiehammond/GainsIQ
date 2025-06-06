package main

type AddExerciseRequest struct {
	ExerciseName string `json:"exercise_name"`
}

type DeleteExerciseRequest struct {
	ExerciseName string `json:"exercise_name"`
}

type LogSetRequest struct {
	Exercise  string  `json:"exercise"`
	Reps      string  `json:"reps"`
	Sets      *int    `json:"sets,omitempty"`
	Weight    float32 `json:"weight"`
	IsCutting *bool   `json:"isCutting"`
}

type EditSetRequest struct {
	WorkoutID string   `json:"workoutId"`
	Timestamp int64    `json:"timestamp"`
	Reps      *string  `json:"reps"`
	Sets      *int     `json:"sets"`
	Weight    *float32 `json:"weight"`
}

type DeleteSetRequest struct {
	WorkoutID string `json:"workoutId"`
	Timestamp int64  `json:"timestamp"`
}

type LogWeightRequest struct {
	Weight float32 `json:"weight"`
}

type WeightTrendResponse struct {
	Date  string  `json:"date"`
	Slope float64 `json:"slope"`
}

type ExerciseItem struct {
	ExerciseName string `dynamodbav:"exerciseName"`
}

type SetItem struct {
	WorkoutID        string  `dynamodbav:"workoutId"`
	Timestamp        int64   `dynamodbav:"timestamp"`
	Exercise         string  `dynamodbav:"exercise"`
	Reps             string  `dynamodbav:"reps"`
	Sets             int32   `dynamodbav:"sets"`
	Weight           float32 `dynamodbav:"weight"`
	WeightModulation string  `dynamodbav:"weight_modulation,omitempty"`
}

type SetOutputItem map[string]string

type WeightItem struct {
	Timestamp int64   `dynamodbav:"timestamp"`
	Weight    float32 `dynamodbav:"weight"`
}

type WeightOutputItem map[string]string

type AnalysisItem struct {
	Timestamp int64  `dynamodbav:"timestamp"`
	Analysis  string `dynamodbav:"analysis"`
}