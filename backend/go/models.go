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

// Injury APIs
type InjuryRequest struct {
    Timestamp *int64  `json:"timestamp,omitempty"`
    Location  string  `json:"location"`
    Details   *string `json:"details,omitempty"`
    Active    *bool   `json:"active,omitempty"`
}

type InjuryItem struct {
    Timestamp int64   `dynamodbav:"timestamp"`
    Username  string  `dynamodbav:"username"`
    Location  string  `dynamodbav:"location"`
    Details   *string `dynamodbav:"details,omitempty"`
    Active    bool    `dynamodbav:"active"`
    ActivePeriods []ActivePeriod `dynamodbav:"activePeriods,omitempty"`
}

type InjuryOutputItem map[string]string

// Bodypart location APIs
type AddBodypartRequest struct {
    Location string `json:"location"`
}

type DeleteBodypartRequest struct {
    Location string `json:"location"`
}

type BodypartItem struct {
    Location string `dynamodbav:"location"`
    Username string `dynamodbav:"username"`
}

type UpdateInjuryActiveRequest struct {
    Timestamp int64 `json:"timestamp"`
    Active    bool  `json:"active"`
}

type ActivePeriod struct {
    Start int64  `dynamodbav:"start" json:"start"`
    End   *int64 `dynamodbav:"end,omitempty" json:"end,omitempty"`
}
