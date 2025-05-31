import React, { useEffect } from 'react';
import {
  Container,
  Grid,
  TextField,
  Autocomplete,
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
import { grey } from '@mui/material/colors';
import { theme } from '../style/theme';
import { Set } from '../types';
import { environment, client } from '../utils/ApiUtils';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../types/store';
import { setWeightUnit, setCuttingState, updateWorkoutForm } from '../store/slices';


const WorkoutTracker: React.FC = () => {
  const dispatch = useDispatch();
  const unit = useSelector((state: RootState) => state.weightUnit.weightUnit);
  const weightModulation = useSelector((state: RootState) => state.weightModulation.cuttingState)
  const { selectedExercise, reps, setNumber, weight } = useSelector(
    (state: RootState) => state.workoutForm
  );

  const [exercises, setExercises] = React.useState<string[]>([]);
  const [inputValue, setInputValue] = React.useState<string>('');
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
        isCutting: weightModulation === "CUTTING" ? true : false
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
        <Paper elevation={0} sx={{ 
          padding: '32px', 
          backgroundColor: '#ffffff',
          border: `1px solid ${grey[200]}`,
          borderRadius: 3
        }}>
          <Typography variant="h4" align="center" gutterBottom sx={{ mb: 4 }}>
            Workout Tracker
            {environment === 'preprod' && (
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                PREPROD - NOT REAL DATA
              </Typography>
            )}
          </Typography>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <Autocomplete
                  freeSolo
                  options={exercises}
                  inputValue={inputValue}
                  onInputChange={(e, newInput) => setInputValue(newInput)}
                  value={selectedExercise}
                  onChange={(e, newValue) => {
                    const value = (newValue as string) || '';
                    dispatch(updateWorkoutForm({ selectedExercise: value }));
                    setInputValue(value);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Exercise"
                      variant="outlined"
                      required
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: grey[50],
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: grey[400],
                          },
                        },
                        '& .MuiInputLabel-root': {
                          color: grey[600],
                        }
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl 
                  fullWidth 
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: grey[50],
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: grey[400],
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: grey[600],
                    }
                  }}
                >
                  <InputLabel>Reps</InputLabel>
                  <Select value={reps} onChange={handleRepsChange} label="Reps">
                    <MenuItem value="">-- Select Reps --</MenuItem>
                    <MenuItem value="5 or below">5 or below</MenuItem>
                    {[...Array(19).keys()].map((n) => (
                      <MenuItem key={n} value={(n + 6).toString()}>
                        {n + 6}
                      </MenuItem>
                    ))}
                    <MenuItem value="25 or more">25 or more</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl 
                  fullWidth 
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: grey[50],
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: grey[400],
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: grey[600],
                    }
                  }}
                >
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

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Weight"
                  type="number"
                  value={weight}
                  onChange={handleWeightChange}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: grey[50],
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: grey[400],
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: grey[600],
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControl 
                  fullWidth 
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: grey[50],
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: grey[400],
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: grey[600],
                    }
                  }}
                >
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

              <Grid item xs={12} sm={4}>
                <FormControl 
                  fullWidth 
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: grey[50],
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: grey[400],
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: grey[600],
                    }
                  }}
                >
                  <InputLabel>Cutting?</InputLabel>
                  <Select
                    value={weightModulation}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'CUTTING' || value === 'BULKING') {
                        dispatch(setCuttingState(value as 'CUTTING' | 'BULKING'));
                      }
                    }}
                    label="Unit"
                  >
                    <MenuItem value="CUTTING">Cutting</MenuItem>
                    <MenuItem value="BULKING">Bulking</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  sx={{ 
                    fontWeight: 500,
                    textTransform: 'none',
                    boxShadow: 'none',
                    mb: 2,
                    '&:hover': { 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)' 
                    }
                  }}
                >
                  Log Workout
                </Button>
              </Grid>

              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  color="secondary"
                  fullWidth
                  onClick={handlePopLastSet}
                  sx={{ 
                    fontWeight: 500,
                    textTransform: 'none',
                    borderColor: grey[300],
                    color: grey[600],
                    '&:hover': { 
                      borderColor: grey[400],
                      backgroundColor: grey[50]
                    }
                  }}
                >
                  Pop Last Set
                </Button>
              </Grid>

              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  color="secondary"
                  fullWidth
                  onClick={handleGenerateAnalysis}
                  sx={{ 
                    fontWeight: 500,
                    textTransform: 'none',
                    borderColor: grey[300],
                    color: grey[600],
                    '&:hover': { 
                      borderColor: grey[400],
                      backgroundColor: grey[50]
                    }
                  }}
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

          <Card elevation={0} sx={{
            marginTop: '24px',
            backgroundColor: grey[50],
            border: `1px solid ${grey[200]}`,
            borderRadius: 2,
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#2c2c2c', fontWeight: 500 }}>
                Add a New Exercise
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={8}>
                  <TextField
                    fullWidth
                    label="New Exercise"
                    value={newExercise}
                    onChange={(e) => setNewExercise(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#ffffff',
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: grey[400],
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: grey[600],
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={4}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleAddExercise}
                    sx={{ 
                      fontWeight: 500,
                      textTransform: 'none',
                      boxShadow: 'none',
                      height: '56px',
                      '&:hover': { 
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)' 
                      }
                    }}
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
