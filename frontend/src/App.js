import React, { useState, useEffect } from 'react';
import axios from 'axios';  // For making HTTP requests

const WorkoutTracker = () => {
  const apiUrl = 'https://57gpuk0gme.execute-api.us-west-2.amazonaws.com/prod'

  const [exercises, setExercises] = useState([]);  // Start with an empty list
  const [searchTerm, setSearchTerm] = useState('');
  const [newExercise, setNewExercise] = useState(''); // To handle new exercise input
  const [selectedExercise, setSelectedExercise] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');
  const [weight, setWeight] = useState(''); // To handle the weight input
  const [unit, setUnit] = useState('lbs'); // To handle the unit selection (default to lbs)
  const [confirmationMessage, setConfirmationMessage] = useState(''); // To show feedback

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const response = await axios.get(`${apiUrl}/workouts`);
        // Parse the body to get the actual array of exercises
        const exercisesData = JSON.parse(response.data.body);  // Parse the JSON string in response.data.body
        setExercises(exercisesData || []);  // Safely handle if exercisesData is empty
      } catch (error) {
        console.error('Error fetching exercises:', error);
        setExercises([]);  // Fallback to empty array in case of error
      }
    };
  
    fetchExercises();  // Trigger the fetch on component mount
  }, [apiUrl]);

  // Filtered exercises based on search term, ensuring exercises is always an array
  const filteredExercises = (Array.isArray(exercises) ? exercises : []).filter(exercise =>
    exercise.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Convert kilograms to pounds if necessary
  const convertToPounds = (weight, unit) => {
    if (unit === 'kg') {
      return weight * 2.20462; // Conversion from kg to lbs
    }
    return weight;
  };

  // Handle form submission (log workout set)
  const handleSubmit = async (e) => {
    e.preventDefault();
    const convertedWeight = convertToPounds(parseFloat(weight), unit);

    const workoutData = {
      exercise: selectedExercise,  // Ensure selected exercise is sent, not what's typed in the search
      reps: reps,
      sets: sets,
      weight: convertedWeight
    };

    try {
      // Send POST request to the backend API
      const response = await axios.post(`${apiUrl}/workouts`, workoutData);
      console.log(response.data);

      // Set confirmation message
      setConfirmationMessage(`You logged ${sets} set(s) of ${reps} rep(s) for ${selectedExercise} with ${convertedWeight.toFixed(2)} lbs.`);

      // Reset form inputs
      setSelectedExercise('');
      setReps('');
      setSets('');
      setWeight('');
      setUnit('lbs');
    } catch (error) {
      console.error('Error logging workout:', error);
    }
  };

  const handleAddExercise = async () => {
    console.log('Current exercises:', exercises);
    // Ensure exercises is an array before checking if it includes newExercise
    if (newExercise && Array.isArray(exercises) && !exercises.includes(newExercise)) {
      try {
        // Send POST request to add the new exercise to the backend
        const response = await axios.post(`${apiUrl}/workouts`, { exerciseName: newExercise });
        console.log(response.data);
  
        // Add the new exercise to the frontend list (temporarily until backend updates)
        setExercises([...exercises, newExercise]);
        setNewExercise('');
      } catch (error) {
        console.error('Error adding exercise:', error);
      }
    } else {
      alert('Exercise already exists or is invalid');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Workout Tracker</h2>

      <form onSubmit={handleSubmit}>
        {/* Search bar to filter exercises */}
        <div>
          <label>Search Exercise: </label>
          <input
            type="text"
            placeholder="Search for exercises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            // Removed 'required' so search field can be left blank
          />
        </div>

        {/* Display the filtered exercises and allow selection */}
        <div>
          <label>Select Exercise: </label>
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            required  // Ensure the dropdown selection is required
          >
            <option value="">--Select an Exercise--</option>
            {filteredExercises.length > 0 ? (
              filteredExercises.map((exercise, index) => (
                <option key={index} value={exercise}>
                  {exercise}
                </option>
              ))
            ) : (
              <option disabled>No exercises found</option>
            )}
          </select>
        </div>

        {/* Reps dropdown */}
        <div>
          <label>Reps: </label>
          <select value={reps} onChange={(e) => setReps(e.target.value)} required>
            <option value="">--Select Reps--</option>
            <option value="5 or below">5 or below</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
            <option value="9">9</option>
            <option value="10">10</option>
            <option value="11">11</option>
            <option value="12">12</option>
            <option value="13">13</option>
            <option value="14">14</option>
            <option value="15">15</option>
            <option value="16 or above">16 or above</option>
          </select>
        </div>

        {/* Sets dropdown */}
        <div>
          <label>Sets: </label>
          <select value={sets} onChange={(e) => setSets(e.target.value)} required>
            <option value="">--Select Sets--</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>

        {/* Weight input */}
        <div>
          <label>Weight: </label>
          <input
            type="number"
            placeholder="Enter weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
          />
        </div>

        {/* Unit selector */}
        <div>
          <label>Unit: </label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} required>
            <option value="lbs">Pounds (lbs)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </div>

        {/* Submit button */}
        <button type="submit">Log Workout</button>
      </form>

      {/* Display confirmation message after submitting */}
      {confirmationMessage && (
        <div style={{ marginTop: '20px', color: 'green' }}>
          <h3>Workout Logged:</h3>
          <p>{confirmationMessage}</p>
        </div>
      )}

      {/* Section to add a new exercise */}
      <div style={{ marginTop: '20px' }}>
        <h3>Add a New Exercise</h3>
        <input
          type="text"
          placeholder="New exercise name"
          value={newExercise}
          onChange={(e) => setNewExercise(e.target.value)}
        />
        <button onClick={handleAddExercise}>Add Exercise</button>
      </div>
    </div>
  );
};

export default WorkoutTracker;