cd frontend
npm install
npm run build:preprod
cd ..
cd backend
cargo lambda build --release --arm64 
cd .. 
cdk deploy -c env=preprod