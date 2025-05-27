package main

// TODO: Break this into multiple files, basically just clean it up.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/google/uuid"
)

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

var (
	ddbClient          *dynamodb.Client
	sqsClient          *sqs.Client
	exercisesTableName string
	setsTableName      string
	weightTableName    string
	analysesTableName  string
	queueURL           string
	apiKeyMapVar       map[string]string
)

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

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("Unable to load SDK config, %v", err)
	}
	ddbClient = dynamodb.NewFromConfig(cfg)
	sqsClient = sqs.NewFromConfig(cfg)

	exercisesTableName = os.Getenv("EXERCISES_TABLE")
	if exercisesTableName == "" {
		log.Fatal("EXERCISES_TABLE environment variable not set")
	}
	setsTableName = os.Getenv("SETS_TABLE")
	if setsTableName == "" {
		log.Fatal("SETS_TABLE environment variable not set")
	}
	weightTableName = os.Getenv("WEIGHT_TABLE")
	if weightTableName == "" {
		log.Fatal("WEIGHT_TABLE environment variable not set")
	}
	analysesTableName = os.Getenv("ANALYSES_TABLE")
	if analysesTableName == "" {
		log.Fatal("ANALYSES_TABLE environment variable not set")
	}
	queueURL = os.Getenv("QUEUE_URL")
	if queueURL == "" {
		log.Fatal("QUEUE_URL environment variable not set")
	}

	apiKeyMapJSON := os.Getenv("API_KEY_MAP")
	if apiKeyMapJSON == "" {
		log.Println("WARN: API_KEY_MAP environment variable not set or empty. API key map will be empty.")
		apiKeyMapVar = make(map[string]string)
	} else {
		if err := json.Unmarshal([]byte(apiKeyMapJSON), &apiKeyMapVar); err != nil {
			log.Printf("WARN: Error unmarshalling API_KEY_MAP: %v. API key map will be empty.", err)
			apiKeyMapVar = make(map[string]string)
		}
	}
}

func getUserForAPIKey(apiKey string) (string, bool) {
	user, ok := apiKeyMapVar[apiKey]
	return user, ok
}

func respond(status int, body interface{}) (events.APIGatewayProxyResponse, error) {
	headers := map[string]string{
		"Content-Type":                "application/json",
		"Access-Control-Allow-Origin": "*",
	}
	var b []byte
	var err error

	if s, ok := body.(string); ok {
		b = []byte(s)
	} else {
		b, err = json.Marshal(body)
		if err != nil {
			log.Printf("Error marshalling response: %v", err)
			errorResponse := map[string]string{"error": "Internal server error marshalling response"}
			b, _ = json.Marshal(errorResponse)
			return events.APIGatewayProxyResponse{StatusCode: 500, Body: string(b), Headers: headers}, nil
		}
	}
	return events.APIGatewayProxyResponse{
		StatusCode: status,
		Body:       string(b),
		Headers:    headers,
	}, nil
}

func getExercisesFromDB() ([]string, error) {
	var exercises []string
	scanInput := &dynamodb.ScanInput{
		TableName: aws.String(exercisesTableName),
	}
	result, err := ddbClient.Scan(context.TODO(), scanInput)
	if err != nil {
		return nil, fmt.Errorf("failed to scan DynamoDB table %s: %w", exercisesTableName, err)
	}
	for _, itemMap := range result.Items {
		var ex ExerciseItem
		if err = attributevalue.UnmarshalMap(itemMap, &ex); err != nil {
			log.Printf("Warning: failed to unmarshal exercise item: %v. Item: %v", err, itemMap)
			continue
		}
		exercises = append(exercises, ex.ExerciseName)
	}
	sort.Strings(exercises)
	return exercises, nil
}

func addExerciseToDB(exerciseName string) error {
	item := map[string]types.AttributeValue{
		"exerciseName": &types.AttributeValueMemberS{Value: exerciseName},
	}
	_, err := ddbClient.PutItem(context.TODO(), &dynamodb.PutItemInput{
		TableName: aws.String(exercisesTableName),
		Item:      item,
	})
	if err != nil {
		return fmt.Errorf("failed to put exercise %s: %w", exerciseName, err)
	}
	return nil
}

func deleteExerciseFromDB(exerciseName string) error {
	key := map[string]types.AttributeValue{
		"exerciseName": &types.AttributeValueMemberS{Value: exerciseName},
	}
	_, err := ddbClient.DeleteItem(context.TODO(), &dynamodb.DeleteItemInput{
		TableName: aws.String(exercisesTableName),
		Key:       key,
	})
	if err != nil {
		return fmt.Errorf("failed to delete exercise %s: %w", exerciseName, err)
	}
	return nil
}

func logWeightToDB(weightValue float32) error {
	timestamp := time.Now().Unix()
	item := WeightItem{
		Timestamp: timestamp,
		Weight:    weightValue,
	}
	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("failed to marshal weight item: %w", err)
	}
	_, err = ddbClient.PutItem(context.TODO(), &dynamodb.PutItemInput{
		TableName: aws.String(weightTableName),
		Item:      av,
	})
	if err != nil {
		return fmt.Errorf("failed to put weight item: %w", err)
	}
	return nil
}

func getWeightsFromDB() ([]WeightOutputItem, error) {
	scanInput := &dynamodb.ScanInput{
		TableName: aws.String(weightTableName),
	}
	result, err := ddbClient.Scan(context.TODO(), scanInput)
	if err != nil {
		return nil, fmt.Errorf("failed to scan weight table: %w", err)
	}

	var outputItems []WeightOutputItem
	var tempWeightItems []WeightItem

	for _, itemMap := range result.Items {
		var wi WeightItem
		if err = attributevalue.UnmarshalMap(itemMap, &wi); err != nil {
			log.Printf("Warning: failed to unmarshal weight item: %v. Item: %v", err, itemMap)
			continue
		}
		tempWeightItems = append(tempWeightItems, wi)
	}

	sort.SliceStable(tempWeightItems, func(i, j int) bool {
		return tempWeightItems[i].Timestamp < tempWeightItems[j].Timestamp
	})

	for _, wi := range tempWeightItems {
		out := make(WeightOutputItem)
		out["timestamp"] = strconv.FormatInt(wi.Timestamp, 10)
		out["weight"] = strconv.FormatFloat(float64(wi.Weight), 'f', -1, 32)
		outputItems = append(outputItems, out)
	}
	return outputItems, nil
}

func calculateWeightTrend() (WeightTrendResponse, error) {
	twoWeeksAgo := time.Now().AddDate(0, 0, -14).Unix()
	
	scanInput := &dynamodb.ScanInput{
		TableName:        aws.String(weightTableName),
		FilterExpression: aws.String("#ts >= :two_weeks_ago"),
		ExpressionAttributeNames: map[string]string{
			"#ts": "timestamp",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":two_weeks_ago": &types.AttributeValueMemberN{Value: strconv.FormatInt(twoWeeksAgo, 10)},
		},
	}
	
	result, err := ddbClient.Scan(context.TODO(), scanInput)
	if err != nil {
		return WeightTrendResponse{}, fmt.Errorf("failed to scan weight table for trend: %w", err)
	}
	
	if len(result.Items) < 2 {
		return WeightTrendResponse{}, fmt.Errorf("insufficient data points for trend calculation (need at least 2)")
	}
	
	var weightItems []WeightItem
	for _, itemMap := range result.Items {
		var wi WeightItem
		if err = attributevalue.UnmarshalMap(itemMap, &wi); err != nil {
			log.Printf("Warning: failed to unmarshal weight item during trend calculation: %v", err)
			continue
		}
		weightItems = append(weightItems, wi)
	}
	
	if len(weightItems) < 2 {
		return WeightTrendResponse{}, fmt.Errorf("insufficient valid data points for trend calculation")
	}
	
	sort.SliceStable(weightItems, func(i, j int) bool {
		return weightItems[i].Timestamp < weightItems[j].Timestamp
	})
	
	// Calculate linear regression (best fit line)
	n := float64(len(weightItems))
	var sumX, sumY, sumXY, sumX2 float64
	
	for _, item := range weightItems {
		x := float64(item.Timestamp)
		y := float64(item.Weight)
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
	}
	
	// Slope formula: (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)
	slope := (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)
	
	// Convert slope from pounds per second to pounds per day
	slopePoundsPerDay := slope * 86400 // 86400 seconds in a day
	
	currentDate := time.Now().Format("2006-01-02")
	
	return WeightTrendResponse{
		Date:  currentDate,
		Slope: slopePoundsPerDay,
	}, nil
}

func deleteMostRecentWeightFromDB() (deleted bool, err error) {
	scanInput := &dynamodb.ScanInput{
		TableName: aws.String(weightTableName),
	}
	result, errScan := ddbClient.Scan(context.TODO(), scanInput)
	if errScan != nil {
		return false, fmt.Errorf("failed to scan weight table for delete: %w", errScan)
	}

	if len(result.Items) == 0 {
		return false, nil
	}

	var mostRecentTimestamp int64 = -1
	for _, itemMap := range result.Items {
		var wi WeightItem
		if innerErr := attributevalue.UnmarshalMap(itemMap, &wi); innerErr != nil {
			log.Printf("Warning: failed to unmarshal weight item during delete scan: %v", innerErr)
			continue
		}
		if wi.Timestamp > mostRecentTimestamp {
			mostRecentTimestamp = wi.Timestamp
		}
	}

	if mostRecentTimestamp == -1 {
		return false, fmt.Errorf("no valid weight entry found to delete despite items being present")
	}

	key := map[string]types.AttributeValue{
		"timestamp": &types.AttributeValueMemberN{Value: strconv.FormatInt(mostRecentTimestamp, 10)},
	}
	_, errDel := ddbClient.DeleteItem(context.TODO(), &dynamodb.DeleteItemInput{
		TableName: aws.String(weightTableName),
		Key:       key,
	})
	if errDel != nil {
		return false, fmt.Errorf("failed to delete weight item with timestamp %d: %w", mostRecentTimestamp, errDel)
	}
	return true, nil
}

func getLastMonthSetsFromDB() ([]SetOutputItem, error) {
	oneMonthAgo := time.Now().AddDate(0, 0, -30).Unix()
	oneMonthAgoStr := strconv.FormatInt(oneMonthAgo, 10)

	scanInput := &dynamodb.ScanInput{
		TableName:        aws.String(setsTableName),
		FilterExpression: aws.String("#ts > :one_month_ago"),
		ExpressionAttributeNames: map[string]string{
			"#ts": "timestamp",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":one_month_ago": &types.AttributeValueMemberN{Value: oneMonthAgoStr},
		},
	}

	result, err := ddbClient.Scan(context.TODO(), scanInput)
	if err != nil {
		return nil, fmt.Errorf("failed to scan sets table %s: %w", setsTableName, err)
	}

	var setItemList []SetItem
	for _, itemMap := range result.Items {
		var si SetItem
		if err = attributevalue.UnmarshalMap(itemMap, &si); err != nil {
			log.Printf("Warning: failed to unmarshal set item: %v. Item: %v", err, itemMap)
			continue
		}
		setItemList = append(setItemList, si)
	}

	sort.SliceStable(setItemList, func(i, j int) bool {
		return setItemList[i].Timestamp < setItemList[j].Timestamp
	})

	var outputItems []SetOutputItem
	for _, si := range setItemList {
		out := make(SetOutputItem)
		out["workoutId"] = si.WorkoutID
		out["timestamp"] = strconv.FormatInt(si.Timestamp, 10)
		out["exercise"] = si.Exercise
		out["reps"] = si.Reps
		out["sets"] = strconv.FormatInt(int64(si.Sets), 10)
		out["weight"] = strconv.FormatFloat(float64(si.Weight), 'f', -1, 32)
		if si.WeightModulation != "" {
			out["weight_modulation"] = si.WeightModulation
		}
		outputItems = append(outputItems, out)
	}
	return outputItems, nil
}

func logSetToDB(req LogSetRequest) error {
	var modulation string
	if req.IsCutting != nil && *req.IsCutting {
		modulation = "Cutting"
	} else {
		modulation = "Bulking"
	}

	item := SetItem{
		WorkoutID:        uuid.NewString(),
		Timestamp:        time.Now().Unix(),
		Exercise:         req.Exercise,
		Reps:             req.Reps,
		Sets:             int32(req.Sets),
		Weight:           req.Weight,
		WeightModulation: modulation,
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("failed to marshal set item: %w", err)
	}
	_, err = ddbClient.PutItem(context.TODO(), &dynamodb.PutItemInput{
		TableName: aws.String(setsTableName),
		Item:      av,
	})
	if err != nil {
		return fmt.Errorf("failed to put set item: %w", err)
	}
	return nil
}

func popLastSetFromDB() (deleted bool, err error) {
	scanInput := &dynamodb.ScanInput{TableName: aws.String(setsTableName)}
	result, errScan := ddbClient.Scan(context.TODO(), scanInput)
	if errScan != nil {
		return false, fmt.Errorf("failed to scan sets table for pop: %w", errScan)
	}

	if len(result.Items) == 0 {
		return false, nil
	}

	var mostRecentSet SetItem
	found := false
	for _, itemMap := range result.Items {
		var currentSet SetItem
		if errUnmarshal := attributevalue.UnmarshalMap(itemMap, &currentSet); errUnmarshal != nil {
			log.Printf("Warning: failed to unmarshal set item during pop scan: %v", errUnmarshal)
			continue
		}
		if !found || currentSet.Timestamp > mostRecentSet.Timestamp {
			mostRecentSet = currentSet
			found = true
		}
	}

	if !found {
		return false, fmt.Errorf("no valid set entry found to pop despite items being present")
	}

	key := map[string]types.AttributeValue{
		"workoutId": &types.AttributeValueMemberS{Value: mostRecentSet.WorkoutID},
		"timestamp": &types.AttributeValueMemberN{Value: strconv.FormatInt(mostRecentSet.Timestamp, 10)},
	}
	_, errDel := ddbClient.DeleteItem(context.TODO(), &dynamodb.DeleteItemInput{
		TableName: aws.String(setsTableName),
		Key:       key,
	})
	if errDel != nil {
		return false, fmt.Errorf("failed to delete set item (workoutId %s, ts %d): %w", mostRecentSet.WorkoutID, mostRecentSet.Timestamp, errDel)
	}
	return true, nil
}

func getSetsForExerciseFromDB(exerciseName string, startTs int64, endTs int64) ([]SetOutputItem, error) {
	if exerciseName == "" {
		return nil, fmt.Errorf("exerciseName cannot be empty")
	}

	filterExpression := "#ex = :exercise_val AND #ts BETWEEN :start_ts AND :end_ts"
	exprAttrNames := map[string]string{
		"#ex": "exercise",
		"#ts": "timestamp",
	}
	exprAttrValuesMap := map[string]interface{}{
		":exercise_val": exerciseName,
		":start_ts":     startTs,
		":end_ts":       endTs,
	}
	marshaledExprAttrValues, err := attributevalue.MarshalMap(exprAttrValuesMap)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal expression attribute values for getSetsForExercise: %w", err)
	}

	scanInput := &dynamodb.ScanInput{
		TableName:                 aws.String(setsTableName),
		FilterExpression:          aws.String(filterExpression),
		ExpressionAttributeNames:  exprAttrNames,
		ExpressionAttributeValues: marshaledExprAttrValues,
	}

	result, err := ddbClient.Scan(context.TODO(), scanInput)
	if err != nil {
		return nil, fmt.Errorf("failed to scan sets for exercise %s: %w", exerciseName, err)
	}

	var setItemList []SetItem
	for _, itemMap := range result.Items {
		var si SetItem
		if errUnmarshal := attributevalue.UnmarshalMap(itemMap, &si); errUnmarshal != nil {
			log.Printf("Warning: failed to unmarshal set item for exercise %s: %v", exerciseName, errUnmarshal)
			continue
		}
		setItemList = append(setItemList, si)
	}

	sort.SliceStable(setItemList, func(i, j int) bool {
		return setItemList[i].Timestamp < setItemList[j].Timestamp
	})

	var outputItems []SetOutputItem
	for _, si := range setItemList {
		out := make(SetOutputItem)
		out["workoutId"] = si.WorkoutID
		out["timestamp"] = strconv.FormatInt(si.Timestamp, 10)
		out["exercise"] = si.Exercise
		out["reps"] = si.Reps
		out["sets"] = strconv.FormatInt(int64(si.Sets), 10)
		out["weight"] = strconv.FormatFloat(float64(si.Weight), 'f', -1, 32)
		if si.WeightModulation != "" {
			out["weight_modulation"] = si.WeightModulation
		}
		outputItems = append(outputItems, out)
	}
	return outputItems, nil
}
// getSetsInRangeFromDB retrieves all workout sets between startTs and endTs (inclusive)
func getSetsInRangeFromDB(startTs int64, endTs int64) ([]SetOutputItem, error) {
   filterExpression := "#ts BETWEEN :start_ts AND :end_ts"
   exprAttrNames := map[string]string{
       "#ts": "timestamp",
   }
   exprAttrValuesMap := map[string]interface{}{
       ":start_ts": startTs,
       ":end_ts":   endTs,
   }
   marshaledVals, err := attributevalue.MarshalMap(exprAttrValuesMap)
   if err != nil {
       return nil, fmt.Errorf("failed to marshal expression attribute values for getSetsInRange: %w", err)
   }
   scanInput := &dynamodb.ScanInput{
       TableName:                 aws.String(setsTableName),
       FilterExpression:          aws.String(filterExpression),
       ExpressionAttributeNames:  exprAttrNames,
       ExpressionAttributeValues: marshaledVals,
   }
   result, err := ddbClient.Scan(context.TODO(), scanInput)
   if err != nil {
       return nil, fmt.Errorf("failed to scan sets for range (%d to %d): %w", startTs, endTs, err)
   }
   var setItemList []SetItem
   for _, itemMap := range result.Items {
       var si SetItem
       if unmarshalErr := attributevalue.UnmarshalMap(itemMap, &si); unmarshalErr != nil {
           log.Printf("Warning: failed to unmarshal set item in range: %v. Item: %v", unmarshalErr, itemMap)
           continue
       }
       setItemList = append(setItemList, si)
   }
   sort.SliceStable(setItemList, func(i, j int) bool {
       return setItemList[i].Timestamp < setItemList[j].Timestamp
   })
   var outputItems []SetOutputItem
   for _, si := range setItemList {
       out := make(SetOutputItem)
       out["workoutId"] = si.WorkoutID
       out["timestamp"] = strconv.FormatInt(si.Timestamp, 10)
       out["exercise"] = si.Exercise
       out["reps"] = si.Reps
       out["sets"] = strconv.FormatInt(int64(si.Sets), 10)
       out["weight"] = strconv.FormatFloat(float64(si.Weight), 'f', -1, 32)
       if si.WeightModulation != "" {
           out["weight_modulation"] = si.WeightModulation
       }
       outputItems = append(outputItems, out)
   }
   return outputItems, nil
}

func editSetInDB(req EditSetRequest) error {
	key := map[string]types.AttributeValue{
		"workoutId": &types.AttributeValueMemberS{Value: req.WorkoutID},
		"timestamp": &types.AttributeValueMemberN{Value: strconv.FormatInt(req.Timestamp, 10)},
	}

	var updateParts []string
	exprAttrValues := make(map[string]types.AttributeValue)
	exprAttrNames := make(map[string]string)

	if req.Reps != nil {
		updateParts = append(updateParts, "reps = :r")
		exprAttrValues[":r"] = &types.AttributeValueMemberS{Value: *req.Reps}
	}
	if req.Sets != nil {
		updateParts = append(updateParts, "#s = :s")
		exprAttrNames["#s"] = "sets"
		exprAttrValues[":s"] = &types.AttributeValueMemberN{Value: strconv.Itoa(*req.Sets)}
	}
	if req.Weight != nil {
		updateParts = append(updateParts, "weight = :w")
		exprAttrValues[":w"] = &types.AttributeValueMemberN{Value: strconv.FormatFloat(float64(*req.Weight), 'f', -1, 32)}
	}

	if len(updateParts) == 0 {
		return nil
	}
	updateExpression := "SET " + strings.Join(updateParts, ", ")

	updateInput := &dynamodb.UpdateItemInput{
		TableName:                 aws.String(setsTableName),
		Key:                       key,
		UpdateExpression:          aws.String(updateExpression),
		ExpressionAttributeValues: exprAttrValues,
		ReturnValues:              types.ReturnValueNone,
	}
	if len(exprAttrNames) > 0 {
		updateInput.ExpressionAttributeNames = exprAttrNames
	}

	_, err := ddbClient.UpdateItem(context.TODO(), updateInput)
	if err != nil {
		return fmt.Errorf("failed to update set (workoutId %s, ts %d): %w", req.WorkoutID, req.Timestamp, err)
	}
	return nil
}

func deleteSetFromDB(workoutID string, timestamp int64) error {
	if workoutID == "" || timestamp == 0 {
		return fmt.Errorf("invalid input: workoutId and timestamp are required")
	}
	key := map[string]types.AttributeValue{
		"workoutId": &types.AttributeValueMemberS{Value: workoutID},
		"timestamp": &types.AttributeValueMemberN{Value: strconv.FormatInt(timestamp, 10)},
	}
	_, err := ddbClient.DeleteItem(context.TODO(), &dynamodb.DeleteItemInput{
		TableName: aws.String(setsTableName),
		Key:       key,
	})
	if err != nil {
		return fmt.Errorf("failed to delete set (workoutId %s, ts %d): %w", workoutID, timestamp, err)
	}
	return nil
}

func getMostRecentAnalysisFromDB() (map[string]string, bool, error) {
	scanInput := &dynamodb.ScanInput{TableName: aws.String(analysesTableName)}
	result, err := ddbClient.Scan(context.TODO(), scanInput)
	if err != nil {
		return nil, false, fmt.Errorf("failed to scan analyses table: %w", err)
	}

	if len(result.Items) == 0 {
		return nil, false, nil
	}

	var mostRecentAnalysisItem AnalysisItem
	foundItem := false
	for _, itemMap := range result.Items {
		var ai AnalysisItem
		if errUnmarshal := attributevalue.UnmarshalMap(itemMap, &ai); errUnmarshal != nil {
			log.Printf("Warning: failed to unmarshal analysis item: %v", errUnmarshal)
			continue
		}
		if !foundItem || ai.Timestamp > mostRecentAnalysisItem.Timestamp {
			mostRecentAnalysisItem = ai
			foundItem = true
		}
	}

	if !foundItem {
		return nil, false, fmt.Errorf("no valid analysis item found despite items being present")
	}
	return map[string]string{"analysis": mostRecentAnalysisItem.Analysis}, true, nil
}

func pingProcessingLambdaViaSQS() (messageID string, err error) {
	msgBody := "Triggering SQS from Go backend!"
	sendMsgInput := &sqs.SendMessageInput{
		QueueUrl:    aws.String(queueURL),
		MessageBody: aws.String(msgBody),
	}
	result, err := sqsClient.SendMessage(context.TODO(), sendMsgInput)
	if err != nil {
		return "", fmt.Errorf("failed to send message to SQS queue: %w", err)
	}
	if result.MessageId != nil {
		return *result.MessageId, nil
	}
	log.Println("SQS SendMessage succeeded but no MessageId was returned.")
	return "", nil
}

// --- Lambda Handler ---
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	apiKey := "unknown"
	if headerValue, ok := req.Headers["x-api-key"]; ok {
		apiKey = headerValue
	}

	user, ok := getUserForAPIKey(apiKey)
	if !ok {
		log.Printf("Unauthorized: Invalid API key provided: %s", apiKey)
		return respond(401, map[string]string{"error": "Unauthorized: Invalid API key"})
	}
	log.Printf("Request from user: %s for %s %s", user, req.HTTPMethod, req.Path)

	path := req.Path
	method := req.HTTPMethod

	switch {
	// === Exercises ===
	case method == "GET" && path == "/exercises":
		exercisesList, err := getExercisesFromDB()
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
		if err := addExerciseToDB(body.ExerciseName); err != nil {
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
			if strings.Contains(err.Error(), "no valid weight entry found") || strings.Contains(err.Error(), "no weight found to delete") { // Consolidate check
				return respond(404, map[string]string{"error": "No weight found to delete"})
			}
			return respond(500, map[string]string{"error": fmt.Sprintf("Error deleting most recent weight: %v", err)})
		}
		if !deleted { // If err was nil but deleted is false (e.g. no items initially)
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
		if !found { // If err was nil but found is false (e.g. no items initially)
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

func main() {
	lambda.Start(handler)
}
