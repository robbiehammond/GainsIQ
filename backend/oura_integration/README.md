# Oura Integration

This directory contains the complete Oura Ring integration for GainsIQ, implemented using AWS Step Functions.

## Architecture

The integration uses a Step Function workflow that runs daily at noon PST to automatically sync sleep data from the Oura API to DynamoDB.

### Components

1. **Step Function** (`step_functions/oura_sync.json`)
   - Orchestrates the entire sync process
   - Handles errors and retries gracefully
   - Provides visual monitoring and logging

2. **Lambda Functions** (`lambdas/`)
   - `check_missing.py`: Identifies missing sleep data dates
   - `fetch_data.py`: Retrieves sleep data from Oura API
   - `validate_data.py`: Validates data quality and format
   - `store_data.py`: Stores validated data in DynamoDB
   - `log_error.py`: Handles error logging and monitoring
   - `summary.py`: Generates sync execution summaries

3. **DynamoDB Table**: `OuraSleepTable`
   - Primary key: `date` (YYYY-MM-DD format)
   - Stores comprehensive sleep metrics

## Data Schema

The following sleep metrics are automatically collected and stored:

### Sleep Duration Metrics
- `total_sleep_duration`: Total time asleep (seconds)
- `light_sleep_duration`: Light sleep duration (seconds)
- `deep_sleep_duration`: Deep sleep duration (seconds)
- `rem_sleep_duration`: REM sleep duration (seconds)
- `awake_duration`: Time awake during sleep period (seconds)

### Sleep Quality Metrics
- `sleep_score`: Overall sleep score (0-100)
- `sleep_efficiency`: Percentage of time asleep vs. time in bed
- `sleep_latency`: Time to fall asleep (seconds)
- `sleep_restlessness`: Restlessness score
- `restless_periods`: Number of restless periods

### Physiological Metrics
- `heart_rate`: Average heart rate during sleep
- `hrv`: Heart rate variability average
- `temperature_delta`: Body temperature variation
- `breathing_disturbances`: Number of breathing disturbances

### Timing Information
- `bedtime_start`: When sleep period began (ISO timestamp)
- `bedtime_end`: When sleep period ended (ISO timestamp)
- `sleep_timing`: Sleep timing score

## Workflow

1. **Daily Trigger**: CloudWatch Events triggers at noon PST daily
2. **Check Missing Dates**: Scans last 7 days for missing sleep data
3. **Parallel Processing**: Processes multiple dates concurrently (max 3)
4. **For Each Date**:
   - Fetch data from Oura API
   - Validate data quality
   - Store in DynamoDB
   - Handle errors appropriately
5. **Summary**: Generates execution summary and logs

## Error Handling

- **Automatic Retries**: Built-in exponential backoff for API failures
- **Graceful Degradation**: Continues processing other dates if one fails
- **Comprehensive Logging**: All errors are logged with context
- **Visual Monitoring**: Step Function provides visual execution tracking

## Features

- **Idempotent**: Safe to run multiple times
- **Backfill Capability**: Automatically catches up on missing data
- **Rate Limit Handling**: Respects Oura API rate limits
- **Data Validation**: Ensures data quality before storage
- **Zero Manual Intervention**: Completely automated after deployment

## Configuration

Environment variables are automatically configured by the CDK stack:
- `OURA_API_KEY`: Your Oura personal access token
- `OURA_SLEEP_TABLE`: DynamoDB table name for sleep data storage

## Monitoring

- **CloudWatch Logs**: All Lambda executions are logged
- **Step Function Console**: Visual workflow monitoring
- **Execution Summaries**: Daily sync summaries in logs
- **Error Alerts**: Failed executions are logged for monitoring

## Integration with Existing Analytics

The sleep data is designed to integrate seamlessly with your existing workout analytics:
- **Correlation Analysis**: Compare sleep quality with workout performance
- **Trend Analysis**: Track sleep patterns over time
- **ML Features**: Sleep metrics available for machine learning models
- **Anomaly Detection**: Identify unusual sleep patterns that may affect performance

This integration provides a solid foundation for advanced sleep-workout correlations and ML-powered insights into your fitness and recovery patterns.