import os  # To access environment variables
import json
import boto3
import uuid
from datetime import datetime
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')

exercises_table_name = os.environ['EXERCISES_TABLE']
sets_table_name = os.environ['SETS_TABLE']

exercises_table = dynamodb.Table(exercises_table_name)
sets_table = dynamodb.Table(sets_table_name)

def response_with_cors(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',  
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',  
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }

def main(event, context):
    try:
        if event['httpMethod'] == 'GET':
            return response_with_cors(200, get_exercises())

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
    response = exercises_table.scan()
    exercises = [item['exerciseName'] for item in response['Items']]

    return {
        'statusCode': 200,
        'body': json.dumps(exercises)
    }

def add_exercise(body):
    exercise_name = body['exerciseName']

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
    workout_id = str(uuid.uuid4())
    
    timestamp = int(datetime.utcnow().timestamp())

    exercise = body['exercise']
    reps = body['reps']
    sets = body['sets']
    
    weight = Decimal(str(body['weight']))

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

def pop_last_set():
    """
    Fetches the most recent workout set (based on timestamp) and deletes it.
    """
    try:
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