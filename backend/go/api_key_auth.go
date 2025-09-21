package main

import (
	"context"
	"fmt"
	"log"
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
	log.Printf("validateApiKeyAndGetUserId called with apiKey: %s", apiKey)

	if apiKey == "" {
		log.Printf("API key is empty")
		return "", fmt.Errorf("API key cannot be empty")
	}

	log.Printf("Starting DynamoDB scan on table: %s", usersTableName)
	scanInput := &dynamodb.ScanInput{
		TableName:        aws.String(usersTableName),
		FilterExpression: aws.String("apiKey = :apiKey"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":apiKey": &types.AttributeValueMemberS{Value: apiKey},
		},
	}

	result, err := ddbClient.Scan(context.TODO(), scanInput)
	if err != nil {
		log.Printf("DynamoDB scan failed: %v", err)
		return "", fmt.Errorf("failed to scan users table: %w", err)
	}

	log.Printf("DynamoDB scan completed. Found %d items", len(result.Items))

	if len(result.Items) == 0 {
		return "", fmt.Errorf("invalid API key")
	}

	if len(result.Items) > 1 {
		return "", fmt.Errorf("multiple users found with same API key - data integrity issue")
	}

	var userItem UserItem
	if err := attributevalue.UnmarshalMap(result.Items[0], &userItem); err != nil {
		return "", fmt.Errorf("failed to unmarshal user item: %w", err)
	}

	// Check if user is active (simplified check without DynamoDB filter)
	if !userItem.IsActive {
		return "", fmt.Errorf("user account is inactive")
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
