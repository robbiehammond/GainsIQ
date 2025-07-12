import json
import os
import requests
from datetime import datetime

def lambda_handler(event, context):
    try:
        start_date = event.get('start_date')
        end_date = event.get('end_date')
        missing_dates = event.get('missing_dates', [])
        
        if not start_date or not end_date:
            raise Exception("start_date and end_date parameters are required")
        
        oura_api_key = os.environ['OURA_API_KEY']
        if not oura_api_key:
            raise Exception("OURA_API_KEY environment variable not set")
        
        # Fetch sleep data from Oura API
        headers = {
            'Authorization': f'Bearer {oura_api_key}',
            'Content-Type': 'application/json'
        }
        
        # Oura API v2 endpoint for sleep data
        url = f'https://api.ouraring.com/v2/usercollection/sleep'
        params = {
            'start_date': start_date,
            'end_date': end_date
        }
        
        print(f"Fetching Oura sleep data for date range: {start_date} to {end_date}")
        
        response = requests.get(url, headers=headers, params=params)
        
        print(f"API Response status: {response.status_code}")
        print(f"API Response headers: {dict(response.headers)}")
        
        if response.status_code == 401:
            raise Exception("OuraApiError: Invalid API key or unauthorized access")
        elif response.status_code == 429:
            raise Exception("OuraApiError: Rate limit exceeded")
        elif response.status_code != 200:
            raise Exception(f"OuraApiError: API request failed with status {response.status_code}: {response.text}")
        
        data = response.json()
        print(f"API Response data: {json.dumps(data, indent=2)}")
        
        # Process all sleep sessions from the API response
        sleep_sessions = []
        
        if 'data' in data and data['data']:
            print(f"Found {len(data['data'])} sleep sessions in date range")
            
            for sleep_session in data['data']:
                # Parse and structure each sleep session
                structured_sleep_data = {
                    'date': sleep_session.get('day'),  # This is the date in YYYY-MM-DD format
                    'sleep_session_id': sleep_session.get('id'),
                    'day': sleep_session.get('day'),
                    'bedtime_start': sleep_session.get('bedtime_start'),
                    'bedtime_end': sleep_session.get('bedtime_end'),
                    'duration': sleep_session.get('duration'),
                    'total_sleep_duration': sleep_session.get('total_sleep_duration'),
                    'awake_duration': sleep_session.get('awake_duration'),
                    'light_sleep_duration': sleep_session.get('light_sleep_duration'),
                    'deep_sleep_duration': sleep_session.get('deep_sleep_duration'),
                    'rem_sleep_duration': sleep_session.get('rem_sleep_duration'),
                    'sleep_score': sleep_session.get('sleep_score'),
                    'sleep_efficiency': sleep_session.get('sleep_efficiency'),
                    'sleep_latency': sleep_session.get('sleep_latency'),
                    'sleep_restlessness': sleep_session.get('sleep_restlessness'),
                    'sleep_timing': sleep_session.get('sleep_timing'),
                    'heart_rate': sleep_session.get('heart_rate', {}).get('average') if sleep_session.get('heart_rate') else None,
                    'hrv': sleep_session.get('hrv', {}).get('average') if sleep_session.get('hrv') else None,
                    'temperature_delta': sleep_session.get('temperature_delta'),
                    'breathing_disturbances': sleep_session.get('breathing_disturbances'),
                    'restless_periods': sleep_session.get('restless_periods'),
                    'type': sleep_session.get('type'),
                    'created_at': datetime.now().isoformat()
                }
                sleep_sessions.append(structured_sleep_data)
        else:
            print(f"No sleep data found for date range: {start_date} to {end_date}")
        
        print(f"Successfully fetched {len(sleep_sessions)} sleep sessions")
        
        return {
            'start_date': start_date,
            'end_date': end_date,
            'missing_dates': missing_dates,
            'sleep_sessions': sleep_sessions,
            'total_sessions': len(sleep_sessions),
            'raw_response': data
        }
        
    except Exception as e:
        print(f"Error in fetch_data: {str(e)}")
        if "OuraApiError" in str(e):
            raise Exception(str(e))
        else:
            raise Exception(f"FetchDataError: {str(e)}")