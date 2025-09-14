package main

import (
	"encoding/json"
	"log"

	"github.com/aws/aws-lambda-go/events"
)


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