import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert
} from 'react-native';

const WorkoutTracker: React.FC = () => {
  const [exercises, setExercises] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newExercise, setNewExercise] = useState<string>('');
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [sets, setSets] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const apiUrl = "https://57gpuk0gme.execute-api.us-west-2.amazonaws.com/prod";

  useEffect(() => {
    // Fetch exercises from the API
    const fetchExercises = async () => {
      try {
        const response = await fetch(`${apiUrl}/workouts`);
        const data = await response.json();
        setExercises(data || []);
      } catch (error) {
        console.error('Error fetching exercises:', error);
        setExercises([]);
      }
    };

    fetchExercises();
  }, []);

  const handleSubmit = async () => {
    const convertedWeight = unit === 'kg' ? parseFloat(weight) * 2.20462 : parseFloat(weight);
    const workoutData = {
      exercise: selectedExercise,
      reps,
      sets: parseInt(sets),
      weight: convertedWeight,
    };

    try {
      const response = await fetch(`${apiUrl}/workouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workoutData),
      });

      if (!response.ok) {
        throw new Error('Failed to log workout');
      }

      setConfirmationMessage(`Logged ${sets} sets of ${reps} reps with ${convertedWeight.toFixed(2)} lbs`);
      Alert.alert("Success", confirmationMessage);

      // Clear inputs
      setReps('');
      setSets('');
      setWeight('');
    } catch (error) {
      console.error('Error logging workout:', error);
    }
  };

  const handleAddExercise = async () => {
    if (newExercise && !exercises.includes(newExercise)) {
      try {
        const response = await fetch(`${apiUrl}/workouts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ exercise_name: newExercise }),
        });

        if (!response.ok) {
          throw new Error('Failed to add exercise');
        }

        setExercises([...exercises, newExercise]);
        setNewExercise('');
      } catch (error) {
        console.error('Error adding exercise:', error);
      }
    } else {
      Alert.alert('Error', 'Exercise already exists or is invalid');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Search Exercise"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {/* Exercise selection */}
        <TextInput
          style={styles.input}
          placeholder="Selected Exercise"
          value={selectedExercise}
          onChangeText={setSelectedExercise}
        />
        {/* Reps input */}
        <TextInput
          style={styles.input}
          placeholder="Reps"
          value={reps}
          onChangeText={setReps}
          keyboardType="numeric"
        />
        {/* Sets input */}
        <TextInput
          style={styles.input}
          placeholder="Sets"
          value={sets}
          onChangeText={setSets}
          keyboardType="numeric"
        />
        {/* Weight input */}
        <TextInput
          style={styles.input}
          placeholder="Weight"
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
        />
        {/* Unit selection */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => setUnit(unit === 'lbs' ? 'kg' : 'lbs')}
        >
          <Text style={styles.buttonText}>Switch to {unit === 'lbs' ? 'kg' : 'lbs'}</Text>
        </TouchableOpacity>
        {/* Submit Button */}
        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Log Workout</Text>
        </TouchableOpacity>

        {/* Add Exercise */}
        <TextInput
          style={styles.input}
          placeholder="New Exercise"
          value={newExercise}
          onChangeText={setNewExercise}
        />
        <TouchableOpacity style={styles.button} onPress={handleAddExercise}>
          <Text style={styles.buttonText}>Add Exercise</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// Define styles for React Native components
const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#E0F2F1', // teal[50]
    flex: 1,
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#3F51B5', // indigo[500]
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FFB300', // amber[500]
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default WorkoutTracker;