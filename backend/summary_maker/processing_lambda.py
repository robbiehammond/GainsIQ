import os
import json
import boto3
import http.client
import ssl
from decimal import Decimal
import datetime
from datetime import timedelta

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')

sets_table_name = os.environ['SETS_TABLE']
analyses_table_name = os.environ['ANALYSES_TABLE']
sets_table = dynamodb.Table(sets_table_name)
openai_api_key = os.environ['OPENAI_API_KEY']
sns_topic_arn = os.environ['SNS_TOPIC_ARN'] 
s3_bucket_name = os.environ['S3_BUCKET_NAME']

is_preprod = True if os.environ['IS_PREPROD'] == "YES" else False

# TODO: Make it so that when triggered by the backend, emails and stuff aren't sent.
def lambda_handler(event, context):

    workout_data = get_last_month_data()
    
    prompt = generate_prompt(workout_data)
    
    analysis = call_openai_api(prompt)

    save_analysis_to_table(analysis)

    # Don't send emails/save to s3 for preprod, since this data is useless.
    if is_preprod:
        return {
        'statusCode': 200,
        'body': json.dumps('Analysis saved to table. No SNS notifications bc this is preprod.')
    }
    
    # Commenting these out now that I can see the analysis in the table, and they can be generated from the frontend.
    # Will keep around in case I want to re-enable this in the future or something.
    #save_analysis_to_s3(analysis)
    
    #send_via_sns(analysis)
    
    return {
        'statusCode': 200,
        'body': json.dumps('Analysis completed, saved to table.')
    }

def get_last_month_data():
    now = datetime.datetime.utcnow()
    last_month = now - datetime.timedelta(days=30)
    last_month_timestamp = int(last_month.timestamp())

    response = sets_table.scan(
        FilterExpression="#ts >= :last_month",
        ExpressionAttributeNames={"#ts": "timestamp"},
        ExpressionAttributeValues={":last_month": last_month_timestamp}
    )

    items = response.get('Items', [])
    return items

def generate_prompt(workout_data):
    utc_offset = timedelta(hours=-7)
    if is_preprod:
        prompt = ("I'm making a workout app and this data is from my preprod endpoint. For testing, I want you to print out the workout data back to me. "
                  "Don't try to analyze it because there's nothing real to analyze. Just print out the exact data you see.")
    else:
        prompt = (
            "I am training to be a bodybuilder on a slight caloric surplus, gaining about 2 pounds per month. "
            "I've been lifting for 5 years, so progress isn't rapid, but it should be noticeable. "
            "Ensuring that the weights on almost all exercises increase, even slightly, over the course of a month is important.\n"
            "My workout split is as follows:\n"
            "- Day 1: Chest/Back (including front delts and rear delts)\n"
            "- Day 2: Arms (biceps, triceps, side delts)\n"
            "- Day 3: Legs (quads, hamstrings, calves, glutes)\n"
            "- Repeat, with occassional rest days\n"
            "\n"
            "I am not looking for advice on exercise selection. Instead, I want to focus on trends within the exercises and muscle groups based on the data provided. "
            "Note that that the precise cycle of this split changes from time to time, so arm day may come before chest/back. No need to comment on any cycle changes. "
            "Please analyze the following workout data for trends and performance improvements over the last month. "
            "If there are any exercises where weight progression seems slower than expected or where there's stagnation, highlight those as well. "
            "If any outliers don't make sense compared to the rest of the data, please ignore those entries. They were likely mistakenly entered.\n\n"
        )
    
    for workout in workout_data:
        exercise = workout.get('exercise', 'Unknown Exercise')
        set_number = workout.get('sets', 0)
        reps = workout.get('reps', 0)
        weight = workout.get('weight', Decimal(0))

        timestamp_utc = datetime.datetime.utcfromtimestamp(workout.get('timestamp', 0))
        timestamp_pst = timestamp_utc + utc_offset  # Adjusting to UTC-7 (PST)

        formatted_timestamp = timestamp_pst.strftime('%Y-%m-%d %H:%M UTC-7')
        
        prompt += f"- {exercise}: set number {set_number}, {reps} reps, {weight} lbs on {formatted_timestamp}\n"

    if not is_preprod:
        prompt += (
            "\nProvide an analysis of my progress based on the muscle groups targeted by these exercises. "
            "Note that there is only ever 1 workout per day; pay attention to the date when analyzing a set, as you can use that to determine if 2 different sets happened in the same workout. "
            "You should be looking between workouts for trends. In the same workout, the number of reps will likely stagnate or decrease for a given exercise; that's expected. Keep your comments to trends between workouts as trends within the same workout don't matter. "
            "To elaborate further on this point, if, for example, you see I do 12 reps at set 1 and then 6 reps at set 3 in the same workout, do not comment on this as it is not important. However, if you see on day X that I did 6 reps for the first set and then on day X + 3 I did 8 reps for the first set, "
            "this is definitely something you should comment on, as this is important and indicates a positive trend. "
            "Note that the set number refers to which set that was on a specific workout. So if there was a workout on day X where I did 3 sets of exercise ABC, "
            "the entry labeled set 1 for that exercise was the first set I did, the entry labeled set 2 was the second, and so on. No need to compare different set numbers "
            "across various dates. What I mean is you should focus on comparing set 1s on some day for some exercise to set 1s on other days for that same exercise. "
            "Please Identify any trends in strength gains or areas where progression might be stalling. No need to make the analysis super lengthy; if there "
            "isn't a notable trend for a given exercise/muscle group, don't mention it. Also, if there's not enough data to note a trend, don't try to comment on it. When making a point about improvement/stagnation/regression, only include "
            "one or two examples to prove your point; no need to regurgitate all the data. However, provide specific dates within the examples you give."
        )
    
    return prompt

def call_openai_api(prompt):
    conn = http.client.HTTPSConnection("api.openai.com", context=ssl.create_default_context())
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {openai_api_key}'
    }
    
    data = json.dumps({
        "model": "o1-mini",  
        "messages": [{"role": "user", "content": prompt}],
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
    subject = "Monthly Workout Analysis"
    message = f"Here is your workout analysis for the past month:\n\n{analysis}"
    
    response = sns.publish(
        TopicArn=sns_topic_arn,
        Subject=subject,
        Message=message
    )
    
    return response

def save_analysis_to_table(analysis):
    analyses_table = dynamodb.Table(analyses_table_name)
    now = datetime.datetime.utcnow()
    timestamp = int(now.timestamp())

    analyses_table.put_item(
        Item={
            'timestamp': timestamp,
            'analysis': analysis
        }
    )
