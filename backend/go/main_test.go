package main

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

// TestGetUserForAPIKeyUnit tests the getUserForAPIKey function in isolation
func TestGetUserForAPIKeyUnit(t *testing.T) {
	originalAPIKeyMap := apiKeyMapVar
	defer func() { apiKeyMapVar = originalAPIKeyMap }()

	apiKeyMapVar = map[string]string{
		"valid-key":   "john",
		"admin-key":   "admin",
		"another-key": "alice",
	}

	tests := []struct {
		name     string
		apiKey   string
		wantUser string
		wantOK   bool
	}{
		{
			name:     "valid API key",
			apiKey:   "valid-key",
			wantUser: "john",
			wantOK:   true,
		},
		{
			name:     "admin API key",
			apiKey:   "admin-key",
			wantUser: "admin",
			wantOK:   true,
		},
		{
			name:     "invalid API key",
			apiKey:   "invalid-key",
			wantUser: "",
			wantOK:   false,
		},
		{
			name:     "empty API key",
			apiKey:   "",
			wantUser: "",
			wantOK:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotUser, gotOK := getUserForAPIKey(tt.apiKey)
			if gotUser != tt.wantUser {
				t.Errorf("getUserForAPIKey() user = %v, want %v", gotUser, tt.wantUser)
			}
			if gotOK != tt.wantOK {
				t.Errorf("getUserForAPIKey() ok = %v, want %v", gotOK, tt.wantOK)
			}
		})
	}
}

// TestRespondUnit tests the respond function in isolation
func TestRespondUnit(t *testing.T) {
	tests := []struct {
		name           string
		status         int
		body           interface{}
		expectedStatus int
		checkBody      bool
	}{
		{
			name:           "string body",
			status:         200,
			body:           "hello world",
			expectedStatus: 200,
			checkBody:      true,
		},
		{
			name:           "map body",
			status:         201,
			body:           map[string]string{"message": "created"},
			expectedStatus: 201,
			checkBody:      true,
		},
		{
			name:           "slice body",
			status:         200,
			body:           []string{"item1", "item2"},
			expectedStatus: 200,
			checkBody:      true,
		},
		{
			name:           "error status",
			status:         500,
			body:           map[string]string{"error": "internal error"},
			expectedStatus: 500,
			checkBody:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := respond(tt.status, tt.body)
			if err != nil {
				t.Errorf("respond() error = %v", err)
				return
			}

			if resp.StatusCode != tt.expectedStatus {
				t.Errorf("respond() StatusCode = %v, want %v", resp.StatusCode, tt.expectedStatus)
			}

			// Check headers
			if resp.Headers["Content-Type"] != "application/json" {
				t.Errorf("respond() Content-Type = %v, want application/json", resp.Headers["Content-Type"])
			}
			if resp.Headers["Access-Control-Allow-Origin"] != "*" {
				t.Errorf("respond() Access-Control-Allow-Origin = %v, want *", resp.Headers["Access-Control-Allow-Origin"])
			}

			if tt.checkBody {
				var responseBody interface{}
				if err := json.Unmarshal([]byte(resp.Body), &responseBody); err != nil {
					// If it's a string body, check directly
					if s, ok := tt.body.(string); ok {
						if resp.Body != s {
							t.Errorf("respond() body = %v, want %v", resp.Body, s)
						}
					} else {
						t.Errorf("respond() failed to unmarshal body: %v", err)
					}
				}
			}
		})
	}
}

// TestCalculateWeightTrendMath tests the weight trend calculation logic
func TestCalculateWeightTrendMath(t *testing.T) {
	testCases := []struct {
		name     string
		weights  []WeightItem
		expected float64 // expected slope in pounds per day
	}{
		{
			name: "increasing weight",
			weights: []WeightItem{
				{Timestamp: 1000, Weight: 150.0},
				{Timestamp: 87400, Weight: 151.0}, // 1 day later, 1 pound heavier
			},
			expected: 1.0,
		},
		{
			name: "decreasing weight",
			weights: []WeightItem{
				{Timestamp: 1000, Weight: 151.0},
				{Timestamp: 87400, Weight: 150.0},
			},
			expected: -1.0, // -1 pound per day
		},
		{
			name: "stable weight",
			weights: []WeightItem{
				{Timestamp: 1000, Weight: 150.0},
				{Timestamp: 87400, Weight: 150.0},
			},
			expected: 0.0, 
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			n := float64(len(tc.weights))
			var sumX, sumY, sumXY, sumX2 float64

			for _, item := range tc.weights {
				x := float64(item.Timestamp)
				y := float64(item.Weight)
				sumX += x
				sumY += y
				sumXY += x * y
				sumX2 += x * x
			}

			slope := (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)
			slopePoundsPerDay := slope * 86400 

			// Allow for small floating point differences
			if abs(slopePoundsPerDay-tc.expected) > 0.001 {
				t.Errorf("calculateWeightTrend() slope = %v, want %v", slopePoundsPerDay, tc.expected)
			}
		})
	}
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

func TestLogSetRequestStruct(t *testing.T) {
	tests := []struct {
		name        string
		jsonStr     string
		expected    LogSetRequest
		shouldError bool
	}{
		{
			name:    "valid cutting request",
			jsonStr: `{"exercise":"bench press","reps":"10","sets":3,"weight":185.5,"isCutting":true}`,
			expected: LogSetRequest{
				Exercise:  "bench press",
				Reps:      "10",
				Sets:      3,
				Weight:    185.5,
				IsCutting: boolPtr(true),
			},
			shouldError: false,
		},
		{
			name:    "valid bulking request",
			jsonStr: `{"exercise":"squat","reps":"8-10","sets":4,"weight":225.0,"isCutting":false}`,
			expected: LogSetRequest{
				Exercise:  "squat",
				Reps:      "8-10",
				Sets:      4,
				Weight:    225.0,
				IsCutting: boolPtr(false),
			},
			shouldError: false,
		},
		{
			name:    "request without cutting info",
			jsonStr: `{"exercise":"deadlift","reps":"5","sets":1,"weight":315.0}`,
			expected: LogSetRequest{
				Exercise:  "deadlift",
				Reps:      "5",
				Sets:      1,
				Weight:    315.0,
				IsCutting: nil,
			},
			shouldError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req LogSetRequest
			err := json.Unmarshal([]byte(tt.jsonStr), &req)

			if tt.shouldError && err == nil {
				t.Errorf("Expected error but got none")
				return
			}
			if !tt.shouldError && err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if err == nil {
				if req.Exercise != tt.expected.Exercise {
					t.Errorf("Exercise = %v, want %v", req.Exercise, tt.expected.Exercise)
				}
				if req.Reps != tt.expected.Reps {
					t.Errorf("Reps = %v, want %v", req.Reps, tt.expected.Reps)
				}
				if req.Sets != tt.expected.Sets {
					t.Errorf("Sets = %v, want %v", req.Sets, tt.expected.Sets)
				}
				if req.Weight != tt.expected.Weight {
					t.Errorf("Weight = %v, want %v", req.Weight, tt.expected.Weight)
				}
				if (req.IsCutting == nil) != (tt.expected.IsCutting == nil) {
					t.Errorf("IsCutting null mismatch: got %v, want %v", req.IsCutting, tt.expected.IsCutting)
				} else if req.IsCutting != nil && tt.expected.IsCutting != nil && *req.IsCutting != *tt.expected.IsCutting {
					t.Errorf("IsCutting = %v, want %v", *req.IsCutting, *tt.expected.IsCutting)
				}
			}
		})
	}
}

func TestEditSetRequestStruct(t *testing.T) {
	tests := []struct {
		name        string
		jsonStr     string
		expected    EditSetRequest
		shouldError bool
	}{
		{
			name:    "edit all fields",
			jsonStr: `{"workoutId":"123-456","timestamp":1234567890,"reps":"12","sets":4,"weight":200.5}`,
			expected: EditSetRequest{
				WorkoutID: "123-456",
				Timestamp: 1234567890,
				Reps:      stringPtr("12"),
				Sets:      intPtr(4),
				Weight:    float32Ptr(200.5),
			},
			shouldError: false,
		},
		{
			name:    "edit only reps",
			jsonStr: `{"workoutId":"789-012","timestamp":9876543210,"reps":"8-10"}`,
			expected: EditSetRequest{
				WorkoutID: "789-012",
				Timestamp: 9876543210,
				Reps:      stringPtr("8-10"),
				Sets:      nil,
				Weight:    nil,
			},
			shouldError: false,
		},
		{
			name:    "edit weight only",
			jsonStr: `{"workoutId":"345-678","timestamp":1111111111,"weight":175.0}`,
			expected: EditSetRequest{
				WorkoutID: "345-678",
				Timestamp: 1111111111,
				Reps:      nil,
				Sets:      nil,
				Weight:    float32Ptr(175.0),
			},
			shouldError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req EditSetRequest
			err := json.Unmarshal([]byte(tt.jsonStr), &req)

			if tt.shouldError && err == nil {
				t.Errorf("Expected error but got none")
				return
			}
			if !tt.shouldError && err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if err == nil {
				if req.WorkoutID != tt.expected.WorkoutID {
					t.Errorf("WorkoutID = %v, want %v", req.WorkoutID, tt.expected.WorkoutID)
				}
				if req.Timestamp != tt.expected.Timestamp {
					t.Errorf("Timestamp = %v, want %v", req.Timestamp, tt.expected.Timestamp)
				}
				if !stringPtrEqual(req.Reps, tt.expected.Reps) {
					t.Errorf("Reps = %v, want %v", req.Reps, tt.expected.Reps)
				}
				if !intPtrEqual(req.Sets, tt.expected.Sets) {
					t.Errorf("Sets = %v, want %v", req.Sets, tt.expected.Sets)
				}
				if !float32PtrEqual(req.Weight, tt.expected.Weight) {
					t.Errorf("Weight = %v, want %v", req.Weight, tt.expected.Weight)
				}
			}
		})
	}
}

func TestWeightTrendResponseStruct(t *testing.T) {
	tests := []struct {
		name     string
		response WeightTrendResponse
		wantJSON string
	}{
		{
			name: "positive trend",
			response: WeightTrendResponse{
				Date:  "2024-01-15",
				Slope: 0.5,
			},
			wantJSON: `{"date":"2024-01-15","slope":0.5}`,
		},
		{
			name: "negative trend",
			response: WeightTrendResponse{
				Date:  "2024-01-15",
				Slope: -0.3,
			},
			wantJSON: `{"date":"2024-01-15","slope":-0.3}`,
		},
		{
			name: "zero trend",
			response: WeightTrendResponse{
				Date:  "2024-01-15",
				Slope: 0.0,
			},
			wantJSON: `{"date":"2024-01-15","slope":0}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jsonBytes, err := json.Marshal(tt.response)
			if err != nil {
				t.Errorf("json.Marshal() error = %v", err)
				return
			}

			if string(jsonBytes) != tt.wantJSON {
				t.Errorf("json.Marshal() = %v, want %v", string(jsonBytes), tt.wantJSON)
			}

			// Test unmarshaling back
			var unmarshaled WeightTrendResponse
			if err := json.Unmarshal(jsonBytes, &unmarshaled); err != nil {
				t.Errorf("json.Unmarshal() error = %v", err)
				return
			}

			if !reflect.DeepEqual(unmarshaled, tt.response) {
				t.Errorf("Unmarshal result = %v, want %v", unmarshaled, tt.response)
			}
		})
	}
}

func TestRequestStructValidation(t *testing.T) {
	t.Run("AddExerciseRequest", func(t *testing.T) {
		jsonStr := `{"exercise_name":"bench press"}`
		var req AddExerciseRequest
		err := json.Unmarshal([]byte(jsonStr), &req)
		if err != nil {
			t.Errorf("Unmarshal error: %v", err)
		}
		if req.ExerciseName != "bench press" {
			t.Errorf("ExerciseName = %v, want bench press", req.ExerciseName)
		}
	})

	t.Run("DeleteExerciseRequest", func(t *testing.T) {
		jsonStr := `{"exercise_name":"squat"}`
		var req DeleteExerciseRequest
		err := json.Unmarshal([]byte(jsonStr), &req)
		if err != nil {
			t.Errorf("Unmarshal error: %v", err)
		}
		if req.ExerciseName != "squat" {
			t.Errorf("ExerciseName = %v, want squat", req.ExerciseName)
		}
	})

	t.Run("LogWeightRequest", func(t *testing.T) {
		jsonStr := `{"weight":175.5}`
		var req LogWeightRequest
		err := json.Unmarshal([]byte(jsonStr), &req)
		if err != nil {
			t.Errorf("Unmarshal error: %v", err)
		}
		if req.Weight != 175.5 {
			t.Errorf("Weight = %v, want 175.5", req.Weight)
		}
	})

	t.Run("DeleteSetRequest", func(t *testing.T) {
		jsonStr := `{"workoutId":"test-123","timestamp":1234567890}`
		var req DeleteSetRequest
		err := json.Unmarshal([]byte(jsonStr), &req)
		if err != nil {
			t.Errorf("Unmarshal error: %v", err)
		}
		if req.WorkoutID != "test-123" {
			t.Errorf("WorkoutID = %v, want test-123", req.WorkoutID)
		}
		if req.Timestamp != 1234567890 {
			t.Errorf("Timestamp = %v, want 1234567890", req.Timestamp)
		}
	})
}

func TestRouteValidation(t *testing.T) {
	// Save original values
	originalAPIKeyMap := apiKeyMapVar
	defer func() { apiKeyMapVar = originalAPIKeyMap }()

	// Setup test API key
	apiKeyMapVar = map[string]string{
		"test-key": "testuser",
	}

	tests := []struct {
		name           string
		method         string
		path           string
		headers        map[string]string
		expectedStatus int
	}{
		{
			name:   "unauthorized request",
			method: "GET",
			path:   "/exercises",
			headers: map[string]string{
				"x-api-key": "invalid-key",
			},
			expectedStatus: 401,
		},
		{
			name:           "missing API key",
			method:         "GET",
			path:           "/exercises",
			headers:        map[string]string{},
			expectedStatus: 401,
		},
		{
			name:   "route not found",
			method: "GET",
			path:   "/nonexistent",
			headers: map[string]string{
				"x-api-key": "test-key",
			},
			expectedStatus: 404,
		},
		{
			name:   "unsupported method",
			method: "PATCH",
			path:   "/exercises",
			headers: map[string]string{
				"x-api-key": "test-key",
			},
			expectedStatus: 404,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := events.APIGatewayProxyRequest{
				HTTPMethod: tt.method,
				Path:       tt.path,
				Headers:    tt.headers,
			}

			resp, err := handler(context.Background(), req)
			if err != nil {
				t.Errorf("handler() error = %v", err)
				return
			}

			if resp.StatusCode != tt.expectedStatus {
				t.Errorf("handler() StatusCode = %v, want %v", resp.StatusCode, tt.expectedStatus)
			}
		})
	}
}

func boolPtr(b bool) *bool {
	return &b
}

func stringPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}

func float32Ptr(f float32) *float32 {
	return &f
}

func stringPtrEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func intPtrEqual(a, b *int) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func float32PtrEqual(a, b *float32) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

// Benchmark tests
func BenchmarkGetUserForAPIKey(b *testing.B) {
	apiKeyMapVar = map[string]string{
		"key1": "user1",
		"key2": "user2",
		"key3": "user3",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		getUserForAPIKey("key2")
	}
}

func BenchmarkRespond(b *testing.B) {
	testBody := map[string]string{"message": "test"}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		respond(200, testBody)
	}
}
