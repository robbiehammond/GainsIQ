cd frontend
npm install
npm run build
cd ..
cd backend
cargo lambda build --release --arm64 
cd .. 
cdk deploy