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

	log.Printf("=== INCOMING REQUEST ===")
	log.Printf("Method: %s, Path: %s", method, path)
	log.Printf("Headers: %+v", req.Headers)
	log.Printf("Body: %s", req.Body)
	log.Printf("QueryStringParameters: %+v", req.QueryStringParameters)

	// User creation endpoint doesn't require authentication
	if method == "POST" && path == "/users/create" {
		log.Printf("Handling user creation request")
		return handleCreateUser(req)
	}

	// Extract API key from Authorization header
	authHeader := req.Headers["Authorization"]
	if authHeader == "" {
		authHeader = req.Headers["authorization"]
	}

	log.Printf("Authorization header: %s", authHeader)

	if authHeader == "" {
		log.Printf("Unauthorized: No Authorization header provided")
		return respond(401, map[string]string{"error": "Unauthorized: No Authorization header"})
	}

	log.Printf("Calling authenticateRequest...")
	username, err := authenticateRequest(authHeader)
	if err != nil {
		log.Printf("Authentication failed: %v", err)
		return respond(401, map[string]string{"error": fmt.Sprintf("Unauthorized: %v", err)})
	}

	log.Printf("Authentication successful for user: %s", username)
	log.Printf("Proceeding to route handler for %s %s", req.HTTPMethod, req.Path)

	switch {
	// === Exercises ===
	case method == "GET" && path == "/exercises":
		log.Printf("Handling GET /exercises for user: %s", username)
		exercisesList, err := getExercisesFromDB(username)
		if err != nil {
			log.Printf("Error getting exercises from DB: %v", err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error fetching exercises: %v", err)})
		}
		log.Printf("Successfully retrieved %d exercises", len(exercisesList))
		return respond(200, exercisesList)

	case method == "POST" && path == "/exercises":
		var body AddExerciseRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		if body.ExerciseName == "" {
			return respond(400, map[string]string{"error": "exercise_name is required"})
		}
		if err := addExerciseToDB(username, body.ExerciseName); err != nil {
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
		if err := logSetToDB(username, body); err != nil {
			log.Printf("Error logging set for exercise '%s': %v", body.Exercise, err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error logging set: %v", err)})
		}
		return respond(200, map[string]string{"message": fmt.Sprintf("Set for %s logged successfully", body.Exercise)})

	case method == "POST" && path == "/sets/batch":
		var body BatchLogSetsRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		if len(body.Sets) == 0 {
			return respond(400, map[string]string{"error": "No sets provided in batch request"})
		}
		if err := batchLogSetsToDB(username, body.Sets); err != nil {
			log.Printf("Error batch logging %d sets: %v", len(body.Sets), err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error batch logging sets: %v", err)})
		}
		return respond(200, map[string]string{"message": fmt.Sprintf("Successfully logged %d sets", len(body.Sets))})

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
		if err := logWeightToDB(username, body.Weight); err != nil {
			log.Printf("Error logging weight %f: %v", body.Weight, err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error logging weight: %v", err)})
		}
		return respond(200, map[string]string{"message": "Weight logged successfully"})

	case method == "GET" && path == "/weight":
		weightsList, err := getWeightsFromDB(username)
		if err != nil {
			log.Printf("Error getting weights: %v", err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error fetching weights: %v", err)})
		}
		return respond(200, weightsList)

	case method == "DELETE" && path == "/weight":
		deleted, err := deleteMostRecentWeightFromDB(username)
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
		trend, err := calculateWeightTrend(username)
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

	case method == "GET" && path == "/injury":
		// Optional: allow start/end filtering via query, but default to all
		injuries, err := getInjuriesFromDB(username, req.QueryStringParameters)
		if err != nil {
			log.Printf("Error getting injuries: %v", err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error fetching injuries: %v", err)})
		}
		return respond(200, injuries)

	case method == "GET" && path == "/injury/active":
		qp := map[string]string{}
		for k, v := range req.QueryStringParameters {
			qp[k] = v
		}
		qp["activeOnly"] = "true"
		injuries, err := getInjuriesFromDB(username, qp)
		if err != nil {
			log.Printf("Error getting active injuries: %v", err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error fetching active injuries: %v", err)})
		}
		return respond(200, injuries)

	case method == "POST" && path == "/injury":
		var body InjuryRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		if strings.TrimSpace(body.Location) == "" {
			return respond(400, map[string]string{"error": "location is required"})
		}
		if err := logInjuryToDB(username, body); err != nil {
			log.Printf("Error logging injury: %v", err)
			msg := fmt.Sprintf("Error logging injury: %v", err)
			if strings.Contains(strings.ToLower(err.Error()), "bodypart location") || strings.Contains(strings.ToLower(err.Error()), "not found") || strings.Contains(strings.ToLower(err.Error()), "location is required") {
				return respond(400, map[string]string{"error": msg})
			}
			return respond(500, map[string]string{"error": msg})
		}
		return respond(200, map[string]string{"message": "Injury logged successfully"})

	case method == "PUT" && path == "/injury/active":
		var body UpdateInjuryActiveRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		if body.Timestamp == 0 {
			return respond(400, map[string]string{"error": "timestamp is required"})
		}
		if err := setInjuryActiveStatus(username, body.Timestamp, body.Active); err != nil {
			log.Printf("Error updating injury active status: %v", err)
			if strings.Contains(strings.ToLower(err.Error()), strings.ToLower("ConditionalCheckFailed")) {
				return respond(404, map[string]string{"error": "Injury not found for user"})
			}
			return respond(500, map[string]string{"error": fmt.Sprintf("Error updating injury: %v", err)})
		}
		return respond(200, map[string]string{"message": "Injury status updated"})

	case method == "GET" && path == "/bodyparts":
		bodyparts, err := getBodypartsFromDB(username)
		if err != nil {
			log.Printf("Error getting bodyparts: %v", err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error fetching bodyparts: %v", err)})
		}
		return respond(200, bodyparts)

	case method == "POST" && path == "/bodyparts":
		var body AddBodypartRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		if strings.TrimSpace(body.Location) == "" {
			return respond(400, map[string]string{"error": "location is required"})
		}
		if err := addBodypartToDB(username, body.Location); err != nil {
			log.Printf("Error adding bodypart '%s': %v", body.Location, err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error adding bodypart: %v", err)})
		}
		return respond(200, map[string]string{"message": fmt.Sprintf("Bodypart %s added successfully", body.Location)})

	case method == "DELETE" && path == "/bodyparts":
		var body DeleteBodypartRequest
		if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
			return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
		}
		if strings.TrimSpace(body.Location) == "" {
			return respond(400, map[string]string{"error": "location is required"})
		}
		if err := deleteBodypartFromDB(username, body.Location); err != nil {
			log.Printf("Error deleting bodypart '%s': %v", body.Location, err)
			return respond(500, map[string]string{"error": fmt.Sprintf("Error deleting bodypart: %v", err)})
		}
		return respond(200, map[string]string{"message": fmt.Sprintf("Bodypart %s deleted successfully", body.Location)})

	default:
		log.Printf("Route not found for %s %s", method, path)
		return respond(404, map[string]string{"error": "Route not found"})
	}
}

func handleCreateUser(req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var body CreateUserRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return respond(400, map[string]string{"error": fmt.Sprintf("Invalid request: %v", err)})
	}

	if body.Username == "" {
		return respond(400, map[string]string{"error": "username is required"})
	}

	username, apiKey, err := createUserWithApiKey(body.Username)
	if err != nil {
		log.Printf("Error creating user '%s': %v", body.Username, err)
		return respond(500, map[string]string{"error": fmt.Sprintf("Error creating user: %v", err)})
	}

	response := CreateUserResponse{
		Username: username,
		ApiKey:   apiKey,
	}

	log.Printf("Created user '%s'", username)
	return respond(201, response)
}
