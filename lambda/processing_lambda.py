import boto3
from datetime import datetime, timedelta
import json
import os

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')

# Initialize SageMaker client
sagemaker = boto3.client('sagemaker')

# DynamoDB table names from environment variables
sets_table = dynamodb.Table(os.environ['SETS_TABLE'])
exercises_table = dynamodb.Table(os.environ['EXERCISES_TABLE'])

# SageMaker model name from environment variable
model_name = os.environ['SAGEMAKER_MODEL_NAME']

def get_last_month_data():
    # Get the timestamp for the first day of the previous month
    today = datetime.utcnow()
    first_day_of_current_month = today.replace(day=1)
    first_day_of_last_month = (first_day_of_current_month - timedelta(days=1)).replace(day=1)
    
    # Query the SetsTable for data from last month
    response = sets_table.scan(
        FilterExpression='#ts >= :start and #ts < :end',
        ExpressionAttributeNames={
            '#ts': 'timestamp'  # Alias 'timestamp' to avoid reserved keyword issue
        },
        ExpressionAttributeValues={
            ':start': int(first_day_of_last_month.timestamp()),
            ':end': int(first_day_of_current_month.timestamp())
        }
    )
    
    return response['Items']

def trigger_sagemaker(data):
    # Convert data to JSON
    input_data = json.dumps(data)
    
    # Upload data to S3 or pass it as input directly
    # Here we assume you're uploading to S3
    s3_client = boto3.client('s3')
    bucket_name = os.environ['S3_BUCKET_NAME']
    s3_key = 'workout_data/input_data.json'
    s3_client.put_object(Body=input_data, Bucket=bucket_name, Key=s3_key)

    # Create a SageMaker processing job
    response = sagemaker.create_processing_job(
        ProcessingJobName=f'gainsiq-processing-{datetime.now().strftime("%Y%m%d%H%M%S")}',
        ProcessingInputs=[
            {
                'InputName': 'input_data',
                'S3Input': {
                    'S3Uri': f's3://{bucket_name}/{s3_key}',
                    'LocalPath': '/opt/ml/processing/input',
                    'S3DataType': 'S3Prefix',
                    'S3InputMode': 'File',
                }
            }
        ],
        ProcessingOutputConfig={
            'Outputs': [
                {
                    'OutputName': 'results',
                    'S3Output': {
                        'S3Uri': f's3://{bucket_name}/workout_data/results/',
                        'LocalPath': '/opt/ml/processing/output',
                        'S3UploadMode': 'EndOfJob'
                    }
                }
            ]
        },
        ProcessingResources={
            'ClusterConfig': {
                'InstanceCount': 1,
                'InstanceType': 'ml.m5.xlarge',
                'VolumeSizeInGB': 30
            }
        },
        AppSpecification={
            'ImageUri': '174872318107.dkr.ecr.us-west-2.amazonaws.com/linear-learner:latest',  # Adjust this with your SageMaker model
        },
        RoleArn=os.environ['SAGEMAKER_ROLE_ARN']
    )
    
    return response

def lambda_handler(event, context):
    # Step 1: Get last month's data
    data = get_last_month_data()
    
    # Step 2: Trigger SageMaker analysis
    sagemaker_response = trigger_sagemaker(data)
    
    return {
        'statusCode': 200,
        'body': json.dumps(sagemaker_response)
    }