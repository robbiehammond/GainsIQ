import boto3
import json
import os
from datetime import datetime
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')

def decimal_default(obj):
    """JSON serializer for Decimal objects"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

def lambda_handler(event, context):
    try:
        table_name = os.environ['OURA_SLEEP_TABLE']
        table = dynamodb.Table(table_name)
        
        date = event.get('date')
        sleep_data = event.get('sleep_data')
        
        if not date:
            raise Exception("Date is required")
        
        if not sleep_data:
            # No sleep data to store - this is valid
            print(f"No sleep data to store for date: {date}")
            return {
                'date': date,
                'action': 'skipped',
                'message': 'No sleep data to store'
            }
        
        # Convert float values to Decimal for DynamoDB
        def convert_to_decimal(obj):
            if isinstance(obj, dict):
                return {k: convert_to_decimal(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_decimal(v) for v in obj]
            elif isinstance(obj, float):
                return Decimal(str(obj))
            else:
                return obj
        
        # Prepare item for DynamoDB
        item = {
            'date': date,
            'sleep_session_id': sleep_data.get('sleep_session_id'),
            'day': sleep_data.get('day'),
            'bedtime_start': sleep_data.get('bedtime_start'),
            'bedtime_end': sleep_data.get('bedtime_end'),
            'duration': sleep_data.get('duration'),
            'total_sleep_duration': sleep_data.get('total_sleep_duration'),
            'awake_duration': sleep_data.get('awake_duration'),
            'light_sleep_duration': sleep_data.get('light_sleep_duration'),
            'deep_sleep_duration': sleep_data.get('deep_sleep_duration'),
            'rem_sleep_duration': sleep_data.get('rem_sleep_duration'),
            'sleep_score': sleep_data.get('sleep_score'),
            'sleep_efficiency': sleep_data.get('sleep_efficiency'),
            'sleep_latency': sleep_data.get('sleep_latency'),
            'sleep_restlessness': sleep_data.get('sleep_restlessness'),
            'sleep_timing': sleep_data.get('sleep_timing'),
            'heart_rate': sleep_data.get('heart_rate'),
            'hrv': sleep_data.get('hrv'),
            'temperature_delta': sleep_data.get('temperature_delta'),
            'breathing_disturbances': sleep_data.get('breathing_disturbances'),
            'restless_periods': sleep_data.get('restless_periods'),
            'type': sleep_data.get('type'),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        # Remove None values
        item = {k: v for k, v in item.items() if v is not None}
        
        # Convert to Decimal where needed
        item = convert_to_decimal(item)
        
        # Store in DynamoDB
        table.put_item(Item=item)
        
        print(f"Successfully stored sleep data for {date}")
        
        return {
            'date': date,
            'action': 'stored',
            'message': 'Sleep data successfully stored',
            'item_keys': list(item.keys())
        }
        
    except Exception as e:
        print(f"Error in store_data: {str(e)}")
        raise Exception(f"StoreDataError: {str(e)}")