import os
import json
import uuid
import boto3
from decimal import Decimal
from typing import List, Dict

dynamodb = boto3.resource("dynamodb")

SETS_TABLE_NAME = os.environ.get("SETS_TABLE", "SetsTable")
ANOMALIES_TABLE_NAME = os.environ.get("ANOMALIES_TABLE", "AnomaliesTable")

def lambda_handler(event, context):
    """
    1. Scan the SetsTable (or query only recent sets if you track 'last scan time').
    2. Group by exercise.
    3. For each exercise:
        - Group sets by workout (8-hour rule).
        - Calculate average weight/reps, then compute 1RM using Brzycki formula.
        - Detect 10% jump anomalies.
        - Write anomalies to the AnomaliesTable if found.
    """

    print("Starting anomaly detection...")

    # 1. Scan all sets
    sets_data = scan_all_sets(SETS_TABLE_NAME)

    # 2. Group sets by exercise
    exercise_map = {}
    for s in sets_data:
        exercise_key = s["exercise"].strip().lower()
        exercise_map.setdefault(exercise_key, []).append(s)

    anomalies_to_write = []

    # 3. For each exercise, group into workouts & compute 1RM points
    for exercise_name, sets_list in exercise_map.items():
        # Sort by timestamp ascending
        sets_list.sort(key=lambda x: x["timestamp"])

        # Group sets by an 8-hour gap
        workouts = group_sets_into_workouts(sets_list, gap_hours=8)

        # Build a list of 1RM points for each workout
        one_rm_points = []
        for w in workouts:
            avg_weight, avg_reps = average_weight_and_reps(w)
            if avg_reps > 0:  # Just to avoid division by zero or nonsense
                one_rm = compute_one_rep_max(avg_weight, avg_reps)
            else:
                one_rm = 0
            workout_timestamp = w[0]["timestamp"]  # representative timestamp
            one_rm_points.append({
                "workoutTimestamp": workout_timestamp,
                "avgWeight": avg_weight,
                "avgReps": avg_reps,
                "oneRepMax": one_rm,
                "workoutSets": w,  # the raw sets in that workout
            })

        # 4. Identify anomalies (10% better jump)
        for i, current in enumerate(one_rm_points):
            prev_point = one_rm_points[i - 1] if i - 1 >= 0 else None
            next_point = one_rm_points[i + 1] if i + 1 < len(one_rm_points) else None

            is_anomaly = False

            if prev_point and current["oneRepMax"] >= 1.1 * prev_point["oneRepMax"]:
                is_anomaly = True
            if next_point and current["oneRepMax"] >= 1.1 * next_point["oneRepMax"]:
                is_anomaly = True

            if is_anomaly:
                # We'll log all sets from that workout as an anomaly
                anomalies_to_write.append({
                    "exercise": exercise_name,
                    "workoutTimestamp": current["workoutTimestamp"],
                    "oneRepMax": current["oneRepMax"],
                    "sets": current["workoutSets"],  # or just references
                    "reason": "10% jump in 1RM detected",
                })

    # 5. Write anomalies to DynamoDB (if any)
    if anomalies_to_write and ANOMALIES_TABLE_NAME:
        print(f"Writing {len(anomalies_to_write)} anomalies to {ANOMALIES_TABLE_NAME}...")
        anomalies_table = dynamodb.Table(ANOMALIES_TABLE_NAME)
        for anomaly in anomalies_to_write:
            item = {
                "anomalyId": str(uuid.uuid4()),
                "exercise": anomaly["exercise"],
                "workoutTimestamp": anomaly["workoutTimestamp"],
                "oneRepMax": Decimal(str(anomaly["oneRepMax"])),
                "reason": anomaly["reason"],
                "createdAt": Decimal(str(int(context.aws_request_id[-5:], 16)))  # or just use time.time() 
                # "sets": you could store them directly or store references
                # e.g., "sets": json.dumps(anomaly["sets"])
            }
            anomalies_table.put_item(Item=item)
    else:
        print("No anomalies detected or no ANOMALIES_TABLE defined.")

    print("Anomaly detection complete.")
    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Anomaly detection finished", "anomalies": len(anomalies_to_write)}),
    }


def scan_all_sets(table_name: str) -> List[Dict]:
    """Scan the entire SetsTable. In production, consider scanning incrementally or by timestamp."""
    table = dynamodb.Table(table_name)
    all_items = []
    last_evaluated_key = None

    while True:
        response = table.scan(
            ExclusiveStartKey=last_evaluated_key
        )
        items = response.get("Items", [])
        all_items.extend(items)
        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break

    # Convert numeric strings to actual numeric types if needed
    normalized = []
    for item in all_items:
        # DynamoDB returns numbers as Decimal, so we might parse them to float/int
        item["timestamp"] = int(item["timestamp"])
        item["weight"] = str(item["weight"])  # e.g. might be a decimal string
        item["reps"] = str(item["reps"])
        normalized.append(item)

    return normalized


def group_sets_into_workouts(sets_list: List[Dict], gap_hours: int) -> List[List[Dict]]:
    """Group sorted sets into workouts based on a time gap (8 hours)."""
    gap_seconds = gap_hours * 3600
    workouts = []
    current_group = []

    for s in sets_list:
        if not current_group:
            current_group.append(s)
            continue

        prev_set = current_group[-1]
        if (s["timestamp"] - prev_set["timestamp"]) > gap_seconds:
            workouts.append(current_group)
            current_group = [s]
        else:
            current_group.append(s)

    if current_group:
        workouts.append(current_group)

    return workouts


def average_weight_and_reps(workout_sets: List[Dict]):
    """Compute average weight & reps for a single workout group."""
    total_weight = 0.0
    total_reps = 0.0
    count = 0

    for s in workout_sets:
        # Parse weight & reps from strings (e.g. "16 or above" => 16)
        w = parse_numeric(s["weight"])
        r = parse_numeric(s["reps"])

        if w is not None and r is not None:
            total_weight += w
            total_reps += r
            count += 1

    if count == 0:
        return (0.0, 0.0)
    return (total_weight / count, total_reps / count)


def parse_numeric(val: str):
    """Parse a numeric string, ignoring things like '16 or above' by returning 16, etc."""
    # Adjust logic as you prefer
    try:
        # remove extra text or handle "16 or above"
        tokens = val.split()
        base = tokens[0]
        base = base.replace('"', '').replace("'", "")
        # if it's something like '16' or '159.83495'
        return float(base)
    except:
        return None


def compute_one_rep_max(weight: float, reps: float) -> float:
    """Brzycki formula 1RM = weight * (36 / (37 - reps))"""
    if reps >= 36:
        # formula gets weird if reps are super high. You can clamp or handle differently
        reps = 35.0
    return weight * (36.0 / (37.0 - reps))