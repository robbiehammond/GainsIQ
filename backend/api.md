# GainsIQ API Documentation

This document describes the API endpoints for the GainsIQ Workout Tracker. The base URL for the API is:

## Endpoints

### 1. Fetch Exercises

**GET /workouts**

Fetches the list of exercises.

#### Response

- **200 OK**: Returns a list of exercise names.
  ```json
  [
    "Pushdowns",
    "Incline DB Curls",
    "Hammer curls",
    "Preacher Curls"
    ...
  ]
  ```

- **500 Internal Server Error**: There was an issue fetching the exercises.

---

### 2. Modify workout data

**POST /workouts**

Logs a set, adds a new exercise, or removes the most recently logged set.

#### Request Body for Logging a Workout Set

```json
{
  "exercise": "Bench Press",
  "reps": "10",
  "sets": 3, // This should be "set" rather than sets, but I've been too lazy to fix it. One of these days...
  "weight": 225
}
```

#### Request Body for Adding a New Exercise

```json
{
  "exercise_name": "Overhead Press"
}
```

#### Request Body for Popping the Last Set

```json
{
  "action": "pop_last_set"
}
```

#### Response

- **200 OK**: Returns a success message.
  ```json
  {
    "message": "Set for Bench Press logged successfully"
  }
  ```

- **400 Bad Request**: Invalid request or missing required fields.
  ```json
  {
    "message": "Invalid request"
  }
  ```

- **500 Internal Server Error**: There was an issue processing the request.
