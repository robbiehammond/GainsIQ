import os
import json
import boto3
import http.client
import ssl
from decimal import Decimal
import datetime

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')

# Get environment variables
sets_table_name = os.environ['SETS_TABLE']
s3_bucket_name = os.environ['S3_BUCKET_NAME']
openai_api_key = os.environ['OPENAI_API_KEY']
sns_topic_arn = os.environ['SNS_TOPIC_ARN']  # SNS topic ARN for sending notifications

# Reference to DynamoDB table
sets_table = dynamodb.Table(sets_table_name)

def lambda_handler(event, context):
    # Get last month's workout data
    workout_data = get_last_month_data()
    
    # Generate the prompt for the OpenAI API
    prompt = generate_prompt(workout_data)
    
    # Send the prompt to OpenAI and get the response
    analysis = call_openai_api(prompt)
    
    # Save the analysis to S3 (optional)
    save_analysis_to_s3(analysis)
    
    # Send the analysis via SNS
    send_via_sns(analysis)
    
    return {
        'statusCode': 200,
        'body': json.dumps('Analysis completed and sent successfully via SNS.')
    }

def get_last_month_data():
    """
    Collects all workout data from the last month from DynamoDB.
    """
    now = datetime.datetime.utcnow()
    last_month = now - datetime.timedelta(days=30)
    last_month_timestamp = int(last_month.timestamp())

    # Query to get items from the last 30 days
    response = sets_table.scan(
        FilterExpression="#ts >= :last_month",
        ExpressionAttributeNames={"#ts": "timestamp"},
        ExpressionAttributeValues={":last_month": last_month_timestamp}
    )

    items = response.get('Items', [])
    return items

def generate_prompt(workout_data):
    prompt = "Analyze the following workout data for trends and performance improvements over the last month:\n"
    
    for workout in workout_data:
        exercise = workout.get('exercise', 'Unknown Exercise')
        sets = workout.get('sets', 0)
        reps = workout.get('reps', 0)
        weight = workout.get('weight', Decimal(0))
        timestamp = datetime.datetime.fromtimestamp(workout.get('timestamp', 0)).strftime('%Y-%m-%d')
        
        prompt += f"- {exercise}: {sets} sets, {reps} reps, {weight} lbs on {timestamp}\n"
    
    prompt += "\nProvide an analysis of progress, areas for improvement, and any trends over time."
    
    return prompt

def call_openai_api(prompt):
    """
    Sends the prompt to the OpenAI API using `http.client` and returns the generated analysis.
    """
    conn = http.client.HTTPSConnection("api.openai.com", context=ssl.create_default_context())
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {openai_api_key}'
    }
    
    data = json.dumps({
        "model": "gpt-4o-mini",  # Use the correct GPT model
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7  # Adjust temperature for creativity of responses
    })
    
    conn.request("POST", "/v1/chat/completions", body=data, headers=headers)
    
    response = conn.getresponse()
    response_data = response.read().decode("utf-8")
    
    if response.status == 200:
        result = json.loads(response_data)
        return result['choices'][0]['message']['content']
    else:
        raise Exception(f"Error from OpenAI API: {response_data}")

def save_analysis_to_s3(analysis):
    """
    Saves the analysis to S3 for record-keeping.
    """
    s3 = boto3.client('s3')
    now = datetime.datetime.utcnow().strftime('%Y-%m-%d-%H-%M-%S')
    file_name = f"analysis/analysis-{now}.txt"
    
    s3.put_object(
        Bucket=s3_bucket_name,
        Key=file_name,
        Body=analysis,
        ContentType='text/plain'
    )

def send_via_sns(analysis):
    """
    Sends the analysis via Amazon SNS.
    """
    subject = "Monthly Workout Analysis"
    message = f"Here is your workout analysis for the past month:\n\n{analysis}"
    
    # Send the message to the SNS topic
    response = sns.publish(
        TopicArn=sns_topic_arn,
        Subject=subject,
        Message=message
    )
    
    return response