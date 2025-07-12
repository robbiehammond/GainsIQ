import json
from datetime import datetime

def lambda_handler(event, context):
    try:
        # Extract summary information from the step function execution
        check_result = event.get('checkResult', {}).get('Payload', {})
        batch_results = event.get('batchResults', [])
        
        # Count successful and failed batch processing
        successful_batches = []
        failed_batches = []
        total_sessions_processed = 0
        total_sessions_stored = 0
        
        for batch_result in batch_results:
            if isinstance(batch_result, dict):
                if batch_result.get('status') == 'success':
                    successful_batches.append(batch_result)
                    # If we have processing results, extract session counts
                    if 'Payload' in batch_result and 'results' in batch_result['Payload']:
                        results = batch_result['Payload']['results']
                        total_sessions_processed += results.get('processed_sessions', 0)
                        total_sessions_stored += results.get('stored_sessions', 0)
                elif batch_result.get('status') == 'failed':
                    failed_batches.append(batch_result)
        
        # Get actual count from DynamoDB to verify what was stored
        try:
            import boto3
            import os
            dynamodb = boto3.resource('dynamodb')
            table_name = os.environ.get('OURA_SLEEP_TABLE')
            if table_name:
                table = dynamodb.Table(table_name)
                scan_response = table.scan(Select='COUNT')
                actual_records_in_db = scan_response['Count']
            else:
                actual_records_in_db = 'unknown'
        except Exception as e:
            actual_records_in_db = f'error: {str(e)}'
        
        # Build summary
        summary = {
            'execution_time': datetime.now().isoformat(),
            'total_batches': check_result.get('total_batches', 0),
            'successful_batches': len(successful_batches),
            'failed_batches': len(failed_batches),
            'total_dates_originally_missing': check_result.get('total_missing', 0),
            'total_sessions_processed': total_sessions_processed,
            'total_sessions_stored': total_sessions_stored,
            'actual_records_in_dynamodb': actual_records_in_db,
            'batch_success_rate': (len(successful_batches) / len(batch_results) * 100) if batch_results else 100,
            'original_check_result': check_result
        }
        
        print(f"OURA_SYNC_SUMMARY: {json.dumps(summary, default=str)}")
        
        # In the future, this could:
        # - Send summary to SNS
        # - Store metrics in CloudWatch
        # - Update a dashboard
        # - Send notification if success rate is low
        
        return {
            'message': 'Oura sync summary generated',
            'summary': summary
        }
        
    except Exception as e:
        print(f"Error in summary: {str(e)}")
        # Even if summary fails, we don't want to break the step function
        return {
            'message': f'Failed to generate summary: {str(e)}',
            'basic_info': {
                'execution_time': datetime.now().isoformat(),
                'status': 'summary_generation_failed'
            }
        }