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
	Sets      int     `json:"sets"`
	Weight    float32 `json:"weight"`
	IsCutting *bool   `json:"isCutting"`
	Timestamp *int64  `json:"timestamp,omitempty"`
}

type BatchLogSetsRequest struct {
	Sets []LogSetRequest `json:"sets"`
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
	Username     string `dynamodbav:"username"`
}

type SetItem struct {
	WorkoutID        string  `dynamodbav:"workoutId"`
	Timestamp        int64   `dynamodbav:"timestamp"`
	Exercise         string  `dynamodbav:"exercise"`
	Reps             string  `dynamodbav:"reps"`
	Sets             int32   `dynamodbav:"sets"`
	Weight           float32 `dynamodbav:"weight"`
	WeightModulation string  `dynamodbav:"weight_modulation,omitempty"`
	Username         string  `dynamodbav:"username"`
}

type SetOutputItem map[string]string

type WeightItem struct {
	Timestamp int64   `dynamodbav:"timestamp"`
	Weight    float32 `dynamodbav:"weight"`
	Username  string  `dynamodbav:"username"`
}

type WeightOutputItem map[string]string

type AnalysisItem struct {
	Timestamp int64  `dynamodbav:"timestamp"`
	Analysis  string `dynamodbav:"analysis"`
	Username  string `dynamodbav:"username"`
}


type UserItem struct {
	Username   string  `dynamodbav:"username"`
	ApiKey     string  `dynamodbav:"apiKey"`
	Email      *string `dynamodbav:"email,omitempty"`
	GivenName  *string `dynamodbav:"givenName,omitempty"`
	FamilyName *string `dynamodbav:"familyName,omitempty"`
	CreatedAt  int64   `dynamodbav:"createdAt"`
	UpdatedAt  int64   `dynamodbav:"updatedAt"`
	IsActive   bool    `dynamodbav:"isActive"`
}

type CreateUserRequest struct {
	Username string `json:"username"`
}

type CreateUserResponse struct {
	Username string `json:"username"`
	ApiKey   string `json:"apiKey"`
}
