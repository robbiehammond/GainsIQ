# GainsIQ API Documentation

This document describes the API endpoints for the GainsIQ Workout Tracker. The base URL for the preprod API https://winhi1fmi8.execute-api.us-west-2.amazonaws.com/prod.

---

## Endpoints

### Exercises

#### 1. Fetch Exercises

**GET /exercises**

Fetches the list of exercises stored in the database.

**Response:**

- **200 OK:** Returns a list of exercise names.
  ```
  [
    "Pushdowns",
    "Incline DB Curls",
    "Hammer curls",
    "Preacher Curls"
  ]
  ```

- **500 Internal Server Error:** There was an issue fetching the exercises.
  ```
  {
    "message": "Error fetching exercises"
  }
  ```

---

#### 2. Add a New Exercise

**POST /exercises**

Adds a new exercise to the database.

**Request Body:**
```
{
  "exercise_name": "Overhead Press"
}
```

**Response:**

- **200 OK:** Returns a success message.
  ```
  {
    "message": "Exercise Overhead Press added successfully"
  }
  ```

- **400 Bad Request:** Missing required fields.
  ```
  {
    "message": "Invalid request"
  }
  ```

- **500 Internal Server Error:** There was an issue processing the request.
  ```
  {
    "message": "Error adding exercise"
  }
  ```

---

#### 3. Delete an Exercise

**DELETE /exercises**

Deletes an exercise from the database.

**Request Body:**
```json
{
  "exercise_name": "Bench Press"
}
```

**Response:**

- **200 OK:** Successfully deleted the exercise.
  ```json
  {
    "message": "Exercise Bench Press deleted successfully"
  }
  ```

- **400 Bad Request:** Missing or invalid exercise name.
  ```json
  {
    "message": "Invalid input: exercise_name is required"
  }
  ```

- **500 Internal Server Error:** There was an issue deleting the exercise.
  ```json
  {
    "message": "Error deleting exercise"
  }
  ```

### Sets

#### 1. Log a Workout Set

**POST /sets/log**

Logs a new workout set.

**Request Body:**
```
{
  "exercise": "Bench Press",
  "reps": "10",
  "sets": 3,
  "weight": 225.0
}
```

**Response:**

- **200 OK:** Successfully logged the set.
  ```
  {
    "message": "Set for Bench Press logged successfully"
  }
  ```

- **400 Bad Request:** Invalid or missing required fields.
  ```
  {
    "message": "Invalid request"
  }
  ```

- **500 Internal Server Error:** There was an issue processing the request.
  ```
  {
    "message": "Error logging set"
  }
  ```

---

#### 2. Fetch Last Month's Workouts

**GET /sets/last_month**

Fetches all workouts logged in the last 30 days.

**Response:**

- **200 OK:** Returns a list of workouts.
  ```
  [
    {
      "workoutId": "123e4567-e89b-12d3-a456-426614174000",
      "exercise": "Bench Press",
      "reps": "10",
      "sets": "3",
      "weight": "225.0",
      "timestamp": "1698787200"
    }
  ]
  ```

- **500 Internal Server Error:** There was an issue processing the request.
  ```
  {
    "message": "Error fetching last month workouts"
  }
  ```

---

#### 3. Pop the Last Logged Set

**POST /sets/pop**

Removes the most recently logged workout set.

**Response:**

- **200 OK:** Successfully removed the set.
  ```
  {
    "message": "Successfully deleted last set for Bench Press"
  }
  ```

- **404 Not Found:** No set to delete.
  ```
  {
    "message": "No set found to delete"
  }
  ```

- **500 Internal Server Error:** There was an issue processing the request.
  ```
  {
    "message": "Error deleting last set"
  }
  ```

---

#### 4. Edit a Workout Set

**PUT /sets/edit**

Edits an existing workout set.

**Request Body:**
```
{
  "workoutId": "123e4567-e89b-12d3-a456-426614174000",
  "timestamp": 1698787200,
  "reps": "12",
  "sets": 4,
  "weight": 230.0
}
```

**Response:**

- **200 OK:** Successfully updated the set.
  ```
  {
    "message": "Set updated successfully"
  }
  ```

- **400 Bad Request:** Missing or invalid fields.
  ```
  {
    "message": "Invalid request"
  }
  ```

- **500 Internal Server Error:** There was an issue updating the set.
  ```
  {
    "message": "Error updating set"
  }
  ```

---

#### 5. Delete a Workout Set

**DELETE /sets**

Deletes a specific workout set by `workoutId` and `timestamp`.

**Request Body:**
```
{
  "workoutId": "123e4567-e89b-12d3-a456-426614174000",
  "timestamp": 1698787200
}
```

**Response:**

- **200 OK:** Successfully deleted the set.
  ```
  {
    "message": "Set deleted successfully"
  }
  ```

- **400 Bad Request:** Missing or invalid fields.
  ```
  {
    "message": "Invalid input"
  }
  ```

- **500 Internal Server Error:** There was an issue deleting the set.
  ```
  {
    "message": "Error deleting set"
  }
  ```

---

### Weight Tracking

#### 1. Log Weight

**POST /weight**

Logs a new weight entry.

**Request Body:**
```
{
  "weight": 175.5
}
```

**Response:**

- **200 OK:** Successfully logged the weight.
  ```
  {
    "message": "Weight logged successfully"
  }
  ```

- **500 Internal Server Error:** There was an issue logging the weight.
  ```
  {
    "message": "Error logging weight"
  }
  ```

---

#### 2. Fetch All Weight Entries

**GET /weight**

Fetches all logged weight entries.

**Response:**

- **200 OK:** Returns a list of weight entries.
  ```
  [
    {
      "timestamp": "1698787200",
      "weight": "175.5"
    }
  ]
  ```

- **500 Internal Server Error:** There was an issue fetching the weight entries.
  ```
  {
    "message": "Error fetching weights"
  }
  ```

---

#### 3. Delete the Most Recent Weight Entry

**DELETE /weight**

Deletes the most recently logged weight entry.

**Response:**

- **200 OK:** Successfully deleted the weight entry.
  ```
  {
    "message": "Most recent weight deleted successfully"
  }
  ```

- **500 Internal Server Error:** There was an issue deleting the weight entry.
  ```
  {
    "message": "Error deleting most recent weight"
  }
  ```

---

### Default Error Response

For invalid routes or methods:

**Response:**
```
{
  "message": "Route not found"
}
```