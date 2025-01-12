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
} from '@mui/material';
import { amber, indigo } from '@mui/material/colors';
import { theme } from './style/theme';
import { Set, SetUtils } from './models/Set';
import { environment, useApi } from './utils/ApiUtils';
import { setWeightUnit } from './actions/UnitActions';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from './utils/types';

const WorkoutTracker: React.FC = () => {
  const dispatch = useDispatch();
  const unit = useSelector((state: RootState) => state.weightUnit.weightUnit);

  const { fetchData } = useApi();
  // TODO: Simply state management. Could just have [usersSet, setUsersSet] that gets updated on change.
  const [exercises, setExercises] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newExercise, setNewExercise] = useState<string>('');
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [setNumber, setSetNumber] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const data = await fetchData('/exercises');
        setExercises(data || []);
      } catch (error) {
        console.error('Error fetching exercises:', error);
        setExercises([]);
      }
    };

    fetchExercises();
  }, [fetchData]);

  const filteredExercises = exercises.filter((exercise) =>
    exercise.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const convertToPounds = (weight: number, unit: 'lbs' | 'kg'): number => {
    return unit === 'kg' ? weight * 2.20462 : weight;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const convertedWeight = convertToPounds(parseFloat(weight), unit);
    const setData: Set = {
      exercise: selectedExercise,
      reps: reps.toString(),
      setNumber: parseInt(setNumber),
      weight: convertedWeight,
    };
    console.log(JSON.stringify(SetUtils.toBackend(setData)));

    try {
      await fetchData('/sets/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SetUtils.toBackend(setData)),
      });

      setConfirmationMessage(
        `Logged: Set number ${setNumber} for ${selectedExercise}, ${reps} rep(s) with ${convertedWeight.toFixed(
          2
        )} lbs`
      );
      setSnackbarOpen(true);
      setReps('');
      setSetNumber('');
    } catch (error) {
      console.error('Error logging workout:', error);
    }
  };

  const handleAddExercise = async () => {
    if (newExercise && !exercises.includes(newExercise)) {
      try {
        await fetchData('/exercises', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exercise_name: newExercise }),
        });

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
      const message = await fetchData('/sets/pop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      console.log(message);

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
            <div>{environment === "preprod" ? "PREPROD - NOT REAL DATA" : ""}</div>
          </Typography>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Search Exercise"
                  variant="outlined"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Grid>

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
                    {[...Array(10).keys()].map((n) => (
                      <MenuItem key={n} value={(n + 6).toString()}>
                        {n + 6}
                      </MenuItem>
                    ))}
                    <MenuItem value="16 or above">16 or above</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Set Number</InputLabel>
                  <Select
                    value={setNumber}
                    onChange={(e) => setSetNumber(e.target.value)}
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

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={unit}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'lbs' || value === 'kg') {
                        dispatch(setWeightUnit(value as 'lbs' | 'kg'))
                      }
                    }}
                    label="Unit"
                  >
                    <MenuItem value="lbs">Pounds (lbs)</MenuItem>
                    <MenuItem value="kg">Kilograms (kg)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

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

          <Snackbar
            open={snackbarOpen}
            autoHideDuration={4000}
            onClose={() => setSnackbarOpen(false)}
          >
            <Alert onClose={() => setSnackbarOpen(false)} severity="success">
              {confirmationMessage}
            </Alert>
          </Snackbar>

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