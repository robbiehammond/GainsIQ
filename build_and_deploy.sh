cd frontend
npm install
npm run build:preprod
cd ..
#cd backend
#cargo lambda build --release --arm64 
#cd .. 
echo "Building Go Lambda for preprod environment"
cd backend/go
GOOS=linux GOARCH=amd64 go build -ldflags=\"-s -w\" -o main main.go
cd ../..
cdk deploy -c env=preprod