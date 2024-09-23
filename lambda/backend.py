import os  # To access environment variables
import json
import boto3
import uuid
from datetime import datetime
from decimal import Decimal

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
        elif body.get('action') == 'pop_last_set': 
            return response_with_cors(200, pop_last_set())
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
    
    # Convert weight to Decimal to avoid the float issue
    weight = Decimal(str(body['weight']))

    # Add the set to the DynamoDB table
    sets_table.put_item(
        Item={
            'workoutId': workout_id,
            'timestamp': timestamp,
            'exercise': exercise,
            'reps': reps,
            'sets': sets,
            'weight': weight  # Ensure weight is stored as Decimal
        }
    )

    return {
        'statusCode': 200,
        'body': json.dumps(f'Set for {exercise} logged successfully')
    }

def pop_last_set():
    """
    Fetches the most recent workout set (based on timestamp) and deletes it.
    """
    try:
        # Scan the sets table to find the most recent set (sorted by timestamp manually in code)
        response = sets_table.scan(
            FilterExpression="attribute_exists(#ts)",
            ExpressionAttributeNames={"#ts": "timestamp"}
        )

        items = response.get('Items', [])

        if not items:
            return {
                'statusCode': 404,
                'body': json.dumps('No set found to delete')
            }

        # Find the most recent set by sorting in code
        most_recent_set = max(items, key=lambda x: x['timestamp'])
        workout_id = most_recent_set['workoutId']
        timestamp = most_recent_set['timestamp']

        # Delete the most recent set
        sets_table.delete_item(
            Key={
                'workoutId': workout_id,
                'timestamp': timestamp
            }
        )

        return {
            'statusCode': 200,
            'body': json.dumps(f'Successfully deleted last set for {most_recent_set["exercise"]}')
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps(f"Error deleting last set: {str(e)}")
        }