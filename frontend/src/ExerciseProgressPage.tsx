import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Button,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import { useApi } from './utils/ApiUtils';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface WorkoutSet {
  workoutId?: string;
  exercise?: string;
  reps?: string;  
  sets?: string;  
  weight?: string;
  timestamp?: string;  
}

const ExerciseProgressPage: React.FC = () => {
  const { fetchData } = useApi();

  const [exercises, setExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().subtract(14, 'day')); 
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());
  const [setsData, setSetsData] = useState<WorkoutSet[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadExercises = async () => {
      try {
        const response = await fetchData<string[]>('/exercises', { method: 'GET' });
        let data: string[];
        if (typeof response === 'string') {
          data = JSON.parse(response);
        } else {
          data = response || [];
        }
        setExercises(data);
      } catch (err) {
        console.error('Error fetching exercises:', err);
        setExercises([]);
      }
    };

    loadExercises();
  }, [fetchData]);

  const dateToUnix = (d: Dayjs | null): number => {
    return d ? d.unix() : 0; 
  };

  const handleFetch = async () => {
    setError('');

    if (!selectedExercise) {
      setError('Please select an exercise first.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Please pick both start and end dates.');
      return;
    }

    try {
      // Convert dayjs to Unix timestamps
      const startTs = dateToUnix(startDate);
      const endTs = dateToUnix(endDate);

      const queryParams = new URLSearchParams({
        exerciseName: selectedExercise,
        start: startTs.toString(),
        end: endTs.toString(),
      }).toString();

      const response = await fetchData<WorkoutSet[]>(
        `/sets/by_exercise?${queryParams}`,
        { method: 'GET' }
      );

      let parsed: WorkoutSet[];
      if (typeof response === 'string') {
        parsed = JSON.parse(response);
      } else {
        parsed = response || [];
      }
      setSetsData(parsed);
    } catch (err) {
      console.error('Error fetching sets by exercise:', err);
      setError('Failed to fetch sets. See console for details.');
    }
  };

  const chartData = Object.values(
    setsData.reduce((acc, set) => {
      const dateKey = set.timestamp
        ? new Date(parseInt(set.timestamp) * 1000).toLocaleDateString()
        : '';

      if (!dateKey) return acc;

      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          totalWeight: 0,
          totalReps: 0,
          setCount: 0,
        };
      }

      // Increment totals
      const weight = set.weight ? parseFloat(set.weight) : 0;
      const reps = set.reps ? parseInt(set.reps) : 0;

      acc[dateKey].totalWeight += weight;
      acc[dateKey].totalReps += reps;
      acc[dateKey].setCount += 1;

      return acc;
    }, {} as Record<string, { date: string; totalWeight: number; totalReps: number; setCount: number }>)
  ).map((group) => ({
    date: group.date,
    avgWeight: group.totalWeight / group.setCount,
    avgReps: group.totalReps / group.setCount,
  }));
  return (
    <Container maxWidth="md" sx={{ padding: '20px' }}>
      <Paper elevation={3} sx={{ padding: '20px' }}>
        <Typography variant="h4" gutterBottom>
          Exercise Progress
        </Typography>

        <Grid container spacing={2}>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Exercise</InputLabel>
              <Select
                label="Exercise"
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
              >
                <MenuItem value="">
                  <em>-- Select an Exercise --</em>
                </MenuItem>
                {exercises.map((ex, idx) => (
                  <MenuItem key={idx} value={ex}>
                    {ex}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={3}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker<Dayjs>
                label="Start Date"
                value={startDate}
                onChange={(newVal) => setStartDate(newVal)}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} sm={3}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newVal) => setEndDate(newVal)}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Button variant="contained" color="primary" onClick={handleFetch}>
              Fetch Data
            </Button>
          </Grid>

          {error && (
            <Grid item xs={12}>
              <Typography color="error">{error}</Typography>
            </Grid>
          )}
        </Grid>

        <Typography variant="h6" sx={{ marginTop: 3 }}>
          Weight &amp; Reps Over Time
        </Typography>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            {/* Y-axis for reps */}
            <YAxis
              yAxisId="right"
              orientation="right"
              label={{ value: 'Avg Reps', angle: 90, position: 'insideRight' }}
            />
            
            {/* Y-axis for weight */}
            <YAxis
              yAxisId="left"
              label={{ value: 'Avg Weight', angle: -90, position: 'insideLeft' }}
              domain={['dataMin - 10', 'dataMax + 10']} 
            />

            <Tooltip />
            <Legend />

            {/* Line for avg weight */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="avgWeight"
              stroke="#8884d8"
              name="Avg Weight"
              activeDot={{ r: 8 }}
            />

            {/* Bar for avg reps */}
            <Bar
              yAxisId="right"
              dataKey="avgReps"
              fill="#82ca9d"
              name="Avg Reps"
              fillOpacity={0.5} 
            />
          </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Paper>
    </Container>
  );
};

export default ExerciseProgressPage;