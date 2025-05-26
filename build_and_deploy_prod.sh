echo "Building TS frontend code for prod environment"
cd frontend
npm install
npm run build
cd ..
echo "Building Go Lambda for prod environment"
cd backend/go
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bootstrap main.go
cd ../..
cdk deploy