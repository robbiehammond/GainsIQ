package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/aws/aws-lambda-go/events"
)

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	path := req.Path
	method := req.HTTPMethod

	// Authentication routes that don't require JWT validation
	switch {
	case method == "POST" && path == "/auth/register":
		return handleRegister(req)
	case method == "POST" && path == "/auth/login":
		return handleLogin(req)
	case method == "POST" && path == "/auth/refresh":
		return handleRefreshToken(req)
	}

	// All other routes require authentication
	// Extract Bearer token from Authorization header
	authHeader := req.Headers["Authorization"]
	if authHeader == "" {
		authHeader = req.Headers["authorization"] // Try lowercase
	}
	
	if authHeader == "" {
		log.Printf("Unauthorized: No Authorization header provided")
		return respond(401, map[string]string{"error": "Unauthorized: No Authorization header"})
	}

	token, err := extractBearerToken(authHeader)
	if err != nil {
		log.Printf("Unauthorized: Invalid Authorization header format: %v", err)
		return respond(401, map[string]string{"error": "Unauthorized: Invalid Authorization header format"})
	}

	userID, err := extractUserIDFromJWT(token, cognitoRegion, cognitoUserPoolID)
	if err != nil {
		log.Printf("Unauthorized: Invalid JWT token: %v", err)
		return respond(401, map[string]string{"error": "Unauthorized: Invalid JWT token"})
	}
	
	log.Printf("Request from user: %s for %s %s", userID, req.HTTPMethod, req.Path)

	switch {
	// === Exercises ===
	case method == "GET" && path == "/exercises":
		exercisesList, err := getExercisesFromDB(userID)
		if err != nil {
			log.Printf("Error getting exercises: %v", err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error fetching exercises: %v", err)})
		}
		return respond(200, exercisesList)

	case method == "POST" && path == "/exercises":
		var body AddExerciseRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		if body.ExerciseName == "" {
			return respond(400, map[string]string{"error": "exercise_name is required"})
		}
		if err := addExerciseToDB(userID, body.ExerciseName); err != nil {
			log.Printf("Error adding exercise '%s': %v", body.ExerciseName, err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error adding exercise: %v", err)})
		}
		return respond(200, map[string]string{"message": fmt.Sprintf("Exercise %s added successfully", body.ExerciseName)})

	case method == "DELETE" && path == "/exercises":
		var body DeleteExerciseRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		if body.ExerciseName == "" {
			return respond(400, map[string]string{"error": "exercise_name is required"})
		}
		if err := deleteExerciseFromDB(body.ExerciseName); err != nil {
			log.Printf("Error deleting exercise '%s': %v", body.ExerciseName, err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error deleting exercise: %v", err)})
		}
		return respond(200, map[string]string{"message": fmt.Sprintf("Exercise %s deleted successfully", body.ExerciseName)})

	// === Sets ===
	case method == "POST" && path == "/sets/log":
		var body LogSetRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		if err := logSetToDB(body); err != nil {
			log.Printf("Error logging set for exercise '%s': %v", body.Exercise, err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error logging set: %v", err)})
		}
		return respond(200, map[string]string{"message": fmt.Sprintf("Set for %s logged successfully", body.Exercise)})

	case method == "GET" && path == "/sets/last_month":
		setsList, err := getLastMonthSetsFromDB()
		if err != nil {
			log.Printf("Error getting last month's sets: %v", err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error fetching last month's sets: %v", err)})
		}
		return respond(200, setsList)

	case method == "POST" && path == "/sets/pop":
		deleted, err := popLastSetFromDB()
		if err != nil {
			log.Printf("Error popping last set: %v", err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error deleting last set: %v", err)})
		}
		if !deleted {
			return respond(404, map[string]string{"error": "No set found to delete"})
		}
		return respond(200, map[string]string{"message": "Successfully deleted last set"})

	// GET arbitrary sets in a date/time range
	case method == "GET" && path == "/sets":
		qp := req.QueryStringParameters
		startStr := qp["start"]
		if startStr == "" {
			startStr = "0"
		}
		endStr := qp["end"]
		if endStr == "" {
			endStr = "9999999999999"
		}
		startTs, errStart := strconv.ParseInt(startStr, 10, 64)
		endTs, errEnd := strconv.ParseInt(endStr, 10, 64)
		if errStart != nil || errEnd != nil {
			return respond(400, map[string]string{"error": "Invalid start or end timestamp format"})
		}
		setsList, err := getSetsInRangeFromDB(startTs, endTs)
		if err != nil {
			log.Printf("Error getting sets in range %d to %d: %v", startTs, endTs, err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error fetching sets: %v", err)})
		}
		return respond(200, setsList)

	// GET sets for a specific exercise in a date/time range
	case method == "GET" && path == "/sets/by_exercise":
		qp := req.QueryStringParameters
		exerciseName := qp["exerciseName"]
		startStr := qp["start"]
		if startStr == "" {
			startStr = "0"
		}
		endStr := qp["end"]
		if endStr == "" {
			endStr = "9999999999999"
		}

		startTs, errStart := strconv.ParseInt(startStr, 10, 64)
		endTs, errEnd := strconv.ParseInt(endStr, 10, 64)

		if errStart != nil || errEnd != nil {
			return respond(400, map[string]string{"error": "Invalid start or end timestamp format"})
		}

		setsList, err := getSetsForExerciseFromDB(exerciseName, startTs, endTs)
		if err != nil {
			log.Printf("Error getting sets for exercise '%s': %v", exerciseName, err)
			if strings.Contains(err.Error(), "exerciseName cannot be empty") {
				return respond(400, map[string]string{"error": err.Error()})
			}
			return respond(500, map[string]string{"error": fmt.Sprintf("Error querying sets for %s: %v", exerciseName, err)})
		}
		return respond(200, setsList)

	case method == "PUT" && path == "/sets/edit":
		var body EditSetRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		if body.WorkoutID == "" || body.Timestamp == 0 {
			return respond(400, map[string]string{"error": "workout_id and timestamp are required"})
		}
		if err := editSetInDB(body); err != nil {
			log.Printf("Error editing set (workoutId %s, ts %d): %v", body.WorkoutID, body.Timestamp, err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error updating set: %v", err)})
		}
		return respond(200, map[string]string{"message": "Set updated successfully"})

	case method == "DELETE" && path == "/sets":
		var body DeleteSetRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		err := deleteSetFromDB(body.WorkoutID, body.Timestamp)
		if err != nil {
			log.Printf("Error deleting set (workoutId %s, ts %d): %v", body.WorkoutID, body.Timestamp, err)
			if strings.Contains(err.Error(), "invalid input") {
				return respond(400, map[string]string{"error": err.Error()})
			}
			return respond(500, map[string]string{"error": fmt.Sprintf("Error deleting set: %v", err)})
		}
		return respond(200, map[string]string{"message": fmt.Sprintf("Set with workoutId %s and timestamp %d deleted successfully", body.WorkoutID, body.Timestamp)})

	// === Weight ===
	case method == "POST" && path == "/weight":
		var body LogWeightRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		if err := logWeightToDB(body.Weight); err != nil {
			log.Printf("Error logging weight %f: %v", body.Weight, err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error logging weight: %v", err)})
		}
		return respond(200, map[string]string{"message": "Weight logged successfully"})

	case method == "GET" && path == "/weight":
		weightsList, err := getWeightsFromDB()
		if err != nil {
			log.Printf("Error getting weights: %v", err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error fetching weights: %v", err)})
		}
		return respond(200, weightsList)

	case method == "DELETE" && path == "/weight":
		deleted, err := deleteMostRecentWeightFromDB()
		if err != nil {
			log.Printf("Error deleting most recent weight: %v", err)
			if strings.Contains(err.Error(), "no valid weight entry found") || strings.Contains(err.Error(), "no weight found to delete") {
				return respond(404, map[string]string{"error": "No weight found to delete"})
			}
			return respond(500, map[string]string{"error": fmt.Sprintf("Error deleting most recent weight: %v", err)})
		}
		if !deleted {
			return respond(404, map[string]string{"error": "No weight found to delete"})
		}
		return respond(200, map[string]string{"message": "Most recent weight deleted successfully"})

	case method == "GET" && path == "/weight/trend":
		trend, err := calculateWeightTrend()
		if err != nil {
			log.Printf("Error calculating weight trend: %v", err)
			if strings.Contains(err.Error(), "insufficient data points") {
				return respond(400, map[string]string{"error": "Insufficient data points for trend calculation (need at least 2 weights in the last 2 weeks)"})
			}
			return respond(500, map[string]string{"error": fmt.Sprintf("Error calculating weight trend: %v", err)})
		}
		return respond(200, trend)

	// === Analysis ===
	case method == "GET" && path == "/analysis":
		analysisData, found, err := getMostRecentAnalysisFromDB()
		if err != nil {
			log.Printf("Error getting most recent analysis: %v", err)
			if strings.Contains(err.Error(), "no valid analysis item found") || strings.Contains(err.Error(), "no analyses to retrieve") {
				return respond(404, map[string]string{"error": "No analyses to retrieve"})
			}
			return respond(500, map[string]string{"error": fmt.Sprintf("Error scanning table: %v", err)})
		}
		if !found {
			return respond(404, map[string]string{"error": "No analyses to retrieve"})
		}
		return respond(200, analysisData)

	case method == "POST" && path == "/analysis":
		messageID, err := pingProcessingLambdaViaSQS()
		if err != nil {
			log.Printf("Error pinging processing lambda via SQS: %v", err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Failed to send message to SQS queue: %v", err)})
		}
		if messageID == "" && err == nil {
			return respond(200, map[string]string{"message": "Message sent, but no MessageId returned"})
		}
		return respond(200, map[string]string{"message": fmt.Sprintf("Message sent! ID: %s", messageID)})

	default:
		log.Printf("Route not found for %s %s", method, path)
		return respond(404, map[string]string{"error": "Route not found"})
	}
}

func handleRegister(req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var body RegisterRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
	}

	// Validate required fields (only username and password are required)
	if body.Username == "" || body.Password == "" {
		return respond(400, map[string]string{"error": "username and password are required"})
	}

	// Register user with Cognito
	if err := registerUser(body.Username, body.Password, body.Email, body.GivenName, body.FamilyName); err != nil {
		log.Printf("Error registering user '%s': %v", body.Username, err)
		return respond(500, map[string]string{"error": fmt.Sprintf("Error registering user: %v", err)})
	}

	// Create user profile in DynamoDB
	if err := createUserProfile(body.Username, body.Email, body.GivenName, body.FamilyName); err != nil {
		log.Printf("Error creating user profile for '%s': %v", body.Username, err)
		// Note: We don't return an error here as the user was successfully created in Cognito
		log.Printf("User '%s' registered in Cognito but profile creation failed", body.Username)
	}

	return respond(201, map[string]string{"message": "User registered successfully"})
}

func handleLogin(req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var body LoginRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
	}

	if body.Username == "" || body.Password == "" {
		return respond(400, map[string]string{"error": "username and password are required"})
	}

	authResult, err := loginUser(body.Username, body.Password)
	if err != nil {
		log.Printf("Login failed for user '%s': %v", body.Username, err)
		return respond(401, map[string]string{"error": "Invalid credentials"})
	}

	response := AuthResponse{
		AccessToken:  *authResult.AccessToken,
		IdToken:      *authResult.IdToken,
		RefreshToken: *authResult.RefreshToken,
		ExpiresIn:    authResult.ExpiresIn,
		TokenType:    *authResult.TokenType,
	}

	return respond(200, response)
}

func handleRefreshToken(req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var body RefreshTokenRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
	}

	if body.RefreshToken == "" {
		return respond(400, map[string]string{"error": "refresh_token is required"})
	}

	authResult, err := refreshToken(body.RefreshToken)
	if err != nil {
		log.Printf("Token refresh failed: %v", err)
		return respond(401, map[string]string{"error": "Invalid refresh token"})
	}

	response := AuthResponse{
		AccessToken: *authResult.AccessToken,
		IdToken:     *authResult.IdToken,
		ExpiresIn:   authResult.ExpiresIn,
		TokenType:   *authResult.TokenType,
	}

	// Refresh token is not always returned in refresh operations
	if authResult.RefreshToken != nil {
		response.RefreshToken = *authResult.RefreshToken
	}

	return respond(200, response)
}