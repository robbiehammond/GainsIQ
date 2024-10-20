import React, { useState, useEffect } from 'react';
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

// Define interface for Exercise and WorkoutData
interface Exercise {
  exerciseName: string;
}

interface WorkoutData {
  exercise: string;
  reps: string;
  sets: number;
  weight: number;
}

// Create a custom theme
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

const WorkoutTracker: React.FC = () => {
  const apiUrl = process.env.REACT_APP_API_URL || '';
  const [exercises, setExercises] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newExercise, setNewExercise] = useState<string>('');
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [sets, setSets] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  // Fetch exercises
  useEffect(() => {
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
  }, [apiUrl]);

  // Filter exercises based on search term
  const filteredExercises = exercises.filter((exercise) =>
    exercise.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Convert weight to pounds if in kg
  const convertToPounds = (weight: number, unit: 'lbs' | 'kg'): number => {
    return unit === 'kg' ? weight * 2.20462 : weight;
  };

  // Handle form submission to log a workout
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const convertedWeight = convertToPounds(parseFloat(weight), unit);
    const workoutData: WorkoutData = {
      exercise: selectedExercise,
      reps: reps.toString(),
      sets: parseInt(sets),
      weight: convertedWeight,
    };

    try {
      const response = await fetch(`${apiUrl}/workouts`, {
        method: 'POST', // TODO: Don't make this a post, make this back into a GET for new URL
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workoutData),
      });

      if (!response.ok) {
        throw new Error('Failed to log workout');
      }

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

  // Handle adding a new exercise
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
      alert('Exercise already exists or is invalid');
    }
  };

  // Handle popping the last set
  const handlePopLastSet = async () => {
    try {
      const response = await fetch(`${apiUrl}/workouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'pop_last_set' }),
      });

      if (!response.ok) {
        throw new Error('Failed to pop last set');
      }

      const message = await response.text();
      setConfirmationMessage(message);
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
                      <MenuItem key={n} value={(n + 6).toString()}>
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
                      <MenuItem key={n} value={(n + 1).toString()}>
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
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'lbs' || value === 'kg') {
                        setUnit(value as 'lbs' | 'kg');
                      }
                    }}
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