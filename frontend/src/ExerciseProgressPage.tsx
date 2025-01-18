import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Grid,
} from '@mui/material';
import { useApi } from './utils/ApiUtils'; // Or wherever your hook is located
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface WorkoutSet {
  workoutId?: string;
  exercise?: string;
  reps?: string;
  sets?: string;
  weight?: string;      // We'll treat these as strings, but parse them
  timestamp?: string;   // stored as a string. We'll parse it as a number
}

const ExerciseProgressPage: React.FC = () => {
  const { fetchData } = useApi();

  const [exerciseName, setExerciseName] = useState('');
  const [start, setStart] = useState('0');         // as a string, or maybe '1698787200'
  const [end, setEnd] = useState('9999999999');    // big default
  const [setsData, setSetsData] = useState<WorkoutSet[]>([]);
  const [error, setError] = useState('');

  const handleFetch = async () => {
    setError('');
    try {
      // Example: GET /sets/by_exercise?exerciseName=Bench%20Press&start=1698787200&end=1699488399
      const queryParams = new URLSearchParams({
        exerciseName: exerciseName,
        start: start,
        end: end,
      }).toString();

      const response = await fetchData(`/sets/by_exercise?${queryParams}`, {
        method: 'GET',
      });
      // Our backend returns a JSON array of sets
      // We'll store that in setsData
      setSetsData(response);
    } catch (err: any) {
      console.error('Error fetching sets by exercise:', err);
      setError('Failed to fetch sets. See console for details.');
    }
  };

  // Convert your setsData to something Recharts-friendly, e.g. { time, weight }
  // We'll also parse the string fields to numbers where appropriate
  const chartData = setsData.map(s => ({
    time: s.timestamp ? new Date(parseInt(s.timestamp) * 1000).toLocaleDateString() : '',
    weight: s.weight ? parseFloat(s.weight) : 0,
    reps: s.reps ? parseInt(s.reps) : 0,
  }));

  return (
    <Container maxWidth="md" sx={{ padding: '20px' }}>
      <Paper elevation={3} sx={{ padding: '20px' }}>
        <Typography variant="h4" gutterBottom>
          Exercise Progress
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Exercise Name"
              variant="outlined"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              label="Start Timestamp"
              variant="outlined"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              label="End Timestamp"
              variant="outlined"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              fullWidth
            />
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
          Chart
        </Typography>
        <div style={{ width: '100%', height: 400 }}>
          {/* We use ResponsiveContainer so the chart scales automatically */}
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Paper>
    </Container>
  );
};

export default ExerciseProgressPage;