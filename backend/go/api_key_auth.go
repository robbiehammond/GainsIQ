package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

func extractApiKeyFromHeader(authHeader string) (string, error) {
	if authHeader == "" {
		return "", fmt.Errorf("authorization header missing")
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", fmt.Errorf("invalid authorization header format, expected 'Bearer <api_key>'")
	}

	return parts[1], nil
}

func validateApiKeyAndGetUserId(apiKey string) (string, error) {
	if apiKey == "" {
		return "", fmt.Errorf("API key cannot be empty")
	}

	// Scan the users table to find the user with this API key
	scanInput := &dynamodb.ScanInput{
		TableName:        aws.String(usersTableName),
		FilterExpression: aws.String("apiKey = :apiKey AND isActive = :isActive"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":apiKey":    &types.AttributeValueMemberS{Value: apiKey},
			":isActive":  &types.AttributeValueMemberBOOL{Value: true},
		},
	}

	result, err := ddbClient.Scan(context.TODO(), scanInput)
	if err != nil {
		return "", fmt.Errorf("failed to scan users table: %w", err)
	}

	if len(result.Items) == 0 {
		return "", fmt.Errorf("invalid or inactive API key")
	}

	if len(result.Items) > 1 {
		return "", fmt.Errorf("multiple users found with same API key - data integrity issue")
	}

	var userItem UserItem
	if err := attributevalue.UnmarshalMap(result.Items[0], &userItem); err != nil {
		return "", fmt.Errorf("failed to unmarshal user item: %w", err)
	}

	return userItem.Username, nil
}

func authenticateRequest(authHeader string) (string, error) {
	apiKey, err := extractApiKeyFromHeader(authHeader)
	if err != nil {
		return "", err
	}

	userID, err := validateApiKeyAndGetUserId(apiKey)
	if err != nil {
		return "", err
	}

	return userID, nil
}