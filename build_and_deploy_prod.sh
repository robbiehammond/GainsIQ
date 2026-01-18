echo "Building Go Lambda for prod environment"
cd backend/go
GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o bootstrap .
cd ../..
echo "Building frontend (Vite/React)"
cd frontend
npm ci && npm run build
cd ..
cdk deploy
