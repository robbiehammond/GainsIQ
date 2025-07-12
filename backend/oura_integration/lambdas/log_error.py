import json
import os
from datetime import datetime

def lambda_handler(event, context):
    try:
        error_type = event.get('error_type', 'unknown')
        error_details = event.get('error', {})
        date = event.get('date')
        
        # Log error details
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'error_type': error_type,
            'date': date,
            'error_details': error_details,
            'context': context.__dict__ if context else {}
        }
        
        print(f"OURA_SYNC_ERROR: {json.dumps(log_entry, default=str)}")
        
        # In the future, this could:
        # - Send to SNS for alerting
        # - Store in a dedicated errors table
        # - Send to CloudWatch as custom metrics
        # - Integrate with external monitoring systems
        
        return {
            'message': f'Error logged: {error_type}',
            'error_type': error_type,
            'date': date
        }
        
    except Exception as e:
        print(f"Error in log_error: {str(e)}")
        # Even if logging fails, we don't want to break the step function
        return {
            'message': f'Failed to log error: {str(e)}',
            'original_error_type': event.get('error_type', 'unknown')
        }