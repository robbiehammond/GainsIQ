import os  # To access environment variables
import json
import boto3
import uuid
from datetime import datetime

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')

# Get table names from environment variables
exercises_table_name = os.environ['EXERCISES_TABLE']
sets_table_name = os.environ['SETS_TABLE']

# Reference to the DynamoDB tables using environment variables
exercises_table = dynamodb.Table(exercises_table_name)
sets_table = dynamodb.Table(sets_table_name)

def response_with_cors(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',  # Allow all origins
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',  # Allowed methods
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }

def main(event, context):
    try:
        # Handle GET request to fetch exercises
        if event['httpMethod'] == 'GET':
            return response_with_cors(200, get_exercises())

        # Handle POST requests
        body = json.loads(event['body'])
        if 'exerciseName' in body:
            return response_with_cors(200, add_exercise(body))
        elif 'exercise' in body and 'reps' in body and 'sets' in body and 'weight' in body:
            return response_with_cors(200, log_set(body))
        else:
            return response_with_cors(400, 'Invalid request')

    except Exception as e:
        return response_with_cors(500, f"Error: {str(e)}")

def get_exercises():
    # Scan the ExercisesTable to get all exercises
    response = exercises_table.scan()
    exercises = [item['exerciseName'] for item in response['Items']]

    return {
        'statusCode': 200,
        'body': json.dumps(exercises)
    }

def add_exercise(body):
    # Extract the exercise name
    exercise_name = body['exerciseName']

    # Add the exercise to the DynamoDB table
    exercises_table.put_item(
        Item={
            'exerciseName': exercise_name
        }
    )

    return {
        'statusCode': 200,
        'body': json.dumps(f'Exercise {exercise_name} added successfully')
    }

def log_set(body):
    # Generate a unique ID for the workout set
    workout_id = str(uuid.uuid4())
    
    # Get the current timestamp
    timestamp = int(datetime.utcnow().timestamp())

    # Extract details from the request body
    exercise = body['exercise']
    reps = body['reps']
    sets = body['sets']
    weight = body['weight']

    # Add the set to the DynamoDB table
    sets_table.put_item(
        Item={
            'workoutId': workout_id,
            'timestamp': timestamp,
            'exercise': exercise,
            'reps': reps,
            'sets': sets,
            'weight': weight
        }
    )

    return {
        'statusCode': 200,
        'body': json.dumps(f'Set for {exercise} logged successfully')
    }