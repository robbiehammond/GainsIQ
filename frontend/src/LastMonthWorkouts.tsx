import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  CircularProgress,
  Grid,
  TextField,
  Button,
  ThemeProvider,
  Box,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker';
// Removed Accordion and grouping components for direct list display
import { theme } from './style/theme';
import { Set, SetUtils } from './models/Set';
import { apiUrl, client } from './utils/ApiUtils';
import DeleteIcon from '@mui/icons-material/Delete'; 
import { useSelector } from 'react-redux';
import { RootState } from './utils/types';
import dayjs, { Dayjs } from 'dayjs';

/** 
 * storing everything as lbs internally because the backend uses lbs.
 */
const lbsToKgs = (lbs: number): number => lbs * 0.45359237;
const kgsToLbs = (kgs: number): number => kgs / 0.45359237;

const toDisplayWeight = (weightInLbs: number, unit: string): string => {
  if (unit === 'kg') {
    return lbsToKgs(weightInLbs).toFixed(2); 
  }
  return weightInLbs.toString(); 
};

const toLbsFromDisplay = (displayValue: string, unit: string): number => {
  const typed = Number(displayValue);
  if (unit === 'kg') {
    return kgsToLbs(typed);
  }
  return typed;
};

const LastMonthWorkouts: React.FC = () => {
  const unit = useSelector((state: RootState) => state.weightUnit.weightUnit); 

  const [sets, setSets] = useState<Set[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());

  const [editingKeys, setEditingKeys] = useState<{workoutId?: string, timestamp?: number}>({});
  const [editingValues, setEditingValues] = useState<Set>({
    exercise: '',
    weight: 0, 
    reps: '',
    setNumber: 0,
    timestamp: 0,
    workoutId: ''
  });

  useEffect(() => {
    const fetchWorkouts = async () => {
      setLoading(true);
      try {
        const startTs = Math.floor(selectedDate.startOf('day').valueOf() / 1000);
        const endTs = Math.floor(selectedDate.endOf('day').valueOf() / 1000);
        const data = await client.getSets({ start: startTs, end: endTs });
        setSets(data.map(SetUtils.fromBackend) || []);
      } catch (error) {
        console.error('Error fetching workouts for date:', error);
        setSets([]);
      }
      setLoading(false);
    };
    fetchWorkouts();
  }, [selectedDate]);

  const startEditing = (set: Set) => {
    setEditingKeys({ workoutId: set.workoutId, timestamp: set.timestamp });
    setEditingValues({ ...set }); 
  };

  const cancelEditing = () => {
    setEditingKeys({});
    setEditingValues({
      exercise: '',
      weight: 0,
      reps: '',
      setNumber: 0,
      timestamp: 0,
      workoutId: ''
    });
  };

  const handleChange = (field: keyof Set, value: string | number) => {
    setEditingValues((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const deleteSet = async (set: Set) => {
    if (!set.workoutId || !set.timestamp) return;
  
    const payload = {
      workoutId: set.workoutId,
      timestamp: Number(set.timestamp),
    };
  
    try {
      const _ = client.deleteSet(payload);
  
      setSets((prevSets) =>
        prevSets.filter(
          (item) =>
            !(item.workoutId === set.workoutId && item.timestamp === set.timestamp)
        )
      );
    } catch (error) {
      console.error('Error deleting set:', error);
    }
  };

  const saveEdits = async () => {
    if (!editingKeys.workoutId || !editingKeys.timestamp) return;

    // The editingValues.weight is stored as lbs, which the backend expects.
    const payload = {
      workoutId: editingKeys.workoutId,
      timestamp: Number(editingKeys.timestamp),
      exercise: editingValues.exercise,
      reps: editingValues.reps,
      sets: Number(editingValues.setNumber),
      weight: Number(editingValues.weight) 
    };

    try {
      const _ = client.editSet(payload);

      // Update local sets state
      setSets((prevSets) =>
        prevSets.map((item) =>
          item.workoutId === editingKeys.workoutId && item.timestamp === editingKeys.timestamp
            ? { ...item, ...editingValues }
            : item
        )
      );

      cancelEditing();
    } catch (error) {
      console.error('Error updating set:', error);
    }
  };


  const isEditing = (set: Set) =>
    editingKeys.workoutId === set.workoutId && editingKeys.timestamp === set.timestamp;

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
            Previous Workouts
          </Typography>
          
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              <StaticDatePicker
                value={selectedDate}
                onChange={(newValue) => {
                  if (newValue) {
                    setSelectedDate(newValue);
                  }
                }}
                sx={{
                  '& .MuiPickersDay-root': {
                    color: '#2c2c2c',
                  },
                  '& .MuiPickersDay-root.Mui-selected': {
                    backgroundColor: '#2c2c2c',
                  }
                }}
              />
            </Box>
          </LocalizationProvider>

          {loading ? (
            <Grid container justifyContent="center">
              <CircularProgress />
            </Grid>
          ) : (
            <>
              {sets.length > 0 ? (
                sets.map((setItem, idx) => {
                  if (isEditing(setItem)) {
                    return (
                      <Paper
                        key={idx}
                        elevation={0}
                        sx={{
                          padding: '20px',
                          marginBottom: '12px',
                          backgroundColor: grey[50],
                          border: `1px solid ${grey[200]}`,
                          borderRadius: 2,
                          transition: 'border-color 0.2s',
                          '&:hover': { 
                            borderColor: grey[300],
                          },
                        }}
                      >
                        <Typography variant="h6" sx={{ mb: 2, color: '#2c2c2c' }}>{setItem.exercise}</Typography>
                        <TextField
                          label="Reps"
                          value={editingValues.reps}
                          onChange={(e) => handleChange('reps', e.target.value)}
                          fullWidth
                          sx={{ 
                            marginBottom: '12px',
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
                        <TextField
                          label="Set Number"
                          type="number"
                          value={editingValues.setNumber}
                          onChange={(e) => handleChange('setNumber', Number(e.target.value))}
                          fullWidth
                          sx={{ 
                            marginBottom: '12px',
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
                        <TextField
                          label={"Weight " + unit}
                          type="number"
                          value={toDisplayWeight(editingValues.weight, unit)}
                          onChange={(e) => handleChange('weight', toLbsFromDisplay(e.target.value, unit))}
                          fullWidth
                          sx={{ 
                            marginBottom: '16px',
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
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button 
                            variant="contained" 
                            color="primary" 
                            onClick={saveEdits}
                            sx={{ 
                              fontWeight: 500,
                              textTransform: 'none',
                              boxShadow: 'none',
                              '&:hover': { 
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)' 
                              }
                            }}
                          >
                            Save
                          </Button>
                          <Button 
                            variant="outlined" 
                            onClick={cancelEditing}
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
                            Cancel
                          </Button>
                        </Box>
                      </Paper>
                    );
                  }
                  return (
                    <Paper
                      key={idx}
                      elevation={0}
                      sx={{
                        padding: '16px',
                        marginBottom: '8px',
                        backgroundColor: '#ffffff',
                        border: `1px solid ${grey[200]}`,
                        borderRadius: 1,
                        transition: 'border-color 0.2s',
                        '&:hover': { 
                          borderColor: grey[300],
                        },
                      }}
                    >
                      <Typography variant="h6" sx={{ mb: 1, color: '#2c2c2c', fontWeight: 500 }}>
                        {setItem.exercise}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Set #{setItem.setNumber} • {setItem.reps} reps • {toDisplayWeight(setItem.weight, unit)} {unit}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {new Date((setItem.timestamp || 0) * 1000).toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {setItem.weight_modulation ?? "Bulking"}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button 
                          variant="text" 
                          onClick={() => startEditing(setItem)}
                          sx={{ 
                            fontWeight: 500,
                            textTransform: 'none',
                            color: '#2c2c2c',
                            '&:hover': { 
                              backgroundColor: grey[50]
                            }
                          }}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="text" 
                          color="error" 
                          onClick={() => deleteSet(setItem)} 
                          startIcon={<DeleteIcon />}
                          sx={{ 
                            fontWeight: 500,
                            textTransform: 'none',
                            '&:hover': { 
                              backgroundColor: '#ffebee'
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </Paper>
                  );
                })
              ) : (
                <Typography variant="h6" align="center" color="text.secondary" sx={{ fontStyle: 'italic', py: 4 }}>
                  No workouts found for this date.
                </Typography>
              )}
            </>
          )}
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default LastMonthWorkouts;
