echo "Building Go Lambda for preprod environment"
cd backend/go
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bootstrap .
EXERCISES_TABLE=test SETS_TABLE=test WEIGHT_TABLE=test ANALYSES_TABLE=test QUEUE_URL=test API_KEY_MAP='{}' go test -v
cd ../..
cdk deploy -c env=preprod