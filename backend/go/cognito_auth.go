package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	dynamodbTypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

var cognitoClient *cognitoidentityprovider.Client

func initCognitoClient() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("Unable to load SDK config for Cognito, %v", err)
	}
	cognitoClient = cognitoidentityprovider.NewFromConfig(cfg)
}

func registerUser(username, password string, email, givenName, familyName *string) error {
	if cognitoClient == nil {
		initCognitoClient()
	}

	// Build user attributes dynamically based on provided fields
	var userAttributes []types.AttributeType

	if email != nil && *email != "" {
		userAttributes = append(userAttributes, types.AttributeType{
			Name:  aws.String("email"),
			Value: aws.String(*email),
		})
		// Only set email_verified if email is provided
		userAttributes = append(userAttributes, types.AttributeType{
			Name:  aws.String("email_verified"),
			Value: aws.String("true"),
		})
	}

	if givenName != nil && *givenName != "" {
		userAttributes = append(userAttributes, types.AttributeType{
			Name:  aws.String("given_name"),
			Value: aws.String(*givenName),
		})
	}

	if familyName != nil && *familyName != "" {
		userAttributes = append(userAttributes, types.AttributeType{
			Name:  aws.String("family_name"),
			Value: aws.String(*familyName),
		})
	}

	input := &cognitoidentityprovider.AdminCreateUserInput{
		UserPoolId:        aws.String(cognitoUserPoolID),
		Username:          aws.String(username),
		UserAttributes:    userAttributes,
		TemporaryPassword: aws.String(password),
		MessageAction:     types.MessageActionTypeSuppress, // Don't send welcome email
	}

	_, err := cognitoClient.AdminCreateUser(context.TODO(), input)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	// Set permanent password
	setPasswordInput := &cognitoidentityprovider.AdminSetUserPasswordInput{
		UserPoolId: aws.String(cognitoUserPoolID),
		Username:   aws.String(username),
		Password:   aws.String(password),
		Permanent:  true,
	}

	_, err = cognitoClient.AdminSetUserPassword(context.TODO(), setPasswordInput)
	if err != nil {
		return fmt.Errorf("failed to set user password: %w", err)
	}

	return nil
}

func loginUser(username, password string) (*types.AuthenticationResultType, error) {
	if cognitoClient == nil {
		initCognitoClient()
	}

	input := &cognitoidentityprovider.AdminInitiateAuthInput{
		UserPoolId: aws.String(cognitoUserPoolID),
		ClientId:   aws.String(cognitoClientID),
		AuthFlow:   types.AuthFlowTypeAdminNoSrpAuth,
		AuthParameters: map[string]string{
			"USERNAME": username,
			"PASSWORD": password,
		},
	}

	result, err := cognitoClient.AdminInitiateAuth(context.TODO(), input)
	if err != nil {
		return nil, fmt.Errorf("authentication failed: %w", err)
	}

	return result.AuthenticationResult, nil
}

func refreshToken(refreshToken string) (*types.AuthenticationResultType, error) {
	if cognitoClient == nil {
		initCognitoClient()
	}

	input := &cognitoidentityprovider.AdminInitiateAuthInput{
		UserPoolId: aws.String(cognitoUserPoolID),
		ClientId:   aws.String(cognitoClientID),
		AuthFlow:   types.AuthFlowTypeRefreshTokenAuth,
		AuthParameters: map[string]string{
			"REFRESH_TOKEN": refreshToken,
		},
	}

	result, err := cognitoClient.AdminInitiateAuth(context.TODO(), input)
	if err != nil {
		return nil, fmt.Errorf("token refresh failed: %w", err)
	}

	return result.AuthenticationResult, nil
}

func getUserInfo(accessToken string) (*cognitoidentityprovider.GetUserOutput, error) {
	if cognitoClient == nil {
		initCognitoClient()
	}

	input := &cognitoidentityprovider.GetUserInput{
		AccessToken: aws.String(accessToken),
	}

	result, err := cognitoClient.GetUser(context.TODO(), input)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}

	return result, nil
}

func createUserProfile(userID string, email, givenName, familyName *string) error {
	timestamp := time.Now().Unix()
	item := map[string]dynamodbTypes.AttributeValue{
		"userId":    &dynamodbTypes.AttributeValueMemberS{Value: userID},
		"createdAt": &dynamodbTypes.AttributeValueMemberN{Value: fmt.Sprintf("%d", timestamp)},
		"updatedAt": &dynamodbTypes.AttributeValueMemberN{Value: fmt.Sprintf("%d", timestamp)},
	}

	// Add optional fields only if provided
	if email != nil && *email != "" {
		item["email"] = &dynamodbTypes.AttributeValueMemberS{Value: *email}
	}

	if givenName != nil && *givenName != "" {
		item["givenName"] = &dynamodbTypes.AttributeValueMemberS{Value: *givenName}
	}

	if familyName != nil && *familyName != "" {
		item["familyName"] = &dynamodbTypes.AttributeValueMemberS{Value: *familyName}
	}

	_, err := ddbClient.PutItem(context.TODO(), &dynamodb.PutItemInput{
		TableName: aws.String(usersTableName),
		Item:      item,
	})
	if err != nil {
		return fmt.Errorf("failed to create user profile: %w", err)
	}
	return nil
}
