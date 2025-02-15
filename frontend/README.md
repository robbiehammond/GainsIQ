# Overview
## Development 
### Making Components 
See `components/sample_button` for how to do this. In short, create a folder with the component logic and css, then you can import it elsewhere. Components should only be for clearly visible things; `models/` is where to put non-visual, more abstract things (i.e. data structures for things like a Set to submit to the API).


## Testing 
To ensure my real data isn't tampered with when testing I made a preprod endpoint at https://winhi1fmi8.execute-api.us-west-2.amazonaws.com/prod. Adding this line:
```
REACT_APP_API_URL_PREPROD=https://winhi1fmi8.execute-api.us-west-2.amazonaws.com/prod
```
to the `.env` file you need to make will make it so the preprod endpoint is used if you do `npm run build:preprod` or `npm run start:preprod`. Feel free to add trash data to this, it doesn't matter. As described in the top-level README, to make your own endpoint, you'll have to do a double deploy where REACT_APP_API_URL is set to the URL of your deployed backend.

## SDK
The code that handles the client-server communication has been stripped out into it's own repo, which can be found here: https://github.com/robbiehammond/gainsiq-sdk. When the backend is updated with some new APIs, the SDK will need to be updated as well.