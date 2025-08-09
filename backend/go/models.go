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
	UserID       string `dynamodbav:"userId"`
}

type SetItem struct {
	WorkoutID        string  `dynamodbav:"workoutId"`
	Timestamp        int64   `dynamodbav:"timestamp"`
	Exercise         string  `dynamodbav:"exercise"`
	Reps             string  `dynamodbav:"reps"`
	Sets             int32   `dynamodbav:"sets"`
	Weight           float32 `dynamodbav:"weight"`
	WeightModulation string  `dynamodbav:"weight_modulation,omitempty"`
	UserID           string  `dynamodbav:"userId"`
}

type SetOutputItem map[string]string

type WeightItem struct {
	Timestamp int64   `dynamodbav:"timestamp"`
	Weight    float32 `dynamodbav:"weight"`
	UserID    string  `dynamodbav:"userId"`
}

type WeightOutputItem map[string]string

type AnalysisItem struct {
	Timestamp int64  `dynamodbav:"timestamp"`
	Analysis  string `dynamodbav:"analysis"`
	UserID    string `dynamodbav:"userId"`
}

type RegisterRequest struct {
	Username   string  `json:"username"`
	Email      *string `json:"email,omitempty"`
	Password   string  `json:"password"`
	GivenName  *string `json:"given_name,omitempty"`
	FamilyName *string `json:"family_name,omitempty"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	IdToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int32  `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type UserProfileItem struct {
	UserID     string  `dynamodbav:"userId"`
	Email      *string `dynamodbav:"email,omitempty"`
	GivenName  *string `dynamodbav:"givenName,omitempty"`
	FamilyName *string `dynamodbav:"familyName,omitempty"`
	CreatedAt  int64   `dynamodbav:"createdAt"`
	UpdatedAt  int64   `dynamodbav:"updatedAt"`
}
