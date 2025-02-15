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
import { client } from './utils/ApiUtils';

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
  LineChart,
} from 'recharts';
import { WorkoutSet } from 'gainsiq-sdk';

const ExerciseProgressPage: React.FC = () => {
  const [exercises, setExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().subtract(6, 'month')); 
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());
  const [setsData, setSetsData] = useState<WorkoutSet[]>([]);
  const [chartType, setChartType] = useState<'average' | '1rm'>('average');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadExercises = async () => {
      try {
        const response = await client.getExercises();
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
  }, []);

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

      const response = await client.getSetsByExercise({exerciseName: selectedExercise, start: startTs, end: endTs});
      setSetsData(response);
      
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

      const weight = set.weight ? set.weight : 0;
      const reps = set.reps ? set.reps : 0;


      acc[dateKey].totalWeight += parseFloat(weight.toString());
      acc[dateKey].totalReps += parseInt(reps.toString());;
      acc[dateKey].setCount += 1;
      console.log(acc[dateKey].totalWeight);
      return acc;
    }, {} as Record<string, { date: string; totalWeight: number; totalReps: number; setCount: number }>)
  ).map((group) => {
    const avgWeight = group.totalWeight / group.setCount;
    const avgReps = group.totalReps / group.setCount;

    // Brzycki formula for estimated 1RM. Not because the actual 1RM matters, but because it's a good indicator of progress
    const estimated1RM = avgReps > 0 ? avgWeight / (1.0278 - 0.0278 * avgReps) : 0;

    return {
      date: group.date,
      avgWeight,
      avgReps,
      estimated1RM, 
    };
  });

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
        <Grid item xs={12}>
          <Button
            variant={chartType === 'average' ? 'contained' : 'outlined'}
            onClick={() => setChartType('average')}
            sx={{ marginRight: 2 }}
          >
            Avg Weight/Reps
          </Button>
          <Button
            variant={chartType === '1rm' ? 'contained' : 'outlined'}
            onClick={() => setChartType('1rm')}
          >
            Estimated 1RM
          </Button>
        </Grid>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            {chartType === 'average' ? (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis
                  yAxisId="left"
                  label={{ value: 'Avg Weight', angle: -90, position: 'insideLeft' }}
                  domain={['dataMin - 10', 'dataMax + 10']}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  label={{ value: 'Avg Reps', angle: 90, position: 'insideRight' }}
                  domain={['dataMin - 1', 'dataMax + 1']}
                />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgWeight"
                  stroke="#8884d8"
                  name="Avg Weight"
                  activeDot={{ r: 8 }}
                />
                <Bar
                  yAxisId="right"
                  dataKey="avgReps"
                  fill="#82ca9d"
                  name="Avg Reps"
                  fillOpacity={0.5}
                />
              </ComposedChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis
                  label={{ value: 'Estimated 1RM', angle: -90, position: 'insideLeft' }}
                  domain={['dataMin - 10', 'dataMax + 10']}
                />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="estimated1RM"
                  stroke="#ff7300"
                  name="Estimated 1RM"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
      </div>
      </Paper>
    </Container>
  );
};

export default ExerciseProgressPage;