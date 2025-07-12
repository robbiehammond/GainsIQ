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

def validate_sleep_data(sleep_data):
    """Validate a single sleep session"""
    try:
        date = sleep_data.get('date')
        
        if not date:
            return False, "Date is required"
        
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return False, "Invalid date format. Expected YYYY-MM-DD"
        
        # Validate sleep duration values (should be positive integers if present)
        duration_fields = [
            'duration', 'total_sleep_duration', 'awake_duration', 
            'light_sleep_duration', 'deep_sleep_duration', 'rem_sleep_duration'
        ]
        
        for field in duration_fields:
            value = sleep_data.get(field)
            if value is not None:
                try:
                    duration_value = int(value)
                    if duration_value < 0:
                        return False, f"{field} cannot be negative"
                except (ValueError, TypeError):
                    return False, f"{field} must be a valid integer"
        
        # Validate sleep score (should be between 0-100 if present)
        sleep_score = sleep_data.get('sleep_score')
        if sleep_score is not None:
            try:
                score = int(sleep_score)
                if score < 0 or score > 100:
                    return False, "sleep_score must be between 0 and 100"
            except (ValueError, TypeError):
                return False, "sleep_score must be a valid integer"
        
        # Validate sleep efficiency (should be between 0-100 if present)
        sleep_efficiency = sleep_data.get('sleep_efficiency')
        if sleep_efficiency is not None:
            try:
                efficiency = float(sleep_efficiency)
                if efficiency < 0 or efficiency > 100:
                    return False, "sleep_efficiency must be between 0 and 100"
            except (ValueError, TypeError):
                return False, "sleep_efficiency must be a valid number"
        
        # Validate heart rate (should be reasonable if present)
        heart_rate = sleep_data.get('heart_rate')
        if heart_rate is not None:
            try:
                hr = int(heart_rate)
                if hr < 30 or hr > 200:
                    return False, "heart_rate must be between 30 and 200"
            except (ValueError, TypeError):
                return False, "heart_rate must be a valid integer"
        
        return True, "Valid"
        
    except Exception as e:
        return False, str(e)

def convert_to_decimal(obj):
    """Convert float values to Decimal for DynamoDB"""
    if isinstance(obj, dict):
        return {k: convert_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_decimal(v) for v in obj]
    elif isinstance(obj, float):
        return Decimal(str(obj))
    else:
        return obj

def store_sleep_data(table, sleep_data):
    """Store a single sleep session in DynamoDB"""
    try:
        # Prepare item for DynamoDB
        item = {
            'date': sleep_data.get('date'),
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
        
        return True, "Stored successfully"
        
    except Exception as e:
        return False, str(e)

def lambda_handler(event, context):
    try:
        table_name = os.environ['OURA_SLEEP_TABLE']
        table = dynamodb.Table(table_name)
        
        sleep_sessions = event.get('sleep_sessions', [])
        missing_dates = event.get('missing_dates', [])
        start_date = event.get('start_date')
        end_date = event.get('end_date')
        
        print(f"Processing {len(sleep_sessions)} sleep sessions for dates {start_date} to {end_date}")
        
        results = {
            'processed_sessions': 0,
            'stored_sessions': 0,
            'validation_errors': 0,
            'storage_errors': 0,
            'dates_with_data': [],
            'dates_without_data': [],
            'errors': []
        }
        
        # Track which dates have sleep data
        dates_with_sleep_data = set()
        
        # Process each sleep session
        for sleep_session in sleep_sessions:
            results['processed_sessions'] += 1
            date = sleep_session.get('date')
            
            # Validate sleep data
            is_valid, validation_message = validate_sleep_data(sleep_session)
            
            if not is_valid:
                results['validation_errors'] += 1
                results['errors'].append({
                    'date': date,
                    'type': 'validation_error',
                    'message': validation_message
                })
                print(f"Validation error for {date}: {validation_message}")
                continue
            
            # Store sleep data
            stored_successfully, store_message = store_sleep_data(table, sleep_session)
            
            if stored_successfully:
                results['stored_sessions'] += 1
                dates_with_sleep_data.add(date)
                results['dates_with_data'].append(date)
                print(f"Successfully stored sleep data for {date}")
            else:
                results['storage_errors'] += 1
                results['errors'].append({
                    'date': date,
                    'type': 'storage_error',
                    'message': store_message
                })
                print(f"Storage error for {date}: {store_message}")
        
        # Identify dates that were missing and still don't have data
        results['dates_without_data'] = [
            date for date in missing_dates 
            if date not in dates_with_sleep_data
        ]
        
        print(f"Processing complete: {results['stored_sessions']} sessions stored, {len(results['dates_without_data'])} dates still missing data")
        
        return {
            'success': True,
            'start_date': start_date,
            'end_date': end_date,
            'results': results
        }
        
    except Exception as e:
        print(f"Error in process_and_store: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'start_date': event.get('start_date'),
            'end_date': event.get('end_date')
        }