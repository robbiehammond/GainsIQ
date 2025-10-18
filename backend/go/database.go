package main

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/google/uuid"
)

func getExercisesFromDB(username string) ([]string, error) {
	log.Printf("getExercisesFromDB called for username: %s", username)

	var exercises []string
	queryInput := &dynamodb.QueryInput{
		TableName:              aws.String(exercisesTableName),
		IndexName:              aws.String("UsernameExercisesIndex"),
		KeyConditionExpression: aws.String("username = :username"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":username": &types.AttributeValueMemberS{Value: username},
		},
	}

	log.Printf("Executing DynamoDB query on table: %s, index: %s", exercisesTableName, "UsernameExercisesIndex")
	result, err := ddbClient.Query(context.TODO(), queryInput)
	if err != nil {
		log.Printf("DynamoDB query failed: %v", err)
		return nil, fmt.Errorf("failed to query DynamoDB table %s: %w", exercisesTableName, err)
	}

	log.Printf("Query returned %d items", len(result.Items))
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

func addExerciseToDB(username, exerciseName string) error {
	item := map[string]types.AttributeValue{
		"exerciseName": &types.AttributeValueMemberS{Value: exerciseName},
		"username":     &types.AttributeValueMemberS{Value: username},
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

func logWeightToDB(username string, weightValue float32) error {
    timestamp := time.Now().Unix()
    item := WeightItem{
        Timestamp: timestamp,
        Weight:    weightValue,
        Username:  username,
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

func getWeightsFromDB(username string) ([]WeightOutputItem, error) {
    scanInput := &dynamodb.ScanInput{
        TableName:        aws.String(weightTableName),
        FilterExpression: aws.String("#u = :username"),
        ExpressionAttributeNames: map[string]string{
            "#u": "username",
        },
        ExpressionAttributeValues: map[string]types.AttributeValue{
            ":username": &types.AttributeValueMemberS{Value: username},
        },
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

func calculateWeightTrend(username string) (WeightTrendResponse, error) {
    twoWeeksAgo := time.Now().AddDate(0, 0, -14).Unix()

    scanInput := &dynamodb.ScanInput{
        TableName:        aws.String(weightTableName),
        FilterExpression: aws.String("#u = :username AND #ts >= :two_weeks_ago"),
        ExpressionAttributeNames: map[string]string{
            "#u":  "username",
            "#ts": "timestamp",
        },
        ExpressionAttributeValues: map[string]types.AttributeValue{
            ":username":      &types.AttributeValueMemberS{Value: username},
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

func deleteMostRecentWeightFromDB(username string) (deleted bool, err error) {
    scanInput := &dynamodb.ScanInput{
        TableName:        aws.String(weightTableName),
        FilterExpression: aws.String("#u = :username"),
        ExpressionAttributeNames: map[string]string{
            "#u": "username",
        },
        ExpressionAttributeValues: map[string]types.AttributeValue{
            ":username": &types.AttributeValueMemberS{Value: username},
        },
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

type hypotheticalSet struct {
	Exercise  string
	Timestamp int64
	SetNumber int
}

func buildHypotheticalDay(exercise string, dayStart int64, newSets []LogSetRequest) ([]hypotheticalSet, error) {
	dayEnd := dayStart + 86400 - 1

	// Get existing sets for this exercise on this day
	filterExpression := "#ex = :exercise_val AND #ts BETWEEN :start_ts AND :end_ts"
	exprAttrNames := map[string]string{
		"#ex": "exercise",
		"#ts": "timestamp",
	}
	exprAttrValuesMap := map[string]interface{}{
		":exercise_val": exercise,
		":start_ts":     dayStart,
		":end_ts":       dayEnd,
	}
	marshaledExprAttrValues, err := attributevalue.MarshalMap(exprAttrValuesMap)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal expression attribute values: %w", err)
	}

	scanInput := &dynamodb.ScanInput{
		TableName:                 aws.String(setsTableName),
		FilterExpression:          aws.String(filterExpression),
		ExpressionAttributeNames:  exprAttrNames,
		ExpressionAttributeValues: marshaledExprAttrValues,
	}

	result, err := ddbClient.Scan(context.TODO(), scanInput)
	if err != nil {
		return nil, fmt.Errorf("failed to scan existing sets: %w", err)
	}

	var existingSets []SetItem
	for _, itemMap := range result.Items {
		var si SetItem
		if errUnmarshal := attributevalue.UnmarshalMap(itemMap, &si); errUnmarshal != nil {
			log.Printf("Warning: failed to unmarshal set item: %v", errUnmarshal)
			continue
		}
		existingSets = append(existingSets, si)
	}

	// Create hypothetical sets from existing ones
	var allSets []hypotheticalSet
	for _, set := range existingSets {
		allSets = append(allSets, hypotheticalSet{
			Exercise:  set.Exercise,
			Timestamp: set.Timestamp,
		})
	}

	// Add new sets for this exercise on this day
	for _, newSet := range newSets {
		var timestamp int64
		if newSet.Timestamp != nil {
			timestamp = *newSet.Timestamp
		} else {
			timestamp = time.Now().Unix()
		}

		// Only include sets for this exercise on this day
		setDayStart := time.Unix(timestamp, 0).Truncate(24 * time.Hour).Unix()
		if setDayStart == dayStart && newSet.Exercise == exercise {
			allSets = append(allSets, hypotheticalSet{
				Exercise:  newSet.Exercise,
				Timestamp: timestamp,
			})
		}
	}

	// Sort by timestamp to determine correct order
	sort.SliceStable(allSets, func(i, j int) bool {
		return allSets[i].Timestamp < allSets[j].Timestamp
	})

	// Assign set numbers in order
	for i := range allSets {
		allSets[i].SetNumber = i + 1
	}

	return allSets, nil
}

func calculateCorrectSetNumbers(username string, requests []LogSetRequest) (map[string]int, error) {
	// Group requests by day and exercise
	dayExerciseGroups := make(map[string]map[string][]LogSetRequest) // dayStart -> exercise -> requests

	for _, req := range requests {
		var timestamp int64
		if req.Timestamp != nil {
			timestamp = *req.Timestamp
		} else {
			timestamp = time.Now().Unix()
		}

		dayStart := time.Unix(timestamp, 0).Truncate(24 * time.Hour).Unix()
		dayKey := strconv.FormatInt(dayStart, 10)

		if dayExerciseGroups[dayKey] == nil {
			dayExerciseGroups[dayKey] = make(map[string][]LogSetRequest)
		}
		dayExerciseGroups[dayKey][req.Exercise] = append(dayExerciseGroups[dayKey][req.Exercise], req)
	}

	// Build a map from timestamp to correct set number
	timestampToSetNumber := make(map[string]int)

	for dayKey, exerciseGroups := range dayExerciseGroups {
		dayStart, _ := strconv.ParseInt(dayKey, 10, 64)

		for exercise, exerciseRequests := range exerciseGroups {
			hypotheticalSets, err := buildHypotheticalDay(exercise, dayStart, requests)
			if err != nil {
				return nil, fmt.Errorf("failed to build hypothetical day for %s: %w", exercise, err)
			}

			// Map new request timestamps to their correct set numbers
			for _, hypoSet := range hypotheticalSets {
				// Check if this is one of our new sets
				for _, req := range exerciseRequests {
					var reqTimestamp int64
					if req.Timestamp != nil {
						reqTimestamp = *req.Timestamp
					} else {
						reqTimestamp = time.Now().Unix()
					}

					if hypoSet.Timestamp == reqTimestamp && hypoSet.Exercise == req.Exercise {
						timestampKey := fmt.Sprintf("%s_%d", exercise, reqTimestamp)
						timestampToSetNumber[timestampKey] = hypoSet.SetNumber
					}
				}
			}
		}
	}

	return timestampToSetNumber, nil
}

func logSetToDB(username string, req LogSetRequest) error {
	var modulation string
	if req.IsCutting != nil && *req.IsCutting {
		modulation = "Cutting"
	} else {
		modulation = "Bulking"
	}

	// Use provided timestamp if available, otherwise use current time
	var timestamp int64
	if req.Timestamp != nil {
		timestamp = *req.Timestamp
	} else {
		timestamp = time.Now().Unix()
	}

	// Calculate set number based on same-day exercises
	setNumber, err := calculateSetNumber(req.Exercise, timestamp)
	if err != nil {
		return fmt.Errorf("failed to calculate set number: %w", err)
	}

    item := SetItem{
        WorkoutID:        uuid.NewString(),
        Timestamp:        timestamp,
        Exercise:         req.Exercise,
        Reps:             req.Reps,
        Sets:             int32(setNumber),
        Weight:           req.Weight,
        WeightModulation: modulation,
        Username:         username,
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

func batchLogSetsToDB(username string, requests []LogSetRequest) error {
	if len(requests) == 0 {
		return fmt.Errorf("no sets provided for batch logging")
	}

	if len(requests) > 100 {
		return fmt.Errorf("too many sets in batch (maximum 100)")
	}

	// Calculate correct set numbers before doing the transaction
    timestampToSetNumber, err := calculateCorrectSetNumbers(username, requests)
	if err != nil {
		return fmt.Errorf("failed to calculate correct set numbers: %w", err)
	}

	var transactItems []types.TransactWriteItem

	for _, req := range requests {
		var modulation string
		if req.IsCutting != nil && *req.IsCutting {
			modulation = "Cutting"
		} else {
			modulation = "Bulking"
		}

		// Use provided timestamp if available, otherwise use current time
		var timestamp int64
		if req.Timestamp != nil {
			timestamp = *req.Timestamp
		} else {
			timestamp = time.Now().Unix()
		}

		// Get the correct set number from our pre-calculation
		timestampKey := fmt.Sprintf("%s_%d", req.Exercise, timestamp)
		setNumber, exists := timestampToSetNumber[timestampKey]
		if !exists {
			return fmt.Errorf("failed to find calculated set number for exercise %s at timestamp %d", req.Exercise, timestamp)
		}

        item := SetItem{
            WorkoutID:        uuid.NewString(),
            Timestamp:        timestamp,
            Exercise:         req.Exercise,
            Reps:             req.Reps,
            Sets:             int32(setNumber),
            Weight:           req.Weight,
            WeightModulation: modulation,
            Username:         username,
        }

		av, err := attributevalue.MarshalMap(item)
		if err != nil {
			return fmt.Errorf("failed to marshal set item for exercise %s: %w", req.Exercise, err)
		}

		transactItems = append(transactItems, types.TransactWriteItem{
			Put: &types.Put{
				TableName: aws.String(setsTableName),
				Item:      av,
			},
		})
	}

	// Execute the transaction with correct set numbers
	_, err = ddbClient.TransactWriteItems(context.TODO(), &dynamodb.TransactWriteItemsInput{
		TransactItems: transactItems,
	})
	if err != nil {
		return fmt.Errorf("failed to execute batch transaction: %w", err)
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

	// First, get the exercise name and date of the set being deleted
	getInput := &dynamodb.GetItemInput{
		TableName: aws.String(setsTableName),
		Key: map[string]types.AttributeValue{
			"workoutId": &types.AttributeValueMemberS{Value: workoutID},
			"timestamp": &types.AttributeValueMemberN{Value: strconv.FormatInt(timestamp, 10)},
		},
	}
	getResult, err := ddbClient.GetItem(context.TODO(), getInput)
	if err != nil {
		return fmt.Errorf("failed to get set before deletion: %w", err)
	}
	if getResult.Item == nil {
		return fmt.Errorf("set not found for deletion")
	}

	var deletedSet SetItem
	if err := attributevalue.UnmarshalMap(getResult.Item, &deletedSet); err != nil {
		return fmt.Errorf("failed to unmarshal set for deletion: %w", err)
	}

	// Delete the set
	key := map[string]types.AttributeValue{
		"workoutId": &types.AttributeValueMemberS{Value: workoutID},
		"timestamp": &types.AttributeValueMemberN{Value: strconv.FormatInt(timestamp, 10)},
	}
	_, err = ddbClient.DeleteItem(context.TODO(), &dynamodb.DeleteItemInput{
		TableName: aws.String(setsTableName),
		Key:       key,
	})
	if err != nil {
		return fmt.Errorf("failed to delete set (workoutId %s, ts %d): %w", workoutID, timestamp, err)
	}

	// Recalculate set numbers for the same exercise on the same day
	err = recalculateSetNumbers(deletedSet.Exercise, deletedSet.Timestamp)
	if err != nil {
		return fmt.Errorf("failed to recalculate set numbers after deletion: %w", err)
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

func calculateSetNumber(exercise string, timestamp int64) (int, error) {
	dayStart := time.Unix(timestamp, 0).Truncate(24 * time.Hour).Unix()
	dayEnd := dayStart + 86400 - 1 // End of day

	// Query for existing sets of this exercise on the same day
	filterExpression := "#ex = :exercise_val AND #ts BETWEEN :start_ts AND :end_ts"
	exprAttrNames := map[string]string{
		"#ex": "exercise",
		"#ts": "timestamp",
	}
	exprAttrValuesMap := map[string]interface{}{
		":exercise_val": exercise,
		":start_ts":     dayStart,
		":end_ts":       dayEnd,
	}
	marshaledExprAttrValues, err := attributevalue.MarshalMap(exprAttrValuesMap)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal expression attribute values: %w", err)
	}

	scanInput := &dynamodb.ScanInput{
		TableName:                 aws.String(setsTableName),
		FilterExpression:          aws.String(filterExpression),
		ExpressionAttributeNames:  exprAttrNames,
		ExpressionAttributeValues: marshaledExprAttrValues,
	}

	result, err := ddbClient.Scan(context.TODO(), scanInput)
	if err != nil {
		return 0, fmt.Errorf("failed to scan sets for set number calculation: %w", err)
	}

	var existingSets []SetItem
	for _, itemMap := range result.Items {
		var si SetItem
		if errUnmarshal := attributevalue.UnmarshalMap(itemMap, &si); errUnmarshal != nil {
			log.Printf("Warning: failed to unmarshal set item during set number calculation: %v", errUnmarshal)
			continue
		}
		existingSets = append(existingSets, si)
	}

	// Sort by timestamp to determine order
	sort.SliceStable(existingSets, func(i, j int) bool {
		return existingSets[i].Timestamp < existingSets[j].Timestamp
	})

	// Find the highest set number and return the next one
	maxSetNumber := 0
	for _, set := range existingSets {
		if int(set.Sets) > maxSetNumber {
			maxSetNumber = int(set.Sets)
		}
	}

	return maxSetNumber + 1, nil
}

func recalculateSetNumbers(exercise string, timestamp int64) error {
	dayStart := time.Unix(timestamp, 0).Truncate(24 * time.Hour).Unix()
	dayEnd := dayStart + 86400 - 1 // End of day

	filterExpression := "#ex = :exercise_val AND #ts BETWEEN :start_ts AND :end_ts"
	exprAttrNames := map[string]string{
		"#ex": "exercise",
		"#ts": "timestamp",
	}
	exprAttrValuesMap := map[string]interface{}{
		":exercise_val": exercise,
		":start_ts":     dayStart,
		":end_ts":       dayEnd,
	}
	marshaledExprAttrValues, err := attributevalue.MarshalMap(exprAttrValuesMap)
	if err != nil {
		return fmt.Errorf("failed to marshal expression attribute values: %w", err)
	}

	scanInput := &dynamodb.ScanInput{
		TableName:                 aws.String(setsTableName),
		FilterExpression:          aws.String(filterExpression),
		ExpressionAttributeNames:  exprAttrNames,
		ExpressionAttributeValues: marshaledExprAttrValues,
	}

	result, err := ddbClient.Scan(context.TODO(), scanInput)
	if err != nil {
		return fmt.Errorf("failed to scan sets for recalculation: %w", err)
	}

	var existingSets []SetItem
	for _, itemMap := range result.Items {
		var si SetItem
		if errUnmarshal := attributevalue.UnmarshalMap(itemMap, &si); errUnmarshal != nil {
			log.Printf("Warning: failed to unmarshal set item during recalculation: %v", errUnmarshal)
			continue
		}
		existingSets = append(existingSets, si)
	}

	sort.SliceStable(existingSets, func(i, j int) bool {
		return existingSets[i].Timestamp < existingSets[j].Timestamp
	})

	// Update each set with the correct set number
	for i, set := range existingSets {
		newSetNumber := i + 1
		if int(set.Sets) != newSetNumber {
			key := map[string]types.AttributeValue{
				"workoutId": &types.AttributeValueMemberS{Value: set.WorkoutID},
				"timestamp": &types.AttributeValueMemberN{Value: strconv.FormatInt(set.Timestamp, 10)},
			}

			updateInput := &dynamodb.UpdateItemInput{
				TableName:        aws.String(setsTableName),
				Key:              key,
				UpdateExpression: aws.String("SET #s = :s"),
				ExpressionAttributeNames: map[string]string{
					"#s": "sets",
				},
				ExpressionAttributeValues: map[string]types.AttributeValue{
					":s": &types.AttributeValueMemberN{Value: strconv.Itoa(newSetNumber)},
				},
				ReturnValues: types.ReturnValueNone,
			}

			_, err := ddbClient.UpdateItem(context.TODO(), updateInput)
			if err != nil {
				return fmt.Errorf("failed to update set number for workoutId %s: %w", set.WorkoutID, err)
			}
		}
	}

	return nil
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

func createUserWithApiKey(username string) (string, string, error) {
	if username == "" {
		return "", "", fmt.Errorf("username cannot be empty")
	}

	// Check if user already exists
	getInput := &dynamodb.GetItemInput{
		TableName: aws.String(usersTableName),
		Key: map[string]types.AttributeValue{
			"username": &types.AttributeValueMemberS{Value: username},
		},
	}

	result, err := ddbClient.GetItem(context.TODO(), getInput)
	if err != nil {
		return "", "", fmt.Errorf("failed to check if user exists: %w", err)
	}

	if result.Item != nil {
		return "", "", fmt.Errorf("username '%s' already exists", username)
	}

	// Generate API key and create user
	apiKey := uuid.NewString()
	currentTime := time.Now().Unix()

	userItem := UserItem{
		Username:  username,
		ApiKey:    apiKey,
		CreatedAt: currentTime,
		UpdatedAt: currentTime,
		IsActive:  true,
	}

	userAV, err := attributevalue.MarshalMap(userItem)
	if err != nil {
		return "", "", fmt.Errorf("failed to marshal user item: %w", err)
	}

	_, err = ddbClient.PutItem(context.TODO(), &dynamodb.PutItemInput{
		TableName: aws.String(usersTableName),
		Item:      userAV,
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to create user: %w", err)
	}

	return username, apiKey, nil
}

// === Bodyparts (locations) ===
func getBodypartsFromDB(username string) ([]string, error) {
    log.Printf("getBodypartsFromDB called for username: %s", username)

    var bodyparts []string
    queryInput := &dynamodb.QueryInput{
        TableName:              aws.String(bodypartsTableName),
        KeyConditionExpression: aws.String("username = :username"),
        ExpressionAttributeValues: map[string]types.AttributeValue{
            ":username": &types.AttributeValueMemberS{Value: username},
        },
    }

    result, err := ddbClient.Query(context.TODO(), queryInput)
    if err != nil {
        return nil, fmt.Errorf("failed to query DynamoDB table %s: %w", bodypartsTableName, err)
    }

    for _, itemMap := range result.Items {
        var bp BodypartItem
        if err = attributevalue.UnmarshalMap(itemMap, &bp); err != nil {
            log.Printf("Warning: failed to unmarshal bodypart item: %v. Item: %v", err, itemMap)
            continue
        }
        bodyparts = append(bodyparts, bp.Location)
    }
    sort.Strings(bodyparts)
    return bodyparts, nil
}

func addBodypartToDB(username, location string) error {
    item := map[string]types.AttributeValue{
        "location": &types.AttributeValueMemberS{Value: location},
        "username": &types.AttributeValueMemberS{Value: username},
    }
    _, err := ddbClient.PutItem(context.TODO(), &dynamodb.PutItemInput{
        TableName: aws.String(bodypartsTableName),
        Item:      item,
    })
    if err != nil {
        return fmt.Errorf("failed to put bodypart %s: %w", location, err)
    }
    return nil
}

func deleteBodypartFromDB(username, location string) error {
    key := map[string]types.AttributeValue{
        "username": &types.AttributeValueMemberS{Value: username},
        "location": &types.AttributeValueMemberS{Value: location},
    }
    _, err := ddbClient.DeleteItem(context.TODO(), &dynamodb.DeleteItemInput{
        TableName: aws.String(bodypartsTableName),
        Key:       key,
    })
    if err != nil {
        return fmt.Errorf("failed to delete bodypart %s for user %s: %w", location, username, err)
    }
    return nil
}

// === Injuries ===
func logInjuryToDB(username string, req InjuryRequest) error {
    if strings.TrimSpace(req.Location) == "" {
        return fmt.Errorf("location is required")
    }
    // Ensure the bodypart exists for this user before logging an injury
    exists, err := bodypartExists(username, req.Location)
    if err != nil {
        return fmt.Errorf("failed to verify bodypart location: %w")
    }
    if !exists {
        return fmt.Errorf("bodypart location '%s' not found for user", req.Location)
    }
    var ts int64
    if req.Timestamp != nil {
        ts = *req.Timestamp
    } else {
        ts = time.Now().Unix()
    }
    // Default active = true unless explicitly provided
    active := true
    if req.Active != nil {
        active = *req.Active
    }
    var periods []ActivePeriod
    if active {
        periods = []ActivePeriod{{Start: ts}}
    }
    item := InjuryItem{
        Timestamp: ts,
        Username:  username,
        Location:  req.Location,
        Details:   req.Details,
        Active:    active,
        ActivePeriods: periods,
    }
    av, err := attributevalue.MarshalMap(item)
    if err != nil {
        return fmt.Errorf("failed to marshal injury item: %w", err)
    }
    _, err = ddbClient.PutItem(context.TODO(), &dynamodb.PutItemInput{
        TableName: aws.String(injuriesTableName),
        Item:      av,
    })
    if err != nil {
        return fmt.Errorf("failed to put injury item: %w", err)
    }
    return nil
}

func getInjuriesFromDB(username string, qp map[string]string) ([]InjuryOutputItem, error) {
    // Build scan for this user, optional start/end filtering
    filter := "#u = :username"
    exprNames := map[string]string{"#u": "username"}
    exprVals := map[string]types.AttributeValue{
        ":username": &types.AttributeValueMemberS{Value: username},
    }

    // Optional range on timestamp
    var startPtr, endPtr *int64
    if startStr, ok := qp["start"]; ok && startStr != "" {
        if v, err := strconv.ParseInt(startStr, 10, 64); err == nil {
            startPtr = &v
        }
    }
    if endStr, ok := qp["end"]; ok && endStr != "" {
        if v, err := strconv.ParseInt(endStr, 10, 64); err == nil {
            endPtr = &v
        }
    }
    if startPtr != nil && endPtr != nil {
        filter = filter + " AND #ts BETWEEN :start AND :end"
        exprNames["#ts"] = "timestamp"
        exprVals[":start"] = &types.AttributeValueMemberN{Value: strconv.FormatInt(*startPtr, 10)}
        exprVals[":end"] = &types.AttributeValueMemberN{Value: strconv.FormatInt(*endPtr, 10)}
    } else if startPtr != nil {
        filter = filter + " AND #ts >= :start"
        exprNames["#ts"] = "timestamp"
        exprVals[":start"] = &types.AttributeValueMemberN{Value: strconv.FormatInt(*startPtr, 10)}
    } else if endPtr != nil {
        filter = filter + " AND #ts <= :end"
        exprNames["#ts"] = "timestamp"
        exprVals[":end"] = &types.AttributeValueMemberN{Value: strconv.FormatInt(*endPtr, 10)}
    }

    // Optional active-only filter
    if v, ok := qp["activeOnly"]; ok && (v == "true" || v == "1") {
        filter = filter + " AND #active = :true"
        exprNames["#active"] = "active"
        exprVals[":true"] = &types.AttributeValueMemberBOOL{Value: true}
    }

    scanInput := &dynamodb.ScanInput{
        TableName:                 aws.String(injuriesTableName),
        FilterExpression:          aws.String(filter),
        ExpressionAttributeNames:  exprNames,
        ExpressionAttributeValues: exprVals,
    }

    result, err := ddbClient.Scan(context.TODO(), scanInput)
    if err != nil {
        return nil, fmt.Errorf("failed to scan injuries table: %w", err)
    }

    var items []InjuryItem
    for _, m := range result.Items {
        var it InjuryItem
        if err := attributevalue.UnmarshalMap(m, &it); err != nil {
            log.Printf("Warning: failed to unmarshal injury item: %v. Item: %v", err, m)
            continue
        }
        items = append(items, it)
    }

    sort.SliceStable(items, func(i, j int) bool { return items[i].Timestamp < items[j].Timestamp })

    var out []InjuryOutputItem
    for _, it := range items {
        row := make(InjuryOutputItem)
        row["timestamp"] = strconv.FormatInt(it.Timestamp, 10)
        row["location"] = it.Location
        row["active"] = strconv.FormatBool(it.Active)
        if it.Details != nil && strings.TrimSpace(*it.Details) != "" {
            row["details"] = *it.Details
        }
        out = append(out, row)
    }
    return out, nil
}

func setInjuryActiveStatus(username string, timestamp int64, active bool) error {
    if timestamp == 0 {
        return fmt.Errorf("timestamp is required")
    }
    // Load item to update periods
    getOut, err := ddbClient.GetItem(context.TODO(), &dynamodb.GetItemInput{
        TableName: aws.String(injuriesTableName),
        Key: map[string]types.AttributeValue{
            "timestamp": &types.AttributeValueMemberN{Value: strconv.FormatInt(timestamp, 10)},
        },
    })
    if err != nil || getOut.Item == nil {
        return fmt.Errorf("failed to load injury for update")
    }
    var item InjuryItem
    if err := attributevalue.UnmarshalMap(getOut.Item, &item); err != nil {
        return fmt.Errorf("failed to unmarshal injury item")
    }
    if item.Username != username {
        return fmt.Errorf("not found")
    }

    now := time.Now().Unix()
    hadOpen := false
    if len(item.ActivePeriods) > 0 {
        last := &item.ActivePeriods[len(item.ActivePeriods)-1]
        if last.End == nil {
            hadOpen = true
        }
    }

    if active {
        if !hadOpen {
            item.ActivePeriods = append(item.ActivePeriods, ActivePeriod{Start: now})
        }
    } else {
        if hadOpen {
            last := &item.ActivePeriods[len(item.ActivePeriods)-1]
            last.End = &now
        }
    }
    item.Active = active

    av, err := attributevalue.MarshalMap(item)
    if err != nil {
        return fmt.Errorf("failed to marshal updated injury")
    }
    _, err = ddbClient.PutItem(context.TODO(), &dynamodb.PutItemInput{
        TableName:           aws.String(injuriesTableName),
        Item:                av,
        ConditionExpression: aws.String("#u = :username"),
        ExpressionAttributeNames: map[string]string{
            "#u": "username",
        },
        ExpressionAttributeValues: map[string]types.AttributeValue{
            ":username": &types.AttributeValueMemberS{Value: username},
        },
    })
    if err != nil {
        return fmt.Errorf("failed to update injury active status: %w")
    }
    return nil
}

func bodypartExists(username, location string) (bool, error) {
    key := map[string]types.AttributeValue{
        "username": &types.AttributeValueMemberS{Value: username},
        "location": &types.AttributeValueMemberS{Value: location},
    }
    out, err := ddbClient.GetItem(context.TODO(), &dynamodb.GetItemInput{
        TableName: aws.String(bodypartsTableName),
        Key:       key,
    })
    if err != nil {
        return false, fmt.Errorf("get bodypart failed: %w", err)
    }
    return out.Item != nil, nil
}
