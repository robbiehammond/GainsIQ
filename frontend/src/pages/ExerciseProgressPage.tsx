import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateWorkoutForm } from '../store/slices';
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
  ThemeProvider,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { theme } from '../style/theme';
import { client } from '../utils/ApiUtils';

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
import { WorkoutSet } from '../types';

const ExerciseProgressPage: React.FC = () => {
  const [exercises, setExercises] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().subtract(6, 'month'));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());
  const [setsData, setSetsData] = useState<WorkoutSet[]>([]);
  const [chartType, setChartType] = useState<'average' | '1rm'>('average');
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const selectedExercise = useSelector((state: any) => state.workoutForm.selectedExercise);

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
    setsData.reduce(
      (acc, set) => {
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
            cutting: false, // Assuming not cutting by default
          };
        }

        const weight = set.weight ? set.weight : 0;
        const reps = set.reps ? set.reps : 0;
        acc[dateKey].totalWeight += parseFloat(weight.toString());
        acc[dateKey].totalReps += parseInt(reps.toString());
        acc[dateKey].setCount += 1;

        // Mark the day as "cutting" if any set has weight_modulation === 'cutting'
        console.log(set.weight_modulation);
        if (set.weight_modulation === "Cutting") {
          acc[dateKey].cutting = true;
        }
        return acc;
      },
      {} as Record<
        string,
        { date: string; totalWeight: number; totalReps: number; setCount: number; cutting: boolean }
      >
    )
  ).map((group) => {
    const avgWeight = group.totalWeight / group.setCount;
    const avgReps = group.totalReps / group.setCount;
    // Brzycki formula for estimated 1RM
    const estimated1RM = avgReps > 0 ? avgWeight / (1.0278 - 0.0278 * avgReps) : 0;
    return {
      date: group.date,
      avgWeight,
      avgReps,
      estimated1RM,
      cutting: group.cutting, // pass the flag through
    };
  });

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
            Exercise Progress
          </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>

          <Grid item xs={12} sm={6}>
            <FormControl 
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
            >
              <InputLabel>Exercise</InputLabel>
              <Select
                label="Exercise"
                      value={selectedExercise}
                      onChange={(e) => dispatch(updateWorkoutForm({ selectedExercise: e.target.value }))}
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
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleFetch}
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
              Fetch Data
            </Button>
          </Grid>

          {error && (
            <Grid item xs={12}>
              <Typography color="error">{error}</Typography>
            </Grid>
          )}
        </Grid>

        <Typography variant="h5" sx={{ marginTop: 4, marginBottom: 2, color: '#2c2c2c' }}>
          Weight &amp; Reps Over Time
        </Typography>
        <Grid item xs={12} sx={{ mb: 2 }}>
          <Button
            variant={chartType === 'average' ? 'contained' : 'outlined'}
            onClick={() => setChartType('average')}
            sx={{ 
              marginRight: 2,
              fontWeight: 500,
              textTransform: 'none',
              ...(chartType === 'average' ? {
                boxShadow: 'none',
                '&:hover': { 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)' 
                }
              } : {
                borderColor: grey[300],
                color: grey[600],
                '&:hover': { 
                  borderColor: grey[400],
                  backgroundColor: grey[50]
                }
              })
            }}
          >
            Avg Weight/Reps
          </Button>
          <Button
            variant={chartType === '1rm' ? 'contained' : 'outlined'}
            onClick={() => setChartType('1rm')}
            sx={{ 
              fontWeight: 500,
              textTransform: 'none',
              ...(chartType === '1rm' ? {
                boxShadow: 'none',
                '&:hover': { 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)' 
                }
              } : {
                borderColor: grey[300],
                color: grey[600],
                '&:hover': { 
                  borderColor: grey[400],
                  backgroundColor: grey[50]
                }
              })
            }}
          >
            Estimated 1RM
          </Button>
        </Grid>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            {chartType === 'average' ? (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="1 1" stroke={grey[300]} strokeOpacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: grey[600] }}
                />
                <YAxis
                  yAxisId="left"
                  label={{ value: 'Avg Weight', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: grey[600] } }}
                  domain={['dataMin - 10', 'dataMax + 10']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: grey[600] }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  label={{ value: 'Avg Reps', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: grey[600] } }}
                  domain={['dataMin - 1', 'dataMax + 1']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: grey[600] }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: `1px solid ${grey[300]}`,
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgWeight"
                  stroke="#3b82f6"
                  name="Avg Weight"
                  strokeWidth={2.5}
                    dot={(props) => {
                    const { cx, cy, payload } = props;
                    const fillColor = payload.cutting ? '#ef4444' : '#3b82f6';
                    return <circle cx={cx} cy={cy} r={5} fill={fillColor} strokeWidth={0} />;
                  }}
                  activeDot={{ r: 7, fill: '#3b82f6', strokeWidth: 0 }}
                />
                <Bar
                  yAxisId="right"
                  dataKey="avgReps"
                  fill="#10b981"
                  name="Avg Reps"
                  fillOpacity={0.7}
                />
              </ComposedChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="1 1" stroke={grey[300]} strokeOpacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: grey[600] }}
                />
                <YAxis
                  label={{ value: 'Estimated 1RM', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: grey[600] } }}
                  domain={['dataMin - 10', 'dataMax + 10']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: grey[600] }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: `1px solid ${grey[300]}`,
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="estimated1RM"
                  stroke="#8b5cf6"
                  name="Estimated 1RM"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const fillColor = payload.cutting ? '#ef4444' : '#8b5cf6';
                    return <circle cx={cx} cy={cy} r={5} fill={fillColor} strokeWidth={0} />;
                  }}
                  activeDot={{ r: 7, fill: '#8b5cf6', strokeWidth: 0 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
      </div>
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default ExerciseProgressPage;