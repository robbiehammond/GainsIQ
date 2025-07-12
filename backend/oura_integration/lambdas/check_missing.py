import boto3
import json
import os
from datetime import datetime, timedelta
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    try:
        table_name = os.environ['OURA_SLEEP_TABLE']
        table = dynamodb.Table(table_name)
        
        # Check if table has any data first
        scan_response = table.scan(Limit=1)
        table_has_data = scan_response['Count'] > 0
        
        # If table is empty, look back a full year. Otherwise, just look back 7 days
        if table_has_data:
            days_back = event.get('days_back', 7)
            print(f"Table has existing data, looking back {days_back} days")
        else:
            days_back = event.get('days_back', 365)
            print(f"Table is empty, looking back {days_back} days for initial population")
        
        # Calculate date range to check
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days_back)
        
        # Get all dates that should exist
        expected_dates = []
        current_date = start_date
        while current_date <= end_date:
            expected_dates.append(current_date.strftime('%Y-%m-%d'))
            current_date += timedelta(days=1)
        
        # Check which dates exist in DynamoDB
        existing_dates = set()
        for date_str in expected_dates:
            try:
                response = table.get_item(Key={'date': date_str})
                if 'Item' in response:
                    existing_dates.add(date_str)
            except Exception as e:
                print(f"Error checking date {date_str}: {str(e)}")
                continue
        
        # Find missing dates
        missing_dates = [date for date in expected_dates if date not in existing_dates]
        
        # Oura data is typically available with a delay, so exclude today and yesterday
        today = datetime.now().date().strftime('%Y-%m-%d')
        yesterday = (datetime.now().date() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        dates_to_sync = [date for date in missing_dates if date not in [today, yesterday]]
        
        print(f"Found {len(dates_to_sync)} missing dates: {dates_to_sync}")
        
        # If we have dates to sync, create 7-day batches starting from earliest
        if dates_to_sync:
            # Sort dates to ensure chronological processing (oldest first)
            dates_to_sync.sort()
            
            # Create 7-day batches
            batches = []
            batch_size = 7
            
            # Group consecutive dates into batches
            current_batch_dates = []
            
            for date_str in dates_to_sync:
                current_batch_dates.append(date_str)
                
                # If we have 7 dates or we're at the end, create a batch
                if len(current_batch_dates) >= batch_size or date_str == dates_to_sync[-1]:
                    batch = {
                        'start_date': current_batch_dates[0],
                        'end_date': current_batch_dates[-1],
                        'missing_dates': current_batch_dates.copy(),
                        'batch_size': len(current_batch_dates)
                    }
                    batches.append(batch)
                    current_batch_dates = []
            
            print(f"Created {len(batches)} batches for processing:")
            for i, batch in enumerate(batches):
                print(f"  Batch {i+1}: {batch['start_date']} to {batch['end_date']} ({batch['batch_size']} dates)")
            
            result = {
                'has_missing_dates': True,
                'batches': batches,
                'total_batches': len(batches),
                'total_missing': len(dates_to_sync),
                'checked_range': f"{start_date} to {end_date}"
            }
        else:
            result = {
                'has_missing_dates': False,
                'total_batches': 0,
                'total_missing': 0,
                'checked_range': f"{start_date} to {end_date}"
            }
        
        return result
        
    except Exception as e:
        print(f"Error in check_missing: {str(e)}")
        raise Exception(f"CheckMissingError: {str(e)}")