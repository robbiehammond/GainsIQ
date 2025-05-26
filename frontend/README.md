## Testing 
To ensure my real data isn't tampered with when testing I made a preprod endpoint at https://winhi1fmi8.execute-api.us-west-2.amazonaws.com/prod. Adding this line:
```
REACT_APP_API_URL_PREPROD=https://winhi1fmi8.execute-api.us-west-2.amazonaws.com/prod
```
to the `.env` file you need to make will make it so the preprod endpoint is used if you do `npm run build:preprod` or `npm run start:preprod`. Feel free to add trash data to this, it doesn't matter. As described in the top-level README, to make your own endpoint, you'll have to do a double deploy where REACT_APP_API_URL is set to the URL of your deployed backend.
