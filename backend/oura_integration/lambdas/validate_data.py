import json
from datetime import datetime

def lambda_handler(event, context):
    try:
        date = event.get('date')
        sleep_data = event.get('sleep_data')
        
        if not date:
            raise Exception("ValidationError: Date is required")
        
        if not sleep_data:
            # No sleep data available - this is valid, just pass through
            return {
                'date': date,
                'sleep_data': None,
                'validation_status': 'no_data',
                'message': 'No sleep data to validate'
            }
        
        # Validate required fields
        required_fields = ['date', 'sleep_session_id', 'day']
        missing_fields = [field for field in required_fields if not sleep_data.get(field)]
        
        if missing_fields:
            raise Exception(f"ValidationError: Missing required fields: {missing_fields}")
        
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            raise Exception("ValidationError: Invalid date format. Expected YYYY-MM-DD")
        
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
                        raise Exception(f"ValidationError: {field} cannot be negative")
                except (ValueError, TypeError):
                    raise Exception(f"ValidationError: {field} must be a valid integer")
        
        # Validate sleep score (should be between 0-100 if present)
        sleep_score = sleep_data.get('sleep_score')
        if sleep_score is not None:
            try:
                score = int(sleep_score)
                if score < 0 or score > 100:
                    raise Exception("ValidationError: sleep_score must be between 0 and 100")
            except (ValueError, TypeError):
                raise Exception("ValidationError: sleep_score must be a valid integer")
        
        # Validate sleep efficiency (should be between 0-100 if present)
        sleep_efficiency = sleep_data.get('sleep_efficiency')
        if sleep_efficiency is not None:
            try:
                efficiency = float(sleep_efficiency)
                if efficiency < 0 or efficiency > 100:
                    raise Exception("ValidationError: sleep_efficiency must be between 0 and 100")
            except (ValueError, TypeError):
                raise Exception("ValidationError: sleep_efficiency must be a valid number")
        
        # Validate heart rate (should be reasonable if present)
        heart_rate = sleep_data.get('heart_rate')
        if heart_rate is not None:
            try:
                hr = int(heart_rate)
                if hr < 30 or hr > 200:
                    raise Exception("ValidationError: heart_rate must be between 30 and 200")
            except (ValueError, TypeError):
                raise Exception("ValidationError: heart_rate must be a valid integer")
        
        # Validate bedtime timestamps if present
        bedtime_start = sleep_data.get('bedtime_start')
        bedtime_end = sleep_data.get('bedtime_end')
        
        if bedtime_start:
            try:
                start_time = datetime.fromisoformat(bedtime_start.replace('Z', '+00:00'))
            except ValueError:
                raise Exception("ValidationError: Invalid bedtime_start format")
        
        if bedtime_end:
            try:
                end_time = datetime.fromisoformat(bedtime_end.replace('Z', '+00:00'))
            except ValueError:
                raise Exception("ValidationError: Invalid bedtime_end format")
        
        # If both bedtime_start and bedtime_end are present, validate order
        if bedtime_start and bedtime_end:
            try:
                start_time = datetime.fromisoformat(bedtime_start.replace('Z', '+00:00'))
                end_time = datetime.fromisoformat(bedtime_end.replace('Z', '+00:00'))
                
                # Account for sleep spanning midnight
                if end_time < start_time:
                    # This is normal for sleep that spans midnight
                    pass
                elif (end_time - start_time).total_seconds() > 24 * 60 * 60:
                    raise Exception("ValidationError: Sleep duration cannot exceed 24 hours")
            except ValueError:
                raise Exception("ValidationError: Invalid bedtime timestamp format")
        
        print(f"Successfully validated sleep data for {date}")
        
        return {
            'date': date,
            'sleep_data': sleep_data,
            'validation_status': 'valid',
            'message': 'Sleep data validation passed'
        }
        
    except Exception as e:
        print(f"Error in validate_data: {str(e)}")
        if "ValidationError" in str(e):
            raise Exception(str(e))
        else:
            raise Exception(f"ValidationError: {str(e)}")