package main

import (
	"context"
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
    injuriesTableName  string
    bodypartsTableName string
    queueURL           string
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
    injuriesTableName = os.Getenv("INJURIES_TABLE")
    if injuriesTableName == "" {
        log.Fatal("INJURIES_TABLE environment variable not set")
    }
    bodypartsTableName = os.Getenv("BODYPARTS_TABLE")
    if bodypartsTableName == "" {
        log.Fatal("BODYPARTS_TABLE environment variable not set")
    }
    queueURL = os.Getenv("QUEUE_URL")
    if queueURL == "" {
        log.Fatal("QUEUE_URL environment variable not set")
    }
}


func main() {
	lambda.Start(handler)
}
