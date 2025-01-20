import pytest
from unittest.mock import patch, MagicMock
import json
from anomaly_detector import (
    lambda_handler,
    group_sets_into_workouts,
    average_weight_and_reps,
    parse_numeric,
    compute_one_rep_max,
)

def test_parse_numeric():
    # "16 or above" -> 16.0
    assert parse_numeric("16 or above") == 16.0
    # "159.83495" -> 159.83495
    assert parse_numeric("159.83495") == 159.83495
    # Non-numeric
    assert parse_numeric("abc") is None
    # Quoted/escaped strings
    assert parse_numeric('"40"') == 40.0


def test_group_sets_into_workouts():
    sets_list = [
        {"timestamp": 1000, "exercise": "bench press"},
        {"timestamp": 1010, "exercise": "bench press"},
        {"timestamp": 1100, "exercise": "bench press"},
        {"timestamp": 1200, "exercise": "bench press"},
        # Next set is 8 hours (28800 seconds) later => new workout
        {"timestamp": 30000, "exercise": "bench press"},
        {"timestamp": 30010, "exercise": "bench press"},
    ]
    
    sets_list.sort(key=lambda x: x["timestamp"])

    workouts = group_sets_into_workouts(sets_list, gap_hours=8)
    assert len(workouts) == 2, "Should have split into 2 workout groups"

    first_workout, second_workout = workouts
    assert len(first_workout) == 4, "First workout group has 4 sets"
    assert len(second_workout) == 2, "Second workout group has 2 sets"


def test_average_weight_and_reps():
    # All numeric
    workout_sets = [
        {"weight": "100", "reps": "10"},
        {"weight": "110", "reps": "8"},
        {"weight": "90",  "reps": "12"}
    ]
    avg_weight, avg_reps = average_weight_and_reps(workout_sets)
    # average of 100, 110, 90 => 100
    assert abs(avg_weight - 100.0) < 1e-6
    # average of 10, 8, 12 => 10
    assert abs(avg_reps - 10.0) < 1e-6

    # Mixed with a non-numeric
    workout_sets_with_str = [
        {"weight": "100", "reps": "10"},
        {"weight": "abc", "reps": "5"},  # won't parse
        {"weight": "95.5", "reps": "9"}
    ]
    avg_weight, avg_reps = average_weight_and_reps(workout_sets_with_str)
    # Only first and third are counted
    # weight: (100 + 95.5) / 2 => 97.75
    # reps:   (10 + 9) / 2 => 9.5
    assert abs(avg_weight - 97.75) < 1e-6
    assert abs(avg_reps - 9.5) < 1e-6

    # No valid numeric sets
    workout_sets_empty = [
        {"weight": "abc", "reps": "xyz"}
    ]
    avg_weight, avg_reps = average_weight_and_reps(workout_sets_empty)
    assert avg_weight == 0.0
    assert avg_reps == 0.0


def test_compute_one_rep_max():
    # Basic test
    orm = compute_one_rep_max(100, 10)
    # Brzycki = 100 * (36 / (37 - 10)) = 100 * (36 / 27) = 100 * 1.3333... = ~133.33
    assert abs(orm - 133.33) < 0.1

    # Large reps => clamp logic (may change eventually)
    orm2 = compute_one_rep_max(50, 50)  # effectively reps=35
    # => 50 * (36 / (37 - 35)) = 50 * (36 / 2) = 50 * 18 = 900
    assert abs(orm2 - 900) < 1


@pytest.fixture
def mock_context():
    """A simple mock Lambda context object with minimal attributes."""
    class MockContext:
        def __init__(self):
            self.aws_request_id = "test-aws-request-id-12345"
            self.log_group_name = "test-log-group"
            self.log_stream_name = "test-log-stream"
            self.function_name = "test-lambda"
    return MockContext()

