package main

import (
   "context"
   "encoding/json"
   "log"

   "github.com/aws/aws-lambda-go/events"
   "github.com/aws/aws-lambda-go/lambda"
)

// handler processes API Gateway proxy requests and returns a stub response.
func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
   message := map[string]string{
       "message": "Hello from Go backend",
       "path":    req.Path,
       "method":  req.HTTPMethod,
   }
   body, err := json.Marshal(message)
   if err != nil {
       log.Printf("Error marshalling response: %v", err)
       return events.APIGatewayProxyResponse{StatusCode: 500}, nil
   }
   return events.APIGatewayProxyResponse{
       StatusCode: 200,
       Body:       string(body),
       Headers: map[string]string{
           "Content-Type": "application/json",
       },
   }, nil
}

func main() {
   lambda.Start(handler)
}