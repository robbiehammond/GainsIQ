import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Grid,
  TextField,
  MenuItem,
  Button,
  Snackbar,
  Select,
  InputLabel,
  FormControl,
  Typography,
  Alert,
  Paper,
  Card,
  CardContent,
  ThemeProvider,
  createTheme,
} from '@mui/material';

import { amber, teal, indigo } from '@mui/material/colors';

// Create a custom theme with more colors
const theme = createTheme({
  palette: {
    primary: {
      main: indigo[500],
    },
    secondary: {
      main: amber[500],
    },
    background: {
      default: teal[50],
    },
  },
  typography: {
    h4: {
      fontWeight: 'bold',
      color: indigo[700],
    },
    h5: {
      color: amber[800],
    },
  },
});

const WorkoutTracker = () => {
  const apiUrl = 'https://57gpuk0gme.execute-api.us-west-2.amazonaws.com/prod';

  const [exercises, setExercises] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newExercise, setNewExercise] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState('lbs');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const response = await axios.get(`${apiUrl}/workouts`);
        setExercises(response.data || []);
      } catch (error) {
        console.error('Error fetching exercises:', error);
        setExercises([]);
      }
    };

    fetchExercises();
  }, [apiUrl]);

  const filteredExercises = exercises.filter(exercise =>
    exercise.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const convertToPounds = (weight, unit) => {
    return unit === 'kg' ? weight * 2.20462 : weight;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const convertedWeight = convertToPounds(parseFloat(weight), unit);
    const workoutData = {
      exercise: selectedExercise,
      reps: reps.toString(),
      sets: sets,
      weight: convertedWeight,
    };

    try {
      const response = await axios.post(`${apiUrl}/workouts`, workoutData);

      setConfirmationMessage(
        `Logged: Set number ${sets} for ${selectedExercise}, ${reps} rep(s) with ${convertedWeight.toFixed(2)} lbs`
      );
      setSnackbarOpen(true);

      setReps('');
      setSets('');
    } catch (error) {
      console.error('Error logging workout:', error);
    }
  };

  const handleAddExercise = async () => {
    if (newExercise && !exercises.includes(newExercise)) {
      try {
        const response = await axios.post(`${apiUrl}/workouts`, { exercise_name: newExercise });
        setExercises([...exercises, newExercise]);
        setNewExercise('');
      } catch (error) {
        console.error('Error adding exercise:', error);
      }
    } else {
      alert('Exercise already exists or is invalid');
    }
  };

  const handlePopLastSet = async () => {
    try {
      const response = await axios.post(`${apiUrl}/workouts`, { action: 'pop_last_set' });
      setConfirmationMessage(response.data);  // Response from the backend (e.g., 'Last set removed')
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error popping last set:', error);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md" sx={{ padding: '40px 20px' }}>
        <Paper elevation={3} sx={{ padding: '20px', backgroundColor: theme.palette.background.default }}>
          <Typography variant="h4" align="center" gutterBottom>
            Workout Tracker
          </Typography>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Search bar for exercises */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Search Exercise"
                  variant="outlined"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Grid>

              {/* Exercise selection dropdown */}
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Select Exercise</InputLabel>
                  <Select
                    value={selectedExercise}
                    onChange={(e) => setSelectedExercise(e.target.value)}
                    label="Select Exercise"
                  >
                    <MenuItem value="">-- Select an Exercise --</MenuItem>
                    {filteredExercises.length > 0 ? (
                      filteredExercises.map((exercise, index) => (
                        <MenuItem key={index} value={exercise}>
                          {exercise}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>No exercises found</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>

              {/* Reps */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Reps</InputLabel>
                  <Select
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    label="Reps"
                  >
                    <MenuItem value="">-- Select Reps --</MenuItem>
                    <MenuItem value="5 or below">5 or below</MenuItem>
                    {[...Array(12).keys()].map((n) => (
                      <MenuItem key={n} value={n + 6}>
                        {n + 6}
                      </MenuItem>
                    ))}
                    <MenuItem value="16 or above">16 or above</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Sets */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Set Number</InputLabel>
                  <Select
                    value={sets}
                    onChange={(e) => setSets(e.target.value)}
                    label="Sets"
                  >
                    <MenuItem value="">-- Select Set Number --</MenuItem>
                    {[...Array(5).keys()].map((n) => (
                      <MenuItem key={n} value={n + 1}>
                        {n + 1}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Weight */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Weight"
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  required
                />
              </Grid>

              {/* Unit */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    label="Unit"
                  >
                    <MenuItem value="lbs">Pounds (lbs)</MenuItem>
                    <MenuItem value="kg">Kilograms (kg)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Submit button */}
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  sx={{ backgroundColor: indigo[600], '&:hover': { backgroundColor: indigo[800] } }}
                >
                  Log Workout
                </Button>
              </Grid>

              {/* Pop last set button */}
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="secondary"
                  fullWidth
                  onClick={handlePopLastSet}
                  sx={{ backgroundColor: amber[600], '&:hover': { backgroundColor: amber[800] } }}
                >
                  Pop Last Set
                </Button>
              </Grid>
            </Grid>
          </form>

          {/* Snackbar for confirmation */}
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={4000}
            onClose={() => setSnackbarOpen(false)}
          >
            <Alert onClose={() => setSnackbarOpen(false)} severity="success">
              {confirmationMessage}
            </Alert>
          </Snackbar>

          {/* Add new exercise */}
          <Card sx={{ marginTop: '20px', backgroundColor: amber[50] }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Add a New Exercise
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={8}>
                  <TextField
                    fullWidth
                    label="New Exercise"
                    value={newExercise}
                    onChange={(e) => setNewExercise(e.target.value)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleAddExercise}
                    sx={{ backgroundColor: amber[700], '&:hover': { backgroundColor: amber[900] } }}
                  >
                    Add Exercise
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default WorkoutTracker;