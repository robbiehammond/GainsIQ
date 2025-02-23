import React, { useEffect, ChangeEvent } from 'react';
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
import { environment, client } from './utils/ApiUtils';
import { setWeightUnit } from './actions/UnitActions';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from './utils/types';
import { updateWorkoutForm } from './reducers/workoutFormReducer';


const WorkoutTracker: React.FC = () => {
  const dispatch = useDispatch();
  const unit = useSelector((state: RootState) => state.weightUnit.weightUnit);
  const { selectedExercise, reps, setNumber, weight } = useSelector(
    (state: RootState) => state.workoutForm
  );

  const [exercises, setExercises] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [newExercise, setNewExercise] = React.useState<string>('');
  const [confirmationMessage, setConfirmationMessage] = React.useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = React.useState<boolean>(false);

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const data = await client.getExercises();
        setExercises(data || []);
      } catch (error) {
        console.error('Error fetching exercises:', error);
        setExercises([]);
      }
    };

    fetchExercises();
  }, []);

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
    const fifthSet = parseInt(setNumber) === 5

    try {
      await client.logWorkoutSet({
        exercise: setData.exercise,
        reps: setData.reps,
        sets: setData.setNumber,
        weight: setData.weight,
      });

      setConfirmationMessage(
        `Logged: Set number ${setNumber} for ${selectedExercise}, ${reps} rep(s) with ${convertedWeight.toFixed(
          2
        )} lbs`
      );
      setSnackbarOpen(true);
      dispatch(updateWorkoutForm({ selectedExercise: selectedExercise, reps: '', setNumber: fifthSet ? "5" : String(parseInt(setNumber) + 1), weight: weight}));
    } catch (error) {
      console.error('Error logging workout:', error);
    }
  };

  const handleAddExercise = async () => {
    if (newExercise && !exercises.includes(newExercise)) {
      try {
        await client.addExercise(newExercise)

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
      const response = await client.popLastSet();

      setConfirmationMessage(response.message);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error popping last set:', error);
    }
  };

  const handleGenerateAnalysis = async () => {
    try {
      const response = await client.generateAnalysis();
      setConfirmationMessage(response.message);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error generating analysis:', error);
    }
  };

  const handleSelectExerciseChange = (e: any) => {
    dispatch(updateWorkoutForm({ selectedExercise: e.target.value as string }));
  };

  const handleRepsChange = (e: any) => {
    dispatch(updateWorkoutForm({ reps: e.target.value as string }));
  };

  const handleSetNumberChange = (e: any) => {
    dispatch(updateWorkoutForm({ setNumber: e.target.value as string }));
  };

  const handleWeightChange = (e: any) => {
    dispatch(updateWorkoutForm({ weight: e.target.value }));
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md" sx={{ padding: '40px 20px' }}>
        <Paper elevation={3} sx={{ padding: '20px', backgroundColor: theme.palette.background.default }}>
          <Typography variant="h4" align="center" gutterBottom>
            Workout Tracker
            <div>{environment === 'preprod' ? 'PREPROD - NOT REAL DATA' : ''}</div>
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
                    onChange={handleSelectExerciseChange}
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
                  <Select value={reps} onChange={handleRepsChange} label="Reps">
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
                  <Select value={setNumber} onChange={handleSetNumberChange} label="Sets">
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
                  onChange={handleWeightChange}
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
                        dispatch(setWeightUnit(value as 'lbs' | 'kg'));
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

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="secondary"
                  fullWidth
                  onClick={handleGenerateAnalysis}
                  sx={{ backgroundColor: amber[600], '&:hover': { backgroundColor: amber[800] } }}
                >
                  Generate Analysis
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
