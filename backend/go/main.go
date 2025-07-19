package main

import (
	"context"
	"encoding/json"
	"log"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

var (
	ddbClient          *dynamodb.Client
	sqsClient          *sqs.Client
	exercisesTableName string
	setsTableName      string
	weightTableName    string
	analysesTableName  string
	usersTableName     string
	queueURL           string
	apiKeyMapVar       map[string]string
	cognitoUserPoolID  string
	cognitoClientID    string
	cognitoRegion      string
)

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
	usersTableName = os.Getenv("USERS_TABLE")
	if usersTableName == "" {
		log.Fatal("USERS_TABLE environment variable not set")
	}
	queueURL = os.Getenv("QUEUE_URL")
	if queueURL == "" {
		log.Fatal("QUEUE_URL environment variable not set")
	}

	cognitoUserPoolID = os.Getenv("COGNITO_USER_POOL_ID")
	if cognitoUserPoolID == "" {
		log.Fatal("COGNITO_USER_POOL_ID environment variable not set")
	}
	cognitoClientID = os.Getenv("COGNITO_USER_POOL_CLIENT_ID")
	if cognitoClientID == "" {
		log.Fatal("COGNITO_USER_POOL_CLIENT_ID environment variable not set")
	}
	
	cognitoRegion = os.Getenv("AWS_REGION")
	if cognitoRegion == "" {
		cognitoRegion = "us-west-2"
		log.Printf("WARN: AWS_REGION not set, defaulting to %s", cognitoRegion)
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


func main() {
	lambda.Start(handler)
}
