# GainsIQ

## What is this?
A simple web-based workout tracker. You'll get sent a monthly email summary of your progress, analyzed by an LLM.

## Deploying 
Before you can do `cdk deploy`, you must do a few things:
 - Create a config.json file in the top-level directory. This is used by the CDK stack. It needs the following format: 
```
{
    "email": "YOUR EMAIL",
    "openai_key": "YOUR OPENAI API KEY"
}
```
- Next, build the backend. `cargo lambda build --release --arm64` will do this for you.
- Next, build the frontend. This can be done via `npm run build`. 

After this, you can deploy. Note that the site won't be connected to your backend yet. This is because you'll need to the API URL (you can get this from API Gateway) for the frontend. Create a .env file in the frontend directory like the following:
```
REACT_APP_API_URL=https://blahblahblah.execute-api.us-west-2.amazonaws.com/prod
```
Rebuild the frontend again and then deploy.

Note there's a script `build_and_deploy_prod.sh` that will do most of this for you. You'll still have to double-deploy; 
just run the script again after fetching the app url.

## Design
Just so I remember vaguely how this works:
![](doc/GainsIQ.png)

A note: You can deploy a preprod and a prod version. Here's how that kinda works:
- duplicated prod stack (via the `build_and_deploy.sh` script)
- After initial deploy frontend was still pointing to prod backend. Need to add `REACT_APP_API_URL_PREPROD={preprod endpoint}` to the frontend `.env` for it to be pointing to the right thing. After this, the preprod stack is fully "preprod".
- Both stacks have the same components; only code difference is the names of the stuff declared in the stack and the API URL in the frontend to point the the preprod backend.

## Task Backlog (vaguely ordered in terms of importance)
- Redesign frontend so it doesn't look so bad
- Rename "sets" column to "set_number" or "setNumber"
- Make it so double deploy doesn't need to happen first time (pass APIGW URL to frontend one deploy)