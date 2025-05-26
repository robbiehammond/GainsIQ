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
        <Paper elevation={3} sx={{ padding: '20px', backgroundColor: theme.palette.background.default }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              <StaticDatePicker
                value={selectedDate}
                onChange={(newValue) => {
                  if (newValue) {
                    setSelectedDate(newValue);
                  }
                }}
              />
            </Box>
          </LocalizationProvider>
          <Typography variant="h4" align="center" gutterBottom>
            See Previous Workouts
          </Typography>

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
                        elevation={1}
                        sx={{
                          padding: '10px',
                          marginBottom: '10px',
                          transition: 'box-shadow 0.3s',
                          '&:hover': { boxShadow: 6 },
                        }}
                      >
                        <Typography variant="h6">{setItem.exercise}</Typography>
                        <TextField
                          label="Reps"
                          value={editingValues.reps}
                          onChange={(e) => handleChange('reps', e.target.value)}
                          fullWidth
                          sx={{ marginBottom: '10px' }}
                        />
                        <TextField
                          label="Set Number"
                          type="number"
                          value={editingValues.setNumber}
                          onChange={(e) => handleChange('setNumber', Number(e.target.value))}
                          fullWidth
                          sx={{ marginBottom: '10px' }}
                        />
                        <TextField
                          label={"Weight " + unit}
                          type="number"
                          value={toDisplayWeight(editingValues.weight, unit)}
                          onChange={(e) => handleChange('weight', toLbsFromDisplay(e.target.value, unit))}
                          fullWidth
                          sx={{ marginBottom: '10px' }}
                        />
                        <Button variant="contained" color="primary" onClick={saveEdits} sx={{ marginRight: '10px' }}>
                          Save
                        </Button>
                        <Button variant="outlined" onClick={cancelEditing}>
                          Cancel
                        </Button>
                      </Paper>
                    );
                  }
                  return (
                    <Paper
                      key={idx}
                      elevation={1}
                      sx={{
                        padding: '10px',
                        marginBottom: '10px',
                        transition: 'box-shadow 0.3s',
                        '&:hover': { boxShadow: 6 },
                      }}
                    >
                      <Typography variant="h6">{setItem.exercise}</Typography>
                      <Typography>
                        Set #: {setItem.setNumber}, Reps: {setItem.reps}, Weight: {toDisplayWeight(setItem.weight, unit)} {unit}
                      </Typography>
                      <Typography>
                        Time: {new Date((setItem.timestamp || 0) * 1000).toLocaleString()}
                      </Typography>
                      <Typography>
                        Bulking or Cutting?: {setItem.weight_modulation ?? "Bulking"}
                      </Typography>
                      <Button variant="text" onClick={() => startEditing(setItem)}>
                        Edit
                      </Button>
                      <Button variant="text" color="error" onClick={() => deleteSet(setItem)} startIcon={<DeleteIcon />}>
                        Delete
                      </Button>
                    </Paper>
                  );
                })
              ) : (
                <Typography variant="h6" align="center">
                  No workouts found.
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
