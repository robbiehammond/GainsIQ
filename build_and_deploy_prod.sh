echo "Building Go Lambda for prod environment"
cd backend/go
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bootstrap .
cd ../..
cdk deploy